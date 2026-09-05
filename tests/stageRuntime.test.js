import { beforeEach, afterEach, test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { 积分余速, 建立台控, 释放场景 } from "../src/shared/stageRuntime.js";

let 帧册, 帧号, 收台, 原全局;
class 画布 extends EventTarget {
  style = {};
  捕获 = new Set();
  setAttribute() {}
  remove() { this.已移除 = true; }
  setPointerCapture(号) { this.捕获.add(号); }
  hasPointerCapture(号) { return this.捕获.has(号); }
  releasePointerCapture(号) { this.捕获.delete(号); }
}
beforeEach(() => {
  原全局 = Object.fromEntries(["window", "document", "ResizeObserver", "requestAnimationFrame", "cancelAnimationFrame"].map((键) => [键, globalThis[键]]));
  帧册 = new Map(); 帧号 = 0; 收台 = [];
  globalThis.window = new EventTarget();
  globalThis.document = Object.assign(new EventTarget(), { hidden: false });
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
  globalThis.requestAnimationFrame = (法) => { 帧册.set(++帧号, 法); return 帧号; };
  globalThis.cancelAnimationFrame = (号) => 帧册.delete(号);
});
afterEach(() => {
  收台.forEach((收) => 收());
  for (const [键, 值] of Object.entries(原全局)) {
    if (值 === undefined) delete globalThis[键]; else globalThis[键] = 值;
  }
});
function 拍(时) {
  const 待行 = [...帧册.values()]; 帧册.clear();
  待行.forEach((法) => 法(时));
}
function 起台(自转 = false, 行功 = () => {}) {
  const scene = new THREE.Scene(), world = new THREE.Group(); scene.add(world);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(4.2, 3.2, 5.2); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const renderer = { domElement: new 画布(), 绘数: 0, render() { this.绘数++; }, setSize() {}, dispose() {}, forceContextLoss() {} };
  const autoSpinRef = { current: 自转 }, hudRef = { current: { textContent: "" } };
  const 台控 = 建立台控({ mount: { clientWidth: 800, clientHeight: 600 }, scene, world, camera, renderer, autoSpinRef, hudRef, 行功 });
  收台.push(() => 台控.收台());
  return { 台控, world, camera, renderer, autoSpinRef, hudRef };
}
function 指(台, 名, 号, x = 200, y = 200) {
  台.renderer.domElement.dispatchEvent(Object.assign(new Event(名), { pointerId: 号, clientX: x, clientY: y, pointerType: "touch" }));
}

test("60 / 120 / 144 Hz 同时长余速积分一致", () => {
  const 果 = [60, 120, 144].map((频) => {
    let 速度 = 0.24, 角度 = 0;
    for (let i = 0; i < 频 * 5; i++) {
      const 步 = 积分余速(速度, 1 / 频, 0.09); 速度 = 步.速度; 角度 += 步.角度;
    }
    return 角度;
  });
  for (const 角 of 果) assert.ok(Math.abs(角 - 果[0]) < 1e-12);
});
test("真实台控在不同刷新率下的机位及引擎行时相同", () => {
  const 果 = [60, 120, 144].map((频) => {
    let 相位 = 0;
    const 台 = 起台(true, (秒) => { 相位 += -0.6 * 秒; });
    拍(0);
    for (let i = 1; i <= 频 * 2; i++) 拍(i * 1000 / 频);
    const 姿态 = 台.world.quaternion.clone(); 台.台控.收台();
    return { 姿态, 相位 };
  });
  for (const 枚 of 果) {
    assert.ok(枚.姿态.angleTo(果[0].姿态) < 1e-7);
    assert.ok(Math.abs(枚.相位 + 1.2) < 1e-12);
  }
});
test("静台没有空转帧，唤醒合并，隐藏停止、回来不补跳", () => {
  let 行时 = 0;
  const 台 = 起台(false, (秒) => { 行时 += 秒; });
  拍(0); assert.equal(帧册.size, 0);
  台.台控.唤醒(); 台.台控.唤醒(); assert.equal(帧册.size, 1);
  拍(20000); assert.equal(行时, 0); assert.equal(帧册.size, 0);
  台.autoSpinRef.current = true; 台.台控.唤醒(); 拍(21000);
  document.hidden = true; document.dispatchEvent(new Event("visibilitychange"));
  assert.equal(帧册.size, 0);
  document.hidden = false; document.dispatchEvent(new Event("visibilitychange"));
  拍(60000); assert.equal(行时, 0);
  台.autoSpinRef.current = false; 拍(60016); assert.equal(帧册.size, 0);
});
test("双指缩放后单指可立即旋转，取消和失焦会放开手势", () => {
  const 台 = 起台(); 拍(0); const 原距 = 台.camera.position.length();
  指(台, "pointerdown", 1, 200, 200); 指(台, "pointerdown", 2, 300, 200);
  指(台, "pointermove", 2, 350, 200);
  assert.ok(Math.abs(台.camera.position.length() - 原距 * 100 / 150) < 1e-10);
  指(台, "pointerup", 2, 350, 200);
  const 旧姿 = 台.world.quaternion.clone(); 指(台, "pointermove", 1, 220, 200);
  assert.ok(台.world.quaternion.angleTo(旧姿) > 0.1);
  指(台, "pointercancel", 1); const 已止 = 台.world.quaternion.clone();
  指(台, "pointermove", 1, 290, 200); assert.deepEqual(台.world.quaternion.toArray(), 已止.toArray());
  指(台, "pointerdown", 3); window.dispatchEvent(new Event("blur"));
  assert.equal(台.renderer.domElement.捕获.size, 0);
  指(台, "pointermove", 3, 250, 200); assert.deepEqual(台.world.quaternion.toArray(), 已止.toArray());
  // 两指重合不得把距离写成无穷或 NaN。
  指(台, "pointerdown", 4); 指(台, "pointerdown", 5);
  指(台, "pointermove", 5); assert.ok(Number.isFinite(台.camera.position.length()));
});
test("机位存还保留姿态、自转、距离及余速，复位回出生机位", () => {
  const 台 = 起台(true); 拍(0); 拍(20);
  台.台控.缩放(12); const 旧 = 台.台控.存机位();
  台.world.quaternion.identity(); 台.camera.position.set(7.4, 0, 0); 台.autoSpinRef.current = false;
  台.台控.还机位(旧); const 今 = 台.台控.存机位();
  assert.deepEqual(今, 旧);
  台.台控.复位(); assert.deepEqual(台.camera.position.toArray(), [4.2, 3.2, 5.2]);
  assert.deepEqual(台.world.quaternion.toArray(), [0, 0, 0, 1]);
});
test("共享几何、材质、纹理各释放一次，同时销掉上下文", () => {
  const scene = new THREE.Scene(), 几何 = new THREE.BoxGeometry(), 纹理 = new THREE.Texture();
  const 材质 = new THREE.MeshBasicMaterial({ map: 纹理 });
  scene.add(new THREE.Mesh(几何, 材质), new THREE.Mesh(几何, 材质));
  const 数 = { 几何: 0, 材质: 0, 纹理: 0, 绘器: 0, 上下文: 0 };
  for (const [名, 物] of Object.entries({ 几何, 材质, 纹理 })) 物.addEventListener("dispose", () => 数[名]++);
  const renderer = { domElement: new 画布(), dispose() { 数.绘器++; }, forceContextLoss() { 数.上下文++; } };
  释放场景(scene, renderer);
  assert.deepEqual(数, { 几何: 1, 材质: 1, 纹理: 1, 绘器: 1, 上下文: 1 });
  assert.equal(scene.children.length, 0); assert.equal(renderer.domElement.已移除, true);
});
test("收台撤去全部监听和待行帧，旧台不再被事件唤醒", () => {
  const 台 = 起台(true); 拍(0); 台.台控.收台();
  assert.equal(帧册.size, 0);
  指(台, "pointerdown", 1); 指(台, "pointermove", 1, 400, 200);
  document.dispatchEvent(new Event("visibilitychange")); 台.台控.唤醒();
  assert.equal(帧册.size, 0); assert.equal(台.renderer.domElement.捕获.size, 0);
});
