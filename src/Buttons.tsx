export function CreateNodeButton(props) {
    return (
        <button onClick={props.onClick} style={{width: 80, height: 80}}>Create</button>
    );
}

export function DeleteObjectsButton(props) {
    return (
        <button onClick={props.onClick} style={{width: 80, height: 80}}>Delete</button>
    );
}

export function UndoButton(props) {
    return (
        <button onClick={props.onClick} style={{width: 80, height: 80}}>Undo</button>
    );
}

export function RedoButton(props) {
    return (
        <button onClick={props.onClick} style={{width: 80, height: 80}}>Redo</button>
    );
}
