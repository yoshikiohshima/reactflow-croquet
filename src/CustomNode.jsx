import React, { memo, useState, useCallback } from 'react';
import { Handle, useReactFlow, useStoreApi, Position } from 'reactflow';

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

function TextNodeBody({ id, data }) {
    const model = useModelRoot();
    const viewId = useViewId();
    let text = data.text;
    const [content, setContent] = useState(data.text);

    if (content !== data.text) {
        setContent(data.text);
    }

    const publishTextChange = usePublish((data) => [model.id, 'updateTextNode', data]);
    
    const onChange = useCallback((e) => {
        publishTextChange({id, viewId, data: {text: e.target.value}});
        text = e.target.value;
        setContent(e.target.value);
    }, [publishTextChange]);

    return (
        <>
            <div className="custom-node__header">
                This is a <strong>ediable text node</strong>
            </div>
            <textarea className="custom-node__body" value={content} onChange={onChange}></textarea>
        </>
    );
}

export const CustomNode = memo(CustomNodeBody);
export const TextNode = memo(TextNodeBody);
