import React, { useRef, useEffect } from "react";
import * as THREE from "three";
import { 建立台控 } from "../shared/stageRuntime.js";

// ═══════════════════════════════════════════
//  卦 台 v7(整铸版)
//  天地人三轴 · 立方体体心=中宫 · 八角=八卦
//  爻→轴:初=地(x) 中=人(z) 上=天(y),阳+阴−
// ═══════════════════════════════════════════

const AXIS_LEN = 3;
const HALF = 1.5;

const CORNERS = [
  { name: "乾", di: 1, ren: 1, tian: 1 },
  { name: "兑", di: 1, ren: 1, tian: -1 },
  { name: "离", di: 1, ren: -1, tian: 1 },
  { name: "震", di: 1, ren: -1, tian: -1 },
  { name: "巽", di: -1, ren: 1, tian: 1 },
  { name: "坎", di: -1, ren: 1, tian: -1 },
  { name: "艮", di: -1, ren: -1, tian: 1 },
  { name: "坤", di: -1, ren: -1, tian: -1 },
];

function makeTextSprite(text, color) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.font =
    "bold 40px 'PingFang SC','Microsoft YaHei','Noto Sans SC',sans-serif";
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 64, 32);
  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true })
  );
  sprite.scale.set(0.9, 0.45, 1);
  return sprite;
}

function makeAxis(parent, dir, color, labelPos, labelNeg) {
  const c = new THREE.Color(color);
  const d = dir.clone().normalize();
  const o = new THREE.Vector3(0, 0, 0);

  const posGeom = new THREE.BufferGeometry().setFromPoints([
    o,
    d.clone().multiplyScalar(AXIS_LEN),
  ]);
  parent.add(new THREE.Line(posGeom, new THREE.LineBasicMaterial({ color: c })));

  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(0.07, 0.24, 16),
    new THREE.MeshBasicMaterial({ color: c })
  );
  cone.position.copy(d.clone().multiplyScalar(AXIS_LEN));
  cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
  parent.add(cone);

  const negGeom = new THREE.BufferGeometry().setFromPoints([
    o,
    d.clone().multiplyScalar(-AXIS_LEN),
  ]);
  const negLine = new THREE.Line(
    negGeom,
    new THREE.LineDashedMaterial({ color: c, dashSize: 0.12, gapSize: 0.08 })
  );
  negLine.computeLineDistances();
  parent.add(negLine);

  const lp = makeTextSprite(labelPos, color);
  lp.position.copy(d.clone().multiplyScalar(AXIS_LEN + 0.4));
  parent.add(lp);
  const ln = makeTextSprite(labelNeg, color);
  ln.position.copy(d.clone().multiplyScalar(-(AXIS_LEN + 0.4)));
  parent.add(ln);
}

// 先天八卦圆图:HUD 基准盘(南上:乾上坤下,离左坎右;内圈=初爻)
function drawXiantian(cv, mirror) {
  const size = cv.width;
  const ctx = cv.getContext("2d");
  ctx.clearRect(0, 0, size, size);
  const c = size / 2;
  const R = size * 0.46;
  const gua = [
    { ming: "乾", yao: [1, 1, 1], deg: 0 },
    { ming: "兑", yao: [1, 1, 0], deg: -45 },
    { ming: "离", yao: [1, 0, 1], deg: -90 },
    { ming: "震", yao: [1, 0, 0], deg: -135 },
    { ming: "坤", yao: [0, 0, 0], deg: 180 },
    { ming: "艮", yao: [0, 0, 1], deg: 135 },
    { ming: "坎", yao: [0, 1, 0], deg: 90 },
    { ming: "巽", yao: [0, 1, 1], deg: 45 },
  ];
  ctx.strokeStyle = "#5a4632";
  ctx.lineWidth = size * 0.008;
  ctx.beginPath();
  ctx.arc(c, c, R, 0, Math.PI * 2);
  ctx.stroke();
  const bw = size * 0.16,
    bh = size * 0.035,
    gap = size * 0.04;
  for (const g of gua) {
    const th = ((mirror ? -g.deg : g.deg) * Math.PI) / 180;
    ctx.save();
    ctx.translate(c, c);
    ctx.rotate(th);
    ctx.fillStyle = "#3a3324";
    for (let i = 0; i < 3; i++) {
      const ry = -(size * 0.2 + i * (bh + size * 0.02));
      if (g.yao[i] === 1) {
        ctx.fillRect(-bw / 2, ry, bw, bh);
      } else {
        ctx.fillRect(-bw / 2, ry, bw / 2 - gap / 2, bh);
        ctx.fillRect(gap / 2, ry, bw / 2 - gap / 2, bh);
      }
    }
    ctx.font =
      "bold " +
      Math.round(size * 0.09) +
      "px 'PingFang SC','Microsoft YaHei','Noto Sans SC',sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#5a4632";
    ctx.fillText(g.ming, 0, -(size * 0.4));
    ctx.restore();
  }
}


