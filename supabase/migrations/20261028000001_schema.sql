-- Travel Recovery — Demo acquirente: schema dati, RLS e privilegi.
-- Tutte le scritture dei partecipanti passano da funzioni RPC (file 0002); i creator leggono tramite RLS.

-- ---------------------------------------------------------------- versioni e configurazione
create table public.research_versions (
  id text primary key check (char_length(id) <= 40),
  demo_version text not null,
  survey_version text not null,
  catalog_version text not null,
  notes text,
  created_at timestamptz not null default now()
);

create table public.app_config (
  id smallint primary key default 1 check (id = 1),
  collection_mode text not null default 'test' check (collection_mode in ('test', 'live')),
  current_version_id text not null references public.research_versions (id),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table public.privacy_config (
  id smallint primary key default 1 check (id = 1),
  controller_name text check (char_length(controller_name) between 1 and 300),
  contact_email text check (char_length(contact_email) between 3 and 254),
  legal_basis text check (legal_basis in ('consent', 'public_interest_research', 'legitimate_interest')),
  responses_retention_months integer check (responses_retention_months between 1 and 120),
  contacts_retention_months integer check (contacts_retention_months between 1 and 120),
  project_context text check (char_length(project_context) <= 600),
  privacy_version text check (char_length(privacy_version) between 1 and 40),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- catalogo di scenario (seed generato)
create table public.catalog_hotels (
  catalog_version text not null,
  destination_id text not null,
  original_cents integer not null check (original_cents > 0),
  sale_cents integer not null check (sale_cents > 0 and sale_cents < original_cents),
  primary key (catalog_version, destination_id)
);

create table public.catalog_origins (
  catalog_version text not null,
  origin_id text not null,
  country_id text not null check (country_id in ('IT', 'ES', 'SE')),
  primary key (catalog_version, origin_id)
);

create table public.catalog_routes (
  catalog_version text not null,
  origin_id text not null,
  destination_id text not null,
  position smallint not null check (position between 1 and 4),
  main_cents integer not null check (main_cents > 0),
  transfers_cents integer not null check (transfers_cents >= 0),
  duration_min_minutes integer not null,
  duration_max_minutes integer not null,
  primary key (catalog_version, origin_id, destination_id),
  unique (catalog_version, origin_id, position),
  foreign key (catalog_version, origin_id) references public.catalog_origins (catalog_version, origin_id),
  foreign key (catalog_version, destination_id) references public.catalog_hotels (catalog_version, destination_id)
);

create table public.survey_questions (
  survey_version text not null,
  question_id text not null,
  position smallint not null,
  kind text not null check (kind in ('single', 'multi', 'text')),
  required boolean not null,
  options text[] not null default '{}',
  min_choices integer,
  max_choices integer,
  exclusive_options text[] not null default '{}',
  other_option text,
  max_text_length integer,
  primary key (survey_version, question_id)
);

-- ---------------------------------------------------------------- partecipazioni
-- Una partecipazione è una sessione tecnica pseudonima, non una persona identificata.
create table public.research_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,               -- auth.uid() dell'identità anonima tecnica
  version_id text not null references public.research_versions (id),
  is_test boolean not null,             -- deciso dal server in base a app_config
  reference_date date not null,
  initial_locale text not null check (initial_locale in ('it', 'en', 'es', 'sv')),
  last_locale text not null check (last_locale in ('it', 'en', 'es', 'sv')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  current_search_revision integer not null default 0,
  selected_destination_id text,
  selected_search_revision integer,
  feedback_entry text,
  survey_status text not null default 'not_started' check (survey_status in ('not_started', 'in_progress', 'completed')),
  survey_locale text check (survey_locale in ('it', 'en', 'es', 'sv')),
  completed_at timestamptz,
  email_prompt_seen boolean not null default false,
  email_status text not null default 'not_shown' check (email_status in ('not_shown', 'pending', 'declined', 'submitted')),
  email_status_at timestamptz
);
create index research_sessions_owner_idx on public.research_sessions (owner_id);
create index research_sessions_created_idx on public.research_sessions (created_at);

-- Snapshot immutabile di ogni ricerca: le vecchie partecipazioni non si ricalcolano dal catalogo.
create table public.search_snapshots (
  session_id uuid not null references public.research_sessions (id) on delete cascade,
  search_revision integer not null check (search_revision >= 1),
  origin_country text not null,
  origin_id text not null,
  interval_start date not null,
  interval_end date not null,
  checkin date not null,
  checkout date not null,
  budget_cents integer check (budget_cents > 0),
  adults smallint not null default 2 check (adults = 2),
  nights smallint not null default 2 check (nights = 2),
  catalog_version text not null,
  offers jsonb not null,
  locale text not null,
  created_at timestamptz not null default now(),
  primary key (session_id, search_revision)
);

create table public.session_events (
  id bigint generated always as identity primary key,
  event_id uuid not null unique,
  dedupe_key text not null unique,
  session_id uuid not null references public.research_sessions (id) on delete cascade,
  event_type text not null check (event_type in (
    'session_started', 'preferences_submitted', 'offers_viewed', 'offer_opened', 'offer_selected',
    'checkout_started', 'simulated_payment_completed', 'simulated_transfer_completed', 'no_offer_selected',
    'feedback_started', 'survey_step_saved', 'survey_completed', 'email_prompt_viewed', 'email_declined', 'email_submitted')),
  server_received_at timestamptz not null default now(),
  client_ts timestamptz,
  search_revision integer,
  destination_id text,
  position smallint,
  locale text,
  meta jsonb not null default '{}'::jsonb check (jsonb_typeof(meta) = 'object' and pg_column_size(meta) < 400)
);
create index session_events_session_idx on public.session_events (session_id);

create table public.survey_answers (
  session_id uuid not null references public.research_sessions (id) on delete cascade,
  question_id text not null,
  survey_version text not null,
  option_ids text[] not null default '{}',
  other_text text check (char_length(other_text) <= 300),
  text_answer text check (char_length(text_answer) <= 1500),
  locale text not null check (locale in ('it', 'en', 'es', 'sv')),
  is_final boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finalized_at timestamptz,
  primary key (session_id, question_id)
);

-- ---------------------------------------------------------------- contatti (privati)
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  email_normalized text not null unique check (char_length(email_normalized) between 3 and 254),
  status text not null default 'active' check (status in ('active', 'revoked')),
  consent_version text not null,
  consented_at timestamptz not null default now(),
  revoked_at timestamptz,
  pending_request_after_revocation boolean not null default false,
  last_request_at timestamptz,
  locale text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.session_contacts (
  session_id uuid not null references public.research_sessions (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (session_id, contact_id)
);

create table public.consent_events (
  id bigint generated always as identity primary key,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  session_id uuid references public.research_sessions (id) on delete set null,
  event_type text not null check (event_type in ('consent_given', 'consent_renewed', 'request_after_revocation', 'revoked', 'reactivated_on_new_request')),
  purpose text not null default 'project_updates',
  consent_version text,
  actor text not null check (actor in ('participant', 'creator')),
  actor_id uuid,
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- creator
create table public.creator_members (
  user_id uuid primary key,
  role text not null check (role in ('owner', 'viewer')),
  label text check (char_length(label) <= 120),
  created_at timestamptz not null default now()
);

create table public.admin_actions (
  id bigint generated always as identity primary key,
  actor_id uuid not null,
  action text not null check (action in ('delete_session', 'set_test', 'revoke_contact', 'reactivate_contact', 'update_settings')),
  target_id text,
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- funzioni di supporto per RLS
create function public.tr_is_creator() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.creator_members m where m.user_id = (select auth.uid())) $$;

create function public.tr_is_owner() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.creator_members m where m.user_id = (select auth.uid()) and m.role = 'owner') $$;

create function public.tr_privacy_ready() returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select p.controller_name is not null and btrim(p.controller_name) <> ''
       and p.contact_email is not null and p.contact_email like '%@%'
       and p.legal_basis is not null
       and p.responses_retention_months is not null
       and p.contacts_retention_months is not null
       and p.privacy_version is not null and btrim(p.privacy_version) <> ''
    from public.privacy_config p where p.id = 1), false)
$$;

-- La modalità live non può essere attivata (né restare attiva) senza informativa completa.
create function public.tr_guard_live_mode() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from public.app_config c where c.id = 1 and c.collection_mode = 'live') and not public.tr_privacy_ready() then
    raise exception 'privacy_not_configured';
  end if;
  return null;
