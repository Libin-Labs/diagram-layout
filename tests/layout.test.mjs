import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as esm from '../dist/esm/index.js';

const require = createRequire(import.meta.url);
const cjs = require('../dist/cjs/index.js');

test('ESM and CommonJS surfaces agree', () => {
  assert.deepEqual(Object.keys(esm).sort(), Object.keys(cjs).sort());
});

test('layout is deterministic and places edges in strictly later layers', () => {
  const nodes = [
    { id: 'out', width: 40, height: 20 },
    { id: 'left', width: 60, height: 30 },
    { id: 'in', width: 30, height: 24 },
    { id: 'right', width: 50, height: 36 },
  ];
  const edges = [
    { from: 'in', to: 'right' },
    { from: 'left', to: 'out' },
    { from: 'in', to: 'left' },
  ];
  const first = esm.layoutDag(nodes, edges);
  assert.deepEqual(esm.layoutDag(nodes, edges), first);
  const byId = new Map(first.nodes.map((node) => [node.id, node]));
  for (const edge of edges) assert.ok(byId.get(edge.from).layer < byId.get(edge.to).layer);
  for (const layer of first.layers) {
    const positions = layer.map((id) => byId.get(id));
    for (let i = 1; i < positions.length; i += 1) {
      assert.ok(positions[i].y >= positions[i - 1].y + positions[i - 1].height + 48);
    }
  }
});

test('empty graph and disconnected nodes are valid', () => {
  assert.deepEqual(esm.layoutDag([], []), {
    nodes: [],
    edges: [],
    order: [],
    layers: [],
  });
  const result = esm.layoutDag(
    [
      { id: 'b', width: 1, height: 1 },
      { id: 'a', width: 1, height: 1 },
    ],
    [],
  );
  assert.deepEqual(result.order, ['a', 'b']);
  assert.equal(result.nodes[0].y, 0);
  assert.equal(result.nodes[1].y, 49);
});

test('cycle diagnostic reports a closed cycle and residual downstream nodes', () => {
  assert.throws(
    () =>
      esm.layoutDag(
        [
          { id: 'a', width: 1, height: 1 },
          { id: 'b', width: 1, height: 1 },
          { id: 'tail', width: 1, height: 1 },
        ],
        [
          { from: 'a', to: 'b' },
          { from: 'b', to: 'a' },
          { from: 'b', to: 'tail' },
        ],
      ),
    (error) => {
      assert.ok(error instanceof esm.DiagramCycleError);
      assert.equal(error.cycle[0], error.cycle.at(-1));
      assert.ok(error.cycle.includes('a') && error.cycle.includes('b'));
      return true;
    },
  );
});

test('duplicate, missing, malformed, and over-capacity inputs reject', () => {
  const node = { id: 'n', width: 1, height: 1 };
  assert.throws(() => esm.layoutDag([node, node], []), TypeError);
  assert.throws(() => esm.layoutDag([node], [{ from: 'n', to: 'missing' }]), TypeError);
  assert.throws(
    () =>
      esm.layoutDag(
        [node],
        [
          { from: 'n', to: 'n' },
          { from: 'n', to: 'n' },
        ],
      ),
    TypeError,
  );
  assert.throws(() => esm.layoutDag([{ ...node, width: -1 }], []), RangeError);
  assert.throws(
    () =>
      esm.layoutDag([node, { id: 'm', width: 1, height: 1 }], [], {
        maxNodes: 1,
      }),
    RangeError,
  );
  assert.throws(() => esm.layoutDag([], [], { nodeGap: Infinity }), RangeError);
});

test('generated DAG layouts preserve edge order and separate node rectangles', () => {
  const nodes = Array.from({ length: 64 }, (_, index) => ({
    id: `n${String(index).padStart(2, '0')}`,
    width: 10 + (index % 7),
    height: 8 + (index % 5),
  }));
  const edges = [];
  for (let from = 0; from < nodes.length; from += 1) {
    for (let to = from + 1; to < nodes.length; to += 1) {
      if ((from * 17 + to * 31) % 19 === 0) edges.push({ from: nodes[from].id, to: nodes[to].id });
    }
  }
  const result = esm.layoutDag(nodes, edges);
  const positions = new Map(result.nodes.map((node) => [node.id, node]));
  for (const edge of edges)
    assert.ok(positions.get(edge.from).layer < positions.get(edge.to).layer);
  for (let first = 0; first < result.nodes.length; first += 1) {
    for (let second = first + 1; second < result.nodes.length; second += 1) {
      const a = result.nodes[first];
      const b = result.nodes[second];
      const separated =
        a.x + a.width <= b.x ||
        b.x + b.width <= a.x ||
        a.y + a.height <= b.y ||
        b.y + b.height <= a.y;
      assert.ok(separated, `${a.id} overlaps ${b.id}`);
    }
  }
});

test('long cyclic chains report a cycle without recursive stack dependence', () => {
  const nodes = Array.from({ length: 1500 }, (_, index) => ({
    id: `n${index}`,
    width: 1,
    height: 1,
  }));
  const edges = nodes
    .slice(0, -1)
    .map((node, index) => ({ from: node.id, to: nodes[index + 1].id }));
  edges.push({ from: nodes.at(-1).id, to: nodes[0].id });
  assert.throws(() => esm.layoutDag(nodes, edges), esm.DiagramCycleError);
});
