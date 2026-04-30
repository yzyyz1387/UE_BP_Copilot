import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';

export type ProjectDialogState =
  | {
      kind: 'create';
      userName: string;
      folderPath: string;
      name: string;
    }
  | {
      kind: 'duplicate';
      name: string;
    }
  | {
      kind: 'delete';
      name: string;
      path: string;
    };

interface ProjectDialogProps {
  dialog: ProjectDialogState | null;
  onClose: () => void;
  onCreate: (payload: { userName: string; folderPath: string; name: string }) => void;
  onDuplicate: (name: string) => void;
  onConfirmDelete: () => void;
}

interface ProjectFormState {
  userName: string;
  folderPath: string;
  name: string;
}

function clean(value: string): string {
  return value.trim();
}

export function ProjectDialog({
  dialog,
  onClose,
  onCreate,
  onDuplicate,
  onConfirmDelete,
}: ProjectDialogProps) {
  const [form, setForm] = useState<ProjectFormState>({ userName: '', folderPath: '', name: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    if (!dialog) return;
    if (dialog.kind === 'create') {
      setForm({ userName: dialog.userName, folderPath: dialog.folderPath, name: dialog.name });
    } else if (dialog.kind === 'duplicate') {
      setForm({ userName: '', folderPath: '', name: dialog.name });
    } else {
      setForm({ userName: '', folderPath: '', name: dialog.name });
    }
  }, [dialog]);

  if (!dialog) return null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (dialog.kind === 'create') {
      const userName = clean(form.userName);
      const folderPath = clean(form.folderPath);
      const name = clean(form.name);
      if (!userName || !folderPath || !name) {
        setError('用户名称、文件夹路径和蓝图名称都不能为空。');
        return;
      }
      onCreate({ userName, folderPath, name });
      return;
    }

    if (dialog.kind === 'duplicate') {
      const name = clean(form.name);
      if (!name) {
        setError('复制后的蓝图名称不能为空。');
        return;
      }
      onDuplicate(name);
    }
  };

  const title = dialog.kind === 'create'
    ? '新建本地蓝图'
    : dialog.kind === 'duplicate'
      ? '复制当前蓝图'
      : '删除当前蓝图';

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="app-dialog" role="dialog" aria-modal="true" aria-labelledby="project-dialog-title">
        <div className="app-dialog__header">
          <div>
            <strong id="project-dialog-title">{title}</strong>
            <span>
              {dialog.kind === 'create'
                ? '按“用户 / 文件夹 / 蓝图”的结构保存到浏览器本地。'
                : dialog.kind === 'duplicate'
                  ? '会复制当前蓝图内容和属性，生成一个新的本地蓝图。'
                  : '只会删除浏览器本地存储中的这份蓝图，不会影响 UE 项目。'}
            </span>
          </div>
          <button type="button" className="app-dialog__close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>

        {dialog.kind === 'delete' ? (
          <div className="app-dialog__body">
            <div className="dialog-warning">
              <strong>确定删除“{dialog.name}”？</strong>
              <span>{dialog.path}</span>
              <p>删除后会自动打开列表中的其他蓝图。这个操作无法从网页里撤销。</p>
            </div>
            <div className="app-dialog__actions">
              <button type="button" className="dialog-button" onClick={onClose}>取消</button>
              <button type="button" className="dialog-button dialog-button--danger" onClick={onConfirmDelete}>确认删除</button>
            </div>
          </div>
        ) : (
          <form className="app-dialog__body" onSubmit={handleSubmit}>
            {dialog.kind === 'create' ? (
              <>
                <label className="dialog-field">
                  <span>用户名称</span>
                  <input
                    value={form.userName}
                    onChange={(event) => setForm((current) => ({ ...current, userName: event.target.value }))}
                    placeholder="例如 默认用户 / Mod 作者 A"
                    autoFocus
                  />
                </label>
                <label className="dialog-field">
                  <span>文件夹路径</span>
                  <input
                    value={form.folderPath}
                    onChange={(event) => setForm((current) => ({ ...current, folderPath: event.target.value }))}
                    placeholder="例如 投掷物 / 角色技能 / 交互机关"
                  />
                </label>
              </>
            ) : null}

            <label className="dialog-field">
              <span>{dialog.kind === 'create' ? '蓝图名称' : '复制后的蓝图名称'}</span>
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="例如 BP_GasGrenade"
                autoFocus={dialog.kind === 'duplicate'}
              />
            </label>

            {error ? <p className="app-dialog__error">{error}</p> : null}

            <div className="app-dialog__actions">
              <button type="button" className="dialog-button" onClick={onClose}>取消</button>
              <button type="submit" className="dialog-button dialog-button--primary">
                {dialog.kind === 'create' ? '创建蓝图' : '复制蓝图'}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
