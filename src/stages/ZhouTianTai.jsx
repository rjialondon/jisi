import React, { useRef, useEffect } from "react";
import * as THREE from "three";

// ═══════════════════════════════════════════
//  周 天 台
//  天地人同构三轴 · 空台 · 不预设任何东西
//  随指令而动,共观周天大世界
// ═══════════════════════════════════════════

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

function makeAxis(parent, dir, color, labelPos, labelNeg) {
  const c = new THREE.Color(color);
  const origin = new THREE.Vector3(0, 0, 0);
  const d = dir.clone().normalize();

  // 正方向:实线
  const posGeom = new THREE.BufferGeometry().setFromPoints([
    origin,
    d.clone().multiplyScalar(AXIS_LEN),
  ]);
  parent.add(new THREE.Line(posGeom, new THREE.LineBasicMaterial({ color: c })));

  // 正方向箭头
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(0.07, 0.24, 16),
    new THREE.MeshBasicMaterial({ color: c })
  );
  cone.position.copy(d.clone().multiplyScalar(AXIS_LEN));
  cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
  parent.add(cone);

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
  parent.add(negLine);

  // 标签
  const lp = makeTextSprite(labelPos, color);
  lp.position.copy(d.clone().multiplyScalar(AXIS_LEN + 0.4));
  parent.add(lp);
  const ln = makeTextSprite(labelNeg, color);
  ln.position.copy(d.clone().multiplyScalar(-(AXIS_LEN + 0.4)));
  parent.add(ln);
}

