export interface DiagramNode {
  id: string;
  width: number;
  height: number;
}

export interface DiagramEdge {
  from: string;
  to: string;
}

export interface PositionedNode extends DiagramNode {
  x: number;
  y: number;
  layer: number;
}

export interface DiagramLayoutOptions {
  nodeGap?: number;
  layerGap?: number;
  maxNodes?: number;
  maxEdges?: number;
}

export interface DiagramLayout {
  nodes: PositionedNode[];
  edges: DiagramEdge[];
  order: string[];
  layers: string[][];
}

export class DiagramCycleError extends Error {
  readonly cycle: string[];

  constructor(cycle: string[]) {
    super(`Diagram contains a directed cycle: ${cycle.join(' -> ')}`);
    this.name = 'DiagramCycleError';
    this.cycle = cycle;
  }
}

const MAX_NODES = 10_000;
const MAX_EDGES = 50_000;
const MAX_DIMENSION = 1e9;

function validId(id: string, label: string): void {
  if (typeof id !== 'string' || id.length === 0 || id.length > 128) {
    throw new TypeError(`${label} must be a nonempty string up to 128 characters.`);
  }
}

function finiteNonnegative(value: number, label: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > MAX_DIMENSION) {
    throw new RangeError(`${label} must be finite and between 0 and ${MAX_DIMENSION}.`);
  }
}

function findCycle(residual: Set<string>, adjacency: Map<string, Set<string>>): string[] {
  const state = new Map<string, 0 | 1 | 2>();
  const path: string[] = [];
  for (const id of [...residual].sort()) {
    if ((state.get(id) ?? 0) !== 0) continue;
    const stack: Array<{ id: string; neighbors: string[]; nextIndex: number }> = [];
    const enter = (next: string): void => {
      state.set(next, 1);
      path.push(next);
      stack.push({
        id: next,
        neighbors: [...(adjacency.get(next) ?? [])]
          .filter((neighbor) => residual.has(neighbor))
          .sort(),
        nextIndex: 0,
      });
    };
    enter(id);
    while (stack.length > 0) {
      const current = stack[stack.length - 1]!;
      if (current.nextIndex >= current.neighbors.length) {
        state.set(current.id, 2);
        path.pop();
        stack.pop();
        continue;
      }
      const next = current.neighbors[current.nextIndex++]!;
      const nextState = state.get(next) ?? 0;
      if (nextState === 0) {
        enter(next);
      } else if (nextState === 1) {
        const index = path.indexOf(next);
        return [...path.slice(index), next];
      }
    }
  }
  return [...residual].sort();
}

