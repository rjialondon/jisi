import * as THREE from "three";

// 三台共用行止：角度以秒计，静止不排下一帧，隐藏时不追补旧时间。
const 衰减率 = -60 * Math.log(0.98);
export function 积分余速(速度, 秒数, 底速 = 0) {
  const 衰减 = Math.exp(-衰减率 * 秒数);
  return {
    角度: 底速 * 秒数 + (速度 - 底速) * (1 - 衰减) / 衰减率,
    速度: 底速 + (速度 - 底速) * 衰减,
  };
}

export function 释放场景(scene, renderer) {
  const 几何 = new Set(), 材质 = new Set(), 纹理 = new Set();
  scene.traverse((物) => {
    if (物.geometry) 几何.add(物.geometry);
    if (物.material) {
      for (const 材 of Array.isArray(物.material) ? 物.material : [物.material]) {
        材质.add(材);
        for (const 值 of Object.values(材)) if (值?.isTexture) 纹理.add(值);
      }
    }
  });
  for (const 值 of [scene.background, scene.environment]) if (值?.isTexture) 纹理.add(值);
  几何.forEach((物) => 物.dispose());
  材质.forEach((物) => 物.dispose());
  纹理.forEach((物) => 物.dispose());
  scene.clear();
  renderer.dispose();
  renderer.forceContextLoss();
  renderer.domElement.remove();
}

