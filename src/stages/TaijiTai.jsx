import React, { useRef, useEffect } from "react";
import * as THREE from "three";

// ——— 三维坐标系:x/y/z 三轴,各有正负方向 ———
// 实线 + 箭头 = 正方向;虚线 = 负方向
// 拖动旋转,滚轮缩放

const AXIS_LEN = 3;

function makeTextSprite(text, color) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.font = "bold 40px 'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', sans-serif";
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 64, 32);
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(0.9, 0.45, 1);
  return sprite;
}

function makeTaijiTexture(size = 512, mode = "full") {
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const ctx = cv.getContext("2d");
  const c = size / 2;
  const R = size * 0.48;

  // 黑鱼(阴)路径:右半 + S 形分界
  const yinPath = () => {
    ctx.beginPath();
    ctx.arc(c, c, R, -Math.PI / 2, Math.PI / 2); // 右半圆(上→下)
    ctx.arc(c, c + R / 2, R / 2, Math.PI / 2, -Math.PI / 2); // 下小弧(凸向左)
    ctx.arc(c, c - R / 2, R / 2, Math.PI / 2, -Math.PI / 2, true); // 上小弧(凹)
    ctx.closePath();
  };

  // 白鱼(阳)路径:左半 + S 形分界(与阴鱼共享边界)
  const yangPath = () => {
    ctx.beginPath();
    ctx.arc(c, c, R, Math.PI / 2, (3 * Math.PI) / 2); // 左半圆(下→上)
    ctx.arc(c, c - R / 2, R / 2, -Math.PI / 2, Math.PI / 2); // 上小弧(凸向右)
    ctx.arc(c, c + R / 2, R / 2, -Math.PI / 2, Math.PI / 2, true); // 下小弧(凹)
    ctx.closePath();
  };

  const eye = (x, y, color) => {
    ctx.beginPath();
    ctx.arc(x, y, R / 8, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  };

  ctx.lineWidth = size * 0.008;
  ctx.strokeStyle = "#8f8676";

  if (mode === "full") {
    ctx.beginPath();
    ctx.arc(c, c, R, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    yinPath();
    ctx.fillStyle = "#000000";
    ctx.fill();
    eye(c, c + R / 2, "#ffffff");
    eye(c, c - R / 2, "#000000");
    ctx.beginPath();
    ctx.arc(c, c, R, 0, Math.PI * 2);
    ctx.stroke();
  } else if (mode === "yin") {
    // 阴层 = 一切黑色:黑鱼身(眼位镂空)+ 阴眼(黑点,悬在阳鱼腹中位置)
    yinPath();
    ctx.fillStyle = "#000000";
    ctx.fill();
    yinPath();
    ctx.stroke();
    // 抠掉阳眼的位置:真正的透明洞
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(c, c + R / 2, R / 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    // 洞口描一圈细边
    ctx.beginPath();
    ctx.arc(c, c + R / 2, R / 8, 0, Math.PI * 2);
    ctx.stroke();
    // 阴眼本体:黑点,位于阳鱼腹中
    eye(c, c - R / 2, "#000000");
  } else if (mode === "yang") {
    // 阳层 = 一切白色:白鱼身(眼位镂空)+ 阳眼(白点,悬在阴鱼腹中位置)
    yangPath();
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    yangPath();
    ctx.stroke();
    // 抠掉阴眼的位置:真正的透明洞
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(c, c - R / 2, R / 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    // 洞口描一圈细边
    ctx.beginPath();
    ctx.arc(c, c - R / 2, R / 8, 0, Math.PI * 2);
    ctx.stroke();
    // 阳眼本体:白点,位于阴鱼腹中,描边免得白底隐身
    eye(c, c + R / 2, "#ffffff");
    ctx.beginPath();
    ctx.arc(c, c + R / 2, R / 8, 0, Math.PI * 2);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 4;
  return tex;
}

function makeAxis(scene, dir, color, labelPos, labelNeg) {
  const c = new THREE.Color(color);
  const origin = new THREE.Vector3(0, 0, 0);
  const d = dir.clone().normalize();

  // 正方向:实线
  const posGeom = new THREE.BufferGeometry().setFromPoints([
    origin,
    d.clone().multiplyScalar(AXIS_LEN),
  ]);
  scene.add(
    new THREE.Line(posGeom, new THREE.LineBasicMaterial({ color: c }))
  );

  // 正方向箭头(圆锥)
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(0.07, 0.24, 16),
    new THREE.MeshBasicMaterial({ color: c })
  );
  cone.position.copy(d.clone().multiplyScalar(AXIS_LEN));
  cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
  scene.add(cone);

  // 负方向:虚线
  const negGeom = new THREE.BufferGeometry().setFromPoints([
    origin,
    d.clone().multiplyScalar(-AXIS_LEN),
  ]);
  const negLine = new THREE.Line(
    negGeom,
    new THREE.LineDashedMaterial({ color: c, dashSize: 0.12, gapSize: 0.08 })
  );
  negLine.computeLineDistances();
  scene.add(negLine);

  // 标签
  const lp = makeTextSprite(labelPos, color);
  lp.position.copy(d.clone().multiplyScalar(AXIS_LEN + 0.4));
  scene.add(lp);
  const ln = makeTextSprite(labelNeg, color);
  ln.position.copy(d.clone().multiplyScalar(-(AXIS_LEN + 0.4)));
  scene.add(ln);
}

export default function XYZAxes() {
  const mountRef = useRef(null);
  const layersRef = useRef({});
  const fishRef = useRef([]); // 三个太极盘,供引擎驱动
  const autoSpinRef = useRef(true); // 整体视角自转
  const engineRef = useRef({ on: false, speed: 1 }); // 三层同步引擎
  const resetRef = useRef(() => {}); // 一键复位
  const snapRef = useRef(() => {}); // 一键跳到显影机位
  const hudRef = useRef(null); // 实时机位仪表
  const canvasElRef = useRef(null); // 渲染画布,供圆化镜头用
  const [lens, setLens] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false); // 控制台抽屉
  const [sec, setSec] = React.useState(null); // 当前展开的分组: view | engine | layers
  const flipSec = (k) => setSec((s) => (s === k ? null : k));

  const toggleLens = () => {
    setLens((s) => {
      const next = !s;
      if (canvasElRef.current) {
        canvasElRef.current.style.transformOrigin = "50% 50%";
        canvasElRef.current.style.transform = next
          ? "scaleY(1.41421)" // 沿短轴拉伸 √2:椭圆 → 正圆
          : "none";
      }
      return next;
    });
  };
  const [vis, setVis] = React.useState({ 0: true, 1: true, 2: true, 3: true });
  const [autoSpin, setAutoSpin] = React.useState(true);
  const [engineOn, setEngineOn] = React.useState(false);
  const [speed, setSpeed] = React.useState(1);

  const toggleAutoSpin = () => {
    setAutoSpin((s) => {
      autoSpinRef.current = !s;
      return !s;
    });
  };
  const toggleEngine = () => {
    setEngineOn((s) => {
      engineRef.current.on = !s;
      return !s;
    });
  };
  const changeSpeed = (v) => {
    setSpeed(v);
    engineRef.current.speed = v;
  };

  const toggleLayer = (i) => {
    setVis((v) => {
      const next = { ...v, [i]: !v[i] };
      if (layersRef.current[i]) layersRef.current[i].visible = next[i];
      return next;
    });
  };

  useEffect(() => {
    const mount = mountRef.current;
    const W = mount.clientWidth;
    const H = mount.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#f2ead6");

    const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 100);
    camera.position.set(4.2, 3.2, 5.2);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);
    canvasElRef.current = renderer.domElement;

    // 整体可旋转的组
    const world = new THREE.Group();
    scene.add(world);

    // 原点小球
    const originBall = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 24, 24),
      new THREE.MeshBasicMaterial({ color: "#b8860b", depthTest: false })
    );
    originBall.renderOrder = 10; // 始终显示在最上层,标记原点 O
    world.add(originBall);

    // ═══ 图层 0:坐标轴 ═══
    const layer0 = new THREE.Group();
    layer0.name = "图层0-坐标轴";
    world.add(layer0);

    makeAxis(layer0, new THREE.Vector3(1, 0, 0), "#c8402f", "地+", "地−");
    makeAxis(layer0, new THREE.Vector3(0, 1, 0), "#2f8f4e", "天+", "天−");
    makeAxis(layer0, new THREE.Vector3(0, 0, 1), "#2f5fc8", "人+", "人−");

    // 淡淡的参考网格(xz 平面)
    const grid = new THREE.GridHelper(6, 12, "#cfc5ac", "#e0d7c0");
    layer0.add(grid);

    const taijiTexture = makeTaijiTexture(512, "full");
    const yinTexture = makeTaijiTexture(512, "yin");
    const yangTexture = makeTaijiTexture(512, "yang");

    // ═══ 图层 1:太极图 · 人轴 ═══
    // 圆心在人轴 0 点,盘面垂直于人轴(法线朝 人+)
    const layer1 = new THREE.Group();
    layer1.name = "图层1-太极-人轴";
    world.add(layer1);

    const taiji1 = new THREE.Mesh(
      new THREE.CircleGeometry(1.2, 96),
      new THREE.MeshBasicMaterial({
        map: taijiTexture,
        side: THREE.DoubleSide,
        transparent: true,
        alphaTest: 0.5, // 透明像素直接剔除,不再遮挡后方
      })
    );
    taiji1.position.set(0, 0, 0);
    layer1.add(taiji1);

    // ═══ 图层 2:阴鱼 · 地轴 ═══
    // 圆心在地轴 0 点,盘面垂直于地轴(法线朝 地+)
    const layer2 = new THREE.Group();
    layer2.name = "图层2-阴鱼-地轴";
    world.add(layer2);

    const taiji2 = new THREE.Mesh(
      new THREE.CircleGeometry(1.2, 96),
      new THREE.MeshBasicMaterial({
        map: yinTexture,
        side: THREE.DoubleSide,
        transparent: true,
        alphaTest: 0.5, // 鱼身之外真正镂空,可以看穿到对面
      })
    );
    taiji2.rotation.y = Math.PI / 2; // 转 90°,法线由 人+ 转向 地+
    taiji2.rotateZ(-Math.PI / 2); // 盘面内正转(顺时针)90°(从地+端看向原点);即上一版再正转180°
    taiji2.position.set(0, 0, 0);
    layer2.add(taiji2);

    // ═══ 图层 3:阳鱼 · 天轴 ═══
    // 圆心在天轴 0 点,盘面垂直于天轴(法线朝 天+)
    const layer3 = new THREE.Group();
    layer3.name = "图层3-阳鱼-天轴";
    world.add(layer3);

    const taiji3 = new THREE.Mesh(
      new THREE.CircleGeometry(1.2, 96),
      new THREE.MeshBasicMaterial({
        map: yangTexture,
        side: THREE.DoubleSide,
        transparent: true,
        alphaTest: 0.5, // 鱼身之外真正镂空,可以看穿到对面
      })
    );
    taiji3.rotation.x = -Math.PI / 2; // 转 90°,法线由 人+ 转向 天+
    taiji3.position.set(0, 0, 0);
    layer3.add(taiji3);

    // 注册图层,供外部开关控制
    layersRef.current = { 0: layer0, 1: layer1, 2: layer2, 3: layer3 };
    // 注册三个太极盘,供引擎同步驱动(各绕自身法线轴)
    fishRef.current = [taiji1, taiji2, taiji3];

    // 记录初始状态,供复位:三盘相位 + 世界姿态 + 相机
    const initQuats = fishRef.current.map((f) => f.quaternion.clone());
    const initCam = camera.position.clone();

    // ——— 手动拖拽旋转(四元数轨迹球,无万向节死锁) ———
    let dragging = false;
    let lastX = 0,
      lastY = 0;
    let velX = 0.004,
      velY = 0; // 初始缓慢自转

    const tmpQ = new THREE.Quaternion();
    const rotateWorld = (ax, ay) => {
      // 绕相机的"上"与"右"方向转世界,任何姿态都不卡
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
      world.quaternion.premultiply(tmpQ.setFromAxisAngle(up, ax));
      world.quaternion.premultiply(tmpQ.setFromAxisAngle(right, ay));
    };

    const onDown = (x, y) => {
      dragging = true;
      lastX = x;
      lastY = y;
    };
    const onMove = (x, y) => {
      if (!dragging) return;
      const dx = x - lastX;
      const dy = y - lastY;
      rotateWorld(dx * 0.008, dy * 0.008);
      velX = dx * 0.0008;
      velY = dy * 0.0008;
      lastX = x;
      lastY = y;
    };
    const onUp = () => (dragging = false);

    // 复位:三盘回到初始相位,世界摆正,相机归位,余速清零(不动开关状态)
    resetRef.current = () => {
      fishRef.current.forEach((f, i) => f.quaternion.copy(initQuats[i]));
      world.rotation.set(0, 0, 0);
      camera.position.copy(initCam);
      camera.lookAt(0, 0, 0);
      velX = autoSpinRef.current ? 0.004 : 0;
      velY = 0;
    };

    // 机位1:地天平分线(面对角线) → 相机立于 (1,1,0)/√2,两盘投影为同一椭圆
    // 机位2:体对角线 → 相机立于 (1,1,-1)/√3,三轴等距120°,分体尽显
    snapRef.current = (which = 1) => {
      world.rotation.set(0, 0, 0); // 世界摆正,保证方向是真方向
      const dist = 7.4;
      if (which === 1) {
        const s = dist / Math.sqrt(2);
        camera.position.set(s, s, 0);
      } else {
        const s = dist / Math.sqrt(3);
        camera.position.set(s, s, -s);
      }
      camera.lookAt(0, 0, 0);
      velX = 0;
      velY = 0;
    };

    const md = (e) => onDown(e.clientX, e.clientY);
    const mm = (e) => onMove(e.clientX, e.clientY);
    const ts = (e) => onDown(e.touches[0].clientX, e.touches[0].clientY);
    const tm = (e) => {
      e.preventDefault();
      onMove(e.touches[0].clientX, e.touches[0].clientY);
    };

    renderer.domElement.addEventListener("mousedown", md);
    window.addEventListener("mousemove", mm);
    window.addEventListener("mouseup", onUp);
    renderer.domElement.addEventListener("touchstart", ts, { passive: true });
    renderer.domElement.addEventListener("touchmove", tm, { passive: false });
    renderer.domElement.addEventListener("touchend", onUp);

    // 滚轮缩放
    const wheel = (e) => {
      e.preventDefault();
      camera.position.multiplyScalar(e.deltaY > 0 ? 1.07 : 0.93);
      camera.position.clampLength(2.5, 20);
    };
    renderer.domElement.addEventListener("wheel", wheel, { passive: false });

    let raf;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      if (!dragging) {
        if (autoSpinRef.current) {
          rotateWorld(velX, velY);
          velX *= 0.98;
          velY *= 0.98;
          if (Math.abs(velX) < 0.0015) velX = 0.0015; // 保持一点点自转
        } else {
          velX = 0;
          velY = 0; // 视角锁死,纹丝不动
        }
      }
      // ═══ 引擎:三层锁定同向同速,各绕自身法线正转 ═══
      if (engineRef.current.on) {
        const d = -engineRef.current.speed * 0.01; // 正转 = 从各轴正端看向原点为顺时针
        for (const f of fishRef.current) f.rotateZ(d);
      }
      // ═══ 机位仪表:相机在"世界系"(天地人坐标)中的实时位置 ═══
      if (hudRef.current) {
        const inv = world.quaternion.clone().invert();
        const p = camera.position.clone().applyQuaternion(inv);
        const dist = p.length();
        const u = p.clone().normalize();
        hudRef.current.textContent =
          `地 ${u.x >= 0 ? "+" : ""}${u.x.toFixed(3)}  ` +
          `天 ${u.y >= 0 ? "+" : ""}${u.y.toFixed(3)}  ` +
          `人 ${u.z >= 0 ? "+" : ""}${u.z.toFixed(3)}  ` +
          `距 ${dist.toFixed(2)}`;
      }
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const w = mount.clientWidth,
        h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", mm);
      window.removeEventListener("mouseup", onUp);
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        position: "relative",
        background: "#f2ead6",
        fontFamily: "'Courier New', monospace",
      }}
    >
      {/* 顶部信息(极简) */}
      <div
        style={{
          position: "absolute",
          top: 12,
          left: 14,
          zIndex: 2,
          color: "#3a3324",
          lineHeight: 1.5,
        }}
      >
        <div style={{ fontSize: 14, letterSpacing: 2 }}>天地人 · 三才坐标系</div>
        <div style={{ fontSize: 10, color: "#8a6d1f" }}>
          v20 · 双机位:合与离
        </div>
      </div>

      {/* ☰ 控制台:右上角折叠抽屉,三个分组下拉 */}
      <div
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          zIndex: 3,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 8,
        }}
      >
        <button
          onClick={() => setMenuOpen((o) => !o)}
          style={{
            padding: "10px 16px",
            borderRadius: 12,
            border: "1.5px solid #8f8676",
            background: menuOpen ? "#3a3324" : "rgba(242,234,214,0.9)",
            color: menuOpen ? "#f2ead6" : "#3a3324",
            fontFamily: "inherit",
            fontSize: 14,
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(58,51,36,0.2)",
          }}
        >
          ☰ 控制台
        </button>

        {menuOpen && (
          <div
            style={{
              width: 200,
              background: "rgba(242,234,214,0.96)",
              border: "1.5px solid #8f8676",
              borderRadius: 12,
              padding: 10,
              display: "flex",
              flexDirection: "column",
              gap: 6,
              maxHeight: "72vh",
              overflowY: "auto",
            }}
          >
            {/* ─── 分组:视角 ─── */}
            <button
              onClick={() => flipSec("view")}
              style={{
                padding: "10px 10px",
                borderRadius: 8,
                border: "none",
                background: sec === "view" ? "#e0d7c0" : "transparent",
                color: "#3a3324",
                fontFamily: "inherit",
                fontSize: 13,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              {sec === "view" ? "▾" : "▸"} 视角
            </button>
            {sec === "view" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingLeft: 6 }}>
                <button
                  onClick={toggleAutoSpin}
                  style={{
                    padding: "9px 8px", borderRadius: 8,
                    border: "1.5px solid #8f8676",
                    background: autoSpin ? "#3a3324" : "transparent",
                    color: autoSpin ? "#f2ead6" : "#6b6250",
                    fontFamily: "inherit", fontSize: 12, cursor: "pointer",
                  }}
                >
                  {autoSpin ? "自转 · 开" : "视角锁定 🔒"}
                </button>
                <button
                  onClick={() => {
                    setAutoSpin(false);
                    autoSpinRef.current = false;
                    snapRef.current(1);
                  }}
                  style={{
                    padding: "9px 8px", borderRadius: 8,
                    border: "1.5px solid #7a1f1f",
                    background: "#7a1f1f", color: "#f2ead6",
                    fontFamily: "inherit", fontSize: 12, cursor: "pointer",
                  }}
                >
                  🎯 机位1 · 显影(合)
                </button>
                <button
                  onClick={() => {
                    setAutoSpin(false);
                    autoSpinRef.current = false;
                    snapRef.current(2);
                  }}
                  style={{
                    padding: "9px 8px", borderRadius: 8,
                    border: "1.5px solid #4d3a7a",
                    background: "#4d3a7a", color: "#f2ead6",
                    fontFamily: "inherit", fontSize: 12, cursor: "pointer",
                  }}
                >
                  🎯 机位2 · 分体(离)
                </button>
                <button
                  onClick={toggleLens}
                  style={{
                    padding: "9px 8px", borderRadius: 8,
                    border: "1.5px solid #1f4d7a",
                    background: lens ? "#1f4d7a" : "transparent",
                    color: lens ? "#f2ead6" : "#1f4d7a",
                    fontFamily: "inherit", fontSize: 12, cursor: "pointer",
                  }}
                >
                  ⊕ 圆化{lens ? " · 开" : ""}
                </button>
                <button
                  onClick={() => resetRef.current()}
                  style={{
                    padding: "9px 8px", borderRadius: 8,
                    border: "1.5px solid #8f8676",
                    background: "transparent", color: "#6b6250",
                    fontFamily: "inherit", fontSize: 12, cursor: "pointer",
                  }}
                >
                  ⟲ 复位
                </button>
                <div style={{ fontSize: 10, color: "#9a9078", lineHeight: 1.5 }}>
                  机位1=(1,1,0)/√2 面对角线,两鱼合为一图
                  <br />机位2=(1,1,−1)/√3 体对角线,两鱼永不相触
                  <br />到位皆自动锁视角 · 圆化仅配机位1
                </div>
              </div>
            )}

            {/* ─── 分组:引擎 ─── */}
            <button
              onClick={() => flipSec("engine")}
              style={{
                padding: "10px 10px",
                borderRadius: 8,
                border: "none",
                background: sec === "engine" ? "#e0d7c0" : "transparent",
                color: "#3a3324",
                fontFamily: "inherit",
                fontSize: 13,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              {sec === "engine" ? "▾" : "▸"} 引擎 {engineOn ? "☯ 运转中" : ""}
            </button>
            {sec === "engine" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingLeft: 6 }}>
                <button
                  onClick={toggleEngine}
                  style={{
                    padding: "9px 8px", borderRadius: 8,
                    border: "1.5px solid #8f8676",
                    background: engineOn ? "#7a1f1f" : "transparent",
                    color: engineOn ? "#f2ead6" : "#6b6250",
                    fontFamily: "inherit", fontSize: 12, cursor: "pointer",
                  }}
                >
                  {engineOn ? "运转中 ☯ 点击熄火" : "点火"}
                </button>
                <div style={{ fontSize: 11, color: "#6b6250", textAlign: "center" }}>
                  速率 ×{speed.toFixed(1)}
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="5"
                  step="0.1"
                  value={speed}
                  onChange={(e) => changeSpeed(parseFloat(e.target.value))}
                  style={{ width: "100%", accentColor: "#7a1f1f" }}
                />
                <div style={{ fontSize: 10, color: "#9a9078", lineHeight: 1.5 }}>
                  三层锁定同向同速
                  <br />各绕自身法线正转
                </div>
              </div>
            )}

            {/* ─── 分组:图层 ─── */}
            <button
              onClick={() => flipSec("layers")}
              style={{
                padding: "10px 10px",
                borderRadius: 8,
                border: "none",
                background: sec === "layers" ? "#e0d7c0" : "transparent",
                color: "#3a3324",
                fontFamily: "inherit",
                fontSize: 13,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              {sec === "layers" ? "▾" : "▸"} 图层
            </button>
            {sec === "layers" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingLeft: 6 }}>
                {[
                  { i: 0, label: "0 · 坐标轴" },
                  { i: 1, label: "1 · 太极⊥人" },
                  { i: 2, label: "2 · 阴鱼⊥地" },
                  { i: 3, label: "3 · 阳鱼⊥天" },
                ].map(({ i, label }) => (
                  <button
                    key={i}
                    onClick={() => toggleLayer(i)}
                    style={{
                      padding: "9px 8px", borderRadius: 8,
                      border: "1.5px solid #8f8676",
                      background: vis[i] ? "#3a3324" : "transparent",
                      color: vis[i] ? "#f2ead6" : "#9a9078",
                      fontFamily: "inherit", fontSize: 12, cursor: "pointer",
                      textDecoration: vis[i] ? "none" : "line-through",
                      textAlign: "left",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 左下:机位仪表(常驻) */}
      <div
        ref={hudRef}
        style={{
          position: "absolute",
          left: 12,
          bottom: 16,
          zIndex: 2,
          fontSize: 11,
          color: "#3a3324",
          background: "rgba(242,234,214,0.9)",
          border: "1.5px solid #8f8676",
          borderRadius: 8,
          padding: "8px 10px",
          whiteSpace: "pre",
          fontFamily: "'Courier New', monospace",
        }}
      >
        机位读取中…
      </div>
      <div
        ref={mountRef}
        style={{ width: "100%", height: "100%", overflow: "hidden" }}
      />
    </div>
  );
}
