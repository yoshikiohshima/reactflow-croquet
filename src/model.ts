import { addEdge, Node, Edge} from 'reactflow';
import { Model } from "@croquet/react";

import {defaultValues} from "./defaultValues";

type Action = {actionId: number};

export class FlowModel extends Model {
    nodes: Map<string, Node>;
    edges: Map<string, Edge>;
    nodeOwnerMap: Map<string, {viewId:string, position:object, positionAbsolute:object}>;
    pointerMap: Map<string, {x: number, y: number, color: string}>;
    nextEdgeId: number;
    nextNodeId: number;
    nextActionId: number;
    snapshot: {
        nodes: Array<[string, Node]>;
        edges: Array<[string, Edge]>;
        nextActionId: number,
        nextNodeId: number,
        nextEdgeId: number,
    };
    undoStacks: Map<string, Array<Action>>;
    redoStacks: Map<string, Array<Action>>;
    eventBuffer: Array<{actionId:number}>;
    undoLimit: number;

    connections: Map<string, Array<Action>>;

    interactionTimeStamps: Map<string, number>;
    clearInterval: number;

    loadingPersistentData: boolean;
    loadingPersistentDataErrored: boolean;
    lastPersistTime: number;
    persistPeriod: number;
    persistRequested: boolean;

    init(options, persistentData?) {
        let persistentDataLoaded = false;
        if (persistentData) {
            persistentDataLoaded = this.loadPersistentData(persistentData);
        }
        if (!persistentDataLoaded) {
            this.nodes = new Map(JSON.parse(JSON.stringify(defaultValues.nodes)).map((node) => [node.id, node]))
            this.edges = new Map(JSON.parse(JSON.stringify(defaultValues.edges)).map((edge) => [edge.id, edge]));
            this.nextEdgeId = 0;
            this.nextNodeId = 0;
            this.nextActionId = 0;
        }

        this.nodeOwnerMap = new Map();
        this.pointerMap = new Map(); // {viewId -> {x, y color}}
        this.connections = new Map(); // {viewId -> {}}

        this.undoLimit = 20;
        this.persistPeriod = 30 * 1000;

        this.snapshot = this.makeSnapshot({
            nodes: this.nodes,
            edges: this.edges,
            nextActionId: this.nextActionId,
            nextNodeId: this.nextNodeId,
            nextEdgeId: this.nextEdgeId,
        });

        this.undoStacks = new Map();
        this.redoStacks = new Map();
        this.eventBuffer = []; // [action|snapshot]; action = {actionId, viewId, event}, snapshot = {nodes, edges}

        this.ensurePersistenceProps();
        
        this.subscribe(this.id, "updateNodes", this.updateNodes);
        this.subscribe(this.id, "addEdge", this.addEdge);
        this.subscribe(this.id, "addNode", this.addNode);
        this.subscribe(this.id, "deleteObjects", this.deleteObjects);
        this.subscribe(this.id, `updateData`, this.updateData);

        this.subscribe(this.id, "nodeDragStart", this.nodeDragStart);
        this.subscribe(this.id, "nodeDrag", this.nodeDrag);
        this.subscribe(this.id, "nodeDragStop", this.nodeDragStop);
        
        this.subscribe(this.id, "pointerMove", this.pointerMove);
        this.subscribe(this.sessionId, "view-exit", this.viewExit);

        this.subscribe(this.id, "undo", this.undo);
        this.subscribe(this.id, "redo", this.redo);

        this.subscribe(this.id, "updateConnection", this.updateConnection);

        this.clearInterval = 10 * 1000;
        this.interactionTimeStamps = new Map();
        this.cancelFuture(`maybeClearInteraction`);
        this.maybeClearInteraction();
        
        // this.subscribe(this.sessionId, "triggerPersist", "triggerPersist");
    }

    updateNodes(data) {
        const {actions, viewId} = data;
        actions.forEach((action) => {
            const node = this.nodes.get(action.id);
            if (node) {
                if (action.type === "dimensions") {
                    if (node.data.resizable) {
                        if (!node.style) {
                            node.style = {};
                        }
                        if (action.resizing) {
                            node.style.width = action.dimensions?.width;
                            node.style.height = action.dimensions?.height;
                        }
                    }
                    // this has to be customized for different nodes,
                    // based on whether the custom node allows the user to resize or not.
                    // this.nodes[index][action.type] = action[action.type];
                } else if (action.type === "select") {
                    // console.log("select", viewId);
                } else if (action.type === "position" && action.dragging) {
                    if (this.nodeOwnerMap.get(action.id)?.viewId !== viewId) {
                        return;
                    }
                    node.position = action[action.type];
                    node.positionAbsolute = action. positionAbsolute;
                }
            }
        });
        this.publish(this.id, "nodeUpdated", data);
    }