export function 建立台控({
  mount, scene, world, camera, renderer, hudRef, zoomSliderRef,
  autoSpinRef, 持续行功 = () => false, 行功 = () => {}, 转向 = () => {}, 最远 = 40,
}) {
  const 画布 = renderer.domElement;
  画布.style.touchAction = "none";
  画布.setAttribute("aria-label", "三维演示：拖动旋转，双指或滚轮缩放");
  const 手指 = new Map();
  const 逆姿 = new THREE.Quaternion(), 位置 = new THREE.Vector3(), 单位 = new THREE.Vector3();
  const 右 = new THREE.Vector3(), 上 = new THREE.Vector3(), 转 = new THREE.Quaternion();
  // 竖屏首开按较窄的水平视场退机位，避免八卦骨架一进场就被裁去。
  camera.position.multiplyScalar(Math.max(1, mount.clientHeight / Math.max(mount.clientWidth, 1)));
  camera.position.clampLength(2.5, 最远);
  camera.lookAt(0, 0, 0);
  const 初机位 = camera.position.clone();
  let 横速 = 0.24, 纵速 = 0, 帧 = null, 前时 = null, 已收 = false;
  let 上次仪表 = -Infinity, 仪表待写 = true;
  const 监听 = [];
  function 听(目标, 名, 法, 选项) {
    目标.addEventListener(名, 法, 选项);
    监听.push(() => 目标.removeEventListener(名, 法, 选项));
  }
  function 转世界(横, 纵) {
    右.setFromMatrixColumn(camera.matrixWorld, 0);
    上.setFromMatrixColumn(camera.matrixWorld, 1);
    world.quaternion.premultiply(转.setFromAxisAngle(上, 横));
    world.quaternion.premultiply(转.setFromAxisAngle(右, 纵));
    world.quaternion.normalize();
  }
  function 仪表(时) {
    if (!仪表待写 && 时 - 上次仪表 < 100) return;
    逆姿.copy(world.quaternion).invert();
    位置.copy(camera.position).applyQuaternion(逆姿);
    const 距 = 位置.length();
    单位.copy(位置).normalize();
    const 字 = `地 ${单位.x >= 0 ? "+" : ""}${单位.x.toFixed(3)}  ` +
      `天 ${单位.y >= 0 ? "+" : ""}${单位.y.toFixed(3)}  ` +
      `人 ${单位.z >= 0 ? "+" : ""}${单位.z.toFixed(3)}  距 ${距.toFixed(2)}`;
    if (hudRef.current && hudRef.current.textContent !== 字) hudRef.current.textContent = 字;
    if (zoomSliderRef?.current) {
      const 滑杆 = zoomSliderRef.current;
      const 新值 = 距.toFixed(1);
      if (滑杆.value !== 新值) 滑杆.value = 新值;
    }
    上次仪表 = 时;
    仪表待写 = false;
  }
  function 应续() {
    return (autoSpinRef.current && 手指.size === 0) || 持续行功();
  }
  function 绘(时) {
    帧 = null;
    if (已收 || document.hidden) { 前时 = null; return; }
    const 秒 = 前时 === null ? 0 : Math.min(Math.max((时 - 前时) / 1000, 0), 0.1);
    前时 = 时;
    if (autoSpinRef.current && 手指.size === 0) {
      const 横 = 积分余速(横速, 秒, 横速 < 0 ? -0.09 : 0.09);
      const 纵 = 积分余速(纵速, 秒);
      转世界(横.角度, 纵.角度);
      横速 = 横.速度;
      纵速 = 纵.速度;
    }
    行功(秒);
    仪表(时);
    renderer.render(scene, camera);
    if (应续()) 帧 = requestAnimationFrame(绘);
    else 前时 = null;
  }
  function 唤醒() {
    仪表待写 = true;
    if (!已收 && !document.hidden && 帧 === null) 帧 = requestAnimationFrame(绘);
  }
  function 清手() {
    const 编号 = [...手指.keys()];
    手指.clear();
    for (const 号 of 编号) if (画布.hasPointerCapture(号)) 画布.releasePointerCapture(号);
    横速 = 纵速 = 0;
  }
  function 收帧() {
    if (帧 !== null) cancelAnimationFrame(帧);
    帧 = null;
    前时 = null;
  }
  function 缩放(距离) {
    if (!Number.isFinite(距离)) return;
    camera.position.setLength(THREE.MathUtils.clamp(距离, 2.5, 最远));
    唤醒();
  }
  function 间距() {
    const [甲, 乙] = 手指.values();
    return Math.hypot(甲.x - 乙.x, 甲.y - 乙.y);
  }
  听(画布, "pointerdown", (事) => {
    if (事.pointerType === "mouse" && 事.button !== 0) return;
    手指.set(事.pointerId, { x: 事.clientX, y: 事.clientY });
    画布.setPointerCapture(事.pointerId);
    横速 = 纵速 = 0;
    唤醒();
  });
  听(画布, "pointermove", (事) => {
    const 旧 = 手指.get(事.pointerId);
    if (!旧) return;
    const 旧距 = 手指.size === 2 ? 间距() : 0;
    手指.set(事.pointerId, { x: 事.clientX, y: 事.clientY });
    if (手指.size === 2) {
      const 新距 = 间距();
      if (旧距 > 0 && 新距 > 0) 缩放(camera.position.length() * 旧距 / 新距);
    } else if (手指.size === 1) {
      const 横差 = 事.clientX - 旧.x, 纵差 = 事.clientY - 旧.y;
      if (横差 || 纵差) {
        转向();
        转世界(横差 * 0.008, 纵差 * 0.008);
        // 余速取稳定的角速度；不把触摸事件频率当作时间尺度。
        横速 = Math.sign(横差) * 0.24;
        纵速 = Math.sign(纵差) * 0.12;
      }
    }
    唤醒();
  });
  const 放手 = (事) => {
    if (!手指.delete(事.pointerId)) return;
    if (画布.hasPointerCapture(事.pointerId)) 画布.releasePointerCapture(事.pointerId);
    唤醒();
  };
  听(画布, "pointerup", 放手);
  听(画布, "pointercancel", 放手);
  听(画布, "lostpointercapture", 放手);
  听(window, "blur", () => { 清手(); 唤醒(); });
  听(画布, "wheel", (事) => {
    事.preventDefault();
    const 像素 = 事.deltaY * (事.deltaMode === 1 ? 16 : 事.deltaMode === 2 ? mount.clientHeight : 1);
    缩放(camera.position.length() * Math.exp(THREE.MathUtils.clamp(像素 * 0.001, -1, 1)));
  }, { passive: false });
  听(document, "visibilitychange", () => {
    清手();
    收帧();
    if (!document.hidden) 唤醒();
  });
  const 改尺寸 = () => {
    const 宽 = Math.max(mount.clientWidth, 1), 高 = Math.max(mount.clientHeight, 1);
    camera.aspect = 宽 / 高;
    camera.updateProjectionMatrix();
    renderer.setSize(宽, 高);
    唤醒();
  };
  const 尺寸观察 = new ResizeObserver(改尺寸);
  尺寸观察.observe(mount);
  唤醒();
  return {
    唤醒, 缩放,
    清余速() { 横速 = 纵速 = 0; 唤醒(); },
    存机位() {
      return { 姿态: world.quaternion.clone(), 机位: camera.position.clone(), 自转: autoSpinRef.current, 横速, 纵速 };
    },
    还机位(旧) {
      清手();
      world.quaternion.copy(旧.姿态);
      camera.position.copy(旧.机位);
      camera.lookAt(0, 0, 0);
      autoSpinRef.current = 旧.自转;
      横速 = 旧.横速;
      纵速 = 旧.纵速;
      前时 = null;
      唤醒();
    },
    复位() {
      清手();
      world.quaternion.identity();
      camera.position.copy(初机位);
      camera.lookAt(0, 0, 0);
      横速 = autoSpinRef.current ? 0.24 : 0;
      前时 = null;
      唤醒();
    },
    收台() {
      if (已收) return;
      已收 = true;
      收帧();
      监听.forEach((撤) => 撤());
      清手();
      尺寸观察.disconnect();
      释放场景(scene, renderer);
    },
  };
}
