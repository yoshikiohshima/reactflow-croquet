import React, { useCallback } from 'react';
import ReactFlow, {
  addEdge,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
} from 'reactflow';

import {
  usePublish,
  useViewId,
  useModelRoot,
  useSubscribe,
  useUpdateCallback,
  useSyncedCallback,
} from "@croquet/react";

import CustomNode from './CustomNode';

import 'reactflow/dist/style.css';
import './overview.css';

const nodeTypes = {
  custom: CustomNode,
};

const minimapStyle = {
  height: 120,
};

const onInit = (reactFlowInstance) => console.log('flow loaded:', reactFlowInstance);

const FlowView = () => {
  const model = useModelRoot();
  const viewId = useViewId();
  const [nodes, setNodes, onNodesChange] = useNodesState(model.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(model.edges);
  const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), []);

  // we are using a bit of a shortcut here to adjust the edge type
  // this could also be done with a custom edge for example
  const edgesWithUpdatedTypes = edges.map((edge) => {
    if (edge.sourceHandle) {
    const edgeType = "";
   edge.type = edgeType;
    }

    return edge;
  });


    const publishNodesChange = usePublish((data) => [model.id, 'updateNodes', data]);

    useSubscribe(model.id, "nodeUpdated", (data) => {
      if (viewId === data.viewId) {return;}
      // console.log("view", model.nodes);
      onNodesChange(data.actions);
    });

    const myOnNodesChange = (actions) => {
      const nodeOwnerMap = model.nodeOwnerMap;
      const filtered = actions.filter((action) => !nodeOwnerMap.get(action.id) || nodeOwnerMap.get(action.id) === viewId);
        publishNodesChange({actions: filtered, viewId});
        onNodesChange(filtered);
    };

    const myOnEdgesChange = (actions) => {
        console.log(actions);
        onEdgesChange(actions);
    };

  return (
    <ReactFlow
      nodes={nodes}
      edges={edgesWithUpdatedTypes}
      onNodesChange={myOnNodesChange}
      onEdgesChange={myOnEdgesChange}
      onConnect={onConnect}
      onInit={onInit}
      fitView
      attributionPosition="top-right"
      nodeTypes={nodeTypes}
    >
      <MiniMap style={minimapStyle} zoomable pannable />
      <Controls />
      <Background color="#aaa" gap={16} />
    </ReactFlow>
  );
};

export default FlowView;

