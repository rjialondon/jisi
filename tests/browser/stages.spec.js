import { test, expect } from "@playwright/test";

const 台名 = ["太 极", "周 天", "卦 台"];
async function 开台(page, 名) {
  await page.getByRole("navigation").getByRole("button", { name: 名, exact: true }).click();
  await expect(page.locator(".stage-hud")).not.toContainText("读取中");
  await page.getByRole("button", { name: "☰ 控制台" }).click();
  if (名 === "太 极") await page.getByRole("button", { name: "▸ 视角", exact: true }).click();
}
async function 锁台(page) {
  const 键 = page.getByRole("button", { name: "自转 · 开", exact: true });
  if (await 键.count()) await 键.click();
}
async function 读距(page) {
  return Number((await page.locator(".stage-hud").innerText()).match(/距 ([\d.]+)/)[1]);
}
async function 拖动(page, x = 620, y = 420) {
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x + 60, y + 25, { steps: 5 }); await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__绘数 = 0;
    window.__页面错误 = [];
    window.addEventListener("error", (事) => window.__页面错误.push(事.message));
    for (const 类 of [WebGLRenderingContext, WebGL2RenderingContext]) {
      for (const 名 of ["drawElements", "drawArrays"]) {
        const 原 = 类.prototype[名];
        类.prototype[名] = function (...参) { window.__绘数++; return 原.apply(this, 参); };
      }
    }
  });
  await page.goto("/");
  await expect(page.locator(".stage-hud")).not.toContainText("读取中");
});
test.afterEach(async ({ page }) => {
  expect(await page.evaluate(() => window.__页面错误)).toEqual([]);
});

test("三台静止停绘，拖动、滚轮、图层切换仍立即生效", async ({ page }) => {
  for (const 名 of 台名) {
    if (名 === "太 极") {
      await page.getByRole("button", { name: "☰ 控制台" }).click();
      await page.getByRole("button", { name: "▸ 视角", exact: true }).click();
    } else await 开台(page, 名);
    await 锁台(page);
    await page.waitForTimeout(150);
    const 绘数 = await page.evaluate(() => window.__绘数);
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => window.__绘数)).toBe(绘数);
    const 旧仪表 = await page.locator(".stage-hud").innerText();
    await 拖动(page);
    await expect(page.locator(".stage-hud")).not.toHaveText(旧仪表);
    const 距 = await 读距(page);
    await page.mouse.wheel(0, -180);
    await expect.poll(() => 读距(page)).toBeLessThan(距);
    if (名 === "太 极") await page.getByRole("button", { name: "▸ 图层", exact: true }).click();
    const 前 = await page.evaluate(() => window.__绘数);
    await page.getByRole("button", { name: /^0 ·/ }).click();
    await expect.poll(() => page.evaluate(() => window.__绘数)).toBeGreaterThan(前);
    if (名 !== "太 极") {
      await page.getByRole("slider", { name: "观察距离" }).fill("12");
      await expect.poll(() => 读距(page)).toBe(12);
    }
  }
});

