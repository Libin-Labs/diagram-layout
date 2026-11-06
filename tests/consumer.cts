import layout = require('@lp-labs/diagram-layout');

const nodes: layout.DiagramNode[] = [{ id: 'source', width: 20, height: 10 }];
const result: layout.DiagramLayout = layout.layoutDag(nodes, []);
console.log(result.order);
