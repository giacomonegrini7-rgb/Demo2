import { useState } from 'react';
import { Link } from 'react-router';
import { Download } from 'lucide-react';
import { Button } from '../../components/ui';
import { EMAIL_LABEL, FilterBar, LOCALE_LABEL, Panel, STAGE_LABEL } from '../components';
import { useAdminData } from '../data';
import { chosenDestination } from '../stats';
import { cityItName, download, originItName, participationsCsv, stamp } from '../exports';

const PAGE = 50;

export default function Participations() {
  const { filtered, role, preview, settings } = useAdminData();
  const [page, setPage] = useState(0);
  const [includeEmail, setIncludeEmail] = useState(false);
  const sorted = [...filtered].sort((a, b) => b.s.created_at.localeCompare(a.s.created_at));
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE));
  const rows = sorted.slice(page * PAGE, page * PAGE + PAGE);

  function exportCsv() {
    // tutte le righe filtrate, non solo la pagina corrente
    download(`travel-recovery_partecipazioni_${settings?.versionId ?? ''}_${stamp()}${includeEmail ? '_con-email' : ''}.csv`, participationsCsv(sorted, { includeEmail }));
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-medium">Partecipazioni</h1>
          <p className="text-sm text-muted">{sorted.length} partecipazioni (sessioni pseudonime, non persone identificate).</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {role === 'owner' && !preview && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={includeEmail} onChange={(e) => setIncludeEmail(e.target.checked)} className="size-4 accent-[#176b63]" />
              Includi le email nell’export
            </label>
          )}
          <Button variant="secondary" onClick={exportCsv} icon={<Download className="size-4" aria-hidden />}>CSV questionari ({sorted.length})</Button>
        </div>
      </div>
      <FilterBar />
      <Panel title="Elenco">
        {rows.length === 0 ? <p className="text-sm text-muted">Nessuna partecipazione con questi filtri.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="text-left text-ink-soft">
                  <th className="p-2">Codice</th><th className="p-2">Avvio (UTC)</th><th className="p-2">Dati</th><th className="p-2">Lingua</th>
                  <th className="p-2">Partenza</th><th className="p-2">Scelta</th><th className="p-2">Stato demo</th><th className="p-2">Questionario</th><th className="p-2">Email</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((v) => (
                  <tr key={v.s.id} className="border-t border-line/70 hover:bg-sand/40">
                    <td className="p-2 font-semibold"><Link to={`/admin/partecipazioni/${v.s.id}`} className="text-petrol-dark underline underline-offset-2">{v.s.id.slice(0, 8).toUpperCase()}</Link></td>
                    <td className="p-2 tabular">{v.s.created_at.slice(0, 16).replace('T', ' ')}</td>
                    <td className="p-2">{v.s.is_test ? 'test' : 'live'}</td>
                    <td className="p-2">{LOCALE_LABEL[v.s.initial_locale]}</td>
                    <td className="p-2">{originItName(v.latest?.origin_id) || '—'}</td>
                    <td className="p-2">{cityItName(chosenDestination(v)) || (v.noOffer ? 'nessuna proposta' : '—')}</td>
                    <td className="p-2">{STAGE_LABEL[v.stage]}</td>
                    <td className="p-2">{v.s.survey_status === 'completed' ? 'completato' : v.s.survey_status === 'in_progress' ? 'in corso' : 'non iniziato'}</td>
                    <td className="p-2">{EMAIL_LABEL[v.s.email_status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 && (
          <div className="mt-3 flex items-center gap-2 text-sm">
            <Button variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Precedente</Button>
            <span className="tabular">Pagina {page + 1} di {pages}</span>
            <Button variant="secondary" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Successiva</Button>
          </div>
        )}
      </Panel>
    </div>
  );
}
