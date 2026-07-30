import React, { useState } from "react";
import TaijiTai from "./stages/TaijiTai.jsx";
import ZhouTianTai from "./stages/ZhouTianTai.jsx";
import GuaTai from "./stages/GuaTai.jsx";

// 单页演示：三台顶部切换，无门厅、无说明。
// 各台自占四角——台名左上、控制台右上、仪表左下、缩放右下；正上方留空，切换条即落于此。
// 只挂当前一台：各台 useEffect 归还处已备 cancelAnimationFrame + renderer.dispose()，
// 故切台即真卸载，不积压 WebGL 上下文。
const 台 = [
  { key: "taiji", name: "太 极", Comp: TaijiTai },
  { key: "zhoutian", name: "周 天", Comp: ZhouTianTai },
  { key: "gua", name: "卦 台", Comp: GuaTai },
];

export default function App() {
  const [活, 设活] = useState("taiji");
  const 当前 = 台.find((t) => t.key === 活) ?? 台[0];
  const Comp = 当前.Comp;

  return (
    <>
      <nav
        style={{
          position: "fixed",
          top: 10,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 99,
          display: "flex",
          gap: 6,
          padding: 4,
          borderRadius: 12,
          border: "1.5px solid #8f8676",
          background: "rgba(242,234,214,0.92)",
          backdropFilter: "blur(4px)",
        }}
      >
        {台.map((t) => {
          const on = t.key === 活;
          return (
            <button
              key={t.key}
              onClick={() => 设活(t.key)}
              style={{
                fontSize: 13,
                letterSpacing: 2,
                padding: "6px 14px",
                borderRadius: 9,
                border: "none",
                cursor: "pointer",
                fontFamily: "'Noto Serif SC', 'Songti SC', serif",
                background: on ? "#3a3324" : "transparent",
                color: on ? "#f2ead6" : "#5a4e3a",
                transition: "background .15s ease, color .15s ease",
              }}
            >
              {t.name}
            </button>
          );
        })}
      </nav>

      {/* key 令切台时整台重挂，不复用上一台的 three.js 场景 */}
      <Comp key={当前.key} />
    </>
  );
}
