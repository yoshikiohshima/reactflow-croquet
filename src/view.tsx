import React, { useCallback, useState, useEffect } from 'react';
import ReactFlow, {
    ReactFlowProvider,
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

import {CustomNode, TextNode, ToDoListNode, MonacoEditorNode} from './CustomNode';
import {CreateNodeButton, DeleteObjectsButton, UndoButton, RedoButton} from './Buttons';

import 'reactflow/dist/style.css';
import './overview.css';

import {FlowModel} from "./model";

const minimapStyle = {
    height: 120,
};

const onInit = (reactFlowInstance) => console.log('flow loaded:', reactFlowInstance);

const Pointers = (props) => {
    const {viewport, model, viewId, callback} = props;
    const elem = document.getElementById("flow");
    const {top, left} = elem ? elem.getBoundingClientRect() : {top: 0, left: 0};
    const {x, y, zoom} = useViewport();

    useEffect(() => {
        callback(x, y, zoom, top, left);
    }, [x, y, zoom, top, left, callback]);

    const divs = [...model.pointerMap].map(([v, p]) => {
        const x = p.x * viewport.zoom + viewport.x + viewport.left;
        const y = p.y * viewport.zoom + viewport.y + viewport.top;
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
    text: TextNode,
    todo: ToDoListNode,
    monaco: MonacoEditorNode,
};

const FlowView = () => {
    const model:FlowModel = useModelRoot() as FlowModel;
    const viewId = useViewId();
    const [nodes, setNodes, onNodesChange] = useNodesState(model.nodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(model.edges);

    const [selectedNodes, setSelectedNodes] = useState([]);
    const [selectedEdges, setSelectedEdges] = useState([]);

    const [dragInfo, setDragInfo] = useState({now: 0, viewId: undefined, node: null});
    const [viewport, setViewport] = useState({x: 0, y: 0, zoom: 1, top: 0, left: 0});
    const [pointers, setPointers] = useState(0);

    const nodeOwnerMap = model.nodeOwnerMap;

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
    const publishDeleteObjects = usePublish((data) => [model.id, 'deleteObjects', data]);
    const publishPointerMove = usePublish((data) => [model.id, 'pointerMove', data]);
    const publishUndo = usePublish((data) => [model.id, 'undo', data]);
    const publishRedo = usePublish((data) => [model.id, 'redo', data]);

    const publishNodeDragStart = usePublish((data) => [model.id, "nodeDragStart", data]);
    // const publishNodeDrag = usePublish((data) => [model.id, "nodeDrag", data]);
    const publishNodeDragStop = usePublish((data) => [model.id, 'nodeDragStop', data]);

    useSubscribe(model.id, "nodeUpdated", (data:any) => {
        if (viewId === data.viewId) {return;}
        onNodesChange(data.actions);
    });

    useSubscribe(model.id, "textNodeUpdated", (data:any) => {
        if (viewId === data.viewId) {
            return;
        }
        setNodes([...model.nodes]);
    });

    useSubscribe(model.id, "updateText", (data:any) => {
        const {path, viewId, text} = data;

        if (viewId !== data.viewId) {return;}

        const pathArray = path.split(".");
        setNodes((nodes) => {
            if (pathArray.length === 1) {
                // a vanilla text node
                const index = nodes.findIndex((node) => node.id === path);
                if (index >= 0) {
                    const newNodes = [...nodes];
                    newNodes[index] = {...nodes[index], data: {text}};
                    return newNodes;
                }
            } else if (pathArray[0] === "todos") {
                // a todo list
                const index = nodes.findIndex((node) => node.id === pathArray[1]);
                if (index >= 0) {
                    const newNodes = [...nodes];
                    const node = newNodes[index];
                    const todoIndex = node.data.todos.findIndex((todo) => todo.id === pathArray[2]);
                    node.data = {...node.data}
                    node.data.todos = [...node.data.todos];
                    const todo = node.data.todos[todoIndex];

                    todo.title = text;
                    node.data.todos[todoIndex] = todo;
                    return newNodes;
                }
            }
            return nodes;
        });
    });

    useSubscribe(model.id, "nodeDragged", (data) => {
        console.log(data);
    })

    useSubscribe(model.id, "edgeAdded", (_data) => {
        // if (viewId === data.viewId) {return;}
        setEdges((_edges) => model.edges);
    });

    useSubscribe(model.id, "nodeAdded", (_data) => {
        // if (viewId === data.viewId) {return;}
        setNodes([...model.nodes]);
    });

    useSubscribe(model.id, "pointerMoved", (_data) => {
        setPointers(pointers + 1);
    });

    const myOnNodesChange = (actions) => {
        const filtered = actions.filter((action) => !nodeOwnerMap.get(action.id) || nodeOwnerMap.get(action.id)?.viewId === viewId);
        const now = Date.now();
        if (now - dragInfo.now < 20) {return;}
        setDragInfo((old) => ({...old, now}));
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

    const createNode = useCallback((_evt) => {
        const color = model.pointerMap.get(viewId)?.color;
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
    }, [publishAddNode, viewId, model.pointerMap]);

    const deleteObjects = useCallback((_evt) => {
        publishDeleteObjects({nodes: selectedNodes, edges: selectedEdges, viewId});
    }, [publishDeleteObjects, viewId, selectedNodes, selectedEdges]);

    const onNodeDragStart = useCallback((evt, node) => {
    console.log("dragStart");
        if (nodeOwnerMap.get(node.id) && nodeOwnerMap.get(node.id).viewId !== viewId) {return;}
        const now = Date.now();
        setDragInfo({viewId, node, now});
        publishNodeDragStart({action: {id: node.id}, viewId});
    }, [setDragInfo, viewId, nodeOwnerMap, publishNodeDragStart]);

    const onNodeDrag = () => {};

    const onNodeDragStop = useCallback((evt, node) => {
        console.log("dragStop");
        publishNodeDragStop({id: node.id, viewId});
    }, [publishNodeDragStop, viewId]);
 
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
        const x = (evt.nativeEvent.clientX - viewport.left - viewport.x) / viewport.zoom;
        const y = (evt.nativeEvent.clientY - viewport.top - viewport.y) / viewport.zoom;
        publishPointerMove({x, y, viewId});
    }

    const onSelectionChange = useCallback((params) => {
        const {nodes, edges} = params;
        setSelectedNodes(nodes.map((node) => node.id));
        setSelectedEdges(edges.map((edge) => edge.id));
    }, []);

    return (
        <ReactFlowProvider>
            <div id="all">
            <div id="sidebar">
                <CreateNodeButton id="createNode" onClick={createNode}/>
                <DeleteObjectsButton id="deleteObjects" onClick={deleteObjects}/>
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

                onNodeDragStart={onNodeDragStart}
                onNodeDrag={onNodeDrag}
                onNodeDragStop={onNodeDragStop}

                onSelectionChange={onSelectionChange}

                onConnect={myOnConnect}
                onInit={onInit}
                fitView
                attributionPosition="top-right"
                nodeTypes={nodeTypes}>
                <MiniMap style={minimapStyle} zoomable pannable />
                <Controls />
            
            <Background color="#aaa" gap={16}/>
            </ReactFlow>
            </div>
            <Pointers pointers={pointers} model={model} viewport={viewport} viewId={viewId} callback={viewportCallback}/>
        </ReactFlowProvider>
  );
};

export default FlowView;