// 拆半盘:太极+八卦合体,顺 S 鱼线剖开,两瓣各携四卦,拆至自家半边
// 阳瓣(白鱼,头顶乾):乾·兑·离·震 | 阴瓣(墨鱼,头抵坤):巽·坎·艮·坤
function drawSplit(cv) {
  const Wd = cv.width, Hd = cv.height;
  const ctx = cv.getContext("2d");
  ctx.clearRect(0, 0, Wd, Hd);
  const r = Hd * 0.30;

  function trigram(cx, cy, yao, deg, ming) {
    const th = (deg * Math.PI) / 180;
    const bw = r * 0.52, bh = r * 0.115, gap = r * 0.13;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(th);
    ctx.fillStyle = "#3a3324";
    for (let i = 0; i < 3; i++) {
      const ry = -(r * 1.12 + i * (bh + r * 0.07));
      if (yao[i] === 1) {
        ctx.fillRect(-bw / 2, ry, bw, bh);
      } else {
        ctx.fillRect(-bw / 2, ry, bw / 2 - gap / 2, bh);
        ctx.fillRect(gap / 2, ry, bw / 2 - gap / 2, bh);
      }
    }
    ctx.font = "bold " + Math.round(r * 0.30) + "px 'PingFang SC','Microsoft YaHei',sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#5a4632";
    ctx.fillText(ming, 0, -(r * 1.78));
    ctx.restore();
  }

  // ── 阳瓣(左置):白鱼 + 乾兑离震 ──
  const ax = Wd * 0.27, ay = Hd * 0.52;
  ctx.beginPath();
  ctx.arc(ax, ay, r, Math.PI / 2, (3 * Math.PI) / 2);            // 左外弧(下→上)
  ctx.arc(ax, ay - r / 2, r / 2, -Math.PI / 2, Math.PI / 2);      // 顶部头弧(凸向右)
  ctx.arc(ax, ay + r / 2, r / 2, -Math.PI / 2, Math.PI / 2, true);// 底部尾弧(凹)
  ctx.closePath();
  ctx.fillStyle = "#faf6ea";
  ctx.fill();
  ctx.strokeStyle = "#8f8676";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(ax, ay - r / 2, r / 7, 0, Math.PI * 2);                 // 阳鱼阴眼(头顶乾)
  ctx.fillStyle = "#1a1611";
  ctx.fill();
  trigram(ax, ay, [1, 1, 1], 0, "乾");
  trigram(ax, ay, [1, 1, 0], -45, "兑");
  trigram(ax, ay, [1, 0, 1], -90, "离");
  trigram(ax, ay, [1, 0, 0], -135, "震");

  // ── 阴瓣(右置):墨鱼 + 巽坎艮坤 ──
  const bx = Wd * 0.73, by = Hd * 0.52;
  ctx.beginPath();
  ctx.arc(bx, by, r, -Math.PI / 2, Math.PI / 2);                  // 右外弧(上→下)
  ctx.arc(bx, by + r / 2, r / 2, Math.PI / 2, -Math.PI / 2);      // 底部头弧(凸向左)
  ctx.arc(bx, by - r / 2, r / 2, Math.PI / 2, -Math.PI / 2, true);// 顶部尾弧(凹)
  ctx.closePath();
  ctx.fillStyle = "#2a241a";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(bx, by + r / 2, r / 7, 0, Math.PI * 2);                 // 阴鱼阳眼(头抵坤)
  ctx.fillStyle = "#faf6ea";
  ctx.fill();
  trigram(bx, by, [0, 1, 1], 45, "巽");
  trigram(bx, by, [0, 1, 0], 90, "坎");
  trigram(bx, by, [0, 0, 1], 135, "艮");
  trigram(bx, by, [0, 0, 0], 180, "坤");
}