export function layoutDag(
  nodes: readonly DiagramNode[],
  edges: readonly DiagramEdge[],
  options: DiagramLayoutOptions = {},
): DiagramLayout {
  if (!Array.isArray(nodes) || !Array.isArray(edges)) {
    throw new TypeError('Nodes and edges must be arrays.');
  }
  const maxNodes = options.maxNodes ?? MAX_NODES;
  const maxEdges = options.maxEdges ?? MAX_EDGES;
  if (!Number.isSafeInteger(maxNodes) || maxNodes < 1 || maxNodes > MAX_NODES) {
    throw new RangeError(`maxNodes must be an integer from 1 to ${MAX_NODES}.`);
  }
  if (!Number.isSafeInteger(maxEdges) || maxEdges < 0 || maxEdges > MAX_EDGES) {
    throw new RangeError(`maxEdges must be an integer from 0 to ${MAX_EDGES}.`);
  }
  if (nodes.length > maxNodes) throw new RangeError('Node capacity exceeded.');
  if (edges.length > maxEdges) throw new RangeError('Edge capacity exceeded.');
  const nodeGap = options.nodeGap ?? 48;
  const layerGap = options.layerGap ?? 96;
  finiteNonnegative(nodeGap, 'nodeGap');
  finiteNonnegative(layerGap, 'layerGap');

  const byId = new Map<string, DiagramNode>();
  for (const node of nodes) {
    if (!node || typeof node !== 'object') throw new TypeError('Each node must be an object.');
    validId(node.id, 'Node ID');
    finiteNonnegative(node.width, 'Node width');
    finiteNonnegative(node.height, 'Node height');
    if (byId.has(node.id)) throw new TypeError(`Duplicate node ID: ${node.id}`);
    byId.set(node.id, { id: node.id, width: node.width, height: node.height });
  }

  const adjacency = new Map<string, Set<string>>();
  const indegree = new Map<string, number>();
  for (const id of byId.keys()) {
    adjacency.set(id, new Set());
    indegree.set(id, 0);
  }
  const normalizedEdges: DiagramEdge[] = [];
  for (const edge of edges) {
    if (!edge || typeof edge !== 'object') throw new TypeError('Each edge must be an object.');
    validId(edge.from, 'Edge source');
    validId(edge.to, 'Edge destination');
    if (!byId.has(edge.from) || !byId.has(edge.to)) {
      throw new TypeError(`Edge references an unknown node: ${edge.from} -> ${edge.to}`);
    }
    const destinations = adjacency.get(edge.from)!;
    if (destinations.has(edge.to))
      throw new TypeError(`Duplicate edge: ${edge.from} -> ${edge.to}`);
    destinations.add(edge.to);
    indegree.set(edge.to, indegree.get(edge.to)! + 1);
    normalizedEdges.push({ from: edge.from, to: edge.to });
  }

  const ready = [...byId.keys()].filter((id) => indegree.get(id) === 0).sort();
  const order: string[] = [];
  const layerOf = new Map([...byId.keys()].map((id) => [id, 0]));
  while (ready.length > 0) {
    const id = ready.shift()!;
    order.push(id);
    for (const next of [...adjacency.get(id)!].sort()) {
      layerOf.set(next, Math.max(layerOf.get(next)!, layerOf.get(id)! + 1));
      indegree.set(next, indegree.get(next)! - 1);
      if (indegree.get(next) === 0) {
        ready.push(next);
        ready.sort();
      }
    }
  }
  if (order.length !== byId.size) {
    const residual = new Set([...byId.keys()].filter((id) => indegree.get(id)! > 0));
    throw new DiagramCycleError(findCycle(residual, adjacency));
  }

  const layerCount =
    order.length === 0
      ? 0
      : order.reduce((maximum, id) => Math.max(maximum, layerOf.get(id)!), 0) + 1;
  const layers = Array.from({ length: layerCount }, () => [] as string[]);
  for (const id of order) layers[layerOf.get(id)!]!.push(id);
  for (const layer of layers) layer.sort();
  const widths = layers.map((layer) => Math.max(0, ...layer.map((id) => byId.get(id)!.width)));
  const layerX: number[] = [];
  for (let index = 0; index < widths.length; index += 1) {
    layerX[index] = index === 0 ? 0 : layerX[index - 1]! + widths[index - 1]! + layerGap;
    finiteNonnegative(layerX[index]!, 'Layout x coordinate');
  }
  const positioned: PositionedNode[] = [];
  for (let layerIndex = 0; layerIndex < layers.length; layerIndex += 1) {
    let y = 0;
    for (const id of layers[layerIndex]!) {
      const node = byId.get(id)!;
      positioned.push({
        ...node,
        x: layerX[layerIndex]!,
        y,
        layer: layerIndex,
      });
      y += node.height + nodeGap;
      finiteNonnegative(y, 'Layout y coordinate');
    }
  }
  positioned.sort(
    (first, second) =>
      first.layer - second.layer || (first.id < second.id ? -1 : first.id > second.id ? 1 : 0),
  );
  return {
    nodes: positioned,
    edges: normalizedEdges,
    order,
    layers: layers.map((layer) => [...layer]),
  };
}
