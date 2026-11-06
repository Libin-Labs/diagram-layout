import {
  DiagramCycleError,
  layoutDag,
  type DiagramEdge,
  type DiagramLayout,
  type DiagramLayoutOptions,
  type DiagramNode,
  type PositionedNode,
} from '@lp-labs/diagram-layout';

const nodes: DiagramNode[] = [{ id: 'a', width: 20, height: 10 }];
const edges: DiagramEdge[] = [];
const options: DiagramLayoutOptions = { nodeGap: 8, layerGap: 16 };
const layout: DiagramLayout = layoutDag(nodes, edges, options);
const positioned: PositionedNode = layout.nodes[0]!;
try {
  layoutDag(nodes, [{ from: 'a', to: 'a' }]);
} catch (error) {
  if (error instanceof DiagramCycleError) console.log(error.cycle);
}
console.log(positioned.x);
