import { addEdge } from 'reactflow';
import { Model } from "@croquet/react";

/*

Supporting Undo

delete

add

bulk add

property change for a node

all operations

undoStacks<Map<viewId, Array>>

undo -> find the last event of the user.

time -> serial number of actions

what does redo mean? -> add the action at the end of sequence

*/

import {defaultValues} from "./defaultValues";

export class FlowModel extends Model {
    nodes: Array<object>;
    edges: Array<object>;
    nodeOwnerMap: Map<string, {viewId:string, position:object, positionAbsolute:object}>;
    pointerMap: Map<string, object>;
    nextEdgeId: number;
    nextNodeId: number;
    nextCommandId: number;
    snapshotCounter: number;
    undoStacks: Map<string, Array<object>>;
    redoStacks: Map<string, Array<object>>;
    eventBuffer: Array<object>;
    init(_options) {
        this.nodes = JSON.parse(JSON.stringify(defaultValues.nodes));
        this.edges = JSON.parse(JSON.stringify(defaultValues.edges));

        this.nodeOwnerMap = new Map();
        this.pointerMap = new Map(); // {viewId -> {x, y color}}

        this.nextEdgeId = 0;
        this.nextNodeId = 0;
        this.nextCommandId = 0;
        this.snapshotCounter = 30;

        this.undoStacks = new Map();
        this.redoStacks = new Map();
        this.eventBuffer = []; // [action|snapshot]; action = {commandId, viewId, event}, snapshot = {nodes, edges}
        
        this.subscribe(this.id, "updateNodes", "updateNodes");
        this.subscribe(this.id, "addEdge", "addEdge");
        this.subscribe(this.id, "addNode", "addNode");
        this.subscribe(this.id, "updateTextNode", "updateTextNode");
        this.subscribe(this.id, "nodeDragStop", "nodeDragStop");

        this.subscribe(this.id, "addTodo", "addTodo");
        this.subscribe(this.id, "removeTodo", "removeTodo");

        
        this.subscribe(this.id, "pointerMove", "pointerMove");
        this.subscribe(this.sessionId, "view-exit", "viewExit");

        this.subscribe(this.id, "undo", "undo");
        this.subscribe(this.id, "redo", "redo");
        window.flowModel = this;
    }

    findNodeIndex(node) {
        for (let i = 0; i < this.nodes.length; i++) {
            if (this.nodes[i].id === node.id) {
                return i;
            }
        }
        return -1;
    }

    updateNodes(data) {
        const {actions, viewId} = data;
        actions.forEach((action) => {
            const index = this.findNodeIndex(action);
            if (index >= 0)  {
                if (action.type === "dimensions") {
                    this.nodes[index][action.type] = action[action.type];
                } else if (action.type === "select") {
                    // console.log("select", viewId);
                    
                } else if (action.type === "position" && action.dragging) {
                    // it probably should be moved to a handler fo nodeDragStart
                    // console.log("drag", this.nodeOwnerMap.get(action.id), viewId);
                    if (!this.nodeOwnerMap.get(action.id)) {
                        // console.log("set owner", viewId);
                        this.nodeOwnerMap.set(action.id, {
                            viewId,
                            position: this.nodes[index][action.type],
                            positionAbsolute: this.nodes[index]["positionAbsolute"]});
                        // might be a wrong place to stick this in.
                    } else if (this.nodeOwnerMap.get(action.id)?.viewId !== viewId) {
                        return;
                    }
                    this.nodes[index][action.type] = action[action.type];
                    this.nodes[index]["positionAbsolute"] = action["positionAbsolute"];
                }
            }
        });
        this.publish(this.id, "nodeUpdated", data);
    }

    nodeDragStop(data) {
        const {id, viewId} = data;
        const index = this.findNodeIndex(data);

        if (this.nodeOwnerMap.get(id)?.viewId !== viewId) {return;}
        
        const commandId = this.nextCommandId++;
        const {position, positionAbsolute} = this.nodeOwnerMap.get(id);
        const action = {commandId, viewId, command: "moveNode", action: {
            oldPosition: position,
            id,
            oldPositionAbsolute: positionAbsolute,
            position: this.nodes[index].position,
            positionAbsolute: this.nodes[index].positionAbsolute
        }};

        this.storeEventForUndo(viewId, action);
        this.nodeOwnerMap.delete(id);
    }

    updateTextNode(obj) {
        const index = this.findNodeIndex(obj);
        if (index >= 0) {
            this.nodes[index] = {...this.nodes[index], data: obj.data};
            this.publish(this.id, "textNodeUpdated", obj);
        }
    }

    newEdgeId() {
        return `e${this.nextEdgeId++}`;
    }

    newNodeId() {
        return `n${this.nextNodeId++}`;
    }

    addEdge(data) {
        // console.log(data);
        const viewId = data.viewId;
        const edgeAction = data.action;
        if (edgeAction.id === undefined) {
            edgeAction.id = this.newEdgeId();
        }
        const commandId = this.nextCommandId++;
        const action = {commandId, viewId, command: "addNode", action: edgeAction};

        this.storeEventForUndo(viewId, action);
        this.processEvent(action);
        this.publish(this.id, "edgeAdded", {action: action.action, viewId: action.viewId});
    }

