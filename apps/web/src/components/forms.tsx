'use client';
import { useActionState, useState, type ReactNode } from 'react';
import { perform, type ActionState } from '@/lib/actions';
import { Button } from '@ui/button';
export function ActionForm({
  operation,
  companyId,
  children,
  label = 'Salvar',
  action = perform,
  compact = false,
}: {
  operation?: string;
  companyId?: string;
  children?: ReactNode;
  label?: string;
  action?: (state: ActionState, form: FormData) => Promise<ActionState>;
  compact?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, { message: '' });
  return (
    <form action={formAction} className={compact ? 'inline-form' : 'action-form'}>
      {operation && <input type="hidden" name="operation" value={operation} />}
      <input type="hidden" name="companyId" value={companyId ?? ''} />
      {children}
      <Button disabled={pending} size={compact ? 'sm' : 'default'}>
        {pending ? 'Salvando…' : label}
      </Button>
      {state.message && (
        <div
          role={state.error ? 'alert' : 'status'}
          className={state.error ? 'notice error' : 'notice success'}
        >
          {state.message}
          {state.link && (
            <a href={state.link} className="result-link">
              {state.link.startsWith('/convite') ? 'Abrir convite (copie este link)' : 'Abrir →'}
            </a>
          )}
        </div>
      )}
    </form>
  );
}
export function ImportForm({
  companyId,
  accounts,
}: {
  companyId: string;
  accounts: { id: string; name: string }[];
}) {
  const [preview, previewAction, pending] = useActionState(perform, { message: '' });
  const [saved, saveAction, saving] = useActionState(perform, { message: '' });
  const [source, setSource] = useState('');
  const [filename, setFilename] = useState('');
  const [format, setFormat] = useState('CSV');
  const [account, setAccount] = useState(accounts[0]?.id ?? '');
  const [delimiter, setDelimiter] = useState(';');
  const [mapping, setMapping] = useState({
    dateColumn: 'data',
    descriptionColumn: 'descricao',
    amountColumn: 'valor',
    idColumn: '',
  });
  const [changed, setChanged] = useState(true);
  const ready = !!preview.preview && !changed;
  return (
    <form
      action={
        ready
          ? saveAction
          : async (data) => {
              setChanged(false);
              return previewAction(data);
            }
      }
      className="action-form"
    >
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="operation" value={ready ? 'import' : 'previewImport'} />
      <input type="hidden" name="source" value={source} />
      <input type="hidden" name="filename" value={filename} />
      <input type="hidden" name="previewHash" value={preview.previewHash ?? ''} />
      <label>
        Conta bancária
        <select
          aria-label="Conta bancária"
          name="bankAccountId"
          required
          value={account}
          onChange={(e) => {
            setAccount(e.target.value);
            setChanged(true);
          }}
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Formato
        <select
          name="format"
          value={format}
          onChange={(e) => {
            setFormat(e.target.value);
            setChanged(true);
          }}
        >
          <option>CSV</option>
          <option>OFX</option>
        </select>
      </label>
      <label>
        Arquivo (até 5 MB)
        <input
          type="file"
          accept=".csv,.ofx"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file && file.size <= 5000000) {
              setSource(await file.text());
              setFilename(file.name);
              setChanged(true);
            } else {
              setSource('');
              setFilename('Arquivo excede 5 MB');
            }
          }}
        />
      </label>
      {filename && <small>Arquivo selecionado: {filename}</small>}
      <details>
        <summary>Mapeamento de colunas CSV</summary>
        <div className="form-grid">
          {(
            [
              ['dateColumn', 'Coluna da data'],
              ['descriptionColumn', 'Coluna da descrição'],
              ['amountColumn', 'Coluna do valor'],
              ['idColumn', 'Identificador bancário (opcional)'],
            ] as const
          ).map(([name, label]) => (
            <label key={name}>
              {label}
              <input
                name={name}
                value={mapping[name]}
                onChange={(e) => {
                  setMapping({ ...mapping, [name]: e.target.value });
                  setChanged(true);
                }}
              />
            </label>
          ))}
          <label>
            Separador
            <select
              name="delimiter"
              value={delimiter}
              onChange={(e) => {
                setDelimiter(e.target.value);
                setChanged(true);
              }}
            >
              <option value=";">Ponto e vírgula</option>
              <option value=",">Vírgula</option>
            </select>
          </label>
        </div>
      </details>
      {ready && (
        <>
          <div className="notice">{preview.message}</div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Descrição</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {preview.preview!.accepted.slice(0, 20).map((r, i) => (
                  <tr key={i}>
                    <td>{r.date}</td>
                    <td>{r.description}</td>
                    <td>{r.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.preview!.rejected.map((r) => (
            <p className="error" key={r.line}>
              Linha {r.line}: {r.reason}
            </p>
          ))}
          <label className="checkbox">
            <input type="checkbox" name="confirm" value="yes" required />
            Revisei as linhas e confirmo a importação das válidas.
          </label>
        </>
      )}
      <Button disabled={pending || saving || !source}>
        {ready ? 'Confirmar importação' : 'Pré-visualizar arquivo'}
      </Button>
      {!ready && preview.message && <p role="alert">{preview.message}</p>}
      {saved.message && <p role="status">{saved.message}</p>}
    </form>
  );
}