export default function GuaTai() {
  const mountRef = useRef(null);
  const 台控Ref = useRef(null);
  const layersRef = useRef({});
  const autoSpinRef = useRef(true);
  const resetRef = useRef(() => {});
  const hudRef = useRef(null);
  const zoomSliderRef = useRef(null);
  const baguaRef = useRef(null);
  const daNuoYiRef = useRef(() => {});
  const [nuoyi, setNuoyi] = React.useState(false);
  const baguaMirrorRef = useRef(null);

  const [autoSpin, setAutoSpin] = React.useState(true);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [vis, setVis] = React.useState({ 0: true, 1: true, 2: true });
  const [showBagua, setShowBagua] = React.useState(true);
  const [showMirror, setShowMirror] = React.useState(true);

  const toggleAutoSpin = () => {
    setAutoSpin((s) => {
      autoSpinRef.current = !s;
      return !s;
    });
  };
  const toggleLayer = (i) => {
    setVis((v) => {
      const next = { ...v, [i]: !v[i] };
      if (layersRef.current[i]) layersRef.current[i].visible = next[i];
      return next;
    });
  };

  useEffect(() => {
    if (showBagua && baguaRef.current) drawXiantian(baguaRef.current, false);
  }, [showBagua]);

  useEffect(() => {
    if (showMirror && baguaMirrorRef.current) drawSplit(baguaMirrorRef.current);
  }, [showMirror]);

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

    const world = new THREE.Group();
    scene.add(world);

    // ═══ 图层 0:天地人三轴 ═══
    const layer0 = new THREE.Group();
    layer0.name = "layer0-axes";
    world.add(layer0);
    makeAxis(layer0, new THREE.Vector3(1, 0, 0), "#c8402f", "地+", "地−");
    makeAxis(layer0, new THREE.Vector3(0, 1, 0), "#2f8f4e", "天+", "天−");
    makeAxis(layer0, new THREE.Vector3(0, 0, 1), "#2f5fc8", "人+", "人−");
    const grid = new THREE.GridHelper(6, 12, "#cfc5ac", "#e0d7c0");
    layer0.add(grid);
    const originBall = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 24, 24),
      new THREE.MeshBasicMaterial({ color: "#b8860b", depthTest: false })
    );
    originBall.renderOrder = 10;
    layer0.add(originBall);

    // ═══ 图层 1:立方体 · 八角=八卦 ═══
    const layer1 = new THREE.Group();
    layer1.name = "layer1-cube";
    world.add(layer1);
    const cubeEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(2 * HALF, 2 * HALF, 2 * HALF)),
      new THREE.LineBasicMaterial({ color: "#3a3324" })
    );
    layer1.add(cubeEdges);
    for (const g of CORNERS) {
      const x = g.di * HALF,
        y = g.tian * HALF,
        z = g.ren * HALF;
      const corner = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 16, 16),
        new THREE.MeshBasicMaterial({
          color: g.name === "乾" || g.name === "坤" ? "#7a1f1f" : "#3a3324",
        })
      );
      corner.position.set(x, y, z);
      layer1.add(corner);
      const tag = makeTextSprite(g.name, "#3a3324");
      tag.scale.set(0.55, 0.28, 1);
      tag.position.set(x * 1.22, y * 1.22, z * 1.22);
      tag.material.depthTest = false; // 字恒在最上,不被鱼身遮没
      tag.renderOrder = 9;
      layer1.add(tag);
    }

    // ═══ 图层 2:先天游龙 · 立体阴阳鱼 ═══
    // 阳鱼:宫→乾→兑→离→震→(渡心)→宫;阴鱼:宫→巽→坎→艮→坤→宫
    // 两环各为闭合平滑管;震巽、乾坤皆对宫体对角,渡段天然穿中宫
    const layer2 = new THREE.Group();
    layer2.name = "layer2-youlong";
    world.add(layer2);

    const P = {};
    for (const g of CORNERS) P[g.name] = new THREE.Vector3(g.di * HALF, g.tian * HALF, g.ren * HALF);
    const O = new THREE.Vector3(0, 0, 0);

    function makeFish(points, color) {
      const curve = new THREE.CatmullRomCurve3(points, true, "catmullrom", 0.5);
      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 240, 0.09, 16, true),
        new THREE.MeshBasicMaterial({
          color: color,
          transparent: true,
          opacity: 0.2, // 虚化 20%,字与骨架皆可透见
        })
      );
      return tube;
    }
    // 阳鱼(白):宫起,历纯阳而降,至震渡心
    layer2.add(makeFish([O, P["乾"], P["兑"], P["离"], P["震"]], "#8a6d1f"));
    // 阴鱼(墨):宫起,落巽历阴而降,至坤归心 —— 单持引用,供乾坤大挪移施法
    const yinFish = makeFish([O, P["巽"], P["坎"], P["艮"], P["坤"]], "#1a1611");
    layer2.add(yinFish);

    layersRef.current = { 0: layer0, 1: layer1, 2: layer2 };

    const 台控 = 建立台控({
      mount, scene, world, camera, renderer, hudRef, zoomSliderRef, autoSpinRef,
    });
    台控Ref.current = 台控;
    // 保留原展示构形：阴鱼施地镜（地=0面反射），机位跳地+正望。
    // 本轮只补操作前机位与自转的存还，不以交互修订重判原几何解释。
    let 挪移前 = null;
    daNuoYiRef.current = (开) => {
      if (开) {
        挪移前 = 台控.存机位();
        yinFish.scale.x = -1;
        world.quaternion.identity();
        camera.position.set(7.4, 0.0001, 0);
        camera.lookAt(0, 0, 0);
        autoSpinRef.current = false;
        setAutoSpin(false);
        台控.清余速();
      } else if (挪移前) {
        yinFish.scale.x = 1;
        台控.还机位(挪移前);
        setAutoSpin(挪移前.自转);
        挪移前 = null;
      }
    };
    resetRef.current = () => {
      for (const 层 of Object.values(layersRef.current)) 层.visible = true;
      setVis({ 0: true, 1: true, 2: true });
      autoSpinRef.current = true;
      setAutoSpin(true);
      yinFish.scale.x = 1;
      挪移前 = null;
      setNuoyi(false);
      setShowBagua(true);
      setShowMirror(true);
      台控.复位();
    };
    return () => {
      台控.收台();
      台控Ref.current = null;
      layersRef.current = {};
      resetRef.current = () => {};
      daNuoYiRef.current = () => {};
    };
  }, []);

  useEffect(() => { 台控Ref.current?.唤醒(); }, [autoSpin, vis]);

  const btn = (active, activeBg, activeBorder) => ({
    padding: "9px 8px",
    borderRadius: 8,
    border: "1.5px solid " + (activeBorder || "#8f8676"),
    background: active ? activeBg || "#3a3324" : "transparent",
    color: active ? "#f2ead6" : "#6b6250",
    fontFamily: "inherit",
    fontSize: 12,
    cursor: "pointer",
    textAlign: "left",
  });

  return (
    <div
      className="stage"
      style={{
        width: "100%",
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
        <div style={{ fontSize: 17, letterSpacing: 6 }}>卦 台</div>
        <div style={{ fontSize: 10, color: "#8a6d1f" }}>
          v11 · ☯乾坤大挪移入列 · 地镜拆装订
        </div>
      </div>

      {/* 左上:先天圆图基准盘(HUD) */}
      {showBagua && (
        <div
          className="gua-reference"
          style={{
            position: "absolute",
            left: 12,
            top: 64,
            zIndex: 2,
            background: "rgba(242,234,214,0.75)",
            border: "1px solid #b8ae98",
            borderRadius: 10,
            padding: 5,
          }}
        >
          <canvas
            ref={baguaRef}
            width={300}
            height={300}
            style={{ width: 96, height: 96, display: "block" }}
          />
        </div>
      )}

      {/* 左上其二:先天圆图 · 左右镜像(单独盘) */}
      {showMirror && (
        <div
          className={`gua-reference ${showBagua ? "gua-split-after" : ""}`}
          style={{
            position: "absolute",
            left: 12,
            top: showBagua ? 178 : 64,
            zIndex: 2,
            background: "rgba(242,234,214,0.75)",
            border: "1px solid #b8ae98",
            borderRadius: 10,
            padding: 5,
          }}
        >
          <canvas
            ref={baguaMirrorRef}
            width={480}
            height={260}
            style={{ width: 192, height: 104, display: "block" }}
          />
          <div style={{ fontSize: 9, color: "#9a9078", textAlign: "center" }}>顺鱼线拆半 · 阳瓣D | 阴瓣ᗡ</div>
        </div>
      )}

      {/* ☰ 控制台 */}
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
          aria-expanded={menuOpen}
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
            className="stage-panel"
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
            <button onClick={toggleAutoSpin} style={btn(autoSpin)}>
              {autoSpin ? "自转 · 开" : "视角锁定 🔒"}
            </button>
            <button onClick={() => resetRef.current()} style={btn(false)}>
              ⟲ 全台复位
            </button>
            <button onClick={() => toggleLayer(0)} style={btn(vis[0])}>
              0 · 天地人三轴
            </button>
            <button onClick={() => toggleLayer(1)} style={btn(vis[1])}>
              1 · 立方体八卦
            </button>
            <button onClick={() => toggleLayer(2)} style={btn(vis[2])}>
              2 · 先天游龙(立体鱼)
            </button>
            <button
              onClick={() => {
                daNuoYiRef.current(!nuoyi);
                setNuoyi(!nuoyi);
              }}
              style={btn(nuoyi, "#7a1f1f", "#7a1f1f")}
            >
              ☯ 乾坤大挪移{nuoyi ? " · 已施" : ""}
            </button>
            <div style={{ fontSize: 10, color: "#9a9078", lineHeight: 1.5 }}>
              法理:阴鱼施地镜(拆装订)
              <br />机位跳地+正望 · 再按恢复操作前机位与自转
            </div>
            <button
              onClick={() => setShowBagua((s) => !s)}
              style={btn(showBagua)}
            >
              基准 · 先天圆图
            </button>
            <button
              onClick={() => setShowMirror((s) => !s)}
              style={btn(showMirror)}
            >
              基准 · 拆半盘(顺S切)
            </button>
            <div style={{ fontSize: 10, color: "#9a9078", lineHeight: 1.5 }}>
              乾(+,+,+) 坤(−,−,−)
              <br />
              对宫 = 四条体对角线
            </div>
          </div>
        )}
      </div>

      {/* 左下:机位仪表 */}
      <div
        className="stage-hud"
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

      {/* 右下:缩放滑杆 */}
      <div
        className="stage-zoom"
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
          aria-label="观察距离"
          onInput={(e) => {
            const v = parseFloat(e.target.value);
            台控Ref.current?.缩放(v);
          }}
          style={{ width: 110, accentColor: "#3a3324" }}
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