    nodeDragStart(data) {
        const {action, viewId} = data;
        const node = this.nodes.get(action.id);
        if (!node) {return;}
        if (!this.nodeOwnerMap.get(action.id)) {
            // console.log("set owner", viewId);
            this.nodeOwnerMap.set(action.id, {
                viewId,
                position: node.position,
                positionAbsolute: node.positionAbsolute,
            });
        }
    }

    nodeDrag(_data) {
    }

    nodeDragStop(data) {
        const {id, viewId} = data;
        const node = this.nodes.get(id);
        if (!node) {
            this.nodeOwnerMap.delete(id);
            return;
        }

        if (this.nodeOwnerMap.get(id)?.viewId !== viewId) {return;}
        
        const actionId = this.nextActionId++;
        const {position, positionAbsolute} = this.nodeOwnerMap.get(id);
        const action = {
            actionId,
            viewId,
            command: "moveNode",
            action: {
                oldPosition: position,
                id,
                oldPositionAbsolute: positionAbsolute,
                position: node.position,
                positionAbsolute: node.positionAbsolute
        }};

        this.nodeOwnerMap.delete(id);
        this.storeActionForUndo(viewId, action);
        this.processAction(action);
        this.triggerPersist();
    }

    updateText(data) {
        const {viewId} = data;

        const actionId = this.nextActionId++;
        const action = {actionId, viewId, command: "updateText", action: data};

        this.storeActionForUndo(viewId, action);
        this.processAction(action);

        this.publish(this.id, "textNodeUpdated", data);
    }

    updateData(data: any) {
        const { viewId } = data;
        console.log(`updateData`);

        const actionId = this.nextActionId++;
        const action = { actionId, viewId, command: `updateData`, action: data };

        this.storeActionForUndo(viewId, action);
        this.processAction(action);

        this.publish(this.id, `nodeAdded`);
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

    deleteObjects(data) {
        const {viewId} = data;
        const actionId = this.nextActionId++;

        const action = {actionId, viewId, command: "deleteObjects", action: data};
    
        this.storeActionForUndo(viewId, action);
        this.processAction(action);
        this.publish(this.id, "nodeAdded");
        this.publish(this.id, "edgeAdded");
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
        const viewId = action.viewId;
        this.setInteractionTimeStamp(viewId);
        if (action.command === "addNode") {
            this.nodes.set(action.node.id, action.node);
        } else if (action.command === "addEdge") {
            // if source or dest node is gone, this I think fails silently
            const currentEdges = [...this.edges].map((pair) => pair[1]);
            const newEdges = addEdge(action.action as unknown as Edge, currentEdges);
            this.edges = new Map(newEdges.map((edge) => [edge.id, edge]));
        } else if (action.command === "moveNode") {
            const node = this.nodes.get(action.action.id);
            if (!node) {return;}
            this.nodes.set(node.id, {
                ...node,
                position: { ...action.action.position },
                positionAbsolute: { ...action.action.positionAbsolute },
            });
        } else if (action.command === "deleteObjects") {
            action.action.nodes.forEach((deleteId: string) => {
                this.nodes.delete(deleteId);
            });

            const newEdges = [...this.edges].filter(([_id, edge]) => {
                return (
                    !action.action.edges.includes(edge.id) &&
                        !action.action.nodes.includes(edge.source) &&
                        !action.action.nodes.includes(edge.target)
                );
            });
            this.edges = new Map(newEdges);
        } else if (action.command === `updateData`) {
            const node = this.nodes.get(action.action.id);
            if (!node) {
                return;
            }
            const newNode = {
                ...node,
                data: { ...node.data },
            };
            newNode.data[action.action.property] = action.action.value;
            this.nodes.set(node.id, newNode);
        }
    }

    makeSnapshot(data) {
        const {nodes, edges, nextActionId, nextNodeId, nextEdgeId} = data;
        const snapshot = JSON.parse(
            JSON.stringify(
                {nodes: [...nodes], edges: [...edges], nextActionId, nextNodeId, nextEdgeId}));
        return snapshot;
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
            this.edges = new Map(this.snapshot.edges);
            this.nodes = new Map(this.snapshot.nodes);

            for (let i = 0; i < targetIndex; i++) {
                this.processAction(this.eventBuffer[i]);
            }

            const targetActionId = this.eventBuffer[targetIndex].actionId;

            this.snapshot = this.makeSnapshot({
                nodes: this.nodes,
                edges: this.edges,
                nextActionId: this.nextActionId,
                nextNodeId: this.nextNodeId,
                nextEdgeId: this.nextEdgeId,
            });

            for (let i = targetIndex; i < this.eventBuffer.length - 1; i++) {
                // -1 above, because storeActionForUndo is always followed by processAction call
                this.processAction(this.eventBuffer[i]);
            }

            const newEventBuffer = this.eventBuffer.slice(targetIndex);
            this.eventBuffer = newEventBuffer;

            const newUndoStacks = new Map();
            for (const [viewId, stack] of this.undoStacks) {
                if (stack) {
                    const newStack = stack.filter((event) => event.actionId >= targetActionId);
                    newUndoStacks.set(viewId, newStack);
                }
            }
            this.undoStacks = newUndoStacks;

            const newRedoStacks = new Map();
            for (const [viewId, stack] of this.redoStacks) {
                if (stack) {
                    newRedoStacks.set(viewId, stack);
                }
            }
            this.redoStacks = newRedoStacks;
            console.log("snapshot taken)")
        }
    }

