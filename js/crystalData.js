/*
 * 晶体结构数据层。
 * 扩展建议：最近邻、密排面、密排方向、间隙位置、自测题都作为结构化字段加在对应 structure 内。
 */

window.CRYSTAL_CATEGORIES = [
  {
    id: "bravais",
    name: "空间点阵",
    subtitle: "7 大晶系 · 14 种点阵",
    groups: [
      { name: "三斜晶系 a≠b≠c；α≠β≠γ≠90°", structures: ["triclinic-p"] },
      { name: "单斜晶系 a≠b≠c；α=γ=90°，β≠90°", structures: ["monoclinic-p", "monoclinic-c"] },
      { name: "正交晶系 a≠b≠c；α=β=γ=90°", structures: ["orthorhombic-p", "orthorhombic-c", "orthorhombic-i", "orthorhombic-f"] },
      { name: "六方晶系 a=b≠c；α=β=90°，γ=120°", structures: ["hexagonal-p"] },
      { name: "菱方晶系 a=b=c；α=β=γ≠90°", structures: ["rhombohedral-r"] },
      { name: "四方晶系 a=b≠c；α=β=γ=90°", structures: ["tetragonal-p", "tetragonal-i"] },
      { name: "立方晶系 a=b=c；α=β=γ=90°", structures: ["cubic-p", "cubic-i", "cubic-f"] }
    ]
  },
  {
    id: "metal",
    name: "金属晶体",
    subtitle: "FCC / BCC / HCP",
    structures: ["fcc", "bcc", "hcp"]
  },
  {
    id: "solid-solution",
    name: "固溶体",
    subtitle: "置换 / 间隙",
    structures: ["substitutional-solid-solution", "interstitial-solid-solution"]
  },
  {
    id: "ionic",
    name: "离子晶体",
    subtitle: "CsCl / NaCl / CaF2 / 钙钛矿",
    structures: ["cscl", "nacl", "caf2", "perovskite"]
  },
  {
    id: "covalent",
    name: "共价晶体",
    subtitle: "金刚石结构",
    structures: ["diamond"]
  }
];

