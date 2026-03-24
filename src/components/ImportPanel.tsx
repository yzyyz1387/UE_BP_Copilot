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
        <h3>导入 / 外部 Prompt</h3>
        <span className="panel-tag">兼容其他 AI</span>
      </div>

      <div className="card-stack-tight">
        <label className="form-field">
          <span>导入 JSON</span>
          <textarea
            className="prompt-textarea prompt-textarea--compact"
            value={importText}
            onChange={(event) => onImportTextChange(event.target.value)}
            placeholder="把其他 AI 生成的 JSON 粘贴到这里，然后点击“应用导入”。支持带 ```json 代码块的内容。"
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
        <span>给其他 AI 的 Prompt 模板</span>
        <textarea
          className="prompt-textarea prompt-textarea--compact"
          value={externalPrompt}
          readOnly
        />
      </label>

      <div className="action-group action-group--compact">
        <button type="button" className="ghost-button" onClick={onCopyPrompt}>
          一键复制 Prompt
        </button>
      </div>
    </section>
  );
}
