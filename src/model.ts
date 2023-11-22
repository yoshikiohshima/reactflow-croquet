// @ts-nocheck
import { MarkerType, Position, addEdge } from 'reactflow';
import { Model } from "@croquet/react";

export class FlowModel extends Model {
    nodes: Array<object>;
    edges: Array<object>;
    nodeOwnerMap: Map<string, string>;
    init(_options) {
        this.nodes = [
            {
                id: '1',
                type: 'input',
                data: {
                    label: 'Input Node',
                },
                position: { x: 250, y: 0 },
            },
            {
                id: '2',
                data: {
                    label: 'Default Node',
                },
                position: { x: 100, y: 100 },
            },
            {
                id: '3',
                type: 'output',
                data: {
                    label: 'Output Node',
                },
                position: { x: 400, y: 100 },
            },
            {
                id: '4',
                type: 'custom',
                position: { x: 100, y: 200 },
                data: {
                    selects: {
                        'handle-0': 'smoothstep',
                        'handle-1': 'smoothstep',
                    },
                },
            },
            {
                id: '5',
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
            },
            {
                id: '6',
                type: 'output',
                style: {
                    background: '#63B3ED',
                    color: 'white',
                    width: 100,
                },
                data: {
                    label: 'Node',
                },
                position: { x: 400, y: 325 },
                sourcePosition: Position.Right,
                targetPosition: Position.Left,
            },
            {
                id: '7',
                type: 'default',
                className: 'annotation',
                /*
                data: {
                    label: (
                            <>
                            On the bottom left you see the <strong>Controls</strong> and the bottom right the{' '}
                            <strong>MiniMap</strong>. This is also just a node 🥳
                        </>
                    ),
                },
                */
                draggable: false,
                selectable: false,
                position: { x: 150, y: 400 },
            },
        ];

        this.edges = [
            { id: 'e1-2', source: '1', target: '2', label: 'this is an edge label' },
            { id: 'e1-3', source: '1', target: '3', animated: true },
            {
                id: 'e4-5',
                source: '4',
                target: '5',
                type: 'smoothstep',
                sourceHandle: 'handle-0',
                data: {
                    selectIndex: 0,
                },
                markerEnd: {
                    type: MarkerType.ArrowClosed,
                },
            },
            {
                id: 'e4-6',
                source: '4',
                target: '6',
                type: 'smoothstep',
                sourceHandle: 'handle-1',
                data: {
                    selectIndex: 1,
                },
                markerEnd: {
                    type: MarkerType.ArrowClosed,
                },
            },
        ];

        this.nodeOwnerMap = new Map();
        this.pointerMap = new Map(); // {viewId -> {x, y color}}

        this.nextEdgeId = 0;
        this.nextNodeId = 0;

        this.subscribe(this.id, "updateNodes", "updateNodes");
        this.subscribe(this.id, "addEdge", "addEdge");
        this.subscribe(this.id, "addNode", "addNode");
        this.subscribe(this.id, "pointerMove", "pointerMove");
        this.subscribe(this.sessionId, "view-exit", "viewExit");
    }

    updateNodes(data) {
        const {actions, viewId} = data;
        const findNodeIndex = (node) => {
            for (let i = 0; i < this.nodes.length; i++) {
                if (this.nodes[i].id === node.id) {
                    return i;
                }
            }
            return -1;
        }
       
        actions.forEach((action) => {
            const index = findNodeIndex(action);
            if (index >= 0)  {
                // https://reactflow.dev/api-reference/types/node-change
                // export type NodeChange =
                // | NodeDimensionChange
                // | NodePositionChange
                // | NodeSelectionChange
                // | NodeRemoveChange
                // | NodeAddChange
                // | NodeResetChange;
                // console.log(action);
                if (action.type === "dimensions") {
                    this.nodes[index][action.type] = action[action.type];
                } else if (action.type === "select") {
                    // console.log("select", viewId);
                    
                } else if (action.type === "position" && action.dragging) {
                    // console.log("drag", this.nodeOwnerMap.get(action.id), viewId);
                    if (!this.nodeOwnerMap.get(action.id)) {
                        // console.log("set owner", viewId);
                        this.nodeOwnerMap.set(action.id, viewId);
                    } else if (this.nodeOwnerMap.get(action.id) !== viewId) {
                        // console.log("returning", this.nodeOwnerMap.get(action.id), viewId);
                        return;
                    }
                    this.nodes[index][action.type] = action[action.type];
                    this.nodes[index]["positionAbsolute"] = action["positionAbsolute"];
                } else if (action.type === "position" && !action.dragging) {
                    // console.log("pointerUp", viewId)
                    if (this.nodeOwnerMap.get(action.id) === viewId) {
                        this.nodeOwnerMap.delete(action.id);
                    }
                }
            }
        });
        this.publish(this.id, "nodeUpdated", data);
    }

    newEdgeId() {
        return `e${this.nextEdgeId++}`;
    }

    newNodeId() {
        return `n${this.nextNodeId++}`;
    }

    addEdge(data) {
        // console.log(data);
        const action = data.action;
        if (action.id === undefined) {
            action.id = this.newEdgeId();
        }
        const newEdges = addEdge(data.action, this.edges);
        this.edges = newEdges;
        this.publish(this.id, "edgeAdded", {action, viewId: data.viewId});
    }

    addNode(data) {
        const {node, viewId} = data;
        // console.log(data);
        if (node.id === undefined) {
            node.id = this.newNodeId();
        }
        const newNodes = [...this.nodes, node];
        this.nodes = newNodes;
        this.publish(this.id, "nodeAdded", {node, viewId});
    }

    pointerMove(data) {
        const {x, y, viewId} = data;
        if (!this.pointerMap.get(viewId)) {
            this.pointerMap.set(viewId, {color: this.randomColor()});
        }
        this.pointerMap.get(viewId).x = x;
        this.pointerMap.get(viewId).y = y;
        this.publish(this.id, "pointerMoved", viewId);
    }

    randomColor() {
        let h = Math.random();
        let s = 0.8;
        let v = 0.8;
        let r, g, b, i, f, p, q, t;
        i = Math.floor(h * 6);
        f = h * 6 - i;
        p = v * (1 - s);
        q = v * (1 - f * s);
        t = v * (1 - (1 - f) * s);
        switch (i % 6) {
            case 0: r = v, g = t, b = p; break;
            case 1: r = q, g = v, b = p; break;
            case 2: r = p, g = v, b = t; break;
            case 3: r = p, g = q, b = v; break;
            case 4: r = t, g = p, b = v; break;
            case 5: r = v, g = p, b = q; break;
        }
        return `#${Math.round(r * 255).toString(16).padStart(2, "0")}${Math.round(g * 255).toString(16).padStart(2, "0")}${Math.round(b * 255).toString(16).padStart(2, "0")}`;
    }

    viewExit(viewId) {
        console.log("view-exit", viewId);
        this.nodeOwnerMap.delete(viewId);

        if (this.pointerMap.get(viewId)) {
            this.pointerMap.delete(viewId);
            this.publish(this.id, "pointerMoved", viewId);
        }
    }
}

FlowModel.register("FlowModel");
