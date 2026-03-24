import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { BlueprintFlowNodeData, Pin } from '../types';
import { getNodeAccent } from '../lib/blueprintTransform';

function pinColor(pin: Pin) {
  return pin.kind === 'exec' ? '#f7f9fc' : '#57c1ff';
}

function PinLabel({ pin, direction }: { pin: Pin; direction: 'input' | 'output' }) {
  const isInput = direction === 'input';
  const color = pinColor(pin);
  return (
    <div className={`bp-node__pin-label ${isInput ? 'bp-node__pin-label--input' : 'bp-node__pin-label--output'}`}>
      <Handle
        id={pin.id}
        type={isInput ? 'target' : 'source'}
        position={isInput ? Position.Left : Position.Right}
        isConnectable={false}
        className="bp-node__handle"
        style={{
          background: color,
          borderColor: color,
          left: isInput ? '-18px' : undefined,
          right: isInput ? undefined : '-18px',
          top: 8,
        }}
      />
      <span className="bp-node__pin-name">{pin.label}</span>
      <span className="bp-node__pin-type">{pin.dataType}</span>
    </div>
  );
}

/** Compact pill node — ≤1 input and ≤1 output */
function CompactNode({
  data,
  accent,
  selected,
}: {
  data: BlueprintFlowNodeData;
  accent: string;
  selected: boolean;
}) {
  const input = data.inputs[0] ?? null;
  const output = data.outputs[0] ?? null;

  return (
    <div className={`bp-node bp-node--compact bp-node--${accent} ${selected ? 'is-selected' : ''}`}>
      {input && (
        <Handle
          id={input.id}
          type="target"
          position={Position.Left}
          isConnectable={false}
          className="bp-node__handle"
          style={{ background: pinColor(input), borderColor: pinColor(input) }}
        />
      )}

      <div className="bp-node__compact-inner">
        <span className="bp-node__category">{data.category}</span>
        <strong className="bp-node__compact-title">{data.title}</strong>
        {(input || output) && (
          <div className="bp-node__compact-pins">
            {input && (
              <span className="bp-node__compact-pin">
                <span className="bp-node__pin-name">{input.label}</span>
                <span className="bp-node__pin-type">{input.dataType}</span>
              </span>
            )}
            {input && output && <span className="bp-node__compact-arrow">→</span>}
            {output && (
              <span className="bp-node__compact-pin bp-node__compact-pin--out">
                <span className="bp-node__pin-name">{output.label}</span>
                <span className="bp-node__pin-type">{output.dataType}</span>
              </span>
            )}
          </div>
        )}
      </div>

      {output && (
        <Handle
          id={output.id}
          type="source"
          position={Position.Right}
          isConnectable={false}
          className="bp-node__handle"
          style={{ background: pinColor(output), borderColor: pinColor(output) }}
        />
      )}
    </div>
  );
}

export default function BlueprintNode({ data, selected }: NodeProps<BlueprintFlowNodeData>) {
  const accent = getNodeAccent(data.nodeType, data.category);
  const isSelected = selected || data.selected;

  // Compact pill: at most 1 input and 1 output
  const isCompact = data.inputs.length <= 1 && data.outputs.length <= 1;

  if (isCompact) {
    return <CompactNode data={data} accent={accent} selected={isSelected} />;
  }

  const rowCount = Math.max(data.inputs.length, data.outputs.length, 1);

  return (
    <div className={`bp-node bp-node--${accent} ${isSelected ? 'is-selected' : ''}`}>
      <div className="bp-node__header">
        <span className="bp-node__category">{data.category}</span>
        <strong className="bp-node__title">{data.title}</strong>
        {data.subtitle ? <span className="bp-node__subtitle">{data.subtitle}</span> : null}
      </div>

      <div className="bp-node__surface" style={{ minHeight: `${rowCount * 48 + 28}px` }}>
        <div className="bp-node__pin-column">
          {data.inputs.map((pin) => (
            <PinLabel key={pin.id} pin={pin} direction="input" />
          ))}
        </div>
        <div className="bp-node__pin-column bp-node__pin-column--spacer" />
        <div className="bp-node__pin-column bp-node__pin-column--output">
          {data.outputs.map((pin) => (
            <PinLabel key={pin.id} pin={pin} direction="output" />
          ))}
        </div>
      </div>

      {data.keywords.length > 0 ? (
        <div className="bp-node__keywords">
          {data.keywords.slice(0, 4).map((keyword) => (
            <span key={keyword} className="node-keyword">{keyword}</span>
          ))}
        </div>
      ) : null}

      {data.comment ? <div className="bp-node__comment">{data.comment}</div> : null}
    </div>
  );
}
