import { addEdge, Node, Edge} from 'reactflow';
import { Model } from "@croquet/react";

import {defaultValues} from "./defaultValues";

type Action = {actionId: number};

export class FlowModel extends Model {
    nodes: Array<Node>;
    edges: Array<Edge>;
    nodeOwnerMap: Map<string, {viewId:string, position:object, positionAbsolute:object}>;
    pointerMap: Map<string, {x: number, y: number, color: string}>;
    nextEdgeId: number;
    nextNodeId: number;
    nextActionId: number;
    snapshot: {edges: Array<Edge>, nodes: Array<Node>, actionId: number};
    undoStacks: Map<string, Array<Action>>;
    redoStacks: Map<string, Array<Action>>;
    eventBuffer: Array<{actionId:number}>;
    undoLimit: number;
    init(_options) {
        this.nodes = JSON.parse(JSON.stringify(defaultValues.nodes));
        this.edges = JSON.parse(JSON.stringify(defaultValues.edges));

        this.nodeOwnerMap = new Map();
        this.pointerMap = new Map(); // {viewId -> {x, y color}}

        this.nextEdgeId = 0;
        this.nextNodeId = 0;
        this.nextActionId = 0;
        this.undoLimit = 100;

        this.snapshot = JSON.parse(JSON.stringify({nodes: this.nodes, edges: this.edges, actionId: this.nextActionId}));

        this.undoStacks = new Map();
        this.redoStacks = new Map();
        this.eventBuffer = []; // [action|snapshot]; action = {actionId, viewId, event}, snapshot = {nodes, edges}
        
        this.subscribe(this.id, "updateNodes", this.updateNodes);
        this.subscribe(this.id, "addEdge", this.addEdge);
        this.subscribe(this.id, "addNode", this.addNode);
        this.subscribe(this.id, "updateText", this.updateText);
        // this.subscribe(this.id, "updateTextNode", this.updateTextNode);

        this.subscribe(this.id, "nodeDragStart", this.nodeDragStart);
        this.subscribe(this.id, "nodeDrag", this.nodeDrag);
        this.subscribe(this.id, "nodeDragStop", this.nodeDragStop);

        this.subscribe(this.id, "addTodo", this.addTodo);
        this.subscribe(this.id, "removeTodo", this.removeTodo);
        this.subscribe(this.id, "checkBoxChanged", this.checkBoxChanged);
        
        this.subscribe(this.id, "pointerMove", this.pointerMove);
        this.subscribe(this.sessionId, "view-exit", this.viewExit);

        this.subscribe(this.id, "undo", this.undo);
        this.subscribe(this.id, "redo", this.redo);
    }

