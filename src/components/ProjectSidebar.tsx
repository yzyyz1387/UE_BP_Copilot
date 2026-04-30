import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import type { BlueprintLibrary, BlueprintPlan, BlueprintProject, BlueprintVariable } from '../types';

interface ProjectSidebarProps {
  library: BlueprintLibrary;
  plan: BlueprintPlan;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onSelectProject: (projectId: string) => void;
  onCreateProject: () => void;
  onDuplicateProject: () => void;
  onDeleteProject: () => void;
  onCreateVariable: (variable: BlueprintVariable) => void;
  onUpdateVariable: (originalName: string, variable: BlueprintVariable) => void;
  onDeleteVariable: (name: string) => void;
}

interface FolderGroup {
  folderPath: string;
  projects: BlueprintProject[];
}

interface VariableFormState {
  name: string;
  type: string;
  defaultValue: string;
  instanceEditable: boolean;
  exposeOnSpawn: boolean;
  reason: string;
}

type VariableStyle = CSSProperties & { '--variable-color'?: string };

const VARIABLE_TYPES = [
  'Boolean',
  'Integer',
  'Float',
  'String',
  'Name',
  'Text',
  'Vector',
  'Rotator',
  'Transform',
  'Actor',
  'Object',
  'Component',
  'Widget',
  'Class',
  'Enum',
  'Struct',
];

