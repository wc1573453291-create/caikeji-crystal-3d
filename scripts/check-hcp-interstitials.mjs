import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
function load(read) {
  const context = vm.createContext({ window: {}, navigator: {}, console, document: { getElementById: () => ({}) } });
  for (const path of ["js/crystalData.js", "js/renderer.js"]) vm.runInContext(read(path), context, { filename: path });
  return context.window;
}
const current = load(path => readFileSync(new URL(path, root), "utf8"));
const key = p => [p.x, p.y, p.z].map(v => Math.round(v * 1e6) / 1e6).join("*");
const edgeKey = e => [key(e.start), key(e.end)].sort().join("|");
const near = (x, y) => assert.ok(Math.abs(x - y) < 1e-6, `${x} != ${y}`);
const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);
const same = (x, y, message) => assert.equal(JSON.stringify(x), JSON.stringify(y), message);
function capture() {
  const spheres = [], edges = [], labels = [];
  return { spheres, edges, labels, viewer: {
    addSphere: spec => spheres.push(spec), addCylinder: spec => edges.push(spec),
    addLabel: (text, style) => labels.push({ text, style }),
    clear() {}, resize() {}, zoomTo() {}, rotate() {}, zoom() {}, render() {}
  } };
}
function select(window, crystal, n, type, site = null) {
  const renderer = new window.CrystalRenderer();
  const output = capture();
  renderer.viewer = output.viewer;
  renderer.currentAtoms = renderer.buildAtoms(crystal, n);
  renderer.options = { ...renderer.options, showTetraSites: type === "tetra", showOctaSites: type === "octa", selectedInterstitialKey: site ? key(site) : "" };
  renderer.addInterstitialSites(crystal, n);
  return output;
}
function extracted(window, crystal, type, site) {
  const renderer = new window.InterstitialRenderer();
  const output = capture();
  renderer.viewer = output.viewer;
  renderer.render(crystal, type, site);
  return output;
}
function frame(window, crystal, n) {
  const renderer = new window.CrystalRenderer();
  const output = capture();
  renderer.viewer = output.viewer;
  renderer.addUnitCells(crystal, n);
  return output.edges;
}
// Independent reference: triangular rows with a 60-degree basis, offset on alternate layers.
function referenceMetals(a, c) {
  const atoms = [];
  for (let layer = -4; layer <= 8; layer++) {
    const shiftY = Math.abs(layer % 2) * a / Math.sqrt(3);
    for (let row = -6; row <= 10; row++) {
      for (let column = -6; column <= 10; column++) {
        atoms.push({ x: a * (column + row / 2), y: a * Math.sqrt(3) * row / 2 + shiftY, z: layer * c / 2 });
      }
    }
  }
  return atoms;
}

let checked = 0;
near(current.CRYSTAL_LIBRARY.hcp.lattice.c, Math.sqrt(8 / 3));
for (const a of [1, 2]) {
  const c = a * Math.sqrt(8 / 3);
  const crystal = { ...current.CRYSTAL_LIBRARY.hcp, lattice: { type: "hcp-honeycomb", radius: a, c } };
  const reference = referenceMetals(a, c);
  const referenceKeys = new Set(reference.map(key));
  for (const n of [1, 2]) {
    const atoms = new current.CrystalRenderer().buildAtoms(crystal, n);
    const atomKeys = new Set(atoms.map(key));
    assert.equal(atoms.length, n === 1 ? 17 : 84);
    assert.equal(atomKeys.size, atoms.length);
    for (const atom of atoms) {
      assert.ok(referenceKeys.has(key(atom)), "Every metal must lie on an exact ABAB lattice site");
      const shell = reference.map(p => distance(p, atom) / a).filter(d => d > 1e-6).sort((x, y) => x - y);
      shell.slice(0, 12).forEach(d => near(d, 1));
      assert.ok(shell[12] > 1.1, "Exactly twelve equidistant nearest neighbors");
    }
    for (let layer = 0; layer <= 2 * n; layer++) {
      assert.equal(atoms.filter(p => Math.abs(p.z - layer * c / 2) < 1e-6).length,
        layer % 2 ? (n === 1 ? 3 : 12) : (n === 1 ? 7 : 20));
    }
    const edges = frame(current, crystal, n);
    assert.equal(edges.length, n === 1 ? 18 : 89);
    assert.equal(new Set(edges.map(edgeKey)).size, edges.length, "Shared honeycomb edges are unique");
    assert.ok(edges.every(e => atomKeys.has(key(e.start)) && atomKeys.has(key(e.end))));

    for (const type of ["tetra", "octa"]) {
      const plain = select(current, crystal, n, type);
      const sites = plain.spheres.filter(s => s.clickable).map(s => s.center);
      assert.equal(sites.length, type === "tetra" ? (n === 1 ? 20 : 128) : (n === 1 ? 6 : 48));
      assert.equal(new Set(sites.map(key)).size, sites.length);
      assert.equal(plain.edges.length, 0, "No polyhedron until a site is selected");
      if (n === 1) {
        const weighted = sites.reduce((sum, p) => sum + (Math.abs(Math.hypot(p.x, p.y) - a) < 1e-6 ? 1 / 3 : 1), 0);
        near(weighted, type === "tetra" ? 12 : 6);
      }
      for (const site of sites) {
        const zFraction = (site.z / c) % 1;
        assert.ok((type === "tetra" ? [1 / 8, 3 / 8, 5 / 8, 7 / 8] : [1 / 4, 3 / 4]).some(z => Math.abs(z - zFraction) < 1e-6));
        assert.ok(!atomKeys.has(key(site)), "No interstitial sphere on a metal atom");
        const output = select(current, crystal, n, type, site);
        const neighbors = output.edges.filter(e => e.radius === 0.012).map(e => e.end);
        const count = type === "tetra" ? 4 : 6;
        assert.equal(neighbors.length, count);
        assert.equal(new Set(neighbors.map(key)).size, count);
        const nearest = reference.map(p => ({ p, d: distance(p, site) })).sort((x, y) => x.d - y.d).slice(0, count);
        same(neighbors.map(key).sort(), nearest.map(({ p }) => key(p)).sort(), "Selected vertices must be the true periodic neighbors");
        neighbors.forEach(p => near(distance(site, p) / a, type === "tetra" ? Math.sqrt(6) / 4 : 1 / Math.sqrt(2)));
        for (const axis of ["x", "y", "z"]) near(neighbors.reduce((sum, p) => sum + p[axis], 0) / count, site[axis]);
        const layerCounts = new Map();
        neighbors.forEach(p => { const z = Math.round(p.z / c * 2); layerCounts.set(z, (layerCounts.get(z) || 0) + 1); });
        same([...layerCounts.values()].sort(), type === "tetra" ? [1, 3] : [3, 3]);
        const cage = output.edges.filter(e => e.radius === 0.014);
        assert.equal(cage.length, type === "tetra" ? 6 : 12);
        assert.equal(new Set(cage.map(edgeKey)).size, cage.length);
        cage.forEach(e => near(distance(e.start, e.end), a));
        const addedMetals = output.spheres.filter(s => !s.clickable && s.opacity === 1);
        assert.ok(addedMetals.every(s => referenceKeys.has(key(s.center)) && !atomKeys.has(key(s.center))));
        assert.equal(new Set(addedMetals.map(s => key(s.center))).size, addedMetals.length);
        const mini = extracted(current, crystal, type, site);
        const localMetals = mini.spheres.filter(s => s.opacity === 0.62);
        assert.equal(localMetals.length, count);
        same(localMetals.map(s => key({ x: s.center.x + site.x, y: s.center.y + site.y, z: s.center.z + site.z })).sort(),
          neighbors.map(key).sort(), "Extraction must only translate the actual selected polyhedron");
        localMetals.forEach(s => near(s.radius, a / 2));
        const gap = mini.spheres.find(s => s.opacity === 1);
        near(gap.radius / localMetals[0].radius, type === "tetra" ? Math.sqrt(3 / 2) - 1 : Math.sqrt(2) - 1);
        near(gap.radius + a / 2, distance(localMetals[0].center, gap.center));
        assert.equal(mini.edges.filter(e => e.radius === 0.012).length, type === "tetra" ? 6 : 12);
        checked++;
      }
    }
  }
}

