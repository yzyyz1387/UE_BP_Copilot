import type { BlueprintNodeModel, BlueprintPlan } from '../types';

export type InspectorTab = 'notes' | 'variables' | 'tips' | 'checklist' | 'json';

interface InspectorTabsProps {
  plan: BlueprintPlan;
  selectedNode: BlueprintNodeModel | null;
  activeTab: InspectorTab;
  rawJson: string;
  onChangeTab: (tab: InspectorTab) => void;
  onFocusNode: (nodeId: string) => void;
}

const TAB_OPTIONS: Array<{ id: InspectorTab; label: string }> = [
  { id: 'notes', label: '备注' },
  { id: 'variables', label: '变量' },
  { id: 'tips', label: '搜索提示' },
  { id: 'checklist', label: '执行清单' },
  { id: 'json', label: 'JSON' },
];

function relatedNodeTitle(plan: BlueprintPlan, nodeId: string): string {
  return plan.nodes.find((node) => node.id === nodeId)?.title ?? nodeId;
}

export function InspectorTabs({
  plan,
  selectedNode,
  activeTab,
  rawJson,
  onChangeTab,
  onFocusNode,
}: InspectorTabsProps) {
  return (
    <>
      <section className="section-card section-card--compact">
        <div className="section-card__header section-card__header--tight">
          <h3>当前蓝图</h3>
          <span className="panel-tag">{plan.meta.blueprintType}</span>
        </div>

        <p className="summary-text summary-text--compact">{plan.meta.summary}</p>

        <div className="meta-strip">
          <span className="pill">{plan.meta.ueVersion}</span>
          <span className="pill">{plan.meta.targetUser}</span>
          {plan.meta.sceneContext ? <span className="pill">{plan.meta.sceneContext}</span> : null}
        </div>
      </section>

      <section className="section-card section-card--compact">
        <div className="tab-list">
          {TAB_OPTIONS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`tab-button ${activeTab === tab.id ? 'is-active' : ''}`}
              onClick={() => onChangeTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'notes' ? (
          <div className="card-list">
            {plan.messages.length > 0 ? (
              plan.messages.map((message) => (
                <article
                  key={message.id}
                  className={`note-card note-card--${message.level}`}
                >
                  <div className="note-card__header">
                    <span className="panel-tag panel-tag--soft">
                      {message.level === 'warning'
                        ? '警告'
                        : message.level === 'tip'
                          ? '提示'
                          : '备注'}
                    </span>
                    <strong>{message.title}</strong>
                  </div>
                  <p>{message.content}</p>
                  {message.relatedNodeIds.length > 0 ? (
                    <div className="tag-list">
                      {message.relatedNodeIds.map((nodeId) => (
                        <button
                          key={nodeId}
                          type="button"
                          className="link-chip"
                          onClick={() => onFocusNode(nodeId)}
                        >
                          定位：{relatedNodeTitle(plan, nodeId)}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))
            ) : (
              <p className="empty-hint">当前没有额外备注。</p>
            )}
          </div>
        ) : null}

        {activeTab === 'variables' ? (
          <div className="card-list">
            {plan.variables.length > 0 ? (
              plan.variables.map((variable) => (
                <article key={variable.name} className="variable-card">
                  <div className="variable-card__header">
                    <strong>{variable.name}</strong>
                    <span>{variable.type}</span>
                  </div>
                  <p>{variable.reason}</p>
                  <div className="tag-list">
                    <span className="pill">默认值：{variable.defaultValue || '空'}</span>
                    {variable.instanceEditable ? <span className="pill">实例可编辑</span> : null}
                    {variable.exposeOnSpawn ? <span className="pill">生成时公开</span> : null}
                    {variable.promoteFromNode ? (
                      <span className="pill">来源：{relatedNodeTitle(plan, variable.promoteFromNode)}</span>
                    ) : null}
                  </div>
                </article>
              ))
            ) : (
              <p className="empty-hint">当前没有变量建议。</p>
            )}
          </div>
        ) : null}

        {activeTab === 'tips' ? (
          <div className="card-list">
            {plan.searchTips.length > 0 ? (
              plan.searchTips.map((tip) => (
                <article key={tip.id} className="tip-card">
                  <strong>{tip.target}</strong>
                  <p>
                    <span className="summary-label">常见问题</span>
                    {tip.problem}
                  </p>
                  <p>
                    <span className="summary-label">建议做法</span>
                    {tip.solution}
                  </p>
                </article>
              ))
            ) : (
              <p className="empty-hint">当前没有节点搜索提示。</p>
            )}
          </div>
        ) : null}

        {activeTab === 'checklist' ? (
          <div className="card-list">
            {plan.checklist.length > 0 ? (
              <ol className="ordered-list">
                {plan.checklist.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            ) : (
              <p className="empty-hint">当前没有执行清单。</p>
            )}
          </div>
        ) : null}

        {activeTab === 'json' ? (
          <pre className="json-block">{rawJson}</pre>
        ) : null}
      </section>
    </>
  );
}
