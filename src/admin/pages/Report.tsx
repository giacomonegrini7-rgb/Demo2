import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, Download, Printer, Trash2 } from 'lucide-react';
import it from '../../i18n/it';
import { HOTELS, type DestinationId } from '../../data/catalog';
import { QUESTIONS } from '../../survey/definition';
import { Button, ErrorBox } from '../../components/ui';
import { EMAIL_LABEL, ENTRY_LABEL, LOCALE_LABEL, Panel, STAGE_LABEL } from '../components';
import { adminRpc, useAdminData } from '../data';
import { chosenDestination, factsSummary, NEGATIVE_OPTIONS } from '../stats';
import { download, optionLabel, originItName } from '../exports';

const eur = (c: number) => `${(c / 100).toLocaleString('it-IT')} €`;
const city = (d: DestinationId) => HOTELS[d].city.it;
const EVENT_LABEL: Record<string, string> = {
  session_started: 'Avvio partecipazione', preferences_submitted: 'Preferenze inviate', offers_viewed: 'Offerte visualizzate',
  offer_opened: 'Offerta aperta', offer_selected: 'Offerta scelta', checkout_started: 'Checkout iniziato',
  simulated_payment_completed: 'Pagamento simulato', simulated_transfer_completed: 'Trasferimento simulato', no_offer_selected: '«Nessuna proposta fa per me»',
  feedback_started: 'Questionario iniziato', survey_step_saved: 'Bozza risposta salvata', survey_completed: 'Questionario inviato',
  email_prompt_viewed: 'Richiesta email vista', email_declined: 'Email saltata', email_submitted: 'Email inviata',
};