window.CRYSTAL_LIBRARY = {
  "triclinic-p": bravais("triclinic-p", "简单三斜点阵", "Primitive Triclinic Lattice", "简单三斜", "三斜晶系", "a≠b≠c；α≠β≠γ≠90°", "三条边不同，三个夹角也都可不是直角。", makeBoxCorners("P"), { a: 1, b: 1.25, c: 1.45, alphaShift: 0.22, betaShift: 0.34 }),
  "monoclinic-p": bravais("monoclinic-p", "简单单斜点阵", "Primitive Monoclinic Lattice", "简单单斜", "单斜晶系", "a≠b≠c；α=γ=90°，β≠90°", "只有一个夹角 β 偏离 90°。", makeBoxCorners("P"), { a: 1, b: 1.35, c: 1.45, betaShift: 0.36 }),
  "monoclinic-c": bravais("monoclinic-c", "底心单斜点阵", "Base-Centered Monoclinic Lattice", "底心单斜", "单斜晶系", "a≠b≠c；α=γ=90°，β≠90°", "单斜晶胞在一对底面中心增加点阵点。", [...makeBoxCorners("P"), frac("P", 0.5, 0.5, 0), frac("P", 0.5, 0.5, 1)], { a: 1, b: 1.35, c: 1.45, betaShift: 0.36 }),
  "orthorhombic-p": bravais("orthorhombic-p", "简单正交点阵", "Primitive Orthorhombic Lattice", "简单正交", "正交晶系", "a≠b≠c；α=β=γ=90°", "三条边长都不同，但三个角都是直角。", makeBoxCorners("P"), { a: 1, b: 1.35, c: 1.65 }),
  "orthorhombic-c": bravais("orthorhombic-c", "底心正交点阵", "Base-Centered Orthorhombic Lattice", "底心正交", "正交晶系", "a≠b≠c；α=β=γ=90°", "正交晶胞在一对底面中心增加点阵点。", [...makeBoxCorners("P"), frac("P", 0.5, 0.5, 0), frac("P", 0.5, 0.5, 1)], { a: 1, b: 1.35, c: 1.65 }),
  "orthorhombic-i": bravais("orthorhombic-i", "体心正交点阵", "Body-Centered Orthorhombic Lattice", "体心正交", "正交晶系", "a≠b≠c；α=β=γ=90°", "正交晶胞内部增加体心点。", [...makeBoxCorners("P"), frac("P", 0.5, 0.5, 0.5)], { a: 1, b: 1.35, c: 1.65 }),
  "orthorhombic-f": bravais("orthorhombic-f", "面心正交点阵", "Face-Centered Orthorhombic Lattice", "面心正交", "正交晶系", "a≠b≠c；α=β=γ=90°", "正交晶胞 6 个面中心都有点阵点。", [...makeBoxCorners("P"), ...faceCenters("P")], { a: 1, b: 1.35, c: 1.65 }),
  "hexagonal-p": bravais("hexagonal-p", "简单六方点阵", "Primitive Hexagonal Lattice", "简单六方", "六方晶系", "a=b≠c；α=β=90°，γ=120°", "原胞为底面夹角 γ=120° 的菱形直棱柱；六方对称示意（非原胞）不参与超胞扩展。", [], { type: "hex-primitive", a: 1, c: 1.45 }),
  "rhombohedral-r": bravais("rhombohedral-r", "菱方点阵", "Rhombohedral Lattice", "菱方", "菱方晶系", "a=b=c；α=β=γ≠90°", "三条边相等，但晶胞整体倾斜。", makeBoxCorners("P"), { a: 1, b: 1, c: 1, alphaShift: 0.34, betaShift: 0.22 }),
  "tetragonal-p": bravais("tetragonal-p", "简单四方点阵", "Primitive Tetragonal Lattice", "简单四方", "四方晶系", "a=b≠c；α=β=γ=90°", "底面为正方形，高度 c 与 a 不等。", makeBoxCorners("P"), { a: 1, b: 1, c: 1.45 }),
  "tetragonal-i": bravais("tetragonal-i", "体心四方点阵", "Body-Centered Tetragonal Lattice", "体心四方", "四方晶系", "a=b≠c；α=β=γ=90°", "简单四方点阵加体心点。", [...makeBoxCorners("P"), frac("P", 0.5, 0.5, 0.5)], { a: 1, b: 1, c: 1.45 }),
  "cubic-p": bravais("cubic-p", "简单立方点阵", "Primitive Cubic Lattice", "简单立方", "立方晶系", "a=b=c；α=β=γ=90°", "只在 8 个角点有点阵点。", makeBoxCorners("P"), { a: 1, b: 1, c: 1 }),
  "cubic-i": bravais("cubic-i", "体心立方点阵", "Body-Centered Cubic Lattice", "体心立方", "立方晶系", "a=b=c；α=β=γ=90°", "角点加体心点阵点。", [...makeBoxCorners("P"), frac("P", 0.5, 0.5, 0.5)], { a: 1, b: 1, c: 1 }),
  "cubic-f": bravais("cubic-f", "面心立方点阵", "Face-Centered Cubic Lattice", "面心立方", "立方晶系", "a=b=c；α=β=γ=90°", "角点加 6 个面心点阵点。", [...makeBoxCorners("P"), ...faceCenters("P")], { a: 1, b: 1, c: 1 }),

  fcc: crystal("fcc", "FCC", "面心立方", "Face-Centered Cubic", "Cu、Al、Ni、Ag、Au、γ-Fe", "面心立方点阵", "4", "12", "R=√2a/4", "0.74", "a=b=c；α=β=γ=90°", "{111}", "<110>", "掌握原子数 4、配位数 12、致密度 0.74、密排面 {111} 和密排方向 <110>。", "面心原子不是完整归属一个晶胞；每个面心原子只被 2 个晶胞共有。", "一句话记忆：面心立方最密，十二近邻，四个原子。", [...makeBoxCorners("M"), ...faceCenters("M")], { a: 1, b: 1, c: 1 }, 0.72),
  bcc: crystal("bcc", "BCC", "体心立方", "Body-Centered Cubic", "α-Fe、Cr、W、Mo、V", "体心立方点阵", "2", "8", "R=√3a/4", "0.68", "a=b=c；α=β=γ=90°", "无真正密排面；常考较密排面 {110}", "<111>", "掌握原子数 2、配位数 8、致密度 0.68，并理解体对角线方向原子相切。", "BCC 不是密排结构，不要把它的致密度记成 FCC/HCP 的 0.74。", "一句话记忆：体心一颗坐中央，八个角点最近邻。", [...makeBoxCorners("M"), frac("M", 0.5, 0.5, 0.5)], { a: 1, b: 1, c: 1 }, 0.88),
  hcp: crystal("hcp", "HCP", "密排六方", "Hexagonal Close-Packed", "Mg、Zn、Ti、Co、α-Zr", "简单六方点阵 + 双原子基元", "6（常规六方晶胞）", "12", "R=a/2；理想 c/a≈1.633", "0.74", "a=b≠c；α=β=90°，γ=120°", "{0001}", "<11-20>", "掌握 ABAB 堆垛、配位数 12、致密度 0.74，以及理想轴比 c/a≈1.633。", "HCP 与 FCC 都是最密堆积；区别是 HCP 为 ABAB，FCC 为 ABCABC。", "一句话记忆：六方密排 ABAB，致密配位同 FCC。", hcpAtoms(), { type: "hex", radius: 1, c: 1.55 }, 0.84),
  "substitutional-solid-solution": crystal("substitutional-solid-solution", "置换固溶体", "置换固溶体", "Substitutional Solid Solution", "Cu-Ni、Cu-Zn、Ag-Au", "母相晶格，溶质原子替代部分基体原子", "", "", "溶质与基体原子半径差通常较小，常以 |rA-rB|/rA < 15% 作为经验条件", "", "", "", "", "理解溶质原子占据原来基体原子的正常晶格位置，晶体点阵总体仍保持母相类型。", "不要把置换固溶体理解成溶质原子挤进空隙；它是替代正常晶格位置。", "一句话记忆：大小相近，替位进入。", substitutionalSolidSolutionAtoms(), { a: 1, b: 1, c: 1 }, 0.72),
  "interstitial-solid-solution": crystal("interstitial-solid-solution", "间隙固溶体", "间隙固溶体", "Interstitial Solid Solution", "C in α-Fe、N in Fe、H in Pd", "母相晶格，较小溶质原子进入晶格间隙", "", "", "溶质原子半径远小于基体原子半径，常见 C、N、H、B 等小原子", "", "", "", "", "理解小溶质原子进入八面体或四面体间隙，会造成晶格畸变并影响强度。", "不要把间隙固溶体画成替代基体原子；它占据的是晶格空隙。", "一句话记忆：小原子，钻空隙。", interstitialSolidSolutionAtoms(), { a: 1, b: 1, c: 1 }, 0.72),
  cscl: crystal("cscl", "CsCl", "氯化铯型", "Cesium Chloride Structure", "CsCl、CsBr、CsI", "简单立方点阵 + 双离子基元", "1 Cs+ + 1 Cl-", "Cs+:8；Cl-:8", "r+ + r- = √3a/2", "", "a=b=c；α=β=γ=90°", "", "", "掌握简单立方阴离子框架与体心阳离子位置，重点区分它不是 BCC 金属结构。", "CsCl 看起来像体心立方，但角点和体心是不同离子，不能按 BCC 等价原子理解。", "一句话记忆：CsCl 中心对八角，八配位。", [...makeBoxCorners("Cl"), frac("Cs", 0.5, 0.5, 0.5)], { a: 1, b: 1, c: 1 }, 0.9),
  nacl: crystal("nacl", "NaCl", "氯化钠型", "Rock Salt Structure", "NaCl、KCl、MgO、CaO", "面心立方点阵 + 双离子基元", "4 Na+ + 4 Cl-", "Na+:6；Cl-:6", "r+ + r- = a/2", "", "a=b=c；α=β=γ=90°", "", "", "掌握两套互穿的 FCC 子晶格，阴、阳离子均为 6 配位，常用于判断八面体间隙占位。", "NaCl 是 6:6 配位，不是 CsCl 的 8:8 配位；观察时要看最近的异号离子。", "一句话记忆：NaCl 是 FCC 骨架填八面体，六配位。", [...makeBoxCorners("Cl"), ...faceCenters("Cl"), ...edgeCenters("Na"), frac("Na", 0.5, 0.5, 0.5)], { a: 1.28, b: 1.28, c: 1.28 }, 0.66),
  caf2: crystal("caf2", "CaF2", "萤石结构", "Fluorite Structure", "CaF2、UO2、ThO2", "面心立方点阵 + 三离子基元", "4 Ca2+ + 8 F-", "Ca2+:8；F-:4", "r+ + r- = √3a/4", "", "a=b=c；α=β=γ=90°", "", "", "掌握 Ca2+ 构成 FCC 骨架，F- 占据全部四面体间隙，配位关系为 8:4。", "不要把萤石结构和反萤石结构混淆；CaF2 中小阴离子在四面体间隙。", "一句话记忆：钙成面心，氟填四面体。", [...makeBoxCorners("Ca"), ...faceCenters("Ca"), ...tetraSites("F")], { a: 1.28, b: 1.28, c: 1.28 }, 0.58),
  perovskite: crystal("perovskite", "钙钛矿", "钙钛矿结构", "Perovskite Structure", "CaTiO3、BaTiO3、SrTiO3、MAPbI3", "简单立方点阵 + ABO3 基元", "1 A + 1 B + 3 O", "A位:12；B位:6", "理想立方中 B-O 距离=a/2", "", "理想立方：a=b=c；α=β=γ=90°", "", "", "掌握 A 位在角点、B 位在体心、O 位在面心，B 离子形成 BO6 八面体。", "容易把 A、B 位颠倒；记住体心 B 周围最近的是 6 个 O。", "一句话记忆：A 在角，B 居中，氧在面心围八面体。", [...makeBoxCorners("A"), frac("B", 0.5, 0.5, 0.5), frac("O", 0.5, 0.5, 0), frac("O", 0.5, 0, 0.5), frac("O", 0, 0.5, 0.5), frac("O", 0.5, 0.5, 1), frac("O", 0.5, 1, 0.5), frac("O", 1, 0.5, 0.5)], { a: 1.25, b: 1.25, c: 1.25 }, 0.64),
  diamond: crystal("diamond", "金刚石", "金刚石结构", "Diamond Cubic", "C（金刚石）、Si、Ge、α-Sn", "面心立方点阵 + 双原子基元", "8", "4", "R=√3a/8（共价半径近似）", "约 0.34", "a=b=c；α=β=γ=90°", "", "", "掌握两个 FCC 子晶格沿体对角线错开 1/4，四面体配位和强共价键方向性。", "金刚石不是最密堆积，配位数只有 4，致密度明显小于 FCC/HCP。", "一句话记忆：两个 FCC 错四分之一，四面体共价网络。", [...makeBoxCorners("C"), ...faceCenters("C"), frac("C", 0.25, 0.25, 0.25), frac("C", 0.25, 0.75, 0.75), frac("C", 0.75, 0.25, 0.75), frac("C", 0.75, 0.75, 0.25)], { a: 1.2, b: 1.2, c: 1.2 }, 0.54)
};

