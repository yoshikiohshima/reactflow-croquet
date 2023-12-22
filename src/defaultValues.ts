import { MarkerType, Position } from 'reactflow';

export const defaultValues = {
    nodes: [
        {
            id: '1',
            type: 'todo',
            data: {
                todos: [
                    {
                        id : "t1",
                        title: "Task 1",
                        checked: false,
                    },
                    {
                        id : "t2",
                        title: "Task 2",
                        checked: false,
                    }
                ]
            },
            position: { x: 250, y: 0 },
        },
        {
            id: '2',
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
            id: '3',
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
            id: '4',
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
            id: '5',
            type: 'text',
            position: { x: 100, y: 400 },
            data: {
                resizable: true,
                text: "test text"
            },
        },
        {
            id: '6',
            type: 'monaco',
            position: { x: 300, y: 400 },
            data: {
                text: "test text"
            },
        },
    ],

    edges: [
        {
            id: 'e4-5',
            source: '2',
            target: '3',
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
            source: '2',
            target: '4',
            type: 'smoothstep',
            sourceHandle: 'handle-1',
            data: {
                selectIndex: 1,
            },
            markerEnd: {
                type: MarkerType.ArrowClosed,
            },
        },
    ]
}
