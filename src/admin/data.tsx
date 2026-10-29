import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { hasSupabase, makeClient, toBackendError } from '../backend/supabase';
import { loadPreviewDb } from '../backend/preview';
import { applyFilters, buildViews, EMPTY_FILTERS, type Dataset, type Filters, type SessionView } from './stats';
import { RESEARCH_VERSION_ID } from '../data/versions';

export type Role = 'owner' | 'viewer';

let client: Promise<SupabaseClient> | null = null;
export function adminSupabase(): Promise<SupabaseClient> {
  client ??= makeClient('tr-creator-auth');
  return client;
}

/** Legge tutte le righe (non solo la prima pagina): le policy RLS decidono cosa è visibile. */
async function fetchAll<T>(table: string, order: string): Promise<T[]> {
  const out: T[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await (await adminSupabase()).from(table).select('*').order(order, { ascending: true }).range(from, from + page - 1);
    if (error) throw toBackendError(error);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < page) break;
  }
  return out;
}

export interface Settings {
  mode: 'test' | 'live' | 'preview';
  versionId: string;
  versions: { id: string; demo_version: string; survey_version: string; catalog_version: string; created_at: string }[];
  privacy: Record<string, string | number | null>;
}

async function loadRemote(role: Role): Promise<{ dataset: Dataset; settings: Settings }> {
  const [sessions, snapshots, events, answers, cfg, privacy, versions] = await Promise.all([
    fetchAll<Dataset['sessions'][number]>('research_sessions', 'created_at'),
    fetchAll<Dataset['snapshots'][number]>('search_snapshots', 'created_at'),
    fetchAll<Dataset['events'][number]>('session_events', 'id'),
    fetchAll<Dataset['answers'][number]>('survey_answers', 'created_at'),
    fetchAll<{ collection_mode: 'test' | 'live'; current_version_id: string }>('app_config', 'id'),
    fetchAll<Record<string, string | number | null>>('privacy_config', 'id'),
    fetchAll<Settings['versions'][number]>('research_versions', 'created_at'),
  ]);
  let contacts = null, sessionContacts = null, consentEvents = null;
  if (role === 'owner') {
    [contacts, sessionContacts, consentEvents] = await Promise.all([
      fetchAll<NonNullable<Dataset['contacts']>[number]>('contacts', 'created_at'),
      fetchAll<NonNullable<Dataset['sessionContacts']>[number]>('session_contacts', 'created_at'),
      fetchAll<NonNullable<Dataset['consentEvents']>[number]>('consent_events', 'id'),
    ]);
  }
  return {
    dataset: { sessions, snapshots, events, answers, contacts, sessionContacts, consentEvents },
    settings: { mode: cfg[0]?.collection_mode ?? 'test', versionId: cfg[0]?.current_version_id ?? '', versions, privacy: privacy[0] ?? {} },
  };
}

function loadLocal(): { dataset: Dataset; settings: Settings } {
  const db = loadPreviewDb();
  return {
    dataset: { sessions: db.sessions, snapshots: db.snapshots, events: db.events, answers: db.answers, contacts: null, sessionContacts: null, consentEvents: null },
    settings: { mode: 'preview', versionId: RESEARCH_VERSION_ID, versions: [], privacy: {} },
  };
}

export async function adminRpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await (await adminSupabase()).rpc(fn, args);
  if (error) throw toBackendError(error);
  return data as T;
}

interface AdminData {
  preview: boolean;
  role: Role;
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  dataset: Dataset | null;
  settings: Settings | null;
  views: SessionView[];
  filtered: SessionView[];
  filters: Filters;
  setFilters: (f: Filters) => void;
  reload: () => void;
}

const Ctx = createContext<AdminData | null>(null);
const FILTER_KEY = 'tr-admin-filters';

export function AdminDataProvider({ role, children }: { role: Role; children: ReactNode }) {
  const preview = !hasSupabase;
  const [status, setStatus] = useState<AdminData['status']>('loading');
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{ dataset: Dataset; settings: Settings } | null>(null);
  const [filters, setFiltersState] = useState<Filters>(() => {
    try {
      const saved = sessionStorage.getItem(FILTER_KEY);
      if (saved) return { ...EMPTY_FILTERS, ...JSON.parse(saved) };
    } catch { /* ignorato */ }
    return preview ? { ...EMPTY_FILTERS, data: 'test' } : EMPTY_FILTERS;
  });

  const reload = useCallback(() => {
    setStatus('loading');
    setError(null);
    (preview ? Promise.resolve(loadLocal()) : loadRemote(role)).then(
      (d) => { setData(d); setStatus('ready'); },
      (e) => { setError(String(e?.message ?? e)); setStatus('error'); },
    );
  }, [preview, role]);
  useEffect(reload, [reload]);

  const setFilters = useCallback((f: Filters) => {
    setFiltersState(f);
    try { sessionStorage.setItem(FILTER_KEY, JSON.stringify(f)); } catch { /* ignorato */ }
  }, []);

  const views = useMemo(() => (data ? buildViews(data.dataset) : []), [data]);
  const filtered = useMemo(() => applyFilters(views, filters), [views, filters]);

  const value: AdminData = { preview, role, status, error, dataset: data?.dataset ?? null, settings: data?.settings ?? null, views, filtered, filters, setFilters, reload };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdminData(): AdminData {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAdminData outside provider');
  return v;
}
