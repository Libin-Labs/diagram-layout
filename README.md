# @lp-labs/diagram-layout

A deterministic layered layout for bounded directed acyclic graphs (DAGs). It validates node and
edge identifiers, finds stable topological layers, and assigns non-overlapping positions within
each layer.

## Install

```sh
npm install @lp-labs/diagram-layout
```

```js
import { layoutDag } from '@lp-labs/diagram-layout';

const result = layoutDag(
  [
    { id: 'input', width: 80, height: 32 },
    { id: 'process', width: 120, height: 48 },
    { id: 'output', width: 72, height: 32 },
  ],
  [
    { from: 'input', to: 'process' },
    { from: 'process', to: 'output' },
  ],
);
console.log(result.nodes);
```

## API and types

- `layoutDag(nodes, edges, options?)` returns a `DiagramLayout` containing positioned `nodes`,
  copied `edges`, deterministic topological `order`, and layer ID arrays.
- Each input `DiagramNode` has a unique `id` and finite nonnegative `width` and `height`. Each
  `DiagramEdge` names an existing `from` and `to`; duplicate edges are rejected.
- `DiagramLayoutOptions.nodeGap` (default `48`) spaces nodes vertically;
  `layerGap` (default `96`) spaces layers horizontally; `maxNodes` (default `10,000`) and
  `maxEdges` (default `50,000`) can lower their respective capacities.
- `PositionedNode` adds `x`, `y`, and zero-based `layer` to a `DiagramNode`.
- `DiagramCycleError` extends `Error` and exposes a closed `cycle` ID path. Cycles throw this
  diagnostic rather than returning misleading positions.
- Exported types: `DiagramNode`, `DiagramEdge`, `PositionedNode`, `DiagramLayoutOptions`, and
  `DiagramLayout`.

Nodes are stably ordered by ID within a layer and positions are derived by longest-path layer
assignment. This intentionally simple layout does not optimize edge crossings, support port
constraints, perform incremental layout, or guarantee compactness. Node dimensions and generated
coordinates are capped at 1e9. Invalid IDs or references throw `TypeError`; invalid dimensions,
capacities, and coordinate overflow throw `RangeError`.

## Module formats and customization

ESM, CommonJS (`require('@lp-labs/diagram-layout')`), and TypeScript declarations are included.
Applications can customize gaps and capacities per call, then apply their own renderer-specific
ports, styling, and edge drawing. There are no runtime or peer dependencies; TypeScript and
Prettier are development-only.

## Support

If this library is useful to you, consider supporting its maintenance with a [donation via PayPal](https://www.paypal.me/LibinPrasanth).

## Author

Created by [Libin Prasanth](https://www.linkedin.com/in/libinprasanth/). Connect on LinkedIn for updates and discussion.
