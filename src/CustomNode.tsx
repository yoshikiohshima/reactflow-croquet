import React, { memo, useState, useCallback, useRef, useEffect } from 'react';
import { Handle, useReactFlow, useStoreApi, Position, NodeResizer } from 'reactflow';

import {
    usePublish,
    useModelRoot,
    useViewId
} from "@croquet/react";

const options = [
  {
    value: 'smoothstep',
    label: 'Smoothstep',
  },
  {
    value: 'step',
    label: 'Step',
  },
  {
    value: 'default',
    label: 'Bezier (default)',
  },
  {
    value: 'straight',
    label: 'Straight',
  },
];

function Select({ value, handleId, nodeId }) {
  const { setNodes } = useReactFlow();
  const store = useStoreApi();
  const onChange = (evt) => {
      const { nodeInternals } = store.getState();
      setNodes(
          Array.from(nodeInternals.values()).map((node) => {
              if (node.id === nodeId) {
                  node.data = {
                      ...node.data,
                      selects: {
                          ...node.data.selects,
                          [handleId]: evt.target.value,
                      },
                  };
              }
              return node;
          })
      );
  };

  return (
    <div className="custom-node__select">
      <div>Edge Type</div>
      <select className="nodrag" onChange={onChange} value={value}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Handle type="source" position={Position.Right} id={handleId} />
    </div>
  );
}

function CustomNodeBody({ id, data }) {
  return (
    <>
      <div className="custom-node__header">
        This is a <strong>custom node</strong>
      </div>
      <div className="custom-node__body">
        {Object.keys(data.selects).map((handleId) => (
          <Select key={handleId} nodeId={id} value={data.selects[handleId]} handleId={handleId} />
        ))}
      </div>
    </>
  );
}

function Text({ path, text, className}) {
    const model = useModelRoot();
    const viewId = useViewId();
    const [content, setContent] = useState(text);

    const inputRef = useRef(null);
    const [cursor, setCursor] = useState(undefined);

    if (content !== text) {
        setContent(text);
    }

    const publishDataChange = usePublish((data) => [model.id, 'updateData', data]);

    useEffect(() => {
        if (inputRef.current && cursor !== undefined) {
            // it should check the viewId of last change, or such
            inputRef.current.setSelectionRange(cursor, cursor);
        }
    }, [inputRef, cursor, content]);
    
    const onChange = useCallback((e) => {
        setCursor(e.target.selectionStart);
        publishDataChange({id: path, viewId, property: "text", value: e.target.value});
        setContent(e.target.value);
    }, [publishDataChange, path, viewId]);

    return (
        <textarea ref={inputRef} className={className} value={content} onChange={onChange}></textarea>
    );
}

function TextNodeBody({ id, data }) {
    return (
        <>
            <NodeResizer minWidth={100} minHeight={30}/>
            <div className="custom-node__header">
                This is an <strong>ediable text node</strong>
            </div>
            <Text path={id} text={data.text} className={"custom-node__body custom-node__text"}/>
        </>
    );
}

function ToDoListBody({id, data}) {
/*
 {
    id: "xxx",
    type: "todo",
    data: {
        todos: [
            {
                id: string,
                title: string,
                checked: boolean;
            },
        ]
    }
}
*/

    const model = useModelRoot();
    const viewId = useViewId();

    const publishAddTodo = usePublish((data) => [model.id, 'addTodo', data]);
    const publishRemoveTodo = usePublish((data) => [model.id, 'removeTodo', data]);
    const publishCheckBoxChanged = usePublish((data) => [model.id, 'checkBoxChanged', data]);

    const add = (_evt) => {
        publishAddTodo({id, viewId});
    };

    const remove = (evt) => {
        const removeId = evt.target.parentNode.getAttribute("todoid");
        publishRemoveTodo({id, viewId, todoId: removeId});
    };

    const onCheckBoxChange = (evt) => {
      const todoid = evt.target.parentNode.getAttribute("todoid");
      publishCheckBoxChanged({id, viewId, todoId: todoid, checked: evt.target.checked});
    };

    const makeTodoElement = (todo) => {
      const workaround = {todoid: todo.id};
        return (
            <div key={todo.id} {...workaround} className="custom-node__todo nodrag">
                <Text path={`todos.${id}.${todo.id}`} text={todo.title} className={"custom-node__todo-title nodrag"}/>
                <input className="custom-node__todo-checked nodrag" onChange={onCheckBoxChange} checked={todo.checked} type="checkbox"/>
                <button className="custom-node__todo-delete nodrag" onClick={remove}>Delete</button>
            </div>
        );
    };

    return (
        <>
            <div className="custom-node__todo-header">
                This is a <strong>ToDo List</strong><button className="custom-node___todo-add-button nodrag" onClick={add}>Add</button>

            </div>
            <div className="custom-node___todo-container">
                {data.todos.map(makeTodoElement)}
            </div>
        </>
    );
}

export const CustomNode = memo(CustomNodeBody);
export const TextNode = memo(TextNodeBody);
export const ToDoListNode = memo(ToDoListBody);