export default function ZhouTianTai() {
  const mountRef = useRef(null);
  const worldRef = useRef(null); // 世界组,后续一切造物挂在这里
  const layersRef = useRef({}); // 图层登记簿,随造物增补
  const autoSpinRef = useRef(true);
  const resetRef = useRef(() => {});
  const hudRef = useRef(null);
  const cameraRef = useRef(null); // 相机,供外置缩放滑杆
  const zoomSliderRef = useRef(null); // 滑杆 DOM,动画帧内回写
  const sliderActiveRef = useRef(false);
  const [autoSpin, setAutoSpin] = React.useState(true);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [vis, setVis] = React.useState({ 0: true, 1: true });

  const toggleLayer = (i) => {
    setVis((v) => {
      const next = { ...v, [i]: !v[i] };
      if (layersRef.current[i]) layersRef.current[i].visible = next[i];
      return next;
    });
  };

  const toggleAutoSpin = () => {
    setAutoSpin((s) => {
      autoSpinRef.current = !s;
      return !s;
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
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const world = new THREE.Group();
    scene.add(world);
    worldRef.current = world;

    // ═══ 图层 0:天地人三轴(与三才坐标系同构) ═══
    const layer0 = new THREE.Group();
    layer0.name = "图层0-天地人三轴";
    world.add(layer0);

    makeAxis(layer0, new THREE.Vector3(1, 0, 0), "#c8402f", "地+", "地−");
    makeAxis(layer0, new THREE.Vector3(0, 1, 0), "#2f8f4e", "天+", "天−");
    makeAxis(layer0, new THREE.Vector3(0, 0, 1), "#2f5fc8", "人+", "人−");

    const grid = new THREE.GridHelper(6, 12, "#cfc5ac", "#e0d7c0");
    layer0.add(grid);

    // 原点:金珠,恒显最上层
    const originBall = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 24, 24),
      new THREE.MeshBasicMaterial({ color: "#b8860b", depthTest: false })
    );
    originBall.renderOrder = 10;
    layer0.add(originBall);

    layersRef.current = { 0: layer0 };

    // ═══ 图层 1:周天 729 点 ═══
    // 每根轴放同一根九宫轴:乾+4 兑+3 离+2 震+1 宫0 巽−1 坎−2 艮−3 坤−4
    // 9 × 9 × 9 = 729 = 3⁶ 个格点,坐标 ∈ {−4…+4}³,缩放系数 S 落进台内
    const layer1 = new THREE.Group();
    layer1.name = "图层1-周天729点";
    world.add(layer1);

    const S = 0.6; // 一格 = 0.6 台尺,±4 → ±2.4
    const positions = new Float32Array(729 * 3);
    let k = 0;
    for (let x = -4; x <= 4; x++) {
      for (let y = -4; y <= 4; y++) {
        for (let z = -4; z <= 4; z++) {
          positions[k++] = x * S;
          positions[k++] = y * S;
          positions[k++] = z * S;
        }
      }
    }
    const latticeGeom = new THREE.BufferGeometry();
    latticeGeom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const lattice = new THREE.Points(
      latticeGeom,
      new THREE.PointsMaterial({
        color: "#3a3324",
        size: 0.055,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.75,
      })
    );
    layer1.add(lattice);

    layersRef.current = { 0: layer0, 1: layer1 };
    // ——— 729 点即位,坐标语义:(地,天,人) 各取 乾…宫…坤 ———

    // ——— 四元数轨迹球旋转(无死角) ———
    let dragging = false;
    let lastX = 0,
      lastY = 0;
    let velX = 0.004,
      velY = 0;

    const tmpQ = new THREE.Quaternion();
    const rotateWorld = (ax, ay) => {
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

    const initCam = camera.position.clone();
    resetRef.current = () => {
      world.rotation.set(0, 0, 0);
      camera.position.copy(initCam);
      camera.lookAt(0, 0, 0);
      velX = autoSpinRef.current ? 0.004 : 0;
      velY = 0;
    };

    const md = (e) => onDown(e.clientX, e.clientY);
    const mm = (e) => onMove(e.clientX, e.clientY);

    // 触屏:单指旋转,双指捏合缩放
    let pinchDist = 0;
    const touchGap = (e) => {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      return Math.hypot(dx, dy);
    };
    const ts = (e) => {
      if (e.touches.length === 2) {
        dragging = false;
        pinchDist = touchGap(e);
      } else {
        onDown(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const tm = (e) => {
      e.preventDefault();
      if (e.touches.length === 2) {
        const nd = touchGap(e);
        if (pinchDist > 0) {
          camera.position.multiplyScalar(pinchDist / nd);
          camera.position.clampLength(2.5, 40);
        }
        pinchDist = nd;
      } else {
        onMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    renderer.domElement.addEventListener("mousedown", md);
    window.addEventListener("mousemove", mm);
    window.addEventListener("mouseup", onUp);
    renderer.domElement.addEventListener("touchstart", ts, { passive: true });
    renderer.domElement.addEventListener("touchmove", tm, { passive: false });
    renderer.domElement.addEventListener("touchend", onUp);

    const wheel = (e) => {
      e.preventDefault();
      camera.position.multiplyScalar(e.deltaY > 0 ? 1.07 : 0.93);
      camera.position.clampLength(2.5, 40);
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
          if (Math.abs(velX) < 0.0015) velX = 0.0015;
        } else {
          velX = 0;
          velY = 0;
        }
      }
      // 机位仪表:相机在世界系(天地人)中的实时方向
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
        // 滑杆回写(手没按着的时候)
        if (zoomSliderRef.current && !sliderActiveRef.current) {
          zoomSliderRef.current.value = dist.toFixed(1);
        }
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
      {/* 台名 */}
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
        <div style={{ fontSize: 17, letterSpacing: 6 }}>周 天 台</div>
        <div style={{ fontSize: 10, color: "#8a6d1f" }}>
          v3 · 双指捏合 + 右下滑杆缩放
        </div>
      </div>

      {/* ☰ 控制台(极简起步,随造物扩建) */}
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
              width: 190,
              background: "rgba(242,234,214,0.96)",
              border: "1.5px solid #8f8676",
              borderRadius: 12,
              padding: 10,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <button
              onClick={toggleAutoSpin}
              style={{
                padding: "9px 8px",
                borderRadius: 8,
                border: "1.5px solid #8f8676",
                background: autoSpin ? "#3a3324" : "transparent",
                color: autoSpin ? "#f2ead6" : "#6b6250",
                fontFamily: "inherit",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {autoSpin ? "自转 · 开" : "视角锁定 🔒"}
            </button>
            <button
              onClick={() => resetRef.current()}
              style={{
                padding: "9px 8px",
                borderRadius: 8,
                border: "1.5px solid #8f8676",
                background: "transparent",
                color: "#6b6250",
                fontFamily: "inherit",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              ⟲ 复位
            </button>
            {[
              { i: 0, label: "0 · 天地人三轴" },
              { i: 1, label: "1 · 周天729点" },
            ].map(({ i, label }) => (
              <button
                key={i}
                onClick={() => toggleLayer(i)}
                style={{
                  padding: "9px 8px",
                  borderRadius: 8,
                  border: "1.5px solid #8f8676",
                  background: vis[i] ? "#3a3324" : "transparent",
                  color: vis[i] ? "#f2ead6" : "#9a9078",
                  fontFamily: "inherit",
                  fontSize: 12,
                  cursor: "pointer",
                  textDecoration: vis[i] ? "none" : "line-through",
                  textAlign: "left",
                }}
              >
                {label}
              </button>
            ))}
            <div style={{ fontSize: 10, color: "#9a9078", lineHeight: 1.5 }}>
              每轴:乾+4…宫0…坤−4
              <br />
              9³ = 729 = 3⁶
            </div>
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

      {/* 右下:缩放滑杆(常驻,外置) */}
      <div
        style={{
          position: "absolute",
          right: 12,
          bottom: 16,
          zIndex: 2,
          background: "rgba(242,234,214,0.9)",
          border: "1.5px solid #8f8676",
          borderRadius: 8,
          padding: "8px 10px",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span style={{ fontSize: 11, color: "#6b6250" }}>近</span>
        <input
          ref={zoomSliderRef}
          type="range"
          min="2.5"
          max="40"
          step="0.1"
          defaultValue="7.4"
          onPointerDown={() => (sliderActiveRef.current = true)}
          onPointerUp={() => (sliderActiveRef.current = false)}
          onTouchStart={() => (sliderActiveRef.current = true)}
          onTouchEnd={() => (sliderActiveRef.current = false)}
          onInput={(e) => {
            const v = parseFloat(e.target.value);
            if (cameraRef.current) cameraRef.current.position.setLength(v);
          }}
          style={{ width: 130, accentColor: "#3a3324" }}
        />
        <span style={{ fontSize: 11, color: "#6b6250" }}>远</span>
      </div>

      <div
        ref={mountRef}
        style={{ width: "100%", height: "100%", overflow: "hidden" }}
      />
    </div>
  );
}
