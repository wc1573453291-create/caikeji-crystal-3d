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
    Zn: "#4f9ac8",
    Su: "#e5c34f",
    Ti: "#7180d8",
    Mg: "#e7a44c",
    Al: "#9b87d5",
    C: "#59636d",
    TET: "#00d9ff",
    OCT: "#ff3d71"
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
    Zn: 0.13,
    Su: 0.165,
    Ti: 0.13,
    Mg: 0.145,
    Al: 0.12,
    C: 0.12,
    TET: 0.07,
    OCT: 0.082
  };

  const INTERSTITIAL_CAGE_COLORS = {
    tetra: "#a99bff",
    octa: "#54d6a0"
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
    Zn: "Zn2+",
    Su: "S2-",
    Ti: "Ti4+",
    Mg: "Mg2+",
    Al: "Al3+",
    C: "C / Si / Ge",
    TET: "四面体间隙原子",
    OCT: "八面体间隙原子"
  };

  const EDGE_LABEL_BG = "rgba(41,111,126,0.88)";
  const ANGLE_LABEL_BG = "rgba(121,77,17,0.9)";
  const USE_IPAD_WEBGL_COMPATIBILITY = isIPadOS();

  // 3Dmol 2.5.5 directly references OffscreenCanvas during viewer creation.
  // Older iPadOS releases do not define it, while newer Safari builds may not
  // provide the bitmap renderer used by 3Dmol. Use the regular canvas path.
  if (USE_IPAD_WEBGL_COMPATIBILITY || typeof window.OffscreenCanvas === "undefined") {
    try {
      Object.defineProperty(window, "OffscreenCanvas", {
        configurable: true,
        writable: true,
        value: null
      });
    } catch (error) {
      console.warn("Unable to disable OffscreenCanvas compatibility path", error);
      window.OffscreenCanvas = null;
    }
  }

  class CrystalRenderer {
    constructor(containerId, statusElement, legendElement) {
      this.container = document.getElementById(containerId);
      this.statusElement = statusElement;
      this.legendElement = legendElement;
      this.viewer = null;
      this.currentAtoms = [];
      this.currentCrystal = null;
      this.interstitialSelectionHandler = null;
      this.options = {
        showUnitCell: true,
        showLabels: true,
        modelStyle: "stick",
        supercell: 1,
        showTetraSites: false,
        showOctaSites: false,
        selectedInterstitialKey: ""
      };
    }

    init() {
      if (!window.$3Dmol) {
        this.setStatus("3Dmol.js 未载入，请检查网络或 CDN。");
        return false;
      }

      try {
        this.viewer = window.$3Dmol.createViewer(this.container, {
          backgroundColor: "#132a2e",
          antialias: !USE_IPAD_WEBGL_COMPATIBILITY
        });
      } catch (error) {
        console.error("3D viewer initialization failed", error);
        this.setStatus("3D 图形初始化失败，请刷新页面后重试。");
        return false;
      }

      // iPad Safari/内置浏览器共用 WebKit。关闭轮廓后处理可减少空白画布和上下文丢失。
      if (!USE_IPAD_WEBGL_COMPATIBILITY) {
        this.viewer.setViewStyle({ style: "outline", color: "#0b1719", width: 0.035 });
      }
      this.container.dataset.renderMode = USE_IPAD_WEBGL_COMPATIBILITY ? "ipad-compatibility" : "standard";
      this.bindWebGLRecovery();
      this.bindTouchGestures();
      this.setStatus("拖动旋转，捏合缩放。");
      return true;
    }

    setInterstitialSelectionHandler(handler) {
      this.interstitialSelectionHandler = handler;
    }

    render(crystal, nextOptions = {}) {
      if (!this.viewer) return;

      this.currentCrystal = crystal;
      this.options = { ...this.options, ...nextOptions };
      this.viewer.clear();
      const effectiveSupercell = crystal.kind === "concept" ? 1 : this.options.supercell;
      const isMetalCrystal = ["fcc", "bcc", "hcp"].includes(crystal.id);
      this.currentAtoms = this.buildAtoms(crystal, effectiveSupercell);

      this.addAtoms();
      const showAtomicBonds = ![
        "fcc", "bcc", "hcp",
        "substitutional-solid-solution", "interstitial-solid-solution"
      ].includes(crystal.id);
      if (showAtomicBonds && this.options.modelStyle === "stick" && crystal.bondDistance > 0) {
        this.addBonds(crystal);
      }
      if (this.options.showUnitCell && crystal.lattice) {
        this.addUnitCells(crystal, effectiveSupercell);
      }
      this.addInterstitialSites(crystal, effectiveSupercell);
      if (this.options.showLabels && crystal.kind === "bravais" && effectiveSupercell === 1) {
        this.addLatticeAnnotations(crystal);
      }

      this.updateLegend();
      this.viewer.zoomTo();
      if (isMetalCrystal) {
        this.viewer.zoom(metalCrystalZoom(crystal, effectiveSupercell));
      } else {
        this.viewer.zoom(teachingStructureZoom(crystal, effectiveSupercell));
      }
      this.viewer.render();

      const cellText = crystal.kind === "concept" ? "概念示意" : (this.options.supercell === 1 ? "1 个晶胞" : "2×2×2 晶胞");
      const hasSelectedSite = Boolean(this.options.selectedInterstitialKey);
      const siteName = crystal.interstitialSites && this.options.showTetraSites
        ? "四面体间隙"
        : (crystal.interstitialSites && this.options.showOctaSites ? "八面体间隙" : "");
      const selectedText = siteName && hasSelectedSite ? " · 已选中" : "";
      const actionText = siteName ? (hasSelectedSite ? "再次点按恢复" : "点按小球查看") : "";
      this.setStatus(`${crystal.chineseName} · ${cellText}${siteName ? ` · ${siteName}` : ""}${selectedText}`, actionText);
    }

    updateOptions(nextOptions) {
      if (!this.currentCrystal) return;
      this.render(this.currentCrystal, nextOptions);
    }

    resetView() {
      if (!this.viewer) return;
      this.viewer.zoomTo();
      if (["fcc", "bcc", "hcp"].includes(this.currentCrystal?.id)) {
        this.viewer.zoom(metalCrystalZoom(this.currentCrystal, this.options.supercell));
      } else {
        this.viewer.zoom(teachingStructureZoom(this.currentCrystal, this.options.supercell));
      }
      const bccOctaView = this.currentCrystal?.id === "bcc" && this.options.showOctaSites;
      this.viewer.rotate(bccOctaView ? 48 : 18, { x: 1, y: 0, z: 0 });
      this.viewer.rotate(bccOctaView ? -18 : -28, { x: 0, y: 1, z: 0 });
      this.viewer.render();
    }

    buildAtoms(crystal, supercell) {
      if (crystal.lattice?.type === "hex-primitive") {
        return buildHexPrimitiveAtoms(crystal.lattice, supercell);
      }
      if (crystal.lattice?.type === "hcp-honeycomb") {
        return buildHcpHoneycombAtoms(crystal.lattice, supercell);
      }
      if (crystal.lattice?.type === "wurtzite-honeycomb") {
        return buildWurtziteHoneycombAtoms(crystal.lattice, supercell);
      }

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

    addInterstitialSites(crystal, supercell) {
      if (!crystal.interstitialSites) return;

      const siteType = this.options.showTetraSites ? "tetra" : (this.options.showOctaSites ? "octa" : "");
      if (!siteType) return;

      const candidates = buildInterstitialAtoms(crystal, siteType, supercell);
      const detail = crystal.interstitialDetails?.[siteType];
      const color = COLORS[siteType === "tetra" ? "TET" : "OCT"];
      const cageColor = INTERSTITIAL_CAGE_COLORS[siteType];
      const metalRadius = RADII.M * (this.options.modelStyle === "spacefill" ? 1.58 : 1);
      const radius = Math.max(
        metalRadius * (detail?.ratioValue || 0.2),
        this.options.modelStyle === "spacefill" ? 0.058 : 0.045
      );
      const selectedSite = candidates.find((site) => pointKey(site) === this.options.selectedInterstitialKey);

      if (this.options.selectedInterstitialKey && !selectedSite) {
        this.options.selectedInterstitialKey = "";
      }

      candidates.forEach((site) => {
        const isSelected = selectedSite && samePoint(site, selectedSite);
        this.viewer.addSphere({
          center: pointFrom(site),
          radius: isSelected ? radius * 1.12 : radius,
          color,
          opacity: isSelected ? 1 : 0.9,
          clickable: true,
          callback: () => this.selectInterstitialSite(siteType, site)
        });
      });

      if (!selectedSite) return;

      const neighbors = representativeNeighborAtoms(crystal, siteType, selectedSite, this.currentAtoms);

      neighbors.forEach((atom) => {
        const isExistingAtom = this.currentAtoms.some((current) => current.elem === "M" && samePoint(current, atom));
        if (!isExistingAtom) {
          this.viewer.addSphere({ center: pointFrom(atom), radius: metalRadius, color: COLORS.M, opacity: 1 });
        }
        drawGuide(this.viewer, pointFrom(selectedSite), pointFrom(atom), cageColor, 0.012);
      });
      drawCageEdges(this.viewer, neighbors, cageColor, 0.014);

      this.viewer.addSphere({ center: pointFrom(selectedSite), radius: radius * 1.62, color, opacity: 0.2 });
      if (this.options.showLabels) {
        this.viewer.addLabel("间隙原子 r", {
          position: { x: selectedSite.x + 0.16, y: selectedSite.y + 0.14, z: selectedSite.z + 0.14 },
          fontColor: "#ffffff",
          backgroundColor: siteType === "tetra" ? "rgba(0,113,143,0.94)" : "rgba(176,27,70,0.94)",
          fontSize: 11,
          inFront: true
        });
      }
    }

    selectInterstitialSite(siteType, site) {
      if (!this.viewer || !this.currentCrystal) return;
      const view = this.viewer.getView();
      const key = pointKey(site);
      const nextKey = this.options.selectedInterstitialKey === key ? "" : key;
      this.options.selectedInterstitialKey = nextKey;
      this.render(this.currentCrystal);
      this.viewer.setView(view);
      this.viewer.render();
      if (this.interstitialSelectionHandler) {
        this.interstitialSelectionHandler({ crystal: this.currentCrystal, siteType, key: nextKey, site });
      }
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
      if (crystal.lattice?.type === "hex-primitive") {
        drawHexPrimitiveSupercell(this.viewer, crystal.lattice, supercell);
        return;
      }
      if (["hcp-honeycomb", "wurtzite-honeycomb"].includes(crystal.lattice?.type)) {
        drawHcpHoneycombSupercell(this.viewer, crystal.lattice, supercell);
        return;
      }

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
      if (crystal.lattice?.type === "hex-primitive") {
        const origin = hexPrimitivePoint(crystal.lattice, 0, 0, 0);
        const aAxis = subtract(hexPrimitivePoint(crystal.lattice, 1, 0, 0), origin);
        const bAxis = subtract(hexPrimitivePoint(crystal.lattice, 0, 1, 0), origin);
        const cAxis = subtract(hexPrimitivePoint(crystal.lattice, 0, 0, 1), origin);
        drawGuide(this.viewer, origin, add(origin, aAxis), "#54c6b8");
        drawGuide(this.viewer, origin, add(origin, bAxis), "#7aa4ff");
        drawGuide(this.viewer, origin, add(origin, cAxis), "#efc66b");
        this.viewer.addLabel("a=b", {
          position: add(origin, scale(add(normalize(aAxis), normalize(bAxis)), 0.38)),
          fontColor: "#ffffff",
          backgroundColor: EDGE_LABEL_BG,
          fontSize: 12,
          inFront: true
        });
        this.viewer.addLabel("c", {
          position: add(origin, scale(cAxis, 0.5)),
          fontColor: "#ffffff",
          backgroundColor: EDGE_LABEL_BG,
          fontSize: 12,
          inFront: true
        });
        drawAngleArcBetween(this.viewer, origin, aAxis, bAxis, 0.32, "γ", "#f3a546");
        return;
      }

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
      if (this.currentCrystal?.interstitialSites && this.options.showTetraSites) elements.push("TET");
      if (this.currentCrystal?.interstitialSites && this.options.showOctaSites) elements.push("OCT");
      const atomLegend = elements.map((elem) => {
        const color = COLORS[elem] || COLORS.P;
        const name = ELEMENT_NAMES[elem] || elem;
        return `<div class="legend-item"><span class="legend-swatch" style="background:${color}"></span><span>${window.formatScientificText(name)}</span></div>`;
      }).join("");
      const siteType = this.options.showTetraSites ? "tetra" : (this.options.showOctaSites ? "octa" : "");
      const cageLegend = siteType && this.options.selectedInterstitialKey
        ? `<div class="legend-item"><span class="legend-line" style="background:${INTERSTITIAL_CAGE_COLORS[siteType]}"></span><span>配位多面体边</span></div>`
        : "";
      this.legendElement.innerHTML = atomLegend + cageLegend;
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

    bindWebGLRecovery() {
      const canvas = this.container.querySelector("canvas");
      if (!canvas) return;

      canvas.addEventListener("webglcontextlost", (event) => {
        event.preventDefault();
        this.setStatus("3D 图形暂时中断，正在恢复...");
      });
      canvas.addEventListener("webglcontextrestored", () => {
        if (this.currentCrystal) this.render(this.currentCrystal);
      });
    }

    setStatus(text, actionText = "") {
      if (!this.statusElement) return;
      this.statusElement.innerHTML = window.formatScientificText(text);
      if (!actionText) return;
      const action = document.createElement("strong");
      action.className = "viewer-status-action";
      action.textContent = actionText;
      this.statusElement.appendChild(document.createTextNode(" "));
      this.statusElement.appendChild(action);
    }
  }

  class InterstitialRenderer {
    constructor(containerId) {
      this.container = document.getElementById(containerId);
      this.viewer = null;
    }

    init() {
      if (!this.container || !window.$3Dmol) return false;
      this.viewer = window.$3Dmol.createViewer(this.container, {
        backgroundColor: "#f5f9f8",
        antialias: !USE_IPAD_WEBGL_COMPATIBILITY
      });
      if (!USE_IPAD_WEBGL_COMPATIBILITY) {
        this.viewer.setViewStyle({ style: "outline", color: "#213b38", width: 0.035 });
      }
      return true;
    }

    clear() {
      if (!this.viewer) return;
      this.viewer.clear();
      this.viewer.render();
    }

    resize() {
      if (!this.viewer) return;
      this.viewer.resize();
      this.viewer.render();
    }

    render(crystal, siteType) {
      if (!this.viewer) return;
      const cluster = buildInterstitialCluster(crystal.id, siteType);
      const detail = crystal.interstitialDetails?.[siteType];
      if (!cluster || !detail) return;

      this.viewer.clear();
      const cageColor = INTERSTITIAL_CAGE_COLORS[siteType];
      drawCageEdges(this.viewer, cluster.metals, cageColor, 0.012);

      cluster.metals.forEach((atom) => {
        this.viewer.addSphere({
          center: pointFrom(atom),
          radius: cluster.metalRadius,
          color: COLORS.M,
          opacity: 0.62
        });
        drawGuide(this.viewer, cluster.center, pointFrom(atom), cageColor, 0.009);
      });

      this.viewer.addSphere({
        center: cluster.center,
        radius: cluster.gapRadius,
        color: COLORS[cluster.elem],
        opacity: 1
      });
      this.viewer.addSphere({
        center: cluster.center,
        radius: cluster.gapRadius * 1.18,
        color: COLORS[cluster.elem],
        opacity: 0.18
      });

      const nearestMetal = [...cluster.metals].sort((a, b) => distance(cluster.center, a) - distance(cluster.center, b))[0];
      drawGuide(this.viewer, cluster.center, pointFrom(nearestMetal), "#244f49", 0.015);
      this.viewer.addLabel("d=R+r", {
        position: add(midpoint(cluster.center, nearestMetal), { x: 0, y: -cluster.metalRadius * 0.48, z: cluster.metalRadius * 0.42 }),
        fontColor: "#ffffff",
        backgroundColor: "rgba(36,79,73,0.9)",
        fontSize: 10,
        inFront: true
      });
      this.viewer.resize();
      this.viewer.zoomTo();
      this.viewer.rotate(16, { x: 1, y: 0, z: 0 });
      this.viewer.rotate(-24, { x: 0, y: 1, z: 0 });
      this.viewer.zoom(2.15);
      this.viewer.render();
    }
  }

  class InterstitialDiagramRenderer {
    constructor(canvasId) {
      this.canvas = document.getElementById(canvasId);
      this.context = this.canvas?.getContext("2d") || null;
      this.currentCrystal = null;
      this.currentSiteType = "";
    }

    init() {
      if (!this.canvas || !this.context) return false;
      this.clear();
      return true;
    }

    clear() {
      if (!this.context || !this.canvas) return;
      this.currentCrystal = null;
      this.currentSiteType = "";
      this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    resize() {
      if (this.currentCrystal && this.currentSiteType) {
        this.render(this.currentCrystal, this.currentSiteType);
      }
    }

    render(crystal, siteType) {
      const derivation = crystal.interstitialDetails?.[siteType]?.derivation;
      if (!this.context || !derivation) return;

      this.currentCrystal = crystal;
      this.currentSiteType = siteType;
      const { width, height } = this.prepareCanvas();
      const palette = {
        metal: "#d7b66f",
        metalDark: "#8f6c2e",
        gap: siteType === "tetra" ? COLORS.TET : COLORS.OCT,
        cage: INTERSTITIAL_CAGE_COLORS[siteType],
        dimension: "#244f49",
        guide: "#8aa09c",
        text: "#20312e",
        background: "#f7faf9"
      };

      this.context.fillStyle = palette.background;
      this.context.fillRect(0, 0, width, height);
      this.drawLegend(width, palette, siteType);

      if (derivation.diagram.includes("tetra")) {
        this.drawTetrahedron(width, height, palette, derivation, derivation.diagram === "distorted-tetra");
      } else {
        this.drawOctahedron(width, height, palette, derivation, derivation.diagram === "distorted-octa");
      }
    }

    prepareCanvas() {
      const cssWidth = Math.max(280, Math.round(this.canvas.getBoundingClientRect().width || 640));
      const cssHeight = Math.round(cssWidth * 5 / 8);
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = Math.round(cssWidth * pixelRatio);
      this.canvas.height = Math.round(cssHeight * pixelRatio);
      this.context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      this.context.lineCap = "round";
      this.context.lineJoin = "round";
      return { width: cssWidth, height: cssHeight };
    }

    drawLegend(width, palette, siteType) {
      const ctx = this.context;
      const radius = Math.max(5, Math.min(8, width * 0.018));
      const fontSize = Math.max(10, Math.min(12, width * 0.026));
      ctx.font = `700 ${fontSize}px system-ui, sans-serif`;
      ctx.fillStyle = palette.metal;
      ctx.beginPath();
      ctx.arc(18, 18, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = palette.text;
      ctx.fillText("金属原子 R", 18 + radius + 7, 22);

      const secondX = Math.min(width * 0.54, 132);
      ctx.fillStyle = palette.gap;
      ctx.beginPath();
      ctx.arc(secondX, 18, radius * 0.72, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = palette.text;
      ctx.fillText(siteType === "tetra" ? "四面体间隙 r" : "八面体间隙 r", secondX + radius + 5, 22);
    }

    drawTetrahedron(width, height, palette, derivation, distorted) {
      const points = distorted
        ? [this.p(width, height, 0.50, 0.18), this.p(width, height, 0.16, 0.70), this.p(width, height, 0.84, 0.70), this.p(width, height, 0.50, 0.48)]
        : [this.p(width, height, 0.50, 0.17), this.p(width, height, 0.20, 0.71), this.p(width, height, 0.80, 0.71), this.p(width, height, 0.62, 0.47)];
      const center = this.average(points);
      const edges = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];

      edges.forEach(([from, to], index) => {
        const hidden = index === 4 && !distorted;
        this.drawLine(points[from], points[to], palette.cage, hidden ? 1.5 : 2.2, hidden ? [5, 5] : []);
      });

      if (distorted) {
        this.drawCenterDistance(center, points[0], derivation.distanceLabel, palette, width, -1, false, this.p(width, height, 0.56, 0.36));
        this.drawDimension(points[1], points[2], derivation.secondaryLabel, { x: 0, y: height * 0.13 }, palette.dimension, width);
        this.drawShortLabel(this.p(width, height, 0.25, 0.31), derivation.edgeLabel, palette.cage, width);
      } else {
        this.drawCenterDistance(center, points[0], derivation.distanceLabel, palette, width, -1);
        this.drawDimension(points[1], points[2], derivation.edgeLabel, { x: 0, y: height * 0.13 }, palette.dimension, width);
        if (derivation.secondaryLabel) {
          this.drawShortLabel({ x: width * 0.79, y: height * 0.31 }, derivation.secondaryLabel, palette.guide, width);
        }
      }

      points.forEach((point) => this.drawAtom(point, Math.max(9, width * 0.034), palette.metal, palette.metalDark));
      this.drawAtom(center, Math.max(5, width * 0.019), palette.gap, palette.gap);
      this.drawShortLabel(center, "r", palette.gap, width, { x: width * 0.045, y: height * 0.01 });
    }

    drawOctahedron(width, height, palette, derivation, distorted) {
      const points = distorted
        ? [
            this.p(width, height, 0.50, 0.25), this.p(width, height, 0.50, 0.67),
            this.p(width, height, 0.13, 0.47), this.p(width, height, 0.87, 0.47),
            this.p(width, height, 0.50, 0.77), this.p(width, height, 0.50, 0.17)
          ]
        : [
            this.p(width, height, 0.50, 0.15), this.p(width, height, 0.50, 0.80),
            this.p(width, height, 0.17, 0.48), this.p(width, height, 0.83, 0.48),
            this.p(width, height, 0.50, 0.66), this.p(width, height, 0.50, 0.31)
          ];
      const center = this.p(width, height, 0.50, 0.48);
      const ring = [2, 5, 3, 4];

      ring.forEach((index, position) => {
        this.drawLine(points[index], points[ring[(position + 1) % ring.length]], palette.cage, 2.1, index === 5 ? [5, 5] : []);
        this.drawLine(points[0], points[index], palette.cage, 2.1, index === 5 ? [5, 5] : []);
        this.drawLine(points[1], points[index], palette.cage, 2.1, index === 5 ? [5, 5] : []);
      });

      if (distorted) {
        this.drawCenterDistance(center, points[0], derivation.edgeLabel, palette, width, 1, false, this.p(width, height, 0.66, 0.31));
        this.drawCenterDistance(center, points[3], derivation.distanceLabel, palette, width, -1, true, this.p(width, height, 0.72, 0.58));
        this.drawShortLabel({ x: width * 0.74, y: height * 0.78 }, derivation.secondaryLabel, palette.dimension, width);
      } else {
        this.drawCenterDistance(center, points[3], derivation.distanceLabel, palette, width, -1);
        this.drawShortLabel(this.midpoint(points[0], points[3]), derivation.edgeLabel, palette.cage, width, { x: width * 0.02, y: -height * 0.07 });
        if (derivation.secondaryLabel) {
          this.drawShortLabel({ x: width * 0.79, y: height * 0.77 }, derivation.secondaryLabel, palette.guide, width);
        }
      }

      points.forEach((point) => this.drawAtom(point, Math.max(8, width * 0.029), palette.metal, palette.metalDark));
      this.drawAtom(center, Math.max(5, width * 0.019), palette.gap, palette.gap);
      this.drawShortLabel(center, "r", palette.gap, width, { x: width * 0.042, y: height * 0.01 });
    }

    drawCenterDistance(start, end, label, palette, width, side = 1, dashed = false, labelPoint = null) {
      this.drawLine(start, end, palette.dimension, 1.7, dashed ? [5, 4] : []);
      this.drawArrowHead(start, end, palette.dimension, 6);
      this.drawArrowHead(end, start, palette.dimension, 6);
      const a = labelPoint || this.midpoint(start, end);
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const length = Math.hypot(dx, dy) || 1;
      const offset = labelPoint ? { x: 0, y: 0 } : { x: (-dy / length) * 13 * side, y: (dx / length) * 13 * side };
      this.drawShortLabel(a, label, palette.dimension, width, offset);
    }

    drawDimension(start, end, label, offset, color, width) {
      const shiftedStart = { x: start.x + offset.x, y: start.y + offset.y };
      const shiftedEnd = { x: end.x + offset.x, y: end.y + offset.y };
      this.drawLine(start, shiftedStart, "#9aaba7", 1, [3, 4]);
      this.drawLine(end, shiftedEnd, "#9aaba7", 1, [3, 4]);
      this.drawLine(shiftedStart, shiftedEnd, color, 1.5);
      this.drawArrowHead(shiftedStart, shiftedEnd, color, 6);
      this.drawArrowHead(shiftedEnd, shiftedStart, color, 6);
      this.drawShortLabel(this.midpoint(shiftedStart, shiftedEnd), label, color, width, { x: 0, y: -10 });
    }

    drawLine(start, end, color, lineWidth, dash = []) {
      const ctx = this.context;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.setLineDash(dash);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      ctx.restore();
    }

    drawArrowHead(tip, tail, color, size) {
      const ctx = this.context;
      const angle = Math.atan2(tip.y - tail.y, tip.x - tail.x);
      ctx.save();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(tip.x, tip.y);
      ctx.lineTo(tip.x - size * Math.cos(angle - Math.PI / 6), tip.y - size * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(tip.x - size * Math.cos(angle + Math.PI / 6), tip.y - size * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    drawAtom(point, radius, color, shadowColor) {
      const ctx = this.context;
      const gradient = ctx.createRadialGradient(point.x - radius * 0.35, point.y - radius * 0.4, radius * 0.12, point.x, point.y, radius);
      gradient.addColorStop(0, "#fff6d4");
      gradient.addColorStop(0.34, color);
      gradient.addColorStop(1, shadowColor);
      ctx.save();
      ctx.shadowColor = "rgba(15,42,39,0.18)";
      ctx.shadowBlur = radius * 0.5;
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    drawShortLabel(point, text, color, width, offset = { x: 0, y: 0 }) {
      if (!text) return;
      const ctx = this.context;
      const fontSize = Math.max(9, Math.min(12, width * 0.025));
      ctx.save();
      ctx.font = `700 ${fontSize}px system-ui, sans-serif`;
      const maxWidth = width * 0.47;
      const label = this.fitLabel(text, maxWidth);
      const metrics = ctx.measureText(label);
      const boxWidth = metrics.width + 12;
      const boxHeight = fontSize + 9;
      let x = point.x + offset.x - boxWidth / 2;
      let y = point.y + offset.y - boxHeight / 2;
      x = Math.max(4, Math.min(width - boxWidth - 4, x));
      y = Math.max(34, y);
      this.roundedRect(x, y, boxWidth, boxHeight, 5);
      ctx.fillStyle = "rgba(255,255,255,0.94)";
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, x + boxWidth / 2, y + boxHeight / 2 + 0.5);
      ctx.restore();
    }

    fitLabel(text, maxWidth) {
      let compact = text
        .replace(/^棱长\s*/, "")
        .replace(/^中心距\s*/, "")
        .replace(/^轴向中心距\s*/, "")
        .replace(/^侧向中心距\s*/, "")
        .replace(/^四条接触棱\s*/, "")
        .replace(/^两条相对长棱=/, "长棱 ")
        .replace(/^最大间隙由\s*/, "")
        .replace(/\s控制$/, " 控制");
      if (this.context.measureText(compact).width <= maxWidth) return compact;
      while (compact.length > 4 && this.context.measureText(`${compact}…`).width > maxWidth) {
        compact = compact.slice(0, -1);
      }
      return `${compact}…`;
    }

    roundedRect(x, y, width, height, radius) {
      const ctx = this.context;
      const r = Math.min(radius, width / 2, height / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + width - r, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + r);
      ctx.lineTo(x + width, y + height - r);
      ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
      ctx.lineTo(x + r, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }

    p(width, height, x, y) {
      return { x: width * x, y: height * y };
    }

    midpoint(a, b) {
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }

    average(points) {
      return {
        x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
        y: points.reduce((sum, point) => sum + point.y, 0) / points.length
      };
    }
  }

  function representativeNeighborAtoms(crystal, siteType, site, currentAtoms) {
    if (["fcc", "bcc"].includes(crystal.id)) {
      const cluster = buildInterstitialCluster(crystal.id, siteType);
      const localMetals = crystal.id === "bcc" && siteType === "octa"
        ? cluster.metals.map((atom) => ({ x: atom.x, y: atom.z, z: atom.y }))
        : cluster.metals;
      return localMetals.map((atom) => ({
        elem: "M",
        x: site.x + atom.x,
        y: site.y + atom.y,
        z: site.z + atom.z
      }));
    }

    return findNearestMetalAtoms(site, currentAtoms, siteType === "tetra" ? 4 : 6);
  }

  function metalCrystalZoom(crystal, supercell) {
    if (supercell === 2) return 1.28;
    if (crystal?.id === "bcc") return 4.2;
    if (crystal?.id === "hcp") return 3.5;
    return 3;
  }

  function teachingStructureZoom(crystal, supercell) {
    const singleCellZoom = {
      zincblende: 3.1,
      wurtzite: 2.7,
      rutile: 3.5,
      spinel: 2.45,
      "substitutional-solid-solution": 3.2,
      "interstitial-solid-solution": 3.2
    };
    const expandedZoom = {
      zincblende: 1.65,
      wurtzite: 1.5,
      rutile: 1.8,
      spinel: 1.35,
      "substitutional-solid-solution": 1.7,
      "interstitial-solid-solution": 1.7
    };
    return (supercell === 2 ? expandedZoom : singleCellZoom)[crystal?.id] || 1;
  }

  function buildInterstitialCluster(crystalId, siteType) {
    const center = { x: 0, y: 0, z: 0 };
    let metals;
    let metalRadius;
    let gapRadius;

    if (crystalId === "bcc" && siteType === "tetra") {
      metals = [
        { x: -0.5, y: -0.25, z: 0 }, { x: 0.5, y: -0.25, z: 0 },
        { x: 0, y: 0.25, z: 0.5 }, { x: 0, y: 0.25, z: -0.5 }
      ];
      metalRadius = Math.sqrt(3) / 4;
      gapRadius = (Math.sqrt(5) - Math.sqrt(3)) / 4;
    } else if (crystalId === "bcc") {
      metals = [
        { x: 0, y: 0, z: -0.5 }, { x: 0, y: 0, z: 0.5 },
        { x: -0.5, y: -0.5, z: 0 }, { x: 0.5, y: -0.5, z: 0 },
        { x: -0.5, y: 0.5, z: 0 }, { x: 0.5, y: 0.5, z: 0 }
      ];
      metalRadius = Math.sqrt(3) / 4;
      gapRadius = (2 - Math.sqrt(3)) / 4;
    } else if (crystalId === "fcc" && siteType === "tetra") {
      metals = [
        { x: -0.25, y: -0.25, z: -0.25 }, { x: 0.25, y: 0.25, z: -0.25 },
        { x: 0.25, y: -0.25, z: 0.25 }, { x: -0.25, y: 0.25, z: 0.25 }
      ];
      metalRadius = Math.sqrt(2) / 4;
      gapRadius = (Math.sqrt(3) - Math.sqrt(2)) / 4;
    } else if (crystalId === "fcc") {
      metals = axisOctahedron(0.5);
      metalRadius = Math.sqrt(2) / 4;
      gapRadius = (2 - Math.sqrt(2)) / 4;
    } else if (siteType === "tetra") {
      const tetraScale = 1 / (2 * Math.sqrt(2));
      metals = [
        { x: tetraScale, y: tetraScale, z: tetraScale },
        { x: -tetraScale, y: -tetraScale, z: tetraScale },
        { x: -tetraScale, y: tetraScale, z: -tetraScale },
        { x: tetraScale, y: -tetraScale, z: -tetraScale }
      ];
      metalRadius = 0.5;
      gapRadius = Math.sqrt(6) / 4 - 0.5;
    } else {
      metals = axisOctahedron(1 / Math.sqrt(2));
      metalRadius = 0.5;
      gapRadius = 1 / Math.sqrt(2) - 0.5;
    }

    return { center, metals, metalRadius, gapRadius, elem: siteType === "tetra" ? "TET" : "OCT" };
  }

  function axisOctahedron(distanceFromCenter) {
    return [
      { x: distanceFromCenter, y: 0, z: 0 }, { x: -distanceFromCenter, y: 0, z: 0 },
      { x: 0, y: distanceFromCenter, z: 0 }, { x: 0, y: -distanceFromCenter, z: 0 },
      { x: 0, y: 0, z: distanceFromCenter }, { x: 0, y: 0, z: -distanceFromCenter }
    ];
  }

  function findNearestMetalAtoms(site, atoms, count) {
    return atoms
      .filter((atom) => atom.elem === "M")
      .map((atom) => ({ atom, gap: distance(site, atom) }))
      .sort((a, b) => a.gap - b.gap)
      .slice(0, count)
      .map((item) => item.atom);
  }

  function drawCageEdges(viewer, atoms, color, radius) {
    const pairs = [];
    for (let i = 0; i < atoms.length; i += 1) {
      for (let j = i + 1; j < atoms.length; j += 1) {
        pairs.push({ start: atoms[i], end: atoms[j], length: distance(atoms[i], atoms[j]) });
      }
    }
    const shortest = Math.min(...pairs.map((pair) => pair.length));
    pairs
      .filter((pair) => pair.length <= shortest * 1.22)
      .forEach((pair) => drawGuide(viewer, pointFrom(pair.start), pointFrom(pair.end), color, radius));
  }

  function pointFrom(point) {
    return { x: point.x, y: point.y, z: point.z };
  }

  function shouldBond(crystal, a, b) {
    if (samePoint(a, b)) return false;
    if (distance(a, b) > crystal.bondDistance) return false;
    if (["nacl", "cscl", "caf2", "perovskite", "zincblende", "wurtzite", "rutile", "spinel"].includes(crystal.id) && a.elem === b.elem) return false;
    if (crystal.id === "perovskite" && ![a.elem, b.elem].includes("B")) return false;
    if (["zincblende", "wurtzite"].includes(crystal.id) && !isElementPair(a, b, "Zn", "Su")) return false;
    if (crystal.id === "rutile" && !isElementPair(a, b, "Ti", "O")) return false;
    if (crystal.id === "spinel" && !(isElementPair(a, b, "Mg", "O") || isElementPair(a, b, "Al", "O"))) return false;
    if (crystal.id === "diamond" && a.elem !== b.elem) return false;
    return true;
  }

  function isElementPair(a, b, first, second) {
    return (a.elem === first && b.elem === second) || (a.elem === second && b.elem === first);
  }

  function buildInterstitialAtoms(crystal, siteType, supercell) {
    if (crystal.interstitialSites?.type === "hcp-honeycomb") {
      return buildHcpInterstitialSites(crystal.lattice, siteType, supercell);
    }

    const source = crystal.interstitialSites?.[siteType] || [];
    const atoms = [];
    const seen = new Set();
    const transform = getLatticeTransform(crystal.lattice || {});
    const elem = siteType === "tetra" ? "TET" : "OCT";

    for (let i = 0; i < supercell; i += 1) {
      for (let j = 0; j < supercell; j += 1) {
        for (let k = 0; k < supercell; k += 1) {
          source.forEach((site) => {
            const point = transform(site.x + i, site.y + j, site.z + k);
            const key = `${elem}:${pointKey(point)}`;
            if (seen.has(key)) return;
            seen.add(key);
            atoms.push({ elem, x: point.x, y: point.y, z: point.z });
          });
        }
      }
    }

    return atoms;
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

  function buildHexPrimitiveAtoms(lattice, supercell) {
    const atoms = [];
    const seen = new Set();
    for (let i = 0; i <= supercell; i += 1) {
      for (let j = 0; j <= supercell; j += 1) {
        for (let k = 0; k <= supercell; k += 1) {
          const point = hexPrimitivePoint(lattice, i, j, k);
          const key = pointKey(point);
          if (seen.has(key)) continue;
          seen.add(key);
          atoms.push({ elem: "P", cell: [i, j, k], x: point.x, y: point.y, z: point.z });
        }
      }
    }
    return atoms;
  }

  function buildHcpHoneycombAtoms(lattice, supercell) {
    const atoms = [];
    const seen = new Set();
    const centers = hcpHoneycombCenters(lattice, supercell);
    const c = lattice.c || 1.55;

    centers.forEach((center) => {
      for (let k = 0; k <= supercell; k += 1) {
        const z = k * c;
        hcpHexVertices(lattice, center, z).forEach((point) => addUniqueAtom(atoms, seen, "M", point));
        addUniqueAtom(atoms, seen, "M", { x: center.x, y: center.y, z });
      }

      for (let k = 0; k < supercell; k += 1) {
        const z = k * c + c / 2;
        hcpBLayerAtoms(lattice, center, z).forEach((point) => addUniqueAtom(atoms, seen, "M", point));
      }
    });

    return atoms;
  }

  function buildWurtziteHoneycombAtoms(lattice, supercell) {
    const atoms = [];
    const seen = new Set();
    const centers = hcpHoneycombCenters(lattice, supercell);
    const c = lattice.c || Math.sqrt(8 / 3);
    const u = lattice.u || 3 / 8;

    centers.forEach((center) => {
      for (let k = 0; k <= supercell; k += 1) {
        const z = k * c;
        hcpHexVertices(lattice, center, z).forEach((point) => addUniqueAtom(atoms, seen, "Zn", point));
        addUniqueAtom(atoms, seen, "Zn", { x: center.x, y: center.y, z });
      }

      for (let k = 0; k < supercell; k += 1) {
        const baseZ = k * c;
        hcpHexVertices(lattice, center, baseZ + u * c).forEach((point) => addUniqueAtom(atoms, seen, "Su", point));
        addUniqueAtom(atoms, seen, "Su", { x: center.x, y: center.y, z: baseZ + u * c });
        hcpBLayerAtoms(lattice, center, baseZ + c / 2).forEach((point) => addUniqueAtom(atoms, seen, "Zn", point));
        hcpBLayerAtoms(lattice, center, baseZ + (u + 0.5) * c).forEach((point) => addUniqueAtom(atoms, seen, "Su", point));
      }
    });

    return atoms;
  }

  function buildHcpInterstitialSites(lattice, siteType, supercell) {
    const atoms = [];
    const seen = new Set();
    const centers = hcpHoneycombCenters(lattice, supercell);
    const c = lattice.c || 1.55;
    const elem = siteType === "tetra" ? "TET" : "OCT";

    centers.forEach((center) => {
      for (let k = 0; k < supercell; k += 1) {
        const baseZ = k * c;
        const sites = siteType === "tetra"
          ? hcpTetraInterstitials(lattice, center, baseZ)
          : hcpOctaInterstitials(lattice, center, baseZ);
        sites.forEach((point) => addUniqueAtom(atoms, seen, elem, point));
      }
    });

    return atoms;
  }

  function drawHcpHoneycombSupercell(viewer, lattice, supercell) {
    const seen = new Set();
    const centers = hcpHoneycombCenters(lattice, supercell);
    const c = lattice.c || 1.55;

    centers.forEach((center) => {
      for (let k = 0; k <= supercell; k += 1) {
        drawHcpHexEdges(viewer, lattice, seen, center, k * c);
      }
      for (let k = 0; k < supercell; k += 1) {
        drawHcpVerticalEdges(viewer, lattice, seen, center, k * c, (k + 1) * c);
      }
    });
  }

  function hcpHoneycombCenters(lattice, supercell) {
    const s = lattice.radius || 1;
    const centers = [];
    for (let i = 0; i < supercell; i += 1) {
      for (let j = 0; j < supercell; j += 1) {
        centers.push({
          x: i * 1.5 * s,
          y: j * Math.sqrt(3) * s + i * Math.sqrt(3) * s / 2
        });
      }
    }
    return centers;
  }

  function hcpHexVertices(lattice, center, z) {
    const s = lattice.radius || 1;
    const vertices = [];
    for (let n = 0; n < 6; n += 1) {
      const angle = n * Math.PI / 3;
      vertices.push({
        x: center.x + Math.cos(angle) * s,
        y: center.y + Math.sin(angle) * s,
        z
      });
    }
    return vertices;
  }

  function hcpBLayerAtoms(lattice, center, z) {
    const s = lattice.radius || 1;
    const atoms = [];
    for (let i = 0; i < 3; i += 1) {
      const angle = Math.PI / 2 + i * (2 * Math.PI / 3);
      atoms.push({
        x: center.x + 0.58 * s * Math.cos(angle),
        y: center.y + 0.58 * s * Math.sin(angle),
        z
      });
    }
    return atoms;
  }

  function hcpTetraInterstitials(lattice, center, baseZ) {
    const s = lattice.radius || 1;
    const c = lattice.c || 1.55;
    const lower = [
      { x: center.x, y: center.y + 0.34 * s, z: baseZ + 0.25 * c },
      { x: center.x + 0.29 * s, y: center.y - 0.17 * s, z: baseZ + 0.25 * c },
      { x: center.x - 0.29 * s, y: center.y - 0.17 * s, z: baseZ + 0.25 * c },
      { x: center.x + 0.5 * s, y: center.y + 0.34 * s, z: baseZ + 0.25 * c },
      { x: center.x - 0.5 * s, y: center.y + 0.34 * s, z: baseZ + 0.25 * c },
      { x: center.x, y: center.y - 0.68 * s, z: baseZ + 0.25 * c }
    ];
    const upper = [
      { x: center.x, y: center.y - 0.34 * s, z: baseZ + 0.75 * c },
      { x: center.x + 0.29 * s, y: center.y + 0.17 * s, z: baseZ + 0.75 * c },
      { x: center.x - 0.29 * s, y: center.y + 0.17 * s, z: baseZ + 0.75 * c },
      { x: center.x + 0.5 * s, y: center.y - 0.34 * s, z: baseZ + 0.75 * c },
      { x: center.x - 0.5 * s, y: center.y - 0.34 * s, z: baseZ + 0.75 * c },
      { x: center.x, y: center.y + 0.68 * s, z: baseZ + 0.75 * c }
    ];
    return [...lower, ...upper];
  }

  function hcpOctaInterstitials(lattice, center, baseZ) {
    const s = lattice.radius || 1;
    const c = lattice.c || 1.55;
    return [
      { x: center.x, y: center.y, z: baseZ + 0.5 * c },
      { x: center.x + 0.5 * s, y: center.y + Math.sqrt(3) * s / 6, z: baseZ + 0.5 * c },
      { x: center.x - 0.5 * s, y: center.y + Math.sqrt(3) * s / 6, z: baseZ + 0.5 * c },
      { x: center.x + 0.5 * s, y: center.y - Math.sqrt(3) * s / 6, z: baseZ + 0.5 * c },
      { x: center.x - 0.5 * s, y: center.y - Math.sqrt(3) * s / 6, z: baseZ + 0.5 * c },
      { x: center.x, y: center.y + Math.sqrt(3) * s / 3, z: baseZ + 0.5 * c }
    ];
  }

  function drawHcpHexEdges(viewer, lattice, seen, center, z) {
    const vertices = hcpHexVertices(lattice, center, z);
    for (let i = 0; i < 6; i += 1) {
      drawUniqueEdge(viewer, seen, vertices[i], vertices[(i + 1) % 6]);
    }
  }

  function drawHcpVerticalEdges(viewer, lattice, seen, center, z1, z2) {
    const bottom = hcpHexVertices(lattice, center, z1);
    const top = hcpHexVertices(lattice, center, z2);
    for (let i = 0; i < 6; i += 1) {
      drawUniqueEdge(viewer, seen, bottom[i], top[i]);
    }
  }

  function addUniqueAtom(atoms, seen, elem, point) {
    const key = pointKey(point);
    if (seen.has(key)) return;
    seen.add(key);
    atoms.push({ elem, cell: [0, 0, 0], x: point.x, y: point.y, z: point.z });
  }

  function drawUniqueEdge(viewer, seen, start, end) {
    const edgeKey = [pointKey(start), pointKey(end)].sort().join("|");
    if (seen.has(edgeKey)) return;
    seen.add(edgeKey);
    drawEdges(viewer, [start, end], [[0, 1]]);
  }

  function drawHexPrimitiveSupercell(viewer, lattice, supercell) {
    const seen = new Set();
    for (let i = 0; i <= supercell; i += 1) {
      for (let j = 0; j <= supercell; j += 1) {
        for (let k = 0; k <= supercell; k += 1) {
          if (i < supercell) drawUniquePrimitiveEdge(viewer, lattice, seen, i, j, k, i + 1, j, k);
          if (j < supercell) drawUniquePrimitiveEdge(viewer, lattice, seen, i, j, k, i, j + 1, k);
          if (k < supercell) drawUniquePrimitiveEdge(viewer, lattice, seen, i, j, k, i, j, k + 1);
        }
      }
    }
  }

  function drawUniquePrimitiveEdge(viewer, lattice, seen, i1, j1, k1, i2, j2, k2) {
    const start = hexPrimitivePoint(lattice, i1, j1, k1);
    const end = hexPrimitivePoint(lattice, i2, j2, k2);
    drawUniqueEdge(viewer, seen, start, end);
  }

  function hexPrimitivePoint(lattice, i, j, k) {
    const a = lattice.a || 1;
    const c = lattice.c || 1.45;
    return {
      x: a * i - (a / 2) * j,
      y: (Math.sqrt(3) * a / 2) * j,
      z: c * k
    };
  }

  function pointKey(point) {
    return `${round6(point.x)}*${round6(point.y)}*${round6(point.z)}`;
  }

  function round6(value) {
    return Math.round(value * 1000000) / 1000000;
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

  function isIPadOS() {
    const userAgent = navigator.userAgent || "";
    const platform = navigator.platform || "";
    return /iPad/i.test(userAgent)
      || (/Macintosh/i.test(userAgent) && platform === "MacIntel" && navigator.maxTouchPoints > 1);
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
  window.InterstitialRenderer = InterstitialRenderer;
  window.InterstitialDiagramRenderer = InterstitialDiagramRenderer;
})();
