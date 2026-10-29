import { useState, type FormEvent } from 'react';
import { CheckCircle2, CircleAlert } from 'lucide-react';
import { Button, ErrorBox, Notice } from '../../components/ui';
import { Panel } from '../components';
import { adminRpc, useAdminData } from '../data';
import { clearPreviewDb } from '../../backend/preview';
import { CATALOG_VERSION } from '../../data/catalog';
import { SURVEY_VERSION } from '../../survey/definition';
import { DEMO_VERSION } from '../../data/versions';

const FIELDS = [
  { key: 'controller_name', api: 'controllerName', label: 'Soggetto responsabile della ricerca/raccolta', required: true, placeholder: 'es. Gruppo di studenti … (nome e cognome dei referenti)' },
  { key: 'contact_email', api: 'contactEmail', label: 'Email di contatto per richieste e revoche', required: true, placeholder: '' },
  { key: 'responses_retention_months', api: 'responsesRetentionMonths', label: 'Conservazione risposte (mesi)', required: true, placeholder: 'da decidere nel gruppo' },
  { key: 'contacts_retention_months', api: 'contactsRetentionMonths', label: 'Conservazione email (mesi)', required: true, placeholder: 'da decidere nel gruppo' },
  { key: 'privacy_version', api: 'privacyVersion', label: 'Versione dell’informativa', required: true, placeholder: 'es. 2026-11-v1' },
  { key: 'project_context', api: 'projectContext', label: 'Contesto del progetto (facoltativo, mostrato così com’è)', required: false, placeholder: 'es. corso, docente di riferimento' },
] as const;

export default function SettingsPage() {
  const { settings, role, preview, reload } = useAdminData();
  const p = settings?.privacy ?? {};
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries([...FIELDS.map((f) => [f.api, p[f.key] == null ? '' : String(p[f.key])]), ['legalBasis', p.legal_basis == null ? '' : String(p.legal_basis)]]));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const owner = role === 'owner' && !preview;
  const missing = [...FIELDS.filter((f) => f.required && !values[f.api]?.trim()).map((f) => f.label), ...(values.legalBasis ? [] : ['Base giuridica'])];

  async function save(mode: 'test' | 'live') {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await adminRpc('tr_admin_update_settings', { p_mode: mode, p_privacy: values });
      setSaved(true);
      reload();
    } catch (e) {
      const m = String((e as Error).message);
      setError(m.includes('privacy_not_configured') ? 'La modalità live richiede tutti i campi obbligatori dell’informativa.' : m);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5">
      <h1 className="text-3xl font-medium">Impostazioni</h1>
      {preview ? (
        <Panel title="Anteprima locale">
          <p className="text-sm text-muted">Nessun backend configurato: la modalità è «anteprima». Per raccogliere dati reali segui il README (variabili VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY).</p>
          <Button variant="secondary" className="mt-3" onClick={() => { if (window.confirm('Cancellare le partecipazioni di prova salvate in questo browser?')) { clearPreviewDb(); reload(); } }}>Cancella i dati di prova locali</Button>
        </Panel>
      ) : (
        <Panel title="Modalità di raccolta">
          <p className="text-sm">Modalità attuale: <strong>{settings?.mode === 'live' ? 'Ricerca live' : 'Test con backend'}</strong>. In modalità test ogni nuova partecipazione è salvata con <code>is_test = true</code> ed esclusa dalle statistiche di default. La modalità è decisa dal server, non dal browser dei partecipanti.</p>
          {missing.length > 0 ? (
            <Notice tone="warm" className="mt-3" icon={<CircleAlert className="size-[1.1rem]" />}>
              <p className="font-semibold">Mancano dati per attivare la raccolta live:</p>
              <ul className="list-disc pl-5">{missing.map((m) => <li key={m}>{m}</li>)}</ul>
            </Notice>
          ) : (
            <p className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-petrol-dark"><CheckCircle2 className="size-4" aria-hidden />Informativa completa: la modalità live può essere attivata.</p>
          )}
        </Panel>
      )}

      <Panel title="Informativa privacy" note="Questi valori compaiono nella pagina pubblica /privacy solo quando sono tutti compilati. Non vanno inventati: decidetelo nel gruppo (e con il docente se serve). L’app non dichiara conformità o approvazioni etiche.">
        <form className="grid gap-4" onSubmit={(e: FormEvent) => { e.preventDefault(); void save(settings?.mode === 'live' ? 'live' : 'test'); }}>
          <div className="grid gap-4 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <label key={f.key} className="grid gap-1 text-sm font-semibold">{f.label}{f.required && ' *'}
                <input disabled={!owner} value={values[f.api]} placeholder={f.placeholder} inputMode={f.key.includes('months') ? 'numeric' : undefined}
                  onChange={(e) => setValues({ ...values, [f.api]: e.target.value })} className="min-h-10 rounded-lg border border-line px-3 font-normal disabled:bg-sand/40" />
              </label>
            ))}
            <label className="grid gap-1 text-sm font-semibold">Base giuridica * (da confermare)
              <select disabled={!owner} value={values.legalBasis} onChange={(e) => setValues({ ...values, legalBasis: e.target.value })} className="min-h-10 rounded-lg border border-line px-3 font-normal disabled:bg-sand/40">
                <option value="">— da scegliere —</option>
                <option value="consent">Consenso</option>
                <option value="public_interest_research">Attività di ricerca</option>
                <option value="legitimate_interest">Interesse legittimo</option>
              </select>
            </label>
          </div>
          <div aria-live="assertive">{error && <ErrorBox>{error}</ErrorBox>}{saved && <p className="text-sm font-semibold text-petrol-dark">Impostazioni salvate.</p>}</div>
          {owner && (
            <div className="flex flex-wrap gap-2">
              <Button type="submit" loading={busy}>Salva informativa</Button>
              {settings?.mode === 'live'
                ? <Button type="button" variant="secondary" loading={busy} onClick={() => save('test')}>Torna in modalità test</Button>
                : <Button type="button" variant="secondary" loading={busy} disabled={missing.length > 0} onClick={() => window.confirm('Attivare la raccolta live? Le nuove partecipazioni entreranno nelle statistiche di ricerca.') && save('live')}>Attiva la raccolta live</Button>}
            </div>
          )}
          {!owner && !preview && <p className="text-sm text-muted">Solo il ruolo owner può modificare queste impostazioni.</p>}
        </form>
      </Panel>

      <Panel title="Versioni">
        <ul className="text-sm">
          <li>Versione della ricerca attiva: <strong>{settings?.versionId}</strong></li>
          <li>Demo nel codice: {DEMO_VERSION} · questionario {SURVEY_VERSION} · catalogo {CATALOG_VERSION}</li>
          {settings?.versions.map((v) => <li key={v.id} className="text-muted">{v.id}: {v.demo_version}, {v.survey_version}, {v.catalog_version} (dal {v.created_at.slice(0, 10)})</li>)}
        </ul>
        <p className="mt-2 text-xs text-muted">Per una nuova iterazione: aggiornare src/data/versions.ts, rigenerare il seed (npm run gen:sql) e aggiornare app_config.current_version_id (vedi README).</p>
      </Panel>
    </div>
  );
}