test("大挪移可撤销，全台复位同时清镜像、恢复自转和图层", async ({ page }) => {
  await 开台(page, "卦 台"); await 锁台(page); await 拖动(page);
  await page.getByRole("slider", { name: "观察距离" }).fill("12");
  await expect.poll(() => 读距(page)).toBe(12);
  const 原仪表 = await page.locator(".stage-hud").innerText();
  const 原图 = await page.locator(".stage > div:last-child > canvas").screenshot();
  const 挪移 = page.getByRole("button", { name: /乾坤大挪移/ });
  await 挪移.click(); await expect(page.locator(".stage-hud")).toContainText("地 +1.000");
  await 挪移.click(); await expect(page.locator(".stage-hud")).toHaveText(原仪表);
  expect(await page.locator(".stage > div:last-child > canvas").screenshot()).toEqual(原图);
  await expect(page.getByRole("button", { name: "视角锁定 🔒", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "视角锁定 🔒", exact: true }).click();
  await 挪移.click(); await 挪移.click();
  await expect(page.getByRole("button", { name: "自转 · 开", exact: true })).toBeVisible();
  await 挪移.click(); await page.getByRole("button", { name: /^1 ·/ }).click();
  await page.getByRole("button", { name: "⟲ 全台复位", exact: true }).click();
  await expect(挪移).not.toContainText("已施");
  await expect(page.getByRole("button", { name: "自转 · 开", exact: true })).toBeVisible();
  await expect.poll(() => 读距(page)).toBeCloseTo(Math.hypot(4.2, 3.2, 5.2), 1);
  await expect(page.getByRole("button", { name: /^1 ·/ })).toHaveCSS("background-color", "rgb(58, 51, 36)");
  await expect(page.locator(".stage canvas")).toHaveCount(3);
});

test("圆化只用于显影机位，转向、换机位、自转、复位均关闭", async ({ page }) => {
  await page.getByRole("button", { name: "☰ 控制台" }).click();
  await page.getByRole("button", { name: "▸ 视角", exact: true }).click();
  const 圆化 = page.getByRole("button", { name: /⊕ 圆化/ });
  const 显影 = page.getByRole("button", { name: /机位1 · 显影/ });
  await expect(圆化).toBeDisabled();
  for (const 动作 of ["换位", "拖动", "自转", "复位"]) {
    await 显影.click(); await expect(圆化).toBeEnabled(); await 圆化.click();
    await expect(page.getByRole("status")).toContainText("非原始比例");
    if (动作 === "换位") await page.getByRole("button", { name: /机位2 · 分体/ }).click();
    if (动作 === "拖动") await 拖动(page);
    if (动作 === "自转") await page.getByRole("button", { name: "视角锁定 🔒", exact: true }).click();
    if (动作 === "复位") await page.getByRole("button", { name: "⟲ 全台复位", exact: true }).click();
    await expect(圆化).toBeDisabled(); await expect(page.getByRole("status")).toHaveCount(0);
    await expect(page.locator(".stage > div:last-child > canvas")).toHaveCSS("transform", "none");
  }
});

test("三台真实双指捏合及余下一指旋转", async ({ page, context }) => {
  const cdp = await context.newCDPSession(page);
  const 触 = (type, points) => cdp.send("Input.dispatchTouchEvent", {
    type, touchPoints: points.map(([id, x, y]) => ({ id, x, y })),
  });
  for (const 名 of 台名) {
    if (名 === "太 极") {
      await page.getByRole("button", { name: "☰ 控制台" }).click();
      await page.getByRole("button", { name: "▸ 视角", exact: true }).click();
    } else await 开台(page, 名);
    await 锁台(page);
    const 原距 = await 读距(page);
    await 触("touchStart", [[0, 480, 400], [1, 680, 400]]);
    await 触("touchMove", [[0, 430, 400], [1, 730, 400]]);
    await expect.poll(() => 读距(page)).toBeLessThan(原距 * 0.8);
    // CDP 用下一份仍在接触的点集表达单指离开；touchEnd 会结束整组触摸。
    await 触("touchMove", [[0, 430, 400]]);
    const 原仪表 = await page.locator(".stage-hud").innerText();
    await 触("touchMove", [[0, 480, 430]]);
    await expect(page.locator(".stage-hud")).not.toHaveText(原仪表);
    await 触("touchCancel", []);
    await 拖动(page);
  }
});

test("窄屏及横屏控制区不互相遮挡，连续切台保持单个 WebGL 画布", async ({ page }, testInfo) => {
  for (const viewport of [{ width: 375, height: 812 }, { width: 740, height: 390 }]) {
    await page.setViewportSize(viewport);
    for (const 名 of 台名) {
      await page.getByRole("navigation").getByRole("button", { name: 名, exact: true }).click();
      const 导航 = await page.locator(".stage-nav").boundingBox();
      const 仪表 = await page.locator(".stage-hud").boundingBox();
      expect(仪表.y + 仪表.height).toBeLessThan(导航.y);
      for (const 按钮 of await page.getByRole("navigation").getByRole("button").all()) {
        expect((await 按钮.boundingBox()).height).toBeLessThanOrEqual(44);
      }
      if (名 !== "太 极") {
        const 缩放 = await page.locator(".stage-zoom").boundingBox();
        expect(缩放.y + 缩放.height).toBeLessThan(仪表.y);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
      if (名 === "卦 台" && viewport.height < 520) {
        const 拆半盘 = await page.locator(".gua-split-after").boundingBox();
        expect(拆半盘.y + 拆半盘.height).toBeLessThan(仪表.y);
      }
    }
    await page.screenshot({ path: testInfo.outputPath(`layout-${viewport.width}.png`) });
  }
  for (let i = 0; i < 12; i++) {
    await page.getByRole("navigation").getByRole("button", { name: 台名[i % 3], exact: true }).click();
    await expect(page.locator(".stage > div:last-child > canvas")).toHaveCount(1);
    await expect(page.locator(".stage-hud")).not.toContainText("读取中");
  }
});

test("锁定视角后引擎可独立点火、熄火，全台复位恢复默认开关", async ({ page }) => {
  await page.getByRole("button", { name: "☰ 控制台" }).click();
  await page.getByRole("button", { name: "▸ 视角", exact: true }).click();
  await 锁台(page);
  await page.getByRole("button", { name: /^▸ 引擎/ }).click();
  const 原 = await page.locator(".stage > div:last-child > canvas").screenshot();
  await page.getByRole("button", { name: "点火", exact: true }).click();
  await page.waitForTimeout(200);
  expect(await page.locator(".stage > div:last-child > canvas").screenshot()).not.toEqual(原);
  await page.getByRole("button", { name: "运转中 ☯ 点击熄火", exact: true }).click();
  await page.waitForTimeout(150);
  const 绘数 = await page.evaluate(() => window.__绘数);
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => window.__绘数)).toBe(绘数);
  await page.getByRole("button", { name: "▸ 视角", exact: true }).click();
  await page.getByRole("button", { name: "⟲ 全台复位", exact: true }).click();
  await expect(page.getByRole("button", { name: "自转 · 开", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^▸ 引擎/ }).click();
  await expect(page.getByRole("button", { name: "点火", exact: true })).toBeVisible();
});
