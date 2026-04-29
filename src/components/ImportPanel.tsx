interface ImportPanelProps {
  importText: string;
  externalPrompt: string;
  onImportTextChange: (value: string) => void;
  onApplyImport: () => void;
  onClearImport: () => void;
  onCopyPrompt: () => void;
}

export function ImportPanel({
  importText,
  externalPrompt,
  onImportTextChange,
  onApplyImport,
  onClearImport,
  onCopyPrompt,
}: ImportPanelProps) {
  return (
    <section className="section-card section-card--compact">
      <div className="section-card__header">
        <h3>导入 / 外部提示词</h3>
        <span className="panel-tag">支持工作区操作</span>
      </div>

      <div className="card-stack-tight">
        <label className="form-field">
          <span>导入 JSON</span>
          <textarea
            className="prompt-textarea prompt-textarea--compact"
            value={importText}
            onChange={(event) => onImportTextChange(event.target.value)}
            placeholder="可粘贴旧版单蓝图 JSON，也可粘贴 BlueprintWorkspaceResponse。create_blueprint 会自动加入左侧用户/文件夹树。"
          />
        </label>

        <div className="action-group action-group--compact">
          <button type="button" className="ghost-button" onClick={onClearImport}>
            清空导入区
          </button>
          <button type="button" className="primary-button" onClick={onApplyImport}>
            应用导入
          </button>
        </div>
      </div>

      <div className="divider" />

      <label className="form-field">
        <span>给其他 AI 的提示词模板</span>
        <textarea
          className="prompt-textarea prompt-textarea--compact"
          value={externalPrompt}
          readOnly
        />
      </label>

      <div className="action-group action-group--compact">
        <button type="button" className="ghost-button" onClick={onCopyPrompt}>
          复制提示词
        </button>
      </div>
    </section>
  );
}