end $$;

create constraint trigger app_config_live_guard after insert or update on public.app_config
  deferrable initially deferred for each row execute function public.tr_guard_live_mode();
create constraint trigger privacy_config_live_guard after insert or update on public.privacy_config
  deferrable initially deferred for each row execute function public.tr_guard_live_mode();

create function public.tr_forbid_update() returns trigger
language plpgsql set search_path = ''
as $$ begin raise exception 'immutable_row'; end $$;
create trigger search_snapshots_immutable before update on public.search_snapshots for each row execute function public.tr_forbid_update();

-- ---------------------------------------------------------------- RLS
alter table public.research_versions enable row level security;
alter table public.app_config enable row level security;
alter table public.privacy_config enable row level security;
alter table public.catalog_hotels enable row level security;
alter table public.catalog_origins enable row level security;
alter table public.catalog_routes enable row level security;
alter table public.survey_questions enable row level security;
alter table public.research_sessions enable row level security;
alter table public.search_snapshots enable row level security;
alter table public.session_events enable row level security;
alter table public.survey_answers enable row level security;
alter table public.contacts enable row level security;
alter table public.session_contacts enable row level security;
alter table public.consent_events enable row level security;
alter table public.creator_members enable row level security;
alter table public.admin_actions enable row level security;

-- Solo SELECT: nessuna policy di INSERT/UPDATE/DELETE, quindi le scritture dirette sono negate.
create policy creators_read on public.research_versions for select to authenticated using (public.tr_is_creator());
create policy creators_read on public.app_config for select to authenticated using (public.tr_is_creator());
create policy creators_read on public.privacy_config for select to authenticated using (public.tr_is_creator());
create policy creators_read on public.catalog_hotels for select to authenticated using (public.tr_is_creator());
create policy creators_read on public.catalog_origins for select to authenticated using (public.tr_is_creator());
create policy creators_read on public.catalog_routes for select to authenticated using (public.tr_is_creator());
create policy creators_read on public.survey_questions for select to authenticated using (public.tr_is_creator());