    findNodeIndex(node) {
        return this.nodes.findIndex((n) => n.id === node.id);
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
                    if (this.nodeOwnerMap.get(action.id)?.viewId !== viewId) {
                        return;
                    }
                    this.nodes[index][action.type] = action[action.type];
                    this.nodes[index]["positionAbsolute"] = action["positionAbsolute"];
                }
            }
        });
        this.publish(this.id, "nodeUpdated", data);
    }

    nodeDragStart(data) {
        const {action, viewId} = data;
        const index = this.findNodeIndex(action);
        if (!this.nodeOwnerMap.get(action.id)) {
            // console.log("set owner", viewId);
            this.nodeOwnerMap.set(action.id, {
                viewId,
                position: this.nodes[index]["position"],
                positionAbsolute: this.nodes[index]["positionAbsolute"]});
        }
    }

    nodeDrag(_data) {
    }

    nodeDragStop(data) {
        const {id, viewId} = data;
        const index = this.findNodeIndex(data);

        if (this.nodeOwnerMap.get(id)?.viewId !== viewId) {return;}
        
        const actionId = this.nextActionId++;
        const {position, positionAbsolute} = this.nodeOwnerMap.get(id);
        const action = {actionId, viewId, command: "moveNode", action: {
            oldPosition: position,
            id,
            oldPositionAbsolute: positionAbsolute,
            position: this.nodes[index].position,
            positionAbsolute: this.nodes[index].positionAbsolute
        }};

        this.storeActionForUndo(viewId, action);
        this.nodeOwnerMap.delete(id);
    }

    updateText(data) {
        const {viewId} = data;

        const actionId = this.nextActionId++;
        const action = {actionId, viewId, command: "updateText", action: data};

        this.storeActionForUndo(viewId, action);
        this.processAction(action);

        this.publish(this.id, "textNodeUpdated", data);
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
        const actionId = this.nextActionId++;
        const action = {actionId, viewId, command: "addEdge", action: edgeAction};

        this.storeActionForUndo(viewId, action);
        this.processAction(action);
        this.publish(this.id, "edgeAdded", {action: action.action, viewId: action.viewId});
    }

    addNode(data) {
        const {node, viewId} = data;
        // console.log(data);
        if (node.id === undefined) {
            node.id = this.newNodeId();
        }
        const actionId = this.nextActionId++;
        const action = {actionId, viewId, command: "addNode", node};

        this.storeActionForUndo(viewId, action);
        this.processAction(action);
        this.publish(this.id, "nodeAdded", {node: action.node, viewId: action.viewId});
    }

    addTodo(data) {
        const viewId = data.viewId;
        const actionId = this.nextActionId++;
        const action = {actionId, viewId, command: "addTodo", action: data};

        this.storeActionForUndo(viewId, action);
        this.processAction(action);
        this.publish(this.id, "nodeAdded");
        // it may have to be different event but invokes the same logic on the view side for the moment.
    }

    removeTodo(data) {
        const viewId = data.viewId;
        const actionId = this.nextActionId++;
        const action = {actionId, viewId, command: "removeTodo", action: data};

        this.storeActionForUndo(viewId, action);
        this.processAction(action);
        this.publish(this.id, "nodeAdded");
        // like addTodo, the event name should be update nodes
    }

    checkBoxChanged(data) {
        const {viewId} = data;
        const actionId = this.nextActionId++;
        const action = {actionId, viewId, command: "todoCheckBox", action: data};
        this.storeActionForUndo(viewId, action);
        this.processAction(action);
        console.log("model", data);
        this.publish(this.id, "nodeAdded");
        // like addTodo, the event name should be update nodes
    }

    storeActionForUndo(viewId, action) {
        (window as unknown as {flowModel}).flowModel = this;
        let stack = this.undoStacks.get(viewId);
        if (!stack) {
            stack = [];
            this.undoStacks.set(viewId, stack);
        }
        stack.push(action);
        this.eventBuffer.push(action);

        this.maybeTakeUndoSnapshot();
    }

    processAction(action) {
        // this should only modify nodes and edges
        if (action.command === "addNode") {
            this.nodes = [...this.nodes, action.node];
        } else if (action.command === "addEdge") {
            // if source or dest node is gone, this I think fails silently
            this.edges = addEdge(action.action, this.edges);
        } else if (action.command === "moveNode") {
            const index = this.findNodeIndex(action.action);
            if (index < 0) {return;}
            this.nodes[index] = {...this.nodes[index],
                                 position: {...action.action.position},
                                 positionAbsolute: {...action.action.positionAbsolute}};
        } else if (action.command === "addTodo") {
            const index = this.findNodeIndex(action.action);
            if (index < 0) {return;}
            this.nodes = [...this.nodes];
            const node = this.nodes[index] as Node & {maxId: number};
            node.maxId++;
            node.data.todos = [...node.data.todos, {id: `t${node.maxId}`, title: "untitled", checked: false}];
        } else if (action.command === "removeTodo") {
            const index = this.findNodeIndex(action.action);
            if (index < 0) {return;}
            this.nodes = [...this.nodes];
            const node = this.nodes[index];
            node.data.todos = node.data.todos.filter((todo) => todo.id !== action.action.todoId);
        } else if (action.command === "todoCheckBox") {
            const index = this.findNodeIndex(action.action);
            if (index < 0) {return;}
            this.nodes = [...this.nodes];
            const node = this.nodes[index];
            const todoIndex = node.data.todos.findIndex((todo) => todo.id === action.action.todoId);
            const data = node.data.todos[todoIndex];
            data.checked = action.action.checked;
        } else if (action.command === "updateText") {
            const {path, text} = action.action;
            const pathArray = path.split(".");

            if (pathArray.length === 1) {
                // a vanilla text node
                const index = this.findNodeIndex({id: path});
                if (index >= 0) {
                    this.nodes = [...this.nodes];
                    this.nodes[index] = {...this.nodes[index], data: {text}};
                }
            } else if (pathArray[0] === "todos") {
                // todo list
                const index = this.findNodeIndex({id: pathArray[1]});
                if (index >= 0) {
                    this.nodes = [...this.nodes];
                    const node = this.nodes[index];
                    const todoIndex = node.data.todos.findIndex((todo) => todo.id === pathArray[2]);
                    node.data = {...node.data};
                    node.data.todos = [...node.data.todos];
                    const todo = {...node.data.todos[todoIndex]};
                    todo.title = text;
                    node.data.todos[todoIndex] = todo;
                }
            }
        }
    }

    maybeTakeUndoSnapshot() {
        // we take snapshot 50% more than the maximum undo buffer we say in the spec.
        // when 100 steps is required, we take snapshots every 50 steps.
        // the buffer's maximum length would be 150.
        // There would be exactly one snapshot.
        // eventBuffer would be truncated.
        // the undoStacks are also truncated.

        if (this.eventBuffer.length > this.undoLimit * 1.5) {
            const targetIndex = this.eventBuffer.length - this.undoLimit;
            this.edges = this.snapshot.edges;
            this.nodes = this.snapshot.nodes;

            for (let i = 0; i < targetIndex; i++) {
                this.processAction(this.eventBuffer[i]);
            }

            const targetActionId = this.eventBuffer[targetIndex].actionId;

            this.snapshot = JSON.parse(JSON.stringify({nodes: this.nodes, edges: this.edges, actionId: this.eventBuffer[targetIndex].actionId}));

            for (let i = targetIndex; i < this.eventBuffer.length; i++) {
                this.processAction(this.eventBuffer[i]);
            }

            const newEventBuffer = this.eventBuffer.slice(targetIndex);
            this.eventBuffer = newEventBuffer;

            const newUndoStacks = new Map();
            for (const [viewId, stack] of this.undoStacks) {
                if (stack) {
                    const newStack = stack.filter((event) => event.actionId > targetActionId);
                    newUndoStacks.set(viewId, newStack);
                }
            }
            this.undoStacks = newUndoStacks;

            const newRedoStacks = new Map();
            for (const [viewId, stack] of this.redoStacks) {
                if (stack) {
                    const newStack = stack.filter((event) => event.actionId > targetActionId);
                    newRedoStacks.set(viewId, newStack);
                }
            }
            this.redoStacks = newRedoStacks;
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
        const index = this.eventBuffer.findIndex((c) => {
            return (c as {actionId:number}).actionId === (lastCommand as {actionId:number}).actionId;
        });

        this.nodes = JSON.parse(JSON.stringify(defaultValues.nodes));
        this.edges = JSON.parse(JSON.stringify(defaultValues.edges));

        const newList = [];

        for (let i = 0; i < this.eventBuffer.length; i++) {
            if (i !== index) {
                this.processAction(this.eventBuffer[i]);
                newList.push(this.eventBuffer[i]);
            }
        }
        this.eventBuffer = newList;
        redoList.push(lastCommand);

        this.publish(this.id, "nodeAdded", {});
        this.publish(this.id, "edgeAdded", {});
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
        this.processAction(lastCommand);
        this.eventBuffer.push(lastCommand);
        undoList.push(lastCommand);
        this.publish(this.id, "nodeAdded", {});
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
            this.pointerMap.set(viewId, {color: this.randomColor(), x: 0, y: 0});
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