    undo(data) {
        console.log("undo", data);
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
        console.log("undo action", lastCommand);
        
        const index = this.eventBuffer.findIndex((c) => {
            return (c as {actionId:number}).actionId === (lastCommand as {actionId:number}).actionId;
        });

        if (index < 0) {return}

        this.nodes = new Map(JSON.parse(JSON.stringify(this.snapshot.nodes)));
        this.edges = new Map(JSON.parse(JSON.stringify(this.snapshot.edges)));

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
        console.log("redo");
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

        console.log("redo action", lastCommand);
        
        this.processAction(lastCommand);
        this.eventBuffer.push(lastCommand);
        undoList.push(lastCommand);
        this.publish(this.id, "nodeAdded", {});
        this.publish(this.id, "edgeAdded", {});
    }

    updateConnection(data) {
        const {viewId, done} = data;
        if (done) {
            console.log("done", this.connections, viewId)
            this.connections.delete(viewId);
        } else {
            this.connections.set(viewId, data);
        }
        this.publish(this.id, "connectionUpdated", this.connections);
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

    setInteractionTimeStamp(viewId: string) {
        const now = this.now();
        // console.log(`set`, viewId, now);
        this.interactionTimeStamps.set(viewId, now);
    }

    maybeClearInteraction() {
        const now = this.now();
        // console.log(now, this.clearInterval);
        if (!this.clearInterval) {
            return;
        }

        this.future(this.clearInterval).maybeClearInteraction();

        const toDelete = [];

        for (const [viewId, time] of this.interactionTimeStamps) {
            if (now - time > this.clearInterval) {
                // console.log(now, time, this.clearInterval, viewId);
                this.connections.delete(viewId);
                this.nodeOwnerMap.delete(viewId);
                toDelete.push(viewId);
            }
        }

        if (toDelete.length > 0) {
            toDelete.forEach((viewId) => this.interactionTimeStamps.delete(viewId));
            this.publish(this.id, `connectionUpdated`);
        }
    }

    ensurePersistenceProps() {
        if (!this.persistPeriod) {
            const period = 1 * 60 * 1000;
            this.persistPeriod = period;
        }
        if (this.lastPersistTime === undefined) {
            this.lastPersistTime = 0;
        }

        if (this.persistRequested === undefined) {
            this.persistRequested = false;
        }
    }

    loadPersistentData({ _name, version, data }) {
        let success = false;
        try {
            delete this.loadingPersistentDataErrored;
            this.loadingPersistentData = true;
            success = this.load(data, version);
        } catch (error) {
            console.error("error in loading persistent data", error);
            this.loadingPersistentDataErrored = true;
            success = false;
        } finally {
            delete this.loadingPersistentData;
        }
        return success;
    }

    load(data, _version) {
        if (!data) {return false;}
        this.nodes = new Map(data.nodes);
        this.edges = new Map(data.edges);
        this.nextActionId = data.nextActionId;
        return true;
    }

    savePersistentData() {
        if (this.loadingPersistentData) {return;}
        if (this.loadingPersistentDataErrored) {return;}
        // console.log("persist data");
        this.lastPersistTime = this.now();
        const func = () => {
            const snapshot = this.makeSnapshot({
                nodes: this.nodes,
                edges: this.edges,
                nextActionId: this.nextActionId,
                nextNodeId: this.nextNodeId,
                nextEdgeId: this.nextEdgeId,
            });
            return {name, version: 1, data: snapshot};
        };
        this.persistSession(func);
    }

    triggerPersist() {
        const now = this.now();
        const diff = now - this.lastPersistTime;
        const period = this.persistPeriod;
        // console.log("persist triggered", diff, period);
        if (diff < period) {
            if (!this.persistRequested) {
                // console.log("persist scheduled");
                this.persistRequested =  true;
                this.future(period - diff).triggerPersist();
            }
            // console.log("persist not ready");
            return;
        }
        this.lastPersistTime = now;
        this.persistRequested = false;
        this.savePersistentData();
    }
}

FlowModel.register("FlowModel");