function bravais(id, chineseName, englishName, shortName, system, constants, note, atoms, lattice) {
  return { id, kind: "bravais", shortName, chineseName, englishName, typicalMaterials: system, latticeType: shortName, atomCount: "", coordinationNumber: "", radiusRelation: "", packingFactor: "", latticeConstants: constants, closePackedPlane: "", closePackedDirection: "", examFocus: `${note} 晶格常数关系：${constants}`, commonMistake: "空间点阵只描述平移周期性，不等同于具体晶体结构；具体结构还需要基元。", memoryLine: "一句话记忆：先辨晶系，再看简单、体心、面心或底心。", atoms, lattice, bondDistance: 0 };
}

function crystal(id, shortName, chineseName, englishName, typicalMaterials, latticeType, atomCount, coordinationNumber, radiusRelation, packingFactor, latticeConstants, closePackedPlane, closePackedDirection, examFocus, commonMistake, memoryLine, atoms, lattice, bondDistance) {
  return { id, shortName, chineseName, englishName, typicalMaterials, latticeType, atomCount, coordinationNumber, radiusRelation, packingFactor, latticeConstants, closePackedPlane, closePackedDirection, examFocus, commonMistake, memoryLine, atoms, lattice, bondDistance };
}

function frac(elem, x, y, z) {
  return { elem, x, y, z };
}

