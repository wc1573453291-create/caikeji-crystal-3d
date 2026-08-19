/*
 * 页面交互层。
 * 负责分类切换、结构切换、按钮状态和知识卡片更新。
 */
(function () {
  const state = {
    categoryId: "bravais",
    crystalId: "triclinic-p",
    showUnitCell: true,
    showLabels: true,
    modelStyle: "stick",
    supercell: 1,
    showTetraSites: false,
    showOctaSites: false,
    selectedInterstitialKey: ""
  };

  const elements = {};
  let renderer = null;
  let interstitialRenderer = null;
  let interstitialDiagramRenderer = null;

  document.addEventListener("DOMContentLoaded", () => {
    cacheElements();
    buildCategoryTabs();
    buildStructureTabs();

    renderer = new window.CrystalRenderer("crystalViewer", elements.viewerStatus, elements.elementLegend);
    if (renderer.init()) {
      renderer.setInterstitialSelectionHandler(({ crystal, siteType, key }) => {
        if (crystal.id !== state.crystalId) return;
        state.selectedInterstitialKey = key;
        updateInterstitialDetail(crystal, siteType);
      });
      interstitialRenderer = new window.InterstitialRenderer("interstitialViewer");
      interstitialRenderer.init();
      interstitialDiagramRenderer = new window.InterstitialDiagramRenderer("interstitialDiagram");
      interstitialDiagramRenderer.init();
      selectCrystal(state.crystalId);
      bindControls();
      handleResize();
    }
  });

  function cacheElements() {
    elements.categoryTabs = document.getElementById("categoryTabs");
    elements.structureTabs = document.getElementById("structureTabs");
    elements.viewerStatus = document.getElementById("viewerStatus");
    elements.elementLegend = document.getElementById("elementLegend");
    elements.cardTitle = document.getElementById("cardTitle");
    elements.cardEnglish = document.getElementById("cardEnglish");
    elements.structureBadge = document.getElementById("structureBadge");
    elements.typicalMaterials = document.getElementById("typicalMaterials");
    elements.latticeType = document.getElementById("latticeType");
    elements.atomCount = document.getElementById("atomCount");
    elements.coordinationNumber = document.getElementById("coordinationNumber");
    elements.radiusRelation = document.getElementById("radiusRelation");
    elements.packingFactor = document.getElementById("packingFactor");
    elements.latticeConstants = document.getElementById("latticeConstants");
    elements.closePackedPlane = document.getElementById("closePackedPlane");
    elements.closePackedDirection = document.getElementById("closePackedDirection");
    elements.interstitialSites = document.getElementById("interstitialSites");
    elements.interstitialDetail = document.getElementById("interstitialDetail");
    elements.interstitialDetailTitle = document.getElementById("interstitialDetailTitle");
    elements.interstitialGeometry = document.getElementById("interstitialGeometry");
    elements.interstitialCoordination = document.getElementById("interstitialCoordination");
    elements.interstitialRatio = document.getElementById("interstitialRatio");
    elements.interstitialMetalRadius = document.getElementById("interstitialMetalRadius");
    elements.interstitialGapRadius = document.getElementById("interstitialGapRadius");
    elements.interstitialCenterDistance = document.getElementById("interstitialCenterDistance");
    elements.interstitialRadiusDifference = document.getElementById("interstitialRadiusDifference");
    elements.interstitialCageSwatch = document.getElementById("interstitialCageSwatch");
    elements.interstitialDiagram = document.getElementById("interstitialDiagram");
    elements.interstitialDerivationTitle = document.getElementById("interstitialDerivationTitle");
    elements.interstitialDiagramCaption = document.getElementById("interstitialDiagramCaption");
    elements.interstitialDerivationSteps = document.getElementById("interstitialDerivationSteps");
    elements.interstitialDerivationResult = document.getElementById("interstitialDerivationResult");
    elements.interstitialDerivationAssumption = document.getElementById("interstitialDerivationAssumption");
    elements.interstitialNote = document.getElementById("interstitialNote");
    elements.examFocus = document.getElementById("examFocus");
    elements.commonMistake = document.getElementById("commonMistake");
    elements.memoryLine = document.getElementById("memoryLine");
    elements.unitCellBtn = document.getElementById("unitCellBtn");
    elements.labelBtn = document.getElementById("labelBtn");
    elements.styleBtn = document.getElementById("styleBtn");
    elements.supercellBtn = document.getElementById("supercellBtn");
    elements.tetraBtn = document.getElementById("tetraBtn");
    elements.octaBtn = document.getElementById("octaBtn");
    elements.resetViewBtn = document.getElementById("resetViewBtn");
  }

  function buildCategoryTabs() {
    elements.categoryTabs.innerHTML = "";
    window.CRYSTAL_CATEGORIES.forEach((category) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "category-tab";
      button.dataset.id = category.id;
      button.innerHTML = `<strong>${category.name}</strong><span>${category.subtitle}</span>`;
      button.addEventListener("click", () => selectCategory(category.id));
      elements.categoryTabs.appendChild(button);
    });
  }

  function buildStructureTabs() {
    const category = getCategory(state.categoryId);
    elements.structureTabs.innerHTML = "";

    if (category.groups) {
      category.groups.forEach((group) => {
        const wrapper = document.createElement("div");
        wrapper.className = "system-group";
        const heading = document.createElement("div");
        heading.className = "system-heading";
        heading.textContent = group.name;
        wrapper.appendChild(heading);
        group.structures.forEach((id) => wrapper.appendChild(createStructureButton(id)));
        elements.structureTabs.appendChild(wrapper);
      });
    } else {
      category.structures.forEach((id) => {
        elements.structureTabs.appendChild(createStructureButton(id));
      });
    }

    updateButtonStates();
  }

  function createStructureButton(id) {
    const crystal = window.CRYSTAL_LIBRARY[id];
    const button = document.createElement("button");
    button.type = "button";
    button.className = "structure-tab";
    button.dataset.id = id;
    button.textContent = crystal.shortName;
    button.setAttribute("aria-label", `切换到${crystal.chineseName}`);
    button.addEventListener("click", () => selectCrystal(id));
    return button;
  }

  function bindControls() {
    elements.unitCellBtn.addEventListener("click", () => {
      state.showUnitCell = !state.showUnitCell;
      updateButtonStates();
      renderer.updateOptions({ showUnitCell: state.showUnitCell });
    });

    elements.labelBtn.addEventListener("click", () => {
      state.showLabels = !state.showLabels;
      updateButtonStates();
      renderer.updateOptions({ showLabels: state.showLabels });
    });

    elements.styleBtn.addEventListener("click", () => {
      state.modelStyle = state.modelStyle === "stick" ? "spacefill" : "stick";
      updateButtonStates();
      renderer.updateOptions({ modelStyle: state.modelStyle });
    });

    elements.supercellBtn.addEventListener("click", () => {
      state.supercell = state.supercell === 1 ? 2 : 1;
      state.selectedInterstitialKey = "";
      updateButtonStates();
      renderer.updateOptions({ supercell: state.supercell, selectedInterstitialKey: "" });
      updateInterstitialDetail(window.CRYSTAL_LIBRARY[state.crystalId]);
    });

    elements.tetraBtn.addEventListener("click", () => {
      toggleInterstitialType("tetra");
    });

    elements.octaBtn.addEventListener("click", () => {
      toggleInterstitialType("octa");
    });

    elements.resetViewBtn.addEventListener("click", () => renderer.resetView());
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);
  }

  function selectCategory(id) {
    state.categoryId = id;
    const category = getCategory(id);
    state.crystalId = getFirstStructureId(category);
    buildStructureTabs();
    selectCrystal(state.crystalId);
  }

  function selectCrystal(id) {
    state.crystalId = id;
    state.selectedInterstitialKey = "";
    const crystal = window.CRYSTAL_LIBRARY[id];
    updateCard(crystal);
    updateButtonStates();
    renderer.render(crystal, {
      showUnitCell: state.showUnitCell,
      showLabels: state.showLabels,
      modelStyle: state.modelStyle,
      supercell: state.supercell,
      showTetraSites: state.showTetraSites,
      showOctaSites: state.showOctaSites,
      selectedInterstitialKey: ""
    });
    requestAnimationFrame(() => renderer.resetView());
  }

  function updateCard(crystal) {
    elements.cardTitle.textContent = crystal.chineseName;
    elements.cardEnglish.textContent = crystal.englishName;
    elements.structureBadge.textContent = crystal.shortName;
    elements.typicalMaterials.textContent = crystal.typicalMaterials;
    setInfoValue(elements.latticeType, crystal.latticeType);
    setInfoValue(elements.atomCount, crystal.atomCount);
    setInfoValue(elements.coordinationNumber, crystal.coordinationNumber);
    setInfoValue(elements.radiusRelation, crystal.radiusRelation);
    setInfoValue(elements.packingFactor, crystal.packingFactor);
    setInfoValue(elements.latticeConstants, crystal.latticeConstants);
    setInfoValue(elements.closePackedPlane, crystal.closePackedPlane);
    setInfoValue(elements.closePackedDirection, crystal.closePackedDirection);
    elements.examFocus.textContent = crystal.examFocus;
    elements.commonMistake.textContent = crystal.commonMistake;
    elements.memoryLine.textContent = crystal.memoryLine;
    setInfoValue(elements.interstitialSites, crystal.interstitialSummary);
    toggleInfoRows(crystal);
    updateInterstitialDetail(crystal);
  }

  function toggleInterstitialType(type) {
    const wasActive = type === "tetra" ? state.showTetraSites : state.showOctaSites;
    state.showTetraSites = type === "tetra" && !wasActive;
    state.showOctaSites = type === "octa" && !wasActive;
    state.selectedInterstitialKey = "";
    updateButtonStates();
    renderer.updateOptions({
      showTetraSites: state.showTetraSites,
      showOctaSites: state.showOctaSites,
      selectedInterstitialKey: ""
    });
    updateInterstitialDetail(window.CRYSTAL_LIBRARY[state.crystalId]);
    requestAnimationFrame(() => renderer.resetView());
  }

  function updateInterstitialDetail(crystal, selectedType = "") {
    const activeType = state.selectedInterstitialKey
      ? (selectedType || (state.showTetraSites ? "tetra" : (state.showOctaSites ? "octa" : "")))
      : "";
    const detail = activeType ? crystal.interstitialDetails?.[activeType] : null;
    elements.interstitialDetail.hidden = !detail;

    if (!detail) {
      interstitialRenderer?.clear();
      interstitialDiagramRenderer?.clear();
      return;
    }

    elements.interstitialDetailTitle.textContent = detail.title;
    elements.interstitialGeometry.textContent = detail.geometry;
    elements.interstitialCoordination.textContent = detail.coordination;
    elements.interstitialRatio.textContent = detail.radiusRatio;
    elements.interstitialMetalRadius.textContent = detail.metalRadius;
    elements.interstitialGapRadius.textContent = detail.gapRadius;
    elements.interstitialCenterDistance.textContent = detail.centerDistance;
    elements.interstitialRadiusDifference.textContent = detail.radiusDifference;
    elements.interstitialCageSwatch.style.background = activeType === "tetra" ? "#a99bff" : "#54d6a0";
    elements.interstitialNote.textContent = detail.note;
    renderInterstitialDerivation(crystal, activeType, detail);
    requestAnimationFrame(() => {
      interstitialRenderer?.render(crystal, activeType);
      interstitialDiagramRenderer?.render(crystal, activeType);
    });
  }

  function renderInterstitialDerivation(crystal, siteType, detail) {
    const derivation = detail.derivation;
    if (!derivation) return;

    elements.interstitialDerivationTitle.textContent = `${crystal.shortName} · ${derivation.title}`;
    elements.interstitialDiagramCaption.textContent = [derivation.edgeLabel, derivation.distanceLabel, derivation.secondaryLabel]
      .filter(Boolean)
      .join("；");
    elements.interstitialDerivationSteps.replaceChildren(...derivation.steps.map((item) => {
      const row = document.createElement("li");
      const copy = document.createElement("div");
      const label = document.createElement("strong");
      const formula = document.createElement("span");
      copy.className = "derivation-step-copy";
      label.textContent = item.label;
      formula.textContent = item.formula;
      copy.append(label, formula);
      row.appendChild(copy);
      return row;
    }));
    elements.interstitialDerivationResult.textContent = detail.radiusRatio;
    elements.interstitialDerivationAssumption.textContent = `计算前提：${derivation.assumption}`;
    elements.interstitialDiagram.setAttribute("aria-label", `${crystal.chineseName}${siteType === "tetra" ? "四面体" : "八面体"}间隙二维尺寸图`);
  }

  function toggleInfoRows(crystal) {
    setRowVisible(elements.latticeType, hasUsefulValue(crystal.latticeType));
    setRowVisible(elements.atomCount, hasUsefulValue(crystal.atomCount));
    setRowVisible(elements.coordinationNumber, hasUsefulValue(crystal.coordinationNumber));
    setRowVisible(elements.radiusRelation, hasUsefulValue(crystal.radiusRelation));
    setRowVisible(elements.packingFactor, hasUsefulValue(crystal.packingFactor));
    setRowVisible(elements.latticeConstants, hasUsefulValue(crystal.latticeConstants));
    setRowVisible(elements.closePackedPlane, hasUsefulValue(crystal.closePackedPlane));
    setRowVisible(elements.closePackedDirection, hasUsefulValue(crystal.closePackedDirection));
    setRowVisible(elements.interstitialSites, hasUsefulValue(crystal.interstitialSummary));
  }

  function setRowVisible(valueElement, isVisible) {
    valueElement.parentElement.hidden = !isVisible;
  }

  function setInfoValue(element, value) {
    element.textContent = hasUsefulValue(value) ? String(value).trim() : "";
  }

  function hasUsefulValue(value) {
    return Boolean(String(value ?? "").trim());
  }

  function updateButtonStates() {
    document.querySelectorAll(".category-tab").forEach((button) => {
      const isActive = button.dataset.id === state.categoryId;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });

    document.querySelectorAll(".structure-tab").forEach((button) => {
      const isActive = button.dataset.id === state.crystalId;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });

    elements.unitCellBtn.classList.toggle("is-active", state.showUnitCell);
    elements.unitCellBtn.textContent = state.showUnitCell ? "隐藏晶胞" : "显示晶胞";

    elements.labelBtn.classList.toggle("is-active", state.showLabels);
    elements.labelBtn.textContent = state.showLabels ? "隐藏图例" : "显示图例";

    elements.styleBtn.classList.toggle("is-active", state.modelStyle === "spacefill");
    elements.styleBtn.textContent = state.modelStyle === "stick" ? "空间填充" : "球棍模型";

    elements.supercellBtn.classList.toggle("is-active", state.supercell === 2);
    elements.supercellBtn.textContent = state.supercell === 1 ? "1 个晶胞" : "2×2×2（已展开）";

    const supportsInterstitials = Boolean(window.CRYSTAL_LIBRARY[state.crystalId]?.interstitialSites);
    elements.tetraBtn.hidden = !supportsInterstitials;
    elements.octaBtn.hidden = !supportsInterstitials;
    elements.tetraBtn.classList.toggle("is-active", state.showTetraSites);
    elements.octaBtn.classList.toggle("is-active", state.showOctaSites);
    elements.tetraBtn.setAttribute("aria-pressed", String(state.showTetraSites));
    elements.octaBtn.setAttribute("aria-pressed", String(state.showOctaSites));
    elements.tetraBtn.textContent = state.showTetraSites ? "隐藏四面体间隙" : "四面体间隙";
    elements.octaBtn.textContent = state.showOctaSites ? "隐藏八面体间隙" : "八面体间隙";
  }

  function getCategory(id) {
    return window.CRYSTAL_CATEGORIES.find((category) => category.id === id);
  }

  function getFirstStructureId(category) {
    if (category.groups) return category.groups[0].structures[0];
    return category.structures[0];
  }

  function handleResize() {
    if (!renderer || !renderer.viewer) return;
    window.clearTimeout(handleResize.timer);
    handleResize.timer = window.setTimeout(() => {
      renderer.viewer.resize();
      renderer.viewer.render();
      interstitialRenderer?.resize();
      interstitialDiagramRenderer?.resize();
    }, 120);
  }
})();
