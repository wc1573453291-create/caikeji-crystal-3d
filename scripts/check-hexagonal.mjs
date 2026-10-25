import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
function load(read) {
  const context = vm.createContext({
    window: {}, navigator: {}, console,
    document: { getElementById: () => ({}) }
  });
  for (const path of ["js/crystalData.js", "js/renderer.js"]) {
    vm.runInContext(read(path), context, { filename: path });
  }
  return context.window;
}

const current = load(path => readFileSync(new URL(path, root), "utf8"));
const renderer = new current.CrystalRenderer();
const crystal = current.CRYSTAL_LIBRARY["hexagonal-p"];
const key = p => [p.x, p.y, p.z].map(v => Math.round(v * 1e6) / 1e6).join("*");
const edgeKey = edge => [key(edge.start), key(edge.end)].sort().join("|");
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
const length = p => Math.hypot(p.x, p.y, p.z);
function frame(instance, data, n) {
  const edges = [];
  instance.viewer = { addCylinder: edge => edges.push(edge) };
  instance.addUnitCells(data, n);
  return edges;
}

assert.equal(crystal.lattice.type, "hex-prism");
assert.equal(crystal.latticeConstants, "a=b≠c；α=β=90°，γ=120°");
for (const [n, atomCount, edgeCount] of [[1, 14, 18], [2, 60, 89]]) {
  const atoms = renderer.buildAtoms(crystal, n);
  const { a, c } = crystal.lattice;
  assert.equal(atoms.length, atomCount);
  const positions = new Set(atoms.map(key));
  assert.equal(positions.size, atoms.length, "No overlapping lattice spheres");
  for (const p of atoms) {
    // Inverse of a1=(a,0,0), a2=(-a/2,sqrt(3)*a/2,0), a3=(0,0,c).
    const j = 2 * p.y / (Math.sqrt(3) * a);
    const i = p.x / a + j / 2;
    near(i, Math.round(i));
    near(j, Math.round(j));
    near(p.z / c, Math.round(p.z / c));
    assert.ok(p.z >= 0 && p.z <= n * c, "Only AA layers, no HCP B layer");
  }
  for (let k = 0; k <= n; k++) {
    assert.equal(atoms.filter(p => Math.abs(p.z - k * c) < 1e-6).length, n === 1 ? 7 : 20);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const center = { x: 1.5 * a * i, y: Math.sqrt(3) * a * (j + i / 2), z: k * c };
        assert.ok(positions.has(key(center)), "Basal center is a lattice point");
        for (let v = 0; v < 6; v++) {
          assert.ok(positions.has(key({
            x: center.x + a * Math.cos(v * Math.PI / 3),
            y: center.y + a * Math.sin(v * Math.PI / 3), z: center.z
          })), "Every prism retains six corners");
        }
      }
    }
  }
  const edges = frame(renderer, crystal, n);
  assert.equal(edges.length, edgeCount);
  assert.equal(new Set(edges.map(edgeKey)).size, edges.length, "No duplicate shared edges");
  const adjacency = new Map();
  for (const { start, end } of edges) {
    assert.ok(positions.has(key(start)) && positions.has(key(end)));
    near(Math.hypot(start.x - end.x, start.y - end.y, start.z - end.z), start.z === end.z ? a : c);
    for (const [from, to] of [[start, end], [end, start]]) {
      if (!adjacency.has(key(from))) adjacency.set(key(from), []);
      adjacency.get(key(from)).push(key(to));
    }
  }
  const visited = new Set();
  const queue = [adjacency.keys().next().value];
  while (queue.length) {
    const point = queue.pop();
    if (visited.has(point)) continue;
    visited.add(point);
    queue.push(...adjacency.get(point));
  }
  assert.equal(visited.size, adjacency.size, "The honeycomb frame is connected");
}

const guides = [], labels = [];
renderer.viewer = { addCylinder: edge => guides.push(edge), addLabel: (text, style) => labels.push({ text, style }) };
renderer.addLatticeAnnotations(crystal);
assert.deepEqual(labels.map(label => label.text), ["a", "b", "c", "\u03b3"]);
const [aGuide, bGuide, cGuide, ...arc] = guides;
near(length(aGuide.end), crystal.lattice.a);
near(length(bGuide.end), crystal.lattice.a);
near((aGuide.end.x * bGuide.end.x + aGuide.end.y * bGuide.end.y) / crystal.lattice.a ** 2, -0.5);
assert.equal(key(cGuide.start), "0*0*0");
assert.equal(key(cGuide.end), `0*0*${crystal.lattice.c}`);
for (const [point, axis] of [[arc[0].start, aGuide.end], [arc.at(-1).end, bGuide.end]]) {
  near(point.x, axis.x * 0.36);
  near(point.y, axis.y * 0.36);
}

for (const [width, height] of [[360, 311], [548, 1220]]) {
  for (const n of [1, 2]) {
    let zoomFactor;
    renderer.container = { clientWidth: width, clientHeight: height };
    renderer.currentCrystal = crystal;
    renderer.options.supercell = n;
    renderer.viewer = { resize() {}, zoomTo() {}, zoom: value => { zoomFactor = value; }, render() {} };
    renderer.resize();
    near(zoomFactor, (n === 1 ? 2.6 : 1.15) * Math.min(1, width / height));
  }
}

// Optional comparison against the pre-change Git revision protects all other structures.
if (process.argv[2]) {
  const before = load(path => execFileSync("git", ["show", `${process.argv[2]}:${path}`], { cwd: root, encoding: "utf8" }));
  const oldRenderer = new before.CrystalRenderer();
  let count = 0;
  for (const [id, data] of Object.entries(current.CRYSTAL_LIBRARY)) {
    if (id === "hexagonal-p") continue;
    assert.equal(JSON.stringify(data), JSON.stringify(before.CRYSTAL_LIBRARY[id]), `${id}: unchanged knowledge data`);
    for (const n of [1, 2]) {
      assert.equal(JSON.stringify(renderer.buildAtoms(data, n)), JSON.stringify(oldRenderer.buildAtoms(data, n)), `${id}: unchanged atoms`);
      if (data.lattice) assert.equal(JSON.stringify(frame(renderer, data, n)), JSON.stringify(frame(oldRenderer, data, n)), `${id}: unchanged frame`);
    }
    count++;
  }
  console.log(`Regression comparison passed for ${count} other structures.`);
}
console.log("Simple hexagonal: AA sites, deduplication, connected prisms and annotations passed.");