export default function Report() {
  const { id } = useParams();
  const { views, role, preview, reload } = useAdminData();
  const navigate = useNavigate();
  const v = views.find((x) => x.s.id === id);
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!v) return <ErrorBox>Partecipazione non trovata (forse cancellata o filtrata dai permessi).</ErrorBox>;
  const s = v.s;
  const completed = s.survey_status === 'completed';
  const canEdit = role === 'owner' && !preview;

  async function act(fn: string, args: Record<string, unknown>, after?: () => void) {
    setBusy(true);
    setError(null);
    try {
      await adminRpc(fn, args);
      after?.();
      reload();
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  function exportJson() {
    const payload = { session: s, snapshots: v!.snapshots, events: v!.events, answers: Object.values(v!.answers), contacts: canEdit ? v!.emails : undefined };
    download(`travel-recovery_partecipazione_${s.id.slice(0, 8)}.json`, JSON.stringify(payload, null, 2), 'application/json');
  }

  return (
    <div className="grid gap-5">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link to="/admin/partecipazioni" className="inline-flex min-h-10 items-center gap-2 text-sm font-medium text-ink-soft hover:text-ink"><ArrowLeft className="size-4" aria-hidden />Tutte le partecipazioni</Link>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => window.print()} icon={<Printer className="size-4" aria-hidden />}>Stampa / PDF</Button>
          <Button variant="secondary" onClick={exportJson} icon={<Download className="size-4" aria-hidden />}>JSON</Button>
        </div>
      </div>

      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-terracotta-text">Partecipazione {s.is_test ? '· test' : '· live'}</p>
        <h1 className="text-3xl font-medium tabular">{s.id.slice(0, 8).toUpperCase()}</h1>
        <p className="text-sm text-muted">ID completo {s.id} · avvio {s.created_at.replace('T', ' ').slice(0, 19)} UTC · versione {s.version_id} · lingua iniziale {LOCALE_LABEL[s.initial_locale]}, finale {LOCALE_LABEL[s.last_locale]}{s.survey_locale ? `, questionario in ${LOCALE_LABEL[s.survey_locale]}` : ''}</p>
      </header>

      <Panel title="Riepilogo dei fatti" note="Elenco deterministico ricavato dagli eventi registrati: nessuna interpretazione o etichetta automatica.">
        <p className="text-[0.97rem]">{factsSummary(v, city).join('; ')}.</p>
        <ul className="mt-3 flex flex-wrap gap-2 text-xs">
          <li className="rounded-full bg-sand px-2.5 py-1">Stato demo: {STAGE_LABEL[v.stage]}</li>
          <li className="rounded-full bg-sand px-2.5 py-1">Ingresso al feedback: {v.feedbackEntry ? ENTRY_LABEL[v.feedbackEntry] ?? v.feedbackEntry : '—'}</li>
          <li className="rounded-full bg-sand px-2.5 py-1">Email: {EMAIL_LABEL[s.email_status]}</li>
        </ul>
      </Panel>

      <Panel title={`Ricerche (${v.snapshots.length})`} note="Valori «fotografati» al momento della ricerca: non ricalcolati dal catalogo attuale. Configurazione fissa: 2 adulti, 2 notti, camera doppia.">
        {v.snapshots.length === 0 ? <p className="text-sm text-muted">Nessuna ricerca inviata.</p> : v.snapshots.map((sn) => (
          <div key={sn.search_revision} className="mb-4 last:mb-0">
            <p className="mb-2 text-sm"><strong>Revisione {sn.search_revision}</strong> · partenza {originItName(sn.origin_id)} ({sn.origin_country}) · disponibilità {sn.interval_start} → {sn.interval_end} · soggiorno {sn.checkin} → {sn.checkout} · budget {sn.budget_cents != null ? eur(sn.budget_cents) : 'non indicato'}</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-sm">
                <thead><tr className="text-left text-ink-soft"><th className="p-1.5">Pos.</th><th className="p-1.5">Meta</th><th className="p-1.5">Originale</th><th className="p-1.5">Vendita</th><th className="p-1.5">Risparmio</th><th className="p-1.5">Trasporto</th><th className="p-1.5">Totale</th><th className="p-1.5">Budget</th><th className="p-1.5">Aperta</th></tr></thead>
                <tbody>
                  {sn.offers.map((o) => (
                    <tr key={o.destinationId} className="border-t border-line/70">
                      <td className="p-1.5">{o.position}</td><td className="p-1.5">{city(o.destinationId)}</td>
                      <td className="p-1.5 tabular">{eur(o.hotelOriginalCents)}</td><td className="p-1.5 tabular">{eur(o.hotelSaleCents)}</td>
                      <td className="p-1.5 tabular">{eur(o.hotelSavingsCents)} ({(o.hotelSavingsPercentX10 / 10).toLocaleString('it-IT')}%)</td>
                      <td className="p-1.5 tabular">{eur(o.transportTotalCents)}</td><td className="p-1.5 tabular">{eur(o.tripTotalCents)}</td>
                      <td className="p-1.5">{o.withinBudget == null ? '—' : o.withinBudget ? 'dentro' : 'fuori'}</td>
                      <td className="p-1.5">{v.events.some((e) => e.event_type === 'offer_opened' && e.search_revision === sn.search_revision && e.destination_id === o.destinationId) ? 'sì' : 'no'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
        <p className="mt-2 text-sm">Scelta finale: <strong>{chosenDestination(v) ? city(chosenDestination(v)!) : 'nessuna'}</strong></p>
      </Panel>

      <Panel title="Questionario">
        {s.survey_status === 'not_started' && <p className="mb-3 text-sm text-muted">Questionario non iniziato.</p>}
        <ol className="grid gap-4">
          {QUESTIONS.map((q) => {
            const a = v.answers[q.id];
            const text = it.survey.questions[q.id];
            let body;
            if (!a || (!completed && !a.option_ids.length && !a.text_answer)) body = <span className="rounded bg-sand px-2 py-0.5 text-xs">{completed ? 'nessuna risposta' : 'non ancora risposta'}</span>;
            else if (q.kind === 'text') body = a.text_answer ? <p className="whitespace-pre-wrap break-words rounded-lg bg-sand/60 p-3">{a.text_answer}</p> : <span className="rounded bg-sand px-2 py-0.5 text-xs">facoltativa, lasciata vuota</span>;
            else body = (
              <ul className="grid gap-1">
                {a.option_ids.map((o) => (
                  <li key={o}>• {optionLabel(q.id, o)} <span className="text-xs text-muted">({o})</span>{NEGATIVE_OPTIONS.has(o) && <span className="ml-2 rounded bg-terracotta-tint px-1.5 py-0.5 text-xs text-terracotta-text">risposta negativa</span>}</li>
                ))}
                {a.other_text && <li className="ml-3 text-ink-soft">Altro: «{a.other_text}»</li>}
              </ul>
            );
            return (
              <li key={q.id} className="print-break border-t border-line/70 pt-3 text-sm">
                <p className="font-semibold">{q.id.toUpperCase()} — {text.title}{!q.required && ' (facoltativa)'}{a && !a.is_final && completed === false && <span className="ml-2 text-xs font-normal text-muted">bozza</span>}</p>
                <p className="mb-2 text-ink-soft">{text.text}</p>
                {body}
              </li>
            );
          })}
        </ol>
      </Panel>

      {role === 'owner' && !preview && (
        <Panel title="Contatto">
          {v.emails.length === 0 ? <p className="text-sm text-muted">Nessuna email collegata.</p> : (
            <ul className="text-sm">{v.emails.map((c) => <li key={c.id}>{c.email_normalized} — {c.status === 'active' ? 'consenso attivo' : 'revocato'} · versione consenso {c.consent_version} · <Link className="underline" to="/admin/contatti">gestisci</Link></li>)}</ul>
          )}
        </Panel>
      )}

      <Panel title={`Cronologia (${v.events.length} eventi)`} note="Eventi registrati dal server. Non sono prova di transazioni o verifiche reali.">
        <ol className="grid gap-1 text-sm">
          {v.events.map((e) => (
            <li key={e.id} className="flex flex-wrap gap-x-3"><span className="tabular text-muted">{e.server_received_at.replace('T', ' ').slice(0, 19)}</span><span>{EVENT_LABEL[e.event_type] ?? e.event_type}</span>{e.destination_id && <span className="text-ink-soft">{city(e.destination_id)}{e.position ? ` (pos. ${e.position})` : ''}</span>}{e.search_revision && <span className="text-muted">rev. {e.search_revision}</span>}{e.meta?.entry && <span className="text-muted">da {e.meta.entry}</span>}</li>
          ))}
        </ol>
      </Panel>

      {canEdit && (
        <Panel title="Gestione" className="no-print">
          <div aria-live="assertive">{error && <ErrorBox>{error}</ErrorBox>}</div>
          <div className="mt-2 flex flex-wrap gap-3">
            <Button variant="secondary" loading={busy} onClick={() => act('tr_admin_set_test', { p_session_id: s.id, p_is_test: !s.is_test, p_note: 'Modificato dall’area creator' })}>
              {s.is_test ? 'Segna come partecipazione live' : 'Segna come prova del gruppo (test)'}
            </Button>
            {!confirming ? (
              <Button variant="secondary" onClick={() => setConfirming(true)} icon={<Trash2 className="size-4" aria-hidden />}>Cancella partecipazione…</Button>
            ) : (
              <div className="grid w-full gap-2 rounded-xl border border-danger/30 bg-danger-tint p-4">
                <label className="grid gap-1 text-sm font-semibold">Motivo della cancellazione (resta traccia minima: ID e nota)
                  <input value={note} onChange={(e) => setNote(e.target.value)} className="min-h-10 rounded-lg border border-line bg-white px-3 font-normal" placeholder="es. richiesta del partecipante via email" />
                </label>
                <p className="text-xs text-ink-soft">Elimina definitivamente ricerche, eventi e risposte di questa partecipazione. Il contatto email, se presente, resta e va gestito dalla pagina Contatti.</p>
                <div className="flex gap-2">
                  <Button disabled={note.trim().length < 3} loading={busy} onClick={() => act('tr_admin_delete_session', { p_session_id: s.id, p_note: note }, () => navigate('/admin/partecipazioni'))}>Conferma cancellazione</Button>
                  <Button variant="secondary" onClick={() => setConfirming(false)}>Annulla</Button>
                </div>
              </div>
            )}
          </div>
        </Panel>
      )}
    </div>
  );
}
