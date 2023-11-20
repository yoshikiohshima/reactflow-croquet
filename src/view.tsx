// @ts-nocheck
import React, { useCallback } from 'react';
import ReactFlow, {
    addEdge,
    MiniMap,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    Position,
} from 'reactflow';

import {
    usePublish,
    useViewId,
    useModelRoot,
    useSubscribe,
} from "@croquet/react";

import CustomNode from './CustomNode';
import {CreateNodeButton} from './CreateButton';

import 'reactflow/dist/style.css';
import './overview.css';

import {FlowModel} from "./model";

const nodeTypes = {
    custom: CustomNode,
};

const minimapStyle = {
    height: 120,
};

const onInit = (reactFlowInstance) => console.log('flow loaded:', reactFlowInstance);

const FlowView = () => {
    const model:FlowModel = useModelRoot() as FlowModel;
    const viewId = useViewId();
    const [nodes, setNodes, onNodesChange] = useNodesState(model.nodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(model.edges);

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
    const publishAddEdge = usePublish((data) => [model.id, 'addEdge', data]);
    const publishAddNode = usePublish((data) => [model.id, 'addNode', data]);

    useSubscribe(model.id, "nodeUpdated", (data) => {
        if (viewId === data.viewId) {return;}
        // console.log("view", model.nodes);
        onNodesChange(data.actions);
    });

    useSubscribe(model.id, "edgeAdded", (_data) => {
        // if (viewId === data.viewId) {return;}
        setEdges((_edges) => model.edges);
    });

    useSubscribe(model.id, "nodeAdded", (_data) => {
        // if (viewId === data.viewId) {return;}
        setNodes(model.nodes);
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

    const myOnConnect = useCallback((params) => {
        // presumably this is a new connection, so no need to check if somebody else has grabbed it.
        console.log("connect", params);
        publishAddEdge({action: params, viewId});
        setEdges((eds) => addEdge(params, eds));
    }, [publishAddEdge, setEdges, viewId]);

    const create = useCallback((_evt) => {
        const node = {
                type: 'output',
                data: {
                    label: 'custom style',
                },
                className: 'circle',
                style: {
                    background: '#2B6CB0',
                    color: 'white',
                },
                position: { x: 400, y: 200 },
                sourcePosition: Position.Right,
                targetPosition: Position.Left,
        };
        publishAddNode({node, viewId});
    }, [publishAddNode, viewId]);

    return (
        <div id="all">
            <div id="sidebar">
            <CreateNodeButton id="createNode" onClick={create}/>
            </div>
            <ReactFlow
                id="flow"
                nodes={nodes}
                edges={edgesWithUpdatedTypes}
                onNodesChange={myOnNodesChange}
                onEdgesChange={myOnEdgesChange}
                onConnect={myOnConnect}
                onInit={onInit}
                fitView
                attributionPosition="top-right"
                nodeTypes={nodeTypes}
            >
            <MiniMap style={minimapStyle} zoomable pannable />
            <Controls />
            <Background color="#aaa" gap={16} />
            </ReactFlow>
        </div>
  );
};

export default FlowView;
