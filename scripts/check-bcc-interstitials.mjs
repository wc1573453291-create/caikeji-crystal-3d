import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
function load(read) {
  const context = vm.createContext({ window: {}, navigator: {}, console, document: { getElementById: () => ({}) } });
  for (const path of ["js/crystalData.js", "js/renderer.js"]) {
    vm.runInContext(read(path), context, { filename: path });
  }
  return context.window;
}
const current = load(path => readFileSync(new URL(path, root), "utf8"));
const key = p => [p.x, p.y, p.z].map(v => Math.round(v * 1e6) / 1e6).join("*");
const near = (x, y) => assert.ok(Math.abs(x - y) < 1e-6, `${x} != ${y}`);
const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);
function capture() {
  const spheres = [], edges = [], labels = [];
  return {
    spheres, edges, labels,
    viewer: {
      addSphere: spec => spheres.push(spec), addCylinder: spec => edges.push(spec),
      addLabel: (text, style) => labels.push({ text, style }), clear() {},
      resize() {}, zoomTo() {}, rotate() {}, zoom() {}, render() {}
    }
  };
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
function isBcc(p, a) {
  return [0, 0.5].some(offset => [p.x, p.y, p.z].every(v => Math.abs(v / a - offset - Math.round(v / a - offset)) < 1e-6));
}

let checked = 0;
for (const a of [1, 2]) {
  const crystal = { ...current.CRYSTAL_LIBRARY.bcc, lattice: { a, b: a, c: a } };
  for (const n of [1, 2]) {
    for (const type of ["tetra", "octa"]) {
      const plain = select(current, crystal, n, type);
      const sites = plain.spheres.filter(s => s.clickable).map(s => s.center);
      assert.equal(sites.length, type === "tetra" ? (n === 1 ? 24 : 144) : (n === 1 ? 18 : 90));
      assert.equal(new Set(sites.map(key)).size, sites.length);
      assert.equal(plain.edges.length, 0, "No cage before selection");
      for (const site of sites) {
        const output = select(current, crystal, n, type, site);
        const neighbors = output.edges.filter(e => e.radius === 0.012).map(e => e.end);
        const count = type === "tetra" ? 4 : 6;
        assert.equal(neighbors.length, count);
        assert.equal(new Set(neighbors.map(key)).size, count);
        assert.ok(neighbors.every(p => isBcc(p, a)), "All cage vertices must be corner/body-center lattice sites");
        const distances = neighbors.map(p => distance(site, p)).sort((x, y) => x - y);
        distances.forEach((d, i) => near(d / a, type === "tetra" ? Math.sqrt(5) / 4 : (i < 2 ? 0.5 : 1 / Math.sqrt(2))));
        const cage = output.edges.filter(e => e.radius === 0.014);
        assert.equal(cage.length, type === "tetra" ? 6 : 12);
        assert.equal(new Set(cage.map(e => [key(e.start), key(e.end)].sort().join("|"))).size, cage.length);
        for (const edge of cage) {
          const mid = { x: (edge.start.x + edge.end.x) / 2, y: (edge.start.y + edge.end.y) / 2, z: (edge.start.z + edge.end.z) / 2 };
          assert.notEqual(key(mid), key(site), "No axial diagonal masquerading as an octahedron edge");
        }
        const addedMetals = output.spheres.filter(s => !s.clickable && s.opacity === 1);
        assert.ok(addedMetals.every(s => isBcc(s.center, a)), "Boundary completions are real periodic atoms");
        const mini = new current.InterstitialRenderer();
        const extracted = capture();
        mini.viewer = extracted.viewer;
        mini.render(crystal, type, site);
        const localMetals = extracted.spheres.filter(s => s.opacity === 0.62);
        assert.equal(localMetals.length, count);
        assert.equal(
          JSON.stringify(localMetals.map(s => key({ x: s.center.x + site.x, y: s.center.y + site.y, z: s.center.z + site.z })).sort()),
          JSON.stringify(neighbors.map(key).sort()), "Extracted cluster must match the selected lattice atoms"
        );
        const gap = extracted.spheres.find(s => s.opacity === 1);
        near(gap.radius / localMetals[0].radius, type === "tetra" ? Math.sqrt(5 / 3) - 1 : 2 / Math.sqrt(3) - 1);
        assert.equal(extracted.edges.filter(e => e.radius === 0.012).length, type === "tetra" ? 6 : 12);
        checked++;
      }
    }
  }
}

if (process.argv[2]) {
  const before = load(path => execFileSync("git", ["show", `${process.argv[2]}:${path}`], { cwd: root, encoding: "utf8" }));
  const renderer = new current.CrystalRenderer();
  const oldRenderer = new before.CrystalRenderer();
  for (const [id, crystal] of Object.entries(current.CRYSTAL_LIBRARY)) {
    if (id !== "bcc") assert.equal(JSON.stringify(crystal), JSON.stringify(before.CRYSTAL_LIBRARY[id]), `${id}: unchanged knowledge data`);
    for (const n of [1, 2]) {
      assert.equal(JSON.stringify(renderer.buildAtoms(crystal, n)), JSON.stringify(oldRenderer.buildAtoms(before.CRYSTAL_LIBRARY[id], n)), `${id}: unchanged base crystal`);
    }
  }
  for (const id of ["fcc", "hcp"]) {
    assert.equal(JSON.stringify(current.CRYSTAL_LIBRARY[id]), JSON.stringify(before.CRYSTAL_LIBRARY[id]));
    for (const n of [1, 2]) {
      for (const type of ["tetra", "octa"]) {
        const crystal = current.CRYSTAL_LIBRARY[id];
        const sites = select(current, crystal, n, type).spheres.map(s => s.center);
        for (const site of sites) {
          const now = select(current, crystal, n, type, site);
          const old = select(before, crystal, n, type, site);
          for (const field of ["spheres", "edges", "labels"]) {
            assert.equal(JSON.stringify(now[field]), JSON.stringify(old[field]), `${id}: unchanged ${field}`);
          }
        }
        const mini = new current.InterstitialRenderer();
        const oldMini = new before.InterstitialRenderer();
        const now = capture(), old = capture();
        mini.viewer = now.viewer;
        oldMini.viewer = old.viewer;
        mini.render(crystal, type, sites[0]);
        oldMini.render(crystal, type);
        for (const field of ["spheres", "edges", "labels"]) {
          assert.equal(JSON.stringify(now[field]), JSON.stringify(old[field]), `${id}: unchanged extracted ${field}`);
        }
      }
    }
  }
  console.log("FCC and HCP interstitial renderings unchanged.");
}
console.log(`Passed ${checked} BCC site/scale checks: real lattice vertices, distances, cage edges and matching extracted clusters.`);
