/*
 * 3Dmol.js 渲染层。
 * 负责坐标转换、晶胞线框、元素图例、模型样式和移动端三指平移。
 */
(function () {
  const COLORS = {
    P: "#e6eef1",
    N: "#f0b44c",
    E: "#53c5d0",
    H: "#f7f7f2",
    X: "#8fa3ad",
    M: "#d7b66f",
    S: "#d95d50",
    I: "#53c5d0",
    Na: "#4f83d1",
    Cl: "#62b36f",
    Cs: "#9b72cf",
    Ca: "#f0b44c",
    F: "#64c6c0",
    A: "#d49b38",
    B: "#7865d6",
    O: "#d95d50",
    C: "#59636d"
  };

  const RADII = {
    P: 0.105,
    N: 0.26,
    E: 0.055,
    H: 0.09,
    X: 0.22,
    M: 0.15,
    S: 0.14,
    I: 0.075,
    Na: 0.12,
    Cl: 0.17,
    Cs: 0.18,
    Ca: 0.16,
    F: 0.1,
    A: 0.15,
    B: 0.13,
    O: 0.105,
    C: 0.12
  };

  const ELEMENT_NAMES = {
    P: "点阵点",
    N: "原子核",
    E: "电子",
    H: "H",
    X: "分子 / 原子团",
    M: "金属原子",
    S: "置换溶质原子",
    I: "间隙溶质原子",
    Na: "Na+",
    Cl: "Cl-",
    Cs: "Cs+",
    Ca: "Ca2+",
    F: "F-",
    A: "A 位离子",
    B: "B 位离子",
    O: "O2-",
    C: "C / Si / Ge"
  };

  const EDGE_LABEL_BG = "rgba(41,111,126,0.88)";
  const ANGLE_LABEL_BG = "rgba(121,77,17,0.9)";

  class CrystalRenderer {
    constructor(containerId, statusElement, legendElement) {
      this.container = document.getElementById(containerId);
      this.statusElement = statusElement;
      this.legendElement = legendElement;
      this.viewer = null;
      this.currentAtoms = [];
      this.currentCrystal = null;
      this.options = {
        showUnitCell: true,
        showLabels: true,
        modelStyle: "stick",
        supercell: 1
      };
    }

    init() {
      if (!window.$3Dmol) {
        this.setStatus("3Dmol.js 未载入，请检查网络或 CDN。");
        return false;
      }

      this.viewer = window.$3Dmol.createViewer(this.container, {
        backgroundColor: "#132a2e"
      });
      this.viewer.setViewStyle({ style: "outline", color: "#0b1719", width: 0.035 });
      this.bindTouchGestures();
      this.setStatus("拖动旋转，捏合缩放。");
      return true;
    }

    render(crystal, nextOptions = {}) {
      if (!this.viewer) return;

      this.currentCrystal = crystal;
      this.options = { ...this.options, ...nextOptions };
      this.viewer.clear();
      const effectiveSupercell = crystal.kind === "concept" ? 1 : this.options.supercell;
      this.currentAtoms = this.buildAtoms(crystal, effectiveSupercell);

      this.addAtoms();
      if (this.options.modelStyle === "stick" && crystal.bondDistance > 0) {
        this.addBonds(crystal);
      }
      if (this.options.showUnitCell && crystal.lattice) {
        this.addUnitCells(crystal, effectiveSupercell);
      }
      if (this.options.showLabels && crystal.kind === "bravais" && effectiveSupercell === 1) {
        this.addLatticeAnnotations(crystal);
      }

      this.updateLegend();
      this.viewer.zoomTo();
      this.viewer.render();

      const cellText = crystal.kind === "concept" ? "概念示意" : (this.options.supercell === 1 ? "1 个晶胞" : "2×2×2 晶胞");
      this.setStatus(`${crystal.chineseName} · ${cellText}`);
    }

    updateOptions(nextOptions) {
      if (!this.currentCrystal) return;
      this.render(this.currentCrystal, nextOptions);
    }

    resetView() {
      if (!this.viewer) return;
      this.viewer.zoomTo();
      this.viewer.rotate(18, { x: 1, y: 0, z: 0 });
      this.viewer.rotate(-28, { x: 0, y: 1, z: 0 });
      this.viewer.render();
    }

    buildAtoms(crystal, supercell) {
      const atoms = [];
      const seen = new Set();
      const transform = getLatticeTransform(crystal.lattice || {});

      for (let i = 0; i < supercell; i += 1) {
        for (let j = 0; j < supercell; j += 1) {
          for (let k = 0; k < supercell; k += 1) {
            crystal.atoms.forEach((atom) => {
              const cart = atom.coord === "cart"
                ? offsetCartesian(atom, crystal.lattice, i, j, k)
                : transform(atom.x + i, atom.y + j, atom.z + k);

              const key = `${atom.elem}:${cart.x.toFixed(4)},${cart.y.toFixed(4)},${cart.z.toFixed(4)}`;
              if (seen.has(key)) return;
              seen.add(key);

              atoms.push({
                ...atom,
                cell: [i, j, k],
                x: cart.x,
                y: cart.y,
                z: cart.z
              });
            });
          }
        }
      }
      return atoms;
    }

    addAtoms() {
      this.currentAtoms.forEach((atom) => {
        const base = RADII[atom.elem] || 0.13;
        const radius = this.options.modelStyle === "spacefill" ? base * 1.58 : base;
        this.viewer.addSphere({
          center: { x: atom.x, y: atom.y, z: atom.z },
          radius,
          color: COLORS[atom.elem] || COLORS.P,
          opacity: 1
        });
      });
    }

    addBonds(crystal) {
      this.currentAtoms.forEach((a, firstIndex) => {
        this.currentAtoms.slice(firstIndex + 1).forEach((b) => {
          if (!shouldBond(crystal, a, b)) return;
          this.viewer.addCylinder({
            start: { x: a.x, y: a.y, z: a.z },
            end: { x: b.x, y: b.y, z: b.z },
            radius: 0.025,
            color: "#d9e3df",
            fromCap: 1,
            toCap: 1
          });
        });
      });
    }

    addUnitCells(crystal, supercell) {
      for (let i = 0; i < supercell; i += 1) {
        for (let j = 0; j < supercell; j += 1) {
          for (let k = 0; k < supercell; k += 1) {
            if (crystal.lattice?.type === "hex") {
              drawHexCell(this.viewer, crystal.lattice, i, j, k);
            } else {
              drawBoxCell(this.viewer, getLatticeTransform(crystal.lattice), i, j, k);
            }
          }
        }
      }
    }

    addLatticeAnnotations(crystal) {
      if (crystal.lattice?.type === "hex") {
        const origin = { x: 0, y: 0, z: -0.72 };
        const aAxis = { x: 0.86, y: 0.5, z: 0 };
        const bAxis = { x: -0.86, y: 0.5, z: 0 };
        drawGuide(this.viewer, origin, add(origin, aAxis), "#54c6b8");
        drawGuide(this.viewer, origin, add(origin, bAxis), "#7aa4ff");
        drawGuide(this.viewer, origin, { x: 0, y: 0, z: 0.72 }, "#efc66b");
        this.viewer.addLabel("a=b", {
          position: { x: 0.55, y: 0.12, z: -0.95 },
          fontColor: "#ffffff",
          backgroundColor: EDGE_LABEL_BG,
          fontSize: 12,
          inFront: true
        });
        this.viewer.addLabel("c", {
          position: { x: 0.1, y: 0.08, z: 0 },
          fontColor: "#ffffff",
          backgroundColor: EDGE_LABEL_BG,
          fontSize: 12,
          inFront: true
        });
        if (crystal.kind === "bravais") {
          drawAngleArcBetween(this.viewer, origin, aAxis, bAxis, 0.32, "γ", "#f3a546");
        }
        return;
      }

      const transform = getLatticeTransform(crystal.lattice || {});
      const origin = { x: 0, y: 0, z: 0 };
      const a = transform(1, 0, 0);
      const b = transform(0, 1, 0);
      const c = transform(0, 0, 1);
      drawGuide(this.viewer, origin, a, "#54c6b8");
      drawGuide(this.viewer, origin, b, "#7aa4ff");
      drawGuide(this.viewer, origin, c, "#efc66b");
      const labels = [
        { text: "a", position: midpoint({ x: 0, y: 0, z: 0 }, a) },
        { text: "b", position: midpoint({ x: 0, y: 0, z: 0 }, b) },
        { text: "c", position: midpoint({ x: 0, y: 0, z: 0 }, c) }
      ];

      labels.forEach((item) => {
        this.viewer.addLabel(item.text, {
          position: item.position,
          fontColor: "#ffffff",
          backgroundColor: EDGE_LABEL_BG,
          fontSize: 12,
          inFront: true
        });
      });

      if (crystal.kind === "bravais") {
        drawAngleArcBetween(this.viewer, origin, subtract(b, origin), subtract(c, origin), 0.22, "α", "#62b36f");
        drawAngleArcBetween(this.viewer, origin, subtract(a, origin), subtract(c, origin), 0.3, "β", "#7865d6");
        drawAngleArcBetween(this.viewer, origin, subtract(a, origin), subtract(b, origin), 0.38, "γ", "#f3a546");
      }
    }

    updateLegend() {
      if (!this.legendElement) return;
      this.legendElement.classList.toggle("is-hidden", !this.options.showLabels);

      const elements = [...new Set(this.currentAtoms.map((atom) => atom.elem))];
      this.legendElement.innerHTML = elements.map((elem) => {
        const color = COLORS[elem] || COLORS.P;
        const name = ELEMENT_NAMES[elem] || elem;
        return `<div class="legend-item"><span class="legend-swatch" style="background:${color}"></span><span>${name}</span></div>`;
      }).join("");
    }

    bindTouchGestures() {
      let lastThreeFingerCenter = null;

      this.container.addEventListener("touchstart", (event) => {
        if (event.touches.length === 3) {
          lastThreeFingerCenter = getTouchCenter(event.touches);
          event.preventDefault();
        }
      }, { passive: false });

      this.container.addEventListener("touchmove", (event) => {
        if (event.touches.length === 3 && lastThreeFingerCenter) {
          const center = getTouchCenter(event.touches);
          const dx = center.x - lastThreeFingerCenter.x;
          const dy = center.y - lastThreeFingerCenter.y;
          this.viewer.translate(dx * 0.32, -dy * 0.32);
          this.viewer.render();
          lastThreeFingerCenter = center;
          event.preventDefault();
        }
      }, { passive: false });

      this.container.addEventListener("touchend", () => {
        lastThreeFingerCenter = null;
      });
    }

    setStatus(text) {
      if (this.statusElement) this.statusElement.textContent = text;
    }
  }

  function shouldBond(crystal, a, b) {
    if (samePoint(a, b)) return false;
    if (distance(a, b) > crystal.bondDistance) return false;
    if (["nacl", "cscl", "caf2", "perovskite"].includes(crystal.id) && a.elem === b.elem) return false;
    if (crystal.id === "perovskite" && ![a.elem, b.elem].includes("B")) return false;
    if (crystal.id === "diamond" && a.elem !== b.elem) return false;
    return true;
  }

  function getLatticeTransform(lattice = {}) {
    const a = lattice.a || 1;
    const b = lattice.b || 1;
    const c = lattice.c || 1;
    const alphaShift = lattice.alphaShift || 0;
    const betaShift = lattice.betaShift || 0;

    return (u, v, w) => ({
      x: a * u + betaShift * w,
      y: b * v + alphaShift * w,
      z: c * w
    });
  }

  function offsetCartesian(atom, lattice, i, j, k) {
    const radius = lattice?.radius || 1;
    const c = lattice?.c || 1.5;
    return {
      x: atom.x + i * radius * 2.25,
      y: atom.y + j * radius * 2.0,
      z: atom.z * c + k * c
    };
  }

  function midpoint(a, b) {
    return {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      z: (a.z + b.z) / 2
    };
  }

  function drawBoxCell(viewer, transform, i, j, k) {
    const points = [
      transform(i, j, k), transform(i + 1, j, k), transform(i, j + 1, k), transform(i + 1, j + 1, k),
      transform(i, j, k + 1), transform(i + 1, j, k + 1), transform(i, j + 1, k + 1), transform(i + 1, j + 1, k + 1)
    ];
    drawEdges(viewer, points, [[0, 1], [0, 2], [1, 3], [2, 3], [4, 5], [4, 6], [5, 7], [6, 7], [0, 4], [1, 5], [2, 6], [3, 7]]);
  }

  function drawHexCell(viewer, lattice, i, j, k) {
    const radius = lattice?.radius || 1;
    const c = lattice?.c || 1.5;
    const cx = i * radius * 2.25;
    const cy = j * radius * 2.0;
    const cz = k * c;
    const bottom = [];
    const top = [];

    for (let n = 0; n < 6; n += 1) {
      const angle = Math.PI / 6 + n * Math.PI / 3;
      bottom.push({ x: cx + Math.cos(angle), y: cy + Math.sin(angle), z: cz - c / 2 });
      top.push({ x: cx + Math.cos(angle), y: cy + Math.sin(angle), z: cz + c / 2 });
    }

    drawEdges(viewer, [...bottom, ...top], [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 6], [0, 6], [1, 7], [2, 8], [3, 9], [4, 10], [5, 11]]);
  }

  function drawEdges(viewer, points, edges) {
    edges.forEach(([from, to]) => {
      viewer.addCylinder({
        start: points[from],
        end: points[to],
        radius: 0.016,
        color: "#efc66b",
        fromCap: 1,
        toCap: 1
      });
    });
  }

  function drawGuide(viewer, start, end, color, radius = 0.026) {
    viewer.addCylinder({
      start,
      end,
      radius,
      color,
      fromCap: 1,
      toCap: 1
    });
  }

  function drawAngleArcBetween(viewer, origin, firstVector, secondVector, radius, symbol, color) {
    const first = normalize(firstVector);
    const second = normalize(secondVector);
    const dotValue = Math.max(-1, Math.min(1, dot(first, second)));
    const angle = Math.acos(dotValue);
    const segments = 24;
    let previous = add(origin, scale(first, radius));

    for (let i = 1; i <= segments; i += 1) {
      const t = i / segments;
      const current = add(origin, scale(slerpUnit(first, second, angle, t), radius));
      drawGuide(viewer, previous, current, color, 0.008);
      previous = current;
    }

    const midDirection = slerpUnit(first, second, angle, 0.5);
    const mid = add(origin, scale(midDirection, radius + 0.075));
    viewer.addLabel(symbol, {
      position: mid,
      fontColor: "#ffffff",
      backgroundColor: ANGLE_LABEL_BG,
      fontSize: 11,
      inFront: true
    });
  }

  function slerpUnit(first, second, angle, t) {
    if (angle < 0.001) return first;
    const sinAngle = Math.sin(angle);
    return normalize(add(
      scale(first, Math.sin((1 - t) * angle) / sinAngle),
      scale(second, Math.sin(t * angle) / sinAngle)
    ));
  }

  function add(a, b) {
    return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
  }

  function subtract(a, b) {
    return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  }

  function scale(vector, amount) {
    return { x: vector.x * amount, y: vector.y * amount, z: vector.z * amount };
  }

  function dot(a, b) {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  function normalize(vector) {
    const length = Math.sqrt(dot(vector, vector)) || 1;
    return scale(vector, 1 / length);
  }

  function getTouchCenter(touches) {
    const list = Array.from(touches);
    return {
      x: list.reduce((sum, touch) => sum + touch.clientX, 0) / list.length,
      y: list.reduce((sum, touch) => sum + touch.clientY, 0) / list.length
    };
  }

  function samePoint(a, b) {
    return Math.abs(a.x - b.x) < 0.001 && Math.abs(a.y - b.y) < 0.001 && Math.abs(a.z - b.z) < 0.001;
  }

  function distance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  window.CrystalRenderer = CrystalRenderer;
})();
