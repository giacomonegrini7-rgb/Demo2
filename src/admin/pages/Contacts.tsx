import { useState } from 'react';
import { Link } from 'react-router';
import { Download } from 'lucide-react';
import { Button, ErrorBox } from '../../components/ui';
import { Panel } from '../components';
import { adminRpc, useAdminData } from '../data';
import { contactsCsv, download, stamp } from '../exports';

export default function Contacts() {
  const { dataset, views, reload, settings } = useAdminData();
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const contacts = dataset?.contacts ?? [];
  const links = dataset?.sessionContacts ?? [];
  const consent = dataset?.consentEvents ?? [];
  const shown = contacts.filter((c) => !query || c.email_normalized.includes(query.trim().toLowerCase()));

  async function act(fn: string, id: string, note: string) {
    setBusy(id);
    setError(null);
    try {
      await adminRpc(fn, { p_contact_id: id, p_note: note });
      reload();
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-medium">Contatti</h1>
          <p className="text-sm text-muted">{contacts.length} indirizzi unici normalizzati, {contacts.filter((c) => c.status === 'active').length} con consenso attivo. Email non verificate (nessuna verifica di possesso).</p>
        </div>
        <Button variant="secondary" onClick={() => download(`travel-recovery_contatti_${settings?.versionId ?? ''}_${stamp()}.csv`, contactsCsv(contacts, links, consent, views))} icon={<Download className="size-4" aria-hidden />}>CSV contatti</Button>
      </div>
      <div aria-live="assertive">{error && <ErrorBox>{error}</ErrorBox>}</div>
      <Panel title="Elenco riservato" note="Una revoca non viene annullata da un nuovo invio: la nuova richiesta compare come «richiesta dopo revoca» e va riattivata solo esplicitamente. Revocare gli aggiornamenti non cancella le risposte al questionario.">
        <label className="mb-3 grid max-w-sm gap-1 text-xs font-semibold text-ink-soft">Cerca email
          <input value={query} onChange={(e) => setQuery(e.target.value)} className="min-h-10 rounded-lg border border-line px-3 text-sm font-normal" />
        </label>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead><tr className="text-left text-ink-soft"><th className="p-2">Email</th><th className="p-2">Stato</th><th className="p-2">Consenso</th><th className="p-2">Partecipazioni</th><th className="p-2">Azioni</th></tr></thead>
            <tbody>
              {shown.map((c) => {
                const ls = links.filter((l) => l.contact_id === c.id);
                return (
                  <tr key={c.id} className="border-t border-line/70 align-top">
                    <td className="p-2 break-all">{c.email_normalized}</td>
                    <td className="p-2">{c.status === 'active' ? 'attivo' : 'revocato'}{c.pending_request_after_revocation && <span className="mt-1 block rounded bg-terracotta-tint px-1.5 py-0.5 text-xs text-terracotta-text">richiesta dopo revoca ({c.last_request_at?.slice(0, 10)})</span>}</td>
                    <td className="p-2 text-xs">{c.consent_version}<br />{c.consented_at.slice(0, 10)}{c.revoked_at && <><br />revoca {c.revoked_at.slice(0, 10)}</>}</td>
                    <td className="p-2 text-xs">{ls.map((l) => <Link key={l.session_id} to={`/admin/partecipazioni/${l.session_id}`} className="mr-2 underline">{l.session_id.slice(0, 8).toUpperCase()}</Link>)}</td>
                    <td className="p-2">
                      {c.status === 'active' && <Button variant="secondary" loading={busy === c.id} onClick={() => window.confirm(`Revocare il consenso di ${c.email_normalized}?`) && act('tr_admin_revoke_contact', c.id, 'Revoca registrata dall’area creator')}>Registra revoca</Button>}
                      {c.status === 'revoked' && c.pending_request_after_revocation && <Button variant="secondary" loading={busy === c.id} onClick={() => window.confirm('Riattivare il contatto in base alla nuova richiesta esplicita?') && act('tr_admin_reactivate_contact', c.id, 'Riattivato su nuova richiesta esplicita')}>Riattiva su nuova richiesta</Button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