function cart(elem, x, y, z) {
  return { elem, coord: "cart", x, y, z };
}

function makeBoxCorners(elem) {
  return [frac(elem, 0, 0, 0), frac(elem, 1, 0, 0), frac(elem, 0, 1, 0), frac(elem, 1, 1, 0), frac(elem, 0, 0, 1), frac(elem, 1, 0, 1), frac(elem, 0, 1, 1), frac(elem, 1, 1, 1)];
}

function faceCenters(elem) {
  return [frac(elem, 0.5, 0.5, 0), frac(elem, 0.5, 0.5, 1), frac(elem, 0.5, 0, 0.5), frac(elem, 0.5, 1, 0.5), frac(elem, 0, 0.5, 0.5), frac(elem, 1, 0.5, 0.5)];
}

function edgeCenters(elem) {
  return [frac(elem, 0.5, 0, 0), frac(elem, 0.5, 1, 0), frac(elem, 0.5, 0, 1), frac(elem, 0.5, 1, 1), frac(elem, 0, 0.5, 0), frac(elem, 1, 0.5, 0), frac(elem, 0, 0.5, 1), frac(elem, 1, 0.5, 1), frac(elem, 0, 0, 0.5), frac(elem, 1, 0, 0.5), frac(elem, 0, 1, 0.5), frac(elem, 1, 1, 0.5)];
}

