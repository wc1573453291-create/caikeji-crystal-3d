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
    showOctaSites: false
  };

  const elements = {};
  let renderer = null;

  document.addEventListener("DOMContentLoaded", () => {
    cacheElements();
    buildCategoryTabs();
    buildStructureTabs();

    renderer = new window.CrystalRenderer("crystalViewer", elements.viewerStatus, elements.elementLegend);
    if (renderer.init()) {
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
      updateButtonStates();
      renderer.updateOptions({ supercell: state.supercell });
    });

    elements.tetraBtn.addEventListener("click", () => {
      state.showTetraSites = !state.showTetraSites;
      updateButtonStates();
      renderer.updateOptions({ showTetraSites: state.showTetraSites });
    });

    elements.octaBtn.addEventListener("click", () => {
      state.showOctaSites = !state.showOctaSites;
      updateButtonStates();
      renderer.updateOptions({ showOctaSites: state.showOctaSites });
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
    const crystal = window.CRYSTAL_LIBRARY[id];
    updateCard(crystal);
    updateButtonStates();
    renderer.render(crystal, {
      showUnitCell: state.showUnitCell,
      showLabels: state.showLabels,
      modelStyle: state.modelStyle,
      supercell: state.supercell,
      showTetraSites: state.showTetraSites,
      showOctaSites: state.showOctaSites
    });
    requestAnimationFrame(() => renderer.resetView());
  }

  function updateCard(crystal) {
    elements.cardTitle.textContent = crystal.chineseName;
    elements.cardEnglish.textContent = crystal.englishName;
    elements.structureBadge.textContent = crystal.shortName;
    elements.typicalMaterials.textContent = crystal.typicalMaterials;
    elements.latticeType.textContent = crystal.latticeType || "不适用";
    elements.atomCount.textContent = crystal.atomCount || "不适用";
    elements.coordinationNumber.textContent = crystal.coordinationNumber;
    elements.radiusRelation.textContent = crystal.radiusRelation || "不适用";
    elements.packingFactor.textContent = crystal.packingFactor || "不标注";
    elements.latticeConstants.textContent = crystal.latticeConstants || "不适用";
    elements.closePackedPlane.textContent = crystal.closePackedPlane || "不标注";
    elements.closePackedDirection.textContent = crystal.closePackedDirection || "不标注";
    elements.examFocus.textContent = crystal.examFocus;
    elements.commonMistake.textContent = crystal.commonMistake;
    elements.memoryLine.textContent = crystal.memoryLine;
    elements.interstitialSites.textContent = crystal.interstitialSummary || "";
    toggleInfoRows(crystal);
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

  function hasUsefulValue(value) {
    if (!value) return false;
    return !["不适用", "不标注", "不讨论"].includes(String(value).trim());
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
    }, 120);
  }
})();
