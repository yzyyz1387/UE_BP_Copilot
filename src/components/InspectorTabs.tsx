import type { BlueprintNodeModel, BlueprintPlan, BlueprintProperty } from '../types';

export type InspectorTab = 'notes' | 'variables' | 'tips' | 'checklist' | 'json';

interface InspectorTabsProps {
  plan: BlueprintPlan;
  selectedNode: BlueprintNodeModel | null;
  activeTab: InspectorTab;
  rawJson: string;
  onChangeTab: (tab: InspectorTab) => void;
  onFocusNode: (nodeId: string) => void;
  onUpdatePropertyValue: (propertyId: string, value: string) => void;
}

const TAB_OPTIONS: Array<{ id: InspectorTab; label: string }> = [
  { id: 'notes', label: '备注' },
  { id: 'variables', label: '用户变量' },
  { id: 'tips', label: '搜索提示' },
  { id: 'checklist', label: '执行清单' },
  { id: 'json', label: 'JSON' },
];

const PROPERTY_SOURCE_LABELS: Record<BlueprintProperty['source'], string> = {
  engine_default: '引擎默认',
  component_default: '组件默认',
  user_override: '用户调整',
  ai_override: 'AI 建议调整',
};

function relatedNodeTitle(plan: BlueprintPlan, nodeId: string): string {
  return plan.nodes.find((node) => node.id === nodeId)?.title ?? nodeId;
}

function groupProperties(properties: BlueprintProperty[]): Array<{ key: string; owner: string; category: string; items: BlueprintProperty[] }> {
  const groups = new Map<string, { owner: string; category: string; items: BlueprintProperty[] }>();
  for (const property of properties) {
    const owner = property.owner || 'Self';
    const category = property.category || 'Blueprint Defaults';
    const key = `${owner} / ${category}`;
    if (!groups.has(key)) groups.set(key, { owner, category, items: [] });
    groups.get(key)!.items.push(property);
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b, 'zh-CN'))
    .map(([key, group]) => ({
      key,
      owner: group.owner,
      category: group.category,
      items: [...group.items].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')),
    }));
}

function isPropertyChanged(property: BlueprintProperty): boolean {
  const current = property.value.trim();
  const defaultValue = property.defaultValue.trim();
  return Boolean(current && defaultValue && current !== defaultValue);
}

export function InspectorTabs({
  plan,
  selectedNode,
  activeTab,
  rawJson,
  onChangeTab,
  onFocusNode,
  onUpdatePropertyValue,
}: InspectorTabsProps) {
  const propertyGroups = groupProperties(plan.properties ?? []);

  return (
    <>
      <section className="section-card section-card--compact">
        <div className="section-card__header section-card__header--tight">
          <h3>蓝图属性</h3>
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
        <div className="section-card__header section-card__header--tight">
          <h3>Details / 默认属性</h3>
          <span className="panel-tag">{plan.properties.length} 项</span>
        </div>

        {propertyGroups.length > 0 ? (
          <div className="property-groups">
            {propertyGroups.map((group) => (
              <div key={group.key} className="property-group">
                <div className="property-group__title">
                  <strong>{group.owner}</strong>
                  <span>{group.category}</span>
                </div>
                <div className="property-list">
                  {group.items.map((property) => (
                    <article
                      key={property.id}
                      className={`property-row ${isPropertyChanged(property) ? 'is-overridden' : ''}`}
                      title={property.reason}
                    >
                      <div className="property-row__main">
                        <strong>{property.name}</strong>
                        <span>{property.owner} · {property.type}</span>
                      </div>
                      <div className="property-row__value">
                        <input
                          value={property.value}
                          onChange={(event) => onUpdatePropertyValue(property.id, event.currentTarget.value)}
                          aria-label={`${property.owner}.${property.name}`}
                        />
                        {property.defaultValue ? <em>默认：{property.defaultValue}</em> : null}
                      </div>
                      <div className="property-row__footer">
                        <span>{PROPERTY_SOURCE_LABELS[property.source]}</span>
                        {isPropertyChanged(property) ? <span className="property-row__badge">已调整</span> : null}
                      </div>
                      {property.reason ? <p>{property.reason}</p> : null}
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-hint">当前没有蓝图自带属性调整。AI 如果调整 Tick、Collision、Replication 等 UE Details 属性，会显示在这里。</p>
        )}
      </section>

      {selectedNode ? (
        <section className="section-card section-card--compact">
          <div className="section-card__header section-card__header--tight">
            <h3>选中节点</h3>
            <span className="panel-tag">{selectedNode.category}</span>
          </div>
          <div className="node-detail node-detail--compact">
            <strong>{selectedNode.title}</strong>
            <p>{selectedNode.subtitle || selectedNode.comment || '没有额外说明。'}</p>
            {selectedNode.keywords.length > 0 ? (
              <div className="tag-list">
                {selectedNode.keywords.map((keyword) => (
                  <span key={keyword} className="node-keyword">{keyword}</span>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

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
              <p className="empty-hint">当前没有需要用户新建的变量。蓝图自带属性会显示在上方 Details 区域。</p>
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
