import type { ReactNode } from 'react';
export function Field({
  name,
  label,
  type = 'text',
  value,
  required = true,
  placeholder,
}: {
  name: string;
  label: string;
  type?: string;
  value?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label>
      {label}
      <input
        aria-label={label}
        name={name}
        type={type}
        defaultValue={value}
        required={required}
        placeholder={placeholder}
        step={type === 'number' ? '0.01' : undefined}
      />
    </label>
  );
}
export function Select({
  name,
  label,
  options,
  optional = false,
}: {
  name: string;
  label: string;
  options: { id: string; name: string }[];
  optional?: boolean;
}) {
  return (
    <label>
      {label}
      <select aria-label={label} name={name} required={!optional}>
        {optional && <option value="">Não informado</option>}
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}
export function Hidden({ name, value }: { name: string; value: string }) {
  return <input type="hidden" name={name} value={value} />;
}
export function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="card">
      <div className="card-heading">
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {children}
    </section>
  );
}
export function Empty({
  title = 'Nada por aqui ainda',
  description = 'Os registros aparecerão aqui assim que forem cadastrados.',
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">○</span>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