// Refit by width on narrow portrait viewers, both before and after selecting a boundary hole.
for (const [width, height] of [[360, 311], [548, 1220]]) {
  for (const n of [1, 2]) {
    for (const selectedInterstitialKey of ["", "boundary-site"]) {
      const renderer = new current.CrystalRenderer();
      let zoomFactor;
      renderer.currentCrystal = current.CRYSTAL_LIBRARY.hcp;
      renderer.container = { clientWidth: width, clientHeight: height };
      renderer.options = { ...renderer.options, supercell: n, selectedInterstitialKey };
      renderer.viewer = { resize() {}, zoomTo() {}, zoom: value => { zoomFactor = value; }, render() {} };
      renderer.resize();
      near(zoomFactor, (n === 1 ? 2.6 : 1.15) * Math.min(1, width / height));
    }
  }
}

// Optional pre-change revision proves that this fix does not alter the other structures.
if (process.argv[2]) {
  const before = load(path => execFileSync("git", ["show", `${process.argv[2]}:${path}`], { cwd: root, encoding: "utf8" }));
  const renderer = new current.CrystalRenderer(), oldRenderer = new before.CrystalRenderer();
  for (const [id, crystal] of Object.entries(current.CRYSTAL_LIBRARY)) {
    if (id === "hcp") continue;
    const oldCrystal = before.CRYSTAL_LIBRARY[id];
    same(crystal, oldCrystal, `${id}: unchanged knowledge data`);
    for (const n of [1, 2]) {
      same(renderer.buildAtoms(crystal, n), oldRenderer.buildAtoms(oldCrystal, n), `${id}: unchanged base atoms`);
      same(frame(current, crystal, n), frame(before, oldCrystal, n), `${id}: unchanged frame`);
    }
  }
  for (const id of ["fcc", "bcc"]) {
    const crystal = current.CRYSTAL_LIBRARY[id];
    for (const n of [1, 2]) {
      for (const type of ["tetra", "octa"]) {
        const sites = select(current, crystal, n, type).spheres.map(s => s.center);
        for (const site of sites) {
          const now = select(current, crystal, n, type, site), old = select(before, crystal, n, type, site);
          const mini = extracted(current, crystal, type, site), oldMini = extracted(before, crystal, type, site);
          for (const field of ["spheres", "edges", "labels"]) {
            same(now[field], old[field], `${id}: unchanged selected ${field}`);
            same(mini[field], oldMini[field], `${id}: unchanged extracted ${field}`);
          }
        }
      }
    }
  }
  console.log("All non-HCP structures unchanged, including every FCC/BCC interstitial selection.");
}
console.log(`Passed ${checked} HCP site/scale checks: ABAB layers, nearest neighbors, regular polyhedra, matching extraction and radii.`);
