import {useEffect} from "react";
import { getStraightPath } from 'reactflow';
import {FlowModel} from "./model";

import {
    usePublish,
    useViewId,
    useModelRoot,
} from "@croquet/react";

export function CustomConnectionLine(props) {
    const model:FlowModel = useModelRoot() as FlowModel;
    const { fromX, fromY, toX, toY, connectionLineStyle, viewId } = props;
    // console.log(props);

    const myViewId = useViewId();
    const [edgePath] = getStraightPath({
        sourceX: fromX,
        sourceY: fromY,
        targetX: toX,
        targetY: toY,
    });


        const publishUpdateConnection = usePublish((data) => [model.id, 'updateConnection', data]);


    useEffect(() => {
        // return () => publishUpdateConnection({viewId: myViewId, done: true});
    }, [publishUpdateConnection, myViewId]);

    if (!viewId) {
        publishUpdateConnection({viewId: myViewId, fromX, fromY,toX, toY, connectionLineStyle});
    }

    return (
        <g>
            <path style={connectionLineStyle} fill="none" d={edgePath} />
            <circle cx={toX} cy={toY} fill="black" r={3} stroke="black" strokeWidth={1.5} />
        </g>
    );
}

export function RemoteConnections(props) {
    const {viewport} = props;
// const elem = document.getElementById("flow");
 //   const {top, left} = elem ? elem.getBoundingClientRect() : {top: 0, left: 0};
 //   const {x, y, zoom} = useViewport();
    
    const connections = props.connections.map((pair) => {
        const { fromX, fromY, toX, toY, connectionLineStyle, viewId } = pair[1];
        const [edgePath] = getStraightPath({
            sourceX: fromX,
            sourceY: fromY,
            targetX: toX,
            targetY: toY,
        });

        const transform = `translateX(${viewport.x + viewport.left}px) translateY(${viewport.y + viewport.top}px) scale(${viewport.zoom})`;
   
        return (
            <g key={viewId}>
                <path style={{transform, ...connectionLineStyle}} fill="none" d={edgePath} />
            </g>
        );
    });

    return (
        <svg id="remoteConnections" fill="blue" style={{position: "fixed", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none"}}>
            {connections}
        </svg>
    )
}
