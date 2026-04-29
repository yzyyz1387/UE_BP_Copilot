import { useEffect, useMemo, useState } from 'react';
import type { BlueprintLibrary, BlueprintProject } from '../types';

interface ProjectSidebarProps {
  library: BlueprintLibrary;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onSelectProject: (projectId: string) => void;
  onCreateProject: () => void;
  onDuplicateProject: () => void;
  onDeleteProject: () => void;
}

interface FolderGroup {
  folderPath: string;
  projects: BlueprintProject[];
}

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

export function ProjectSidebar({
  library,
  collapsed,
  onToggleCollapsed,
  onSelectProject,
  onCreateProject,
  onDuplicateProject,
  onDeleteProject,
}: ProjectSidebarProps) {
  const activeProject = library.projects.find((project) => project.id === library.activeProjectId) ?? library.projects[0];
  const grouped = useMemo(() => groupProjects(library.projects), [library.projects]);
  const [openUsers, setOpenUsers] = useState<Record<string, boolean>>({});
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});

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
        </div>
      )}
    </aside>
  );
}
