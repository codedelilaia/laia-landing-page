import type { DashboardModule } from '../../types/dashboard';

interface StatusModuleProps {
  module: DashboardModule;
  editable?: boolean;
  onSave?: (items: string[]) => Promise<void>;
}

export function StatusModule({ module, editable = false, onSave }: StatusModuleProps) {
  const items = ((module.payload as any).items ?? []) as string[];
  const handleEdit = async () => {
    if (!editable || !onSave) return;
    const next = window.prompt(`Update ${module.title}`, items.join('\n'));
    if (next === null) return;
    await onSave(
      next
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean),
    );
  };

  return (
    <section className="panel" data-testid={`module-${module.id}`} data-module-id={module.id}>
      <div className="module-header">
        <div>
          <h2 className="section-title">{module.title}</h2>
          {module.summary ? <p className="tab-intro">{module.summary}</p> : null}
        </div>
        {editable ? (
          <button className="ghost-button" onClick={handleEdit} type="button">
            Edit
          </button>
        ) : null}
      </div>
      <ul className="status-list">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
