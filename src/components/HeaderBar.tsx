import type { BlueprintNodeModel } from '../types';

interface HeaderBarProps {
  statusText: string;
  endpointLabel: string;
  selectedNode: BlueprintNodeModel | null;
  onLoadDemo: () => void;
  onExportJson: () => void;
  onCopyJson: () => void;
}

export function HeaderBar({
  statusText,
  endpointLabel,
  selectedNode,
  onLoadDemo,
  onExportJson,
  onCopyJson,
}: HeaderBarProps) {
  return (
    <header className="topbar">
      <div className="topbar__copy">
        <span className="eyebrow">UE5 Blueprint · Local-first prototype</span>
        <h1>UE Blueprint AI Studio</h1>
      </div>

      <div className="topbar__node-detail">
        {selectedNode ? (
          <>
            <div className="topbar__node-header">
              <span className="topbar__node-category">{selectedNode.category}</span>
              <strong className="topbar__node-title">{selectedNode.title}</strong>
              {selectedNode.subtitle ? (
                <span className="topbar__node-subtitle">{selectedNode.subtitle}</span>
              ) : null}
            </div>
            <div className="topbar__node-pins">
              <div className="topbar__pin-group">
                <span className="summary-label">输入</span>
                <div className="topbar__pin-list">
                  {selectedNode.inputs.length > 0 ? (
                    selectedNode.inputs.map((pin) => (
                      <span key={pin.id} className="topbar__pin">
                        {pin.label}
                        <em>{pin.dataType}</em>
                      </span>
                    ))
                  ) : (
                    <span className="topbar__pin topbar__pin--empty">无</span>
                  )}
                </div>
              </div>
              <div className="topbar__pin-group">
                <span className="summary-label">输出</span>
                <div className="topbar__pin-list">
                  {selectedNode.outputs.length > 0 ? (
                    selectedNode.outputs.map((pin) => (
                      <span key={pin.id} className="topbar__pin">
                        {pin.label}
                        <em>{pin.dataType}</em>
                      </span>
                    ))
                  ) : (
                    <span className="topbar__pin topbar__pin--empty">无</span>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <span className="topbar__node-empty">点击画布节点查看详情</span>
        )}
      </div>

      <div className="topbar__actions">
        <div className="topbar__status">
          <span className="status-dot" />
          <span>{statusText}</span>
          {endpointLabel ? <code>{endpointLabel}</code> : null}
        </div>
        <div className="action-group action-group--compact">
          <button type="button" className="ghost-button" onClick={onLoadDemo}>
            示例
          </button>
          <button type="button" className="ghost-button" onClick={onCopyJson}>
            复制 JSON
          </button>
          <button type="button" className="primary-button" onClick={onExportJson}>
            导出 JSON
          </button>
        </div>
      </div>
    </header>
  );
}