    addNode(data) {
        const {node, viewId} = data;
        // console.log(data);
        if (node.id === undefined) {
            node.id = this.newNodeId();
        }
        const commandId = this.nextCommandId++;
        const action = {commandId, viewId, command: "addNode", node};

        this.storeEventForUndo(viewId, action);
        this.processEvent(action);
        this.publish(this.id, "nodeAdded", {node: action.node, viewId: action.viewId});
        // this.maybeTakeUndoSnapshot();
    }

    addTodo(data) {
        const viewId = data.viewId;
        const commandId = this.nextCommandId++;
        const action = {commandId, viewId, command: "addTodo", action: data};

        this.storeEventForUndo(viewId, action);
        this.processEvent(action);
        this.publish(this.id, "nodeAdded");
        // it may have to be different event but invokes the same logic on the view side for the moment.
    }

    removeTodo(data) {
        const viewId = data.viewId;
        const commandId = this.nextCommandId++;
        const action = {commandId, viewId, command: "removeTodo", action: data};

        this.storeEventForUndo(viewId, action);
        this.processEvent(action);
        this.publish(this.id, "nodeAdded");
        // like addTodo, the event name should b update nodes
    }

    storeEventForUndo(viewId, action) {
        let stack = this.undoStacks.get(viewId);
        if (!stack) {
            stack = [];
            this.undoStacks.set(viewId, stack);
        }
        stack.push(action);
        this.eventBuffer.push(action);
    }        

    processEvent(action) {
        // should only modify nodes and edges
        if (action.command === "addNode") {
            this.nodes = [...this.nodes, action.node];
        } else if (action.command === "addEdge") {
            this.edges = addEdge(action.action, this.edges);
        } else if (action.command === "moveNode") {
            const index = this.findNodeIndex(action.action);
            this.nodes[index] = {...this.nodes[index],
                                 position: {...action.action.position},
                                 positionAbsolute: {...action.action.positionAbsolute}};
        } else if (action.command === "addTodo") {
            this.nodes = [...this.nodes];
            const index = this.findNodeIndex(action.action);
            const node = this.nodes[index];
            node.maxId++;
            node.data.todos = [...node.data.todos, {id: `t${node.maxId}`, title: "untitled", checked: false}];
        } else if (action.command === "removeTodo") {
            this.nodes = [...this.nodes];
            const index = this.findNodeIndex(action.action);
            const node = this.nodes[index];
            node.data.todos = node.data.todos.filter((todo) => todo.id !== action.action.todoId);
        }
    }

    maybeTakeUndoSnapshot() {
        this.snapshotCounter--;
        if (this.snapshotCounter === 0) {
            this.snapshotCounter = 10;
            const commandId = this.nextCommandId;
            const snapshot = JSON.parse(JSON.stringify({nodes: this.nodes, edges: this.edges}));
            this.eventBuffer.push({commandId, snapshot});
            if (this.snapshots.length > 20) {
                this.snapshots = this.snapshots.slice(0, -20);
            }
        }
    }

    undo(data) {
        const {viewId} = data;
        const undoList = this.undoStacks.get(viewId);
        if (!undoList) {return;}

        let redoList = this.redoStacks.get(viewId);

        if (undoList.length === 0) {return;}

        if (!redoList) {
            redoList = [];
            this.redoStacks.set(viewId, redoList);
        }

        const lastCommand = undoList.pop();
        const index = this.eventBuffer.findIndex((c) => c.commandId === lastCommand.commandId);

        this.nodes = JSON.parse(JSON.stringify(defaultValues.nodes));
        this.edges = JSON.parse(JSON.stringify(defaultValues.edges));

        const newList = [];

        for (let i = 0; i < this.eventBuffer.length; i++) {
            if (i !== index) {
                this.processEvent(this.eventBuffer[i]);
                newList.push(this.eventBuffer[i]);
            }
        }
        this.eventBuffer = newList;
        redoList.push(lastCommand);

        this.publish(this.id, "nodeAdded", {});
        this.publish(this.id, "edgeAdded", {});
        window.flowModel = this;
    }

    redo(data) {
        const {viewId} = data;
        const redoList = this.redoStacks.get(viewId);
        if (!redoList) {return;}

        let undoList = this.undoStacks.get(viewId);

        if (redoList.length === 0) {return;}

        if (!undoList) {
            undoList = [];
            this.undoStacks.set(viewId, undoList);
        }

        const lastCommand = redoList.pop();
        this.processEvent(lastCommand);
        this.eventBuffer.push(lastCommand);
        undoList.push(lastCommand);
        this.publish(this.id, "nodeAdded", {foo:true});
        this.publish(this.id, "edgeAdded", {});
    }

    viewExit(viewId) {
        console.log("view-exit", viewId);
        this.nodeOwnerMap.delete(viewId);

        if (this.pointerMap.get(viewId)) {
            this.pointerMap.delete(viewId);
            this.publish(this.id, "pointerMoved", viewId);
        }

        this.undoStacks.delete(viewId);
        this.redoStacks.delete(viewId);
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
        const h = Math.random();
        const s = 0.8;
        const v = 0.8;
        let r, g, b;
        const i = Math.floor(h * 6);
        const f = h * 6 - i;
        const p = v * (1 - s);
        const q = v * (1 - f * s);
        const t = v * (1 - (1 - f) * s);
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
}

FlowModel.register("FlowModel");