const EMPTY_VARIABLE_FORM: VariableFormState = {
  name: '',
  type: 'Boolean',
  defaultValue: '',
  instanceEditable: false,
  exposeOnSpawn: false,
  reason: '',
};

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '未知';
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function groupProjects(projects: BlueprintProject[]): Array<{ userName: string; folders: FolderGroup[] }> {
  const userMap = new Map<string, Map<string, BlueprintProject[]>>();
  for (const project of projects) {
    const userName = project.userName || '默认用户';
    const folderPath = project.folderPath || '未分类';
    if (!userMap.has(userName)) userMap.set(userName, new Map());
    const folderMap = userMap.get(userName)!;
    if (!folderMap.has(folderPath)) folderMap.set(folderPath, []);
    folderMap.get(folderPath)!.push(project);
  }

  return Array.from(userMap.entries())
    .sort(([a], [b]) => a.localeCompare(b, 'zh-CN'))
    .map(([userName, folderMap]) => ({
      userName,
      folders: Array.from(folderMap.entries())
        .sort(([a], [b]) => a.localeCompare(b, 'zh-CN'))
        .map(([folderPath, items]) => ({
          folderPath,
          projects: [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
        })),
    }));
}

function variableColor(type: string): string {
  const text = type.toLowerCase();
  if (text.includes('bool')) return '#b73b3b';
  if (text.includes('int') || text.includes('byte')) return '#3aa55b';
  if (text.includes('float') || text.includes('double')) return '#9ac85f';
  if (text.includes('string')) return '#d84fb2';
  if (text.includes('text')) return '#e46fb0';
  if (text.includes('name')) return '#b969d8';
  if (text.includes('vector')) return '#f0c24f';
  if (text.includes('rotator')) return '#7c6fe6';
  if (text.includes('transform')) return '#df8a3d';
  if (text.includes('class')) return '#7a5bd6';
  if (text.includes('enum')) return '#7cc4aa';
  if (text.includes('struct')) return '#8dc5e8';
  if (text.includes('actor') || text.includes('component') || text.includes('object') || text.includes('widget')) return '#54a6e8';
  return '#5fb7ff';
}

function createVariableFromForm(form: VariableFormState): BlueprintVariable {
  return {
    name: form.name.trim(),
    type: form.type.trim() || 'Boolean',
    defaultValue: form.defaultValue.trim(),
    instanceEditable: form.instanceEditable,
    exposeOnSpawn: form.exposeOnSpawn,
    promoteFromNode: '',
    reason: form.reason.trim() || '用户在左侧变量面板手动添加。',
  };
}

function createFormFromVariable(variable: BlueprintVariable): VariableFormState {
  return {
    name: variable.name,
    type: variable.type || 'Boolean',
    defaultValue: variable.defaultValue || '',
    instanceEditable: variable.instanceEditable,
    exposeOnSpawn: variable.exposeOnSpawn,
    reason: variable.reason || '',
  };
}

export function ProjectSidebar({
  library,
  plan,
  collapsed,
  onToggleCollapsed,
  onSelectProject,
  onCreateProject,
  onDuplicateProject,
  onDeleteProject,
  onCreateVariable,
  onUpdateVariable,
  onDeleteVariable,
}: ProjectSidebarProps) {
  const activeProject = library.projects.find((project) => project.id === library.activeProjectId) ?? library.projects[0];
  const grouped = useMemo(() => groupProjects(library.projects), [library.projects]);
  const variables = useMemo(
    () => [...plan.variables].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')),
    [plan.variables],
  );
  const [openUsers, setOpenUsers] = useState<Record<string, boolean>>({});
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});
  const [variableFormOpen, setVariableFormOpen] = useState(false);
  const [editingVariableName, setEditingVariableName] = useState<string | null>(null);
  const [variableForm, setVariableForm] = useState<VariableFormState>(EMPTY_VARIABLE_FORM);

  useEffect(() => {
    if (!activeProject) return;
    setOpenUsers((current) => ({ ...current, [activeProject.userName]: true }));
    setOpenFolders((current) => ({ ...current, [`${activeProject.userName}/${activeProject.folderPath}`]: true }));
  }, [activeProject?.id, activeProject?.userName, activeProject?.folderPath]);

  const toggleUser = (userName: string) => {
    setOpenUsers((current) => ({ ...current, [userName]: !current[userName] }));
  };

  const toggleFolder = (userName: string, folderPath: string) => {
    const key = `${userName}/${folderPath}`;
    setOpenFolders((current) => ({ ...current, [key]: !current[key] }));
  };

  const beginCreateVariable = () => {
    setEditingVariableName(null);
    setVariableForm(EMPTY_VARIABLE_FORM);
    setVariableFormOpen(true);
  };

  const beginEditVariable = (variable: BlueprintVariable) => {
    setEditingVariableName(variable.name);
    setVariableForm(createFormFromVariable(variable));
    setVariableFormOpen(true);
  };

  const cancelVariableForm = () => {
    setVariableFormOpen(false);
    setEditingVariableName(null);
    setVariableForm(EMPTY_VARIABLE_FORM);
  };

  const submitVariableForm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextVariable = createVariableFromForm(variableForm);
    if (!nextVariable.name) {
      window.alert('变量名称不能为空。');
      return;
    }

    const nextName = nextVariable.name.trim().toLowerCase();
    const oldName = (editingVariableName ?? '').trim().toLowerCase();
    const duplicated = variables.some((variable) => {
      const currentName = variable.name.trim().toLowerCase();
      return currentName === nextName && currentName !== oldName;
    });
    if (duplicated) {
      window.alert(`变量“${nextVariable.name}”已存在。`);
      return;
    }

    if (editingVariableName) {
      onUpdateVariable(editingVariableName, nextVariable);
    } else {
      onCreateVariable(nextVariable);
    }
    cancelVariableForm();
  };

  const handleDeleteVariable = (name: string) => {
    if (!window.confirm(`确定删除变量“${name}”？`)) return;
    onDeleteVariable(name);
    if (editingVariableName === name) cancelVariableForm();
  };

  return (
    <aside className={`project-sidebar ${collapsed ? 'is-collapsed' : ''}`}>
      <div className="project-sidebar__top">
        <button
          type="button"
          className="nav-icon-button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? '展开导航栏' : '收起导航栏'}
          title={collapsed ? '展开导航栏' : '收起导航栏'}
        >
          ☰
        </button>
        {!collapsed ? (
          <div className="project-sidebar__brand">
            <strong>蓝图库</strong>
            <span>{library.projects.length} 个本地蓝图</span>
          </div>
        ) : null}
      </div>

      {!collapsed ? (
        <>
          <div className="project-sidebar__actions">
            <button type="button" className="nav-action" onClick={onCreateProject}>
              新建蓝图
            </button>
            <button type="button" className="nav-action" onClick={onDuplicateProject}>
              复制当前
            </button>
            <button type="button" className="nav-action nav-action--danger" onClick={onDeleteProject}>
              删除
            </button>
          </div>

          <div className="project-sidebar__content">
            <div className="project-tree" role="tree" aria-label="本地蓝图文件夹树">
              {grouped.map((userGroup) => {
                const userOpen = openUsers[userGroup.userName] ?? true;
                return (
                  <div key={userGroup.userName} className="project-tree__user">
                    <button
                      type="button"
                      className="project-tree__row project-tree__row--user"
                      onClick={() => toggleUser(userGroup.userName)}
                    >
                      <span className="project-tree__chevron">{userOpen ? '▾' : '▸'}</span>
                      <span className="project-tree__icon">👤</span>
                      <span className="project-tree__label">{userGroup.userName}</span>
                    </button>

                    {userOpen ? (
                      <div className="project-tree__children">
                        {userGroup.folders.map((folder) => {
                          const folderKey = `${userGroup.userName}/${folder.folderPath}`;
                          const folderOpen = openFolders[folderKey] ?? true;
                          return (
                            <div key={folderKey} className="project-tree__folder">
                              <button
                                type="button"
                                className="project-tree__row project-tree__row--folder"
                                onClick={() => toggleFolder(userGroup.userName, folder.folderPath)}
                              >
                                <span className="project-tree__chevron">{folderOpen ? '▾' : '▸'}</span>
                                <span className="project-tree__icon">📁</span>
                                <span className="project-tree__label">{folder.folderPath}</span>
                                <span className="project-tree__count">{folder.projects.length}</span>
                              </button>

                              {folderOpen ? (
                                <div className="project-tree__children project-tree__children--files">
                                  {folder.projects.map((project) => (
                                    <button
                                      key={project.id}
                                      type="button"
                                      className={`project-tree__file ${project.id === library.activeProjectId ? 'is-active' : ''}`}
                                      onClick={() => onSelectProject(project.id)}
                                      title={`${project.name}\n更新：${formatTime(project.updatedAt)}`}
                                    >
                                      <span className="project-tree__file-icon">◆</span>
                                      <span className="project-tree__file-text">
                                        <strong>{project.name}</strong>
                                        <em>{formatTime(project.updatedAt)}</em>
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="blueprint-variable-panel" aria-label="当前蓝图变量">
              <div className="blueprint-variable-panel__header">
                <button type="button" className="project-tree__row project-tree__row--user variable-section-title">
                  <span className="project-tree__chevron">▾</span>
                  <span className="project-tree__icon">▦</span>
                  <span className="project-tree__label">变量</span>
                  <span className="project-tree__count">{variables.length}</span>
                </button>
                <button
                  type="button"
                  className="variable-add-button"
                  onClick={beginCreateVariable}
                  title="新增变量"
                >
                  ＋
                </button>
              </div>

              <div className="variable-tree">
                {variables.length > 0 ? (
                  variables.map((variable) => (
                    <div
                      key={variable.name}
                      className="variable-tree__item"
                      style={{ '--variable-color': variableColor(variable.type) } as VariableStyle}
                    >
                      <button
                        type="button"
                        className="variable-tree__main"
                        onClick={() => beginEditVariable(variable)}
                        title={`${variable.name}\n类型：${variable.type}\n默认值：${variable.defaultValue || '空'}\n${variable.reason || ''}`}
                      >
                        <span className="variable-tree__icon" />
                        <span className="variable-tree__text">
                          <strong>{variable.name}</strong>
                          <em>{variable.type}{variable.defaultValue ? ` = ${variable.defaultValue}` : ''}</em>
                        </span>
                      </button>
                      <button
                        type="button"
                        className="variable-tree__delete"
                        onClick={() => handleDeleteVariable(variable.name)}
                        title="删除变量"
                      >
                        ×
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="variable-tree__empty">暂无变量。点击 ＋ 添加，或让 AI 在 plan.variables 中生成。</p>
                )}
              </div>

              {variableFormOpen ? (
                <form className="variable-form" onSubmit={submitVariableForm}>
                  <div className="variable-form__row">
                    <label>
                      名称
                      <input
                        value={variableForm.name}
                        onChange={(event) => setVariableForm((current) => ({ ...current, name: event.target.value }))}
                        placeholder="例如 DamageRadius"
                        autoFocus
                      />
                    </label>
                    <label>
                      类型
                      <select
                        value={variableForm.type}
                        onChange={(event) => setVariableForm((current) => ({ ...current, type: event.target.value }))}
                      >
                        {VARIABLE_TYPES.map((type) => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label>
                    默认值
                    <input
                      value={variableForm.defaultValue}
                      onChange={(event) => setVariableForm((current) => ({ ...current, defaultValue: event.target.value }))}
                      placeholder="例如 300.0 / true / None"
                    />
                  </label>
                  <label>
                    说明
                    <input
                      value={variableForm.reason}
                      onChange={(event) => setVariableForm((current) => ({ ...current, reason: event.target.value }))}
                      placeholder="这个变量的用途"
                    />
                  </label>
                  <div className="variable-form__checks">
                    <label>
                      <input
                        type="checkbox"
                        checked={variableForm.instanceEditable}
                        onChange={(event) => setVariableForm((current) => ({ ...current, instanceEditable: event.target.checked }))}
                      />
                      实例可编辑
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={variableForm.exposeOnSpawn}
                        onChange={(event) => setVariableForm((current) => ({ ...current, exposeOnSpawn: event.target.checked }))}
                      />
                      生成时公开
                    </label>
                  </div>
                  <div className="variable-form__actions">
                    <button type="submit" className="nav-action">
                      {editingVariableName ? '保存变量' : '添加变量'}
                    </button>
                    <button type="button" className="nav-action" onClick={cancelVariableForm}>
                      取消
                    </button>
                  </div>
                </form>
              ) : null}
            </div>
          </div>
        </>
      ) : (
        <div className="project-sidebar__mini">
          <button type="button" className="nav-icon-button" onClick={onCreateProject} title="新建蓝图">
            ＋
          </button>
          <button type="button" className="nav-icon-button" onClick={onDuplicateProject} title="复制当前">
            ⧉
          </button>
          <button type="button" className="nav-icon-button" onClick={onDeleteProject} title="删除当前">
            ×
          </button>
          <button
            type="button"
            className="nav-icon-button"
            onClick={() => { onToggleCollapsed(); beginCreateVariable(); }}
            title="新增变量"
          >
            V
          </button>
        </div>
      )}
    </aside>
  );
}