function tetraSites(elem) {
  return [frac(elem, 0.25, 0.25, 0.25), frac(elem, 0.25, 0.25, 0.75), frac(elem, 0.25, 0.75, 0.25), frac(elem, 0.25, 0.75, 0.75), frac(elem, 0.75, 0.25, 0.25), frac(elem, 0.75, 0.25, 0.75), frac(elem, 0.75, 0.75, 0.25), frac(elem, 0.75, 0.75, 0.75)];
}

function hexPrismAtoms(elem, includeCenters) {
  const atoms = [];
  [0, 1].forEach((z) => {
    for (let i = 0; i < 6; i += 1) {
      const angle = Math.PI / 6 + i * Math.PI / 3;
      atoms.push(cart(elem, Math.cos(angle), Math.sin(angle), z - 0.5));
    }
    if (includeCenters) atoms.push(cart(elem, 0, 0, z - 0.5));
  });
  return atoms;
}

function hcpAtoms() {
  const atoms = hexPrismAtoms("M", true);
  for (let i = 0; i < 3; i += 1) {
    const angle = Math.PI / 2 + i * (2 * Math.PI / 3);
    atoms.push(cart("M", 0.58 * Math.cos(angle), 0.58 * Math.sin(angle), 0));
  }
  return atoms;
}

function substitutionalSolidSolutionAtoms() {
  const atoms = [...makeBoxCorners("M"), ...faceCenters("M")];
  atoms[8] = frac("S", 0.5, 0.5, 0);
  atoms[12] = frac("S", 0, 0.5, 0.5);
  return atoms;
}

function interstitialSolidSolutionAtoms() {
  return [
    ...makeBoxCorners("M"),
    ...faceCenters("M"),
    frac("I", 0.5, 0.5, 0.5),
    frac("I", 0.5, 0, 0),
    frac("I", 0, 0.5, 0)
  ];
}
