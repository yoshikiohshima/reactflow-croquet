// @ts-nocheck
import React, { useCallback, useState, useEffect } from 'react';
import ReactFlow, {
    ReactFlowProvider,
    useReactFlow,
    useViewport,
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

import {CustomNode, TextNode} from './CustomNode';
import {CreateNodeButton, UndoButton, RedoButton} from './Buttons';

import 'reactflow/dist/style.css';
import './overview.css';

import {FlowModel} from "./model";

const minimapStyle = {
    height: 120,
};

const onInit = (reactFlowInstance) => console.log('flow loaded:', reactFlowInstance);

const ViewportDisplay = (props) => {
    const elem = document.getElementById("flow");
    const rect = elem ? elem.getBoundingClientRect() : {top: 0, left: 0};
    const {x, y, zoom} = useViewport();
    useEffect(() => {
        props.callback(x, y, zoom, rect.top, rect.left);
    }, [x, y, zoom]);
    
    return (
        <div style={{display: "none"}}></div>
    );
}

const Pointers = (props) => {
    const {viewport, model, viewId} = props;

    const divs = [...model.pointerMap].map(([v, p]) => {
        let x = p.x * viewport.zoom + viewport.x + viewport.left;
        let y = p.y * viewport.zoom + viewport.y + viewport.top;
        const transform = `translateX(${x - 5}px) translateY(${y - 5}px)`;
        const display = viewId === v ? "none" : "inherit";
        return (
            <div key={`pointer-${v}`} style={{pointerEvents: "none", display: display, position: "absolute", transform: transform, background: p.color, width: 10, height: 10}}></div>
        );
    });
        
    return (
        <div id="pointers" style={{pointerEvents: "none", position: "absolute", top: 0, left: 0, "zIndex": 100, background: "transparent", width: 100, height: 100}}>
            {divs}
        </div>
    );
}

const nodeTypes = {
    custom: CustomNode,
    text: TextNode
};

const FlowView = () => {
    const model:FlowModel = useModelRoot() as FlowModel;
    const viewId = useViewId();
    const [nodes, setNodes, onNodesChange] = useNodesState(model.nodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(model.edges);
    const [dragTime, setDragTime] = useState(0);
    const [viewport, setViewport] = useState({x: 0, y: 0, zoom: 1, top: 0, left: 0});
    const [pointers, setPointers] = useState(0);

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
    const publishPointerMove = usePublish((data) => [model.id, 'pointerMove', data]);
    const publishUndo = usePublish((data) => [model.id, 'undo', data]);
    const publishRedo = usePublish((data) => [model.id, 'redo', data]);

    useSubscribe(model.id, "nodeUpdated", (data) => {
        if (viewId === data.viewId) {return;}
        onNodesChange(data.actions);
    });

    useSubscribe(model.id, "textNodeUpdated", (data) => {
        // if (viewId === data.viewId) {return;}
        setNodes([...model.nodes]);
    });

    useSubscribe(model.id, "edgeAdded", (_data) => {
        // if (viewId === data.viewId) {return;}
        setEdges((_edges) => model.edges);
    });

    useSubscribe(model.id, "nodeAdded", (data) => {
        // if (viewId === data.viewId) {return;}
        setNodes([...model.nodes]);
    });

    useSubscribe(model.id, "pointerMoved", (data) => {
        setPointers(pointers + 1);
    });

    const myOnNodesChange = (actions) => {
        const nodeOwnerMap = model.nodeOwnerMap;
        const filtered = actions.filter((action) => !nodeOwnerMap.get(action.id) || nodeOwnerMap.get(action.id)?.viewId === viewId);
        const now = Date.now();
        if (now - dragTime < 20) {return;}
        setDragTime((_old) => now);
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
        let color = model.pointerMap.get(viewId)?.color;
        const node = {
                type: 'output',
                data: {
                    label: 'circle ' + `${Math.random()}`.slice(2, 5),
                },
                className: 'circle',
                style: {
                    background: color || '#2B6CB0',
                    color: 'white',
                },
                position: { x: 400 + (Math.random() * 100 - 50), y: 200 + (Math.random() + 100 - 50)},
                sourcePosition: Position.Right,
                targetPosition: Position.Left,
        };
        publishAddNode({node, viewId});
    }, [publishAddNode, viewId]);

    const undo = useCallback((_evt) => {
        publishUndo({viewId});
    }, [publishUndo, viewId]);

    const redo = useCallback((_evt) => {
        publishRedo({viewId});
    }, [publishRedo, viewId]);

    const viewportCallback = useCallback((x, y, zoom, top, left) => {
        // console.log(x, y, zoom, top, left);
        if (viewport.x === x && viewport.y === y && viewport.zoom === zoom &&
            viewport.top === top && viewport.left === left) {return;}
        setViewport({x, y, zoom, top, left});
    }, [viewport]);

    const pointerMove = (evt) => {
        let x = (evt.nativeEvent.clientX - viewport.left - viewport.x) / viewport.zoom;
        let y = (evt.nativeEvent.clientY - viewport.top - viewport.y) / viewport.zoom;
        publishPointerMove({x, y, viewId});
    }

    return (
        <ReactFlowProvider>
            <div id="all">
            <div id="sidebar">
                <CreateNodeButton id="createNode" onClick={create}/>
                <UndoButton id="undo" onClick={undo}/>
                <RedoButton id="redo" onClick={redo}/>
            </div>
            <ReactFlow
                id="flow"
                nodes={nodes}
                edges={edgesWithUpdatedTypes}
                onNodesChange={myOnNodesChange}
                onEdgesChange={myOnEdgesChange}
                onPointerMove={pointerMove}
                onConnect={myOnConnect}
                onInit={onInit}
                fitView
                attributionPosition="top-right"
                nodeTypes={nodeTypes}>
                <MiniMap style={minimapStyle} zoomable pannable />
                <Controls />
            
            <Background color="#aaa" gap={16}>
            </Background>
            </ReactFlow>
            </div>
            <ViewportDisplay callback={viewportCallback}/>
            <Pointers pointers={pointers} model={model} viewport={viewport} viewId={viewId}/>
        </ReactFlowProvider>
  );
};

export default FlowView;
