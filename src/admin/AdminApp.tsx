import { useEffect, useState, type FormEvent } from 'react';
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router';
import { BarChart3, Contact, LogOut, Settings as SettingsIcon, Users } from 'lucide-react';
import { hasSupabase } from '../backend/supabase';
import { Wordmark } from '../components/Layout';
import { Button, ErrorBox, Notice } from '../components/ui';
import { AdminDataProvider, adminRpc, adminSupabase, useAdminData, type Role } from './data';
import Dashboard from './pages/Dashboard';
import Participations from './pages/Participations';
import Report from './pages/Report';
import Contacts from './pages/Contacts';
import SettingsPage from './pages/Settings';

type Auth = { status: 'checking' } | { status: 'anon' } | { status: 'denied'; email: string } | { status: 'ok'; role: Role; email: string };

function useCreatorAuth(): [Auth, () => void] {
  const [auth, setAuth] = useState<Auth>(hasSupabase ? { status: 'checking' } : { status: 'ok', role: 'owner', email: 'anteprima locale' });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!hasSupabase) return;
    let cancelled = false;
    (async () => {
      const { data } = await (await adminSupabase()).auth.getSession();
      const user = data.session?.user;
      if (!user || user.is_anonymous) return !cancelled && setAuth({ status: 'anon' });
      try {
        // La pagina non decide nulla da sola: il ruolo arriva da creator_members tramite RPC.
        const me = await adminRpc<{ role: Role | null }>('tr_admin_me', {});
        if (!cancelled) setAuth(me.role ? { status: 'ok', role: me.role, email: user.email ?? '' } : { status: 'denied', email: user.email ?? '' });
      } catch {
        if (!cancelled) setAuth({ status: 'denied', email: user.email ?? '' });
      }
    })();
    return () => { cancelled = true; };
  }, [tick]);
  return [auth, () => setTick((x) => x + 1)];
}

function Login({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await (await adminSupabase()).auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setError('Accesso non riuscito. Controlla email e password.');
    else onDone();
  }
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4">
      <Wordmark />
      <h1 className="mt-6 text-3xl font-medium">Area creator</h1>
      <p className="mt-2 text-muted">Accesso riservato ai membri del gruppo abilitati in <code>creator_members</code>.</p>
      <form onSubmit={submit} className="mt-6 grid gap-4 rounded-2xl border border-line bg-white p-5">
        <label className="grid gap-1 text-sm font-semibold">Email
          <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className="min-h-11 rounded-xl border border-line px-3" />
        </label>
        <label className="grid gap-1 text-sm font-semibold">Password
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="min-h-11 rounded-xl border border-line px-3" />
        </label>
        <div aria-live="assertive">{error && <ErrorBox>{error}</ErrorBox>}</div>
        <Button type="submit" loading={busy}>Accedi</Button>
      </form>
    </div>
  );
}

function Shell({ role, email, onSignOut }: { role: Role; email: string; onSignOut: () => void }) {
  const { preview, status, error, reload } = useAdminData();
  const link = ({ isActive }: { isActive: boolean }) =>
    `inline-flex min-h-10 items-center gap-2 rounded-full px-3.5 text-sm font-semibold ${isActive ? 'bg-ink text-white' : 'text-ink-soft hover:bg-sand'}`;
  return (
    <div className="min-h-dvh bg-ivory">
      <header className="no-print border-b border-line/70 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3"><Wordmark /><span className="rounded-full bg-sand px-2.5 py-1 text-xs font-semibold">Area creator</span></div>
          <nav className="flex flex-wrap gap-1" aria-label="Area creator">
            <NavLink to="/admin" end className={link}><BarChart3 className="size-4" aria-hidden />Statistiche</NavLink>
            <NavLink to="/admin/partecipazioni" className={link}><Users className="size-4" aria-hidden />Partecipazioni</NavLink>
            {role === 'owner' && !preview && <NavLink to="/admin/contatti" className={link}><Contact className="size-4" aria-hidden />Contatti</NavLink>}
            <NavLink to="/admin/impostazioni" className={link}><SettingsIcon className="size-4" aria-hidden />Impostazioni</NavLink>
          </nav>
          <div className="flex items-center gap-2 text-sm text-muted">
            <span>{email} · {role}</span>
            {!preview && <button onClick={onSignOut} className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 font-medium text-ink hover:bg-sand"><LogOut className="size-4" aria-hidden />Esci</button>}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        {preview && (
          <Notice tone="warm" className="no-print mb-4">
            <strong>Anteprima locale, nessun backend configurato.</strong> Qui vedi solo le partecipazioni di prova fatte in questo browser (marcate come test). Non è un accesso ai dati live: configura Supabase per la ricerca reale.
          </Notice>
        )}
        {status === 'loading' && <p className="text-muted">Caricamento dei dati…</p>}
        {status === 'error' && <ErrorBox action={<Button variant="secondary" onClick={reload}>Riprova</Button>}>Impossibile caricare i dati: {error}</ErrorBox>}
        {status === 'ready' && (
          <Routes>
            <Route index element={<Dashboard />} />
            <Route path="partecipazioni" element={<Participations />} />
            <Route path="partecipazioni/:id" element={<Report />} />
            <Route path="contatti" element={role === 'owner' && !preview ? <Contacts /> : <Navigate to="/admin" replace />} />
            <Route path="impostazioni" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        )}
      </main>
    </div>
  );
}

export default function AdminApp() {
  const [auth, recheck] = useCreatorAuth();
  const navigate = useNavigate();
  useEffect(() => { document.documentElement.lang = 'it-IT'; document.title = 'Area creator — Travel Recovery'; }, []);

  async function signOut() {
    await (await adminSupabase()).auth.signOut();
    recheck();
    navigate('/admin');
  }

  if (auth.status === 'checking') return <p className="p-8 text-muted">Verifica dell’accesso…</p>;
  if (auth.status === 'anon') return <Login onDone={recheck} />;
  if (auth.status === 'denied') {
    return (
      <div className="mx-auto max-w-md px-4 pt-24">
        <ErrorBox>L’account {auth.email} è autenticato ma non è abilitato come creator. Chiedi a un owner di aggiungerlo a <code>creator_members</code>.</ErrorBox>
        <Button variant="secondary" className="mt-4" onClick={signOut}>Esci</Button>
      </div>
    );
  }
  return (
    <AdminDataProvider role={auth.role}>
      <Shell role={auth.role} email={auth.email} onSignOut={signOut} />
    </AdminDataProvider>
  );
}