create policy own_or_creator_read on public.research_sessions for select to authenticated
  using (owner_id = (select auth.uid()) or public.tr_is_creator());
create policy own_or_creator_read on public.search_snapshots for select to authenticated
  using (public.tr_is_creator() or exists (select 1 from public.research_sessions s where s.id = session_id and s.owner_id = (select auth.uid())));
create policy creators_read on public.session_events for select to authenticated using (public.tr_is_creator());
create policy own_or_creator_read on public.survey_answers for select to authenticated
  using (public.tr_is_creator() or exists (select 1 from public.research_sessions s where s.id = session_id and s.owner_id = (select auth.uid())));

-- Contatti: soltanto creator con ruolo owner.
create policy owners_read on public.contacts for select to authenticated using (public.tr_is_owner());
create policy owners_read on public.session_contacts for select to authenticated using (public.tr_is_owner());
create policy owners_read on public.consent_events for select to authenticated using (public.tr_is_owner());
create policy owners_read on public.admin_actions for select to authenticated using (public.tr_is_owner());
create policy self_or_owner_read on public.creator_members for select to authenticated
  using (user_id = (select auth.uid()) or public.tr_is_owner());

-- ---------------------------------------------------------------- privilegi minimi
revoke all on all tables in schema public from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;
grant select on all tables in schema public to authenticated;
