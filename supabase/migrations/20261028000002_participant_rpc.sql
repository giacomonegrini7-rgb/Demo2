-- Funzioni RPC per i partecipanti (identità anonima tecnica di Supabase).
-- Tutte SECURITY DEFINER con search_path vuoto: verificano auth.uid(), proprietario della sessione e payload.
-- Il client non può scegliere owner_id, is_test, completed_at, prezzi o esiti.

-- ---------------------------------------------------------------- helper interni (nessun EXECUTE pubblico)
create function public.tr_own_session(p_session_id uuid) returns public.research_sessions
language plpgsql security definer set search_path = ''
as $$
declare
  s public.research_sessions;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select * into s from public.research_sessions
   where id = p_session_id and owner_id = auth.uid()
   for update;
  if not found then
    raise exception 'session_not_found' using errcode = 'P0002';
  end if;
  return s;
end $$;

create function public.tr_check_locale(p_locale text) returns text
language plpgsql immutable set search_path = ''
as $$
begin
  if p_locale is null or p_locale not in ('it', 'en', 'es', 'sv') then
    raise exception 'invalid_locale' using errcode = '22023';
  end if;
  return p_locale;
end $$;

create function public.tr_insert_event(
  p_session_id uuid, p_type text, p_dedupe_key text, p_event_id uuid default null,
  p_revision integer default null, p_destination text default null, p_position smallint default null,
  p_locale text default null, p_meta jsonb default '{}'::jsonb, p_client_ts timestamptz default null
) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  n integer;
begin
  insert into public.session_events (event_id, dedupe_key, session_id, event_type, client_ts, search_revision, destination_id, position, locale, meta)
  values (coalesce(p_event_id, gen_random_uuid()), p_dedupe_key, p_session_id, p_type, p_client_ts, p_revision, p_destination, p_position, p_locale, coalesce(p_meta, '{}'::jsonb))
  on conflict do nothing;
  get diagnostics n = row_count;
  return n > 0;
end $$;

create function public.tr_session_state(p_session_id uuid) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'id', s.id,
    'mode', case when s.is_test then 'test' else 'live' end,
    'referenceDate', s.reference_date,
    'currentSearchRevision', s.current_search_revision,
    'selectedDestinationId', s.selected_destination_id,
    'selectedSearchRevision', s.selected_search_revision,
    'surveyStatus', s.survey_status,
    'emailStatus', s.email_status,
    'answers', coalesce((
      select jsonb_object_agg(a.question_id, jsonb_build_object('optionIds', to_jsonb(a.option_ids), 'otherText', a.other_text, 'text', a.text_answer))
      from public.survey_answers a where a.session_id = s.id), '{}'::jsonb)
  )
  from public.research_sessions s where s.id = p_session_id
$$;

-- Valida una risposta contro la definizione salvata. Restituisce un codice d'errore o null.
create function public.tr_answer_error(p_q public.survey_questions, p_options text[], p_other text, p_text text, p_final boolean)
returns text
language plpgsql stable set search_path = ''
as $$
declare
  n integer := coalesce(cardinality(p_options), 0);
begin
  if p_q.kind = 'text' then
    if p_text is not null and char_length(p_text) > coalesce(p_q.max_text_length, 1500) then return 'too_long'; end if;
    if n > 0 then return 'unknown_option'; end if;
    return null;
  end if;
  if p_text is not null then return 'unexpected_text'; end if;
  if n > 0 and exists (select 1 from unnest(p_options) o where not (o = any (p_q.options))) then return 'unknown_option'; end if;
  if n <> (select count(distinct o) from unnest(coalesce(p_options, '{}')) o) then return 'duplicate_option'; end if;
  if p_other is not null and char_length(p_other) > 300 then return 'too_long'; end if;
  if p_other is not null and (p_q.other_option is null or not (p_q.other_option = any (coalesce(p_options, '{}')))) then return 'other_without_option'; end if;
  if p_q.kind = 'single' then
    if n > 1 then return 'single'; end if;
    if p_final and p_q.required and n = 0 then return 'required'; end if;
    return null;
  end if;
  if p_q.max_choices is not null and n > p_q.max_choices then return 'too_many'; end if;
  if n > 1 and exists (select 1 from unnest(p_options) o where o = any (p_q.exclusive_options)) then return 'exclusive'; end if;
  if p_final and p_q.required and n < coalesce(p_q.min_choices, 1) then
    return case when n = 0 then 'required' else 'too_few' end;
  end if;
  return null;
end $$;

-- Costruisce le offerte dal catalogo approvato: il browser non fornisce mai prezzi.
create function public.tr_build_offers(p_catalog text, p_origin text, p_checkin date, p_checkout date, p_budget integer)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'destinationId', r.destination_id,
      'position', r.position,
      'checkIn', to_char(p_checkin, 'YYYY-MM-DD'),
      'checkOut', to_char(p_checkout, 'YYYY-MM-DD'),
      'hotelOriginalCents', h.original_cents,
      'hotelSaleCents', h.sale_cents,
      'hotelSavingsCents', h.original_cents - h.sale_cents,
      'hotelSavingsPercentX10', round((h.original_cents - h.sale_cents) * 1000.0 / h.original_cents)::integer,
      'transportMainCents', r.main_cents,
      'transportTransfersCents', r.transfers_cents,
      'transportTotalCents', r.main_cents + r.transfers_cents,
      'tripTotalCents', h.sale_cents + r.main_cents + r.transfers_cents,
      'withinBudget', case when p_budget is null then null else (h.sale_cents + r.main_cents + r.transfers_cents) <= p_budget end
    ) order by r.position), '[]'::jsonb)
  from public.catalog_routes r
  join public.catalog_hotels h on h.catalog_version = r.catalog_version and h.destination_id = r.destination_id
  where r.catalog_version = p_catalog and r.origin_id = p_origin
$$;

-- ---------------------------------------------------------------- configurazione pubblica
create function public.tr_public_config() returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'mode', c.collection_mode,
    'ready', public.tr_privacy_ready(),
    'versionId', c.current_version_id,
    'privacy', case when public.tr_privacy_ready() then jsonb_build_object(
      'controllerName', p.controller_name,
      'contactEmail', p.contact_email,
      'legalBasis', p.legal_basis,
      'responsesRetentionMonths', p.responses_retention_months,
      'contactsRetentionMonths', p.contacts_retention_months,
      'projectContext', p.project_context,
      'privacyVersion', p.privacy_version) else null end
  )
  from public.app_config c cross join public.privacy_config p
  where c.id = 1 and p.id = 1
$$;

-- ---------------------------------------------------------------- avvio o ripresa della partecipazione
create function public.tr_start_session(p_locale text, p_reference_date date, p_resume_id uuid default null)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  cfg public.app_config;
  sid uuid;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  perform public.tr_check_locale(p_locale);

  if p_resume_id is not null then
    update public.research_sessions set last_locale = p_locale, updated_at = now()
     where id = p_resume_id and owner_id = uid
     returning id into sid;
    if sid is not null then return public.tr_session_state(sid); end if;
  end if;

  select * into cfg from public.app_config where id = 1;
  if not found then raise exception 'not_configured'; end if;
  if cfg.collection_mode = 'live' and not public.tr_privacy_ready() then
    raise exception 'collection_not_ready';
  end if;
  if p_reference_date is null or p_reference_date not between (now() at time zone 'utc')::date - 1 and (now() at time zone 'utc')::date + 1 then
    raise exception 'invalid_reference_date' using errcode = '22023';
  end if;
  if (select count(*) from public.research_sessions where owner_id = uid) >= 20 then
    raise exception 'rate_limited';
  end if;

  insert into public.research_sessions (owner_id, version_id, is_test, reference_date, initial_locale, last_locale)
  values (uid, cfg.current_version_id, cfg.collection_mode = 'test', p_reference_date, p_locale, p_locale)
  returning id into sid;

  perform public.tr_insert_event(sid, 'session_started', sid::text || ':session_started', p_locale => p_locale);
  return public.tr_session_state(sid);
end $$;

-- ---------------------------------------------------------------- ricerca e snapshot
create function public.tr_save_search(p_session_id uuid, p_origin_id text, p_interval_start date, p_interval_end date, p_budget_cents integer, p_locale text)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  s public.research_sessions := public.tr_own_session(p_session_id);
  v public.research_versions;
  country text;
  rev integer;
  checkin date;
  checkout date;
  offers jsonb;
begin
  perform public.tr_check_locale(p_locale);
  if s.survey_status = 'completed' then raise exception 'session_completed'; end if;
  select * into v from public.research_versions where id = s.version_id;
  select o.country_id into country from public.catalog_origins o where o.catalog_version = v.catalog_version and o.origin_id = p_origin_id;
  if country is null then raise exception 'invalid_origin' using errcode = '22023'; end if;

  if p_interval_start is null or p_interval_end is null
     or p_interval_start < s.reference_date + 1
     or p_interval_end > s.reference_date + 14
     or p_interval_end - p_interval_start < 2 then
    raise exception 'invalid_interval' using errcode = '22023';
  end if;
  if p_budget_cents is not null and (p_budget_cents <= 0 or p_budget_cents > 10000000) then
    raise exception 'invalid_budget' using errcode = '22023';
  end if;
  if s.current_search_revision >= 50 then raise exception 'rate_limited'; end if;

  rev := s.current_search_revision + 1;
  checkin := p_interval_start;
  checkout := p_interval_start + 2;
  offers := public.tr_build_offers(v.catalog_version, p_origin_id, checkin, checkout, p_budget_cents);
  if jsonb_array_length(offers) <> 4 then raise exception 'catalog_incomplete'; end if;

  insert into public.search_snapshots (session_id, search_revision, origin_country, origin_id, interval_start, interval_end, checkin, checkout, budget_cents, catalog_version, offers, locale)
  values (s.id, rev, country, p_origin_id, p_interval_start, p_interval_end, checkin, checkout, p_budget_cents, v.catalog_version, offers, p_locale);

  -- una nuova ricerca invalida selezione e checkout precedenti
  update public.research_sessions
     set current_search_revision = rev, selected_destination_id = null, selected_search_revision = null,
         last_locale = p_locale, updated_at = now()
   where id = s.id;

  perform public.tr_insert_event(s.id, 'preferences_submitted', s.id::text || ':preferences_submitted:' || rev, p_revision => rev, p_locale => p_locale);

  return jsonb_build_object(
    'revision', rev,
    'originId', p_origin_id,
    'originCountry', country,
    'intervalStart', to_char(p_interval_start, 'YYYY-MM-DD'),
    'intervalEnd', to_char(p_interval_end, 'YYYY-MM-DD'),
    'budgetCents', p_budget_cents,
    'checkIn', to_char(checkin, 'YYYY-MM-DD'),
    'checkOut', to_char(checkout, 'YYYY-MM-DD'),
    'adults', 2,
    'nights', 2,
    'catalogVersion', v.catalog_version,
    'offers', offers);
end $$;

-- ---------------------------------------------------------------- eventi della demo (allowlist)
create function public.tr_log_event(
  p_session_id uuid, p_event_id uuid, p_event_type text, p_search_revision integer,
  p_destination_id text, p_locale text, p_client_ts timestamptz default null, p_meta jsonb default '{}'::jsonb
) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  s public.research_sessions := public.tr_own_session(p_session_id);
  snap public.search_snapshots;
  pos smallint;
  meta jsonb := '{}'::jsonb;
  key text;
  inserted boolean;
  needs_dest boolean := p_event_type in ('offer_opened', 'offer_selected', 'checkout_started', 'simulated_payment_completed', 'simulated_transfer_completed');
begin
  if p_event_id is null then raise exception 'invalid_event' using errcode = '22023'; end if;
  perform public.tr_check_locale(p_locale);
  if p_event_type not in ('offers_viewed', 'offer_opened', 'offer_selected', 'checkout_started',
                          'simulated_payment_completed', 'simulated_transfer_completed', 'no_offer_selected', 'feedback_started') then
    raise exception 'event_not_allowed' using errcode = '22023';
  end if;
  if s.survey_status = 'completed' then return jsonb_build_object('status', 'ignored'); end if;
  if (select count(*) from public.session_events e where e.session_id = s.id) >= 500 then raise exception 'rate_limited'; end if;
  if p_client_ts is not null and (p_client_ts < now() - interval '2 days' or p_client_ts > now() + interval '1 day') then
    p_client_ts := null;
  end if;

  if p_event_type = 'feedback_started' then
    if p_meta ? 'entry' and p_meta ->> 'entry' in ('outcome', 'results', 'detail', 'summary', 'transfer') then
      meta := jsonb_build_object('entry', p_meta ->> 'entry');
    end if;
    if p_search_revision is not null and p_search_revision <> s.current_search_revision then p_search_revision := null; end if;
  else
    if p_search_revision is null or p_search_revision <> s.current_search_revision or s.current_search_revision = 0 then
      raise exception 'stale_revision';
    end if;
  end if;

  if needs_dest then
    select * into snap from public.search_snapshots where session_id = s.id and search_revision = p_search_revision;
    select (o ->> 'position')::smallint into pos from jsonb_array_elements(snap.offers) o where o ->> 'destinationId' = p_destination_id;
    if pos is null then raise exception 'invalid_destination' using errcode = '22023'; end if;
  else
    p_destination_id := null;
  end if;

  -- sequenza coerente: scelta → checkout → pagamento simulato → trasferimento simulato
  if p_event_type = 'checkout_started' and (s.selected_destination_id is distinct from p_destination_id or s.selected_search_revision is distinct from p_search_revision) then
    raise exception 'invalid_sequence';
  end if;
  if p_event_type = 'simulated_payment_completed' and not exists (
      select 1 from public.session_events e where e.session_id = s.id and e.event_type = 'checkout_started' and e.search_revision = p_search_revision and e.destination_id = p_destination_id) then
    raise exception 'invalid_sequence';
  end if;
  if p_event_type = 'simulated_transfer_completed' and not exists (
      select 1 from public.session_events e where e.session_id = s.id and e.event_type = 'simulated_payment_completed' and e.search_revision = p_search_revision and e.destination_id = p_destination_id) then
    raise exception 'invalid_sequence';
  end if;

  key := case
    when p_event_type in ('offers_viewed', 'no_offer_selected') then s.id::text || ':' || p_event_type || ':' || p_search_revision
    when p_event_type in ('checkout_started', 'simulated_payment_completed', 'simulated_transfer_completed') then s.id::text || ':' || p_event_type || ':' || p_search_revision || ':' || p_destination_id
    when p_event_type = 'feedback_started' then s.id::text || ':feedback_started'
    else p_event_id::text
  end;

  inserted := public.tr_insert_event(s.id, p_event_type, key, p_event_id, p_search_revision, p_destination_id, pos, p_locale, meta, p_client_ts);

  if inserted then
    if p_event_type = 'offer_selected' then
      update public.research_sessions set selected_destination_id = p_destination_id, selected_search_revision = p_search_revision, updated_at = now() where id = s.id;
    elsif p_event_type = 'feedback_started' then
      update public.research_sessions set feedback_entry = coalesce(feedback_entry, meta ->> 'entry', 'other'), updated_at = now() where id = s.id;
    else
      update public.research_sessions set updated_at = now(), last_locale = p_locale where id = s.id;
    end if;
  end if;
  return jsonb_build_object('status', case when inserted then 'ok' else 'duplicate' end);
end $$;

-- ---------------------------------------------------------------- questionario
create function public.tr_save_answer(p_session_id uuid, p_question_id text, p_option_ids text[], p_other_text text, p_text text, p_locale text)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  s public.research_sessions := public.tr_own_session(p_session_id);
  v public.research_versions;
  q public.survey_questions;
  other text := nullif(btrim(coalesce(p_other_text, '')), '');
  txt text := nullif(btrim(coalesce(p_text, '')), '');
  err text;
begin
  perform public.tr_check_locale(p_locale);
  if s.survey_status = 'completed' then raise exception 'session_completed'; end if;
  select * into v from public.research_versions where id = s.version_id;
  select * into q from public.survey_questions where survey_version = v.survey_version and question_id = p_question_id;
  if not found then raise exception 'invalid_question' using errcode = '22023'; end if;
  -- il testo «Altro» si conserva solo se l'opzione Altro è selezionata
  if q.other_option is null or not (q.other_option = any (coalesce(p_option_ids, '{}'))) then other := null; end if;
  err := public.tr_answer_error(q, coalesce(p_option_ids, '{}'), other, txt, false);
  if err is not null then raise exception 'invalid_answer:%', err using errcode = '22023'; end if;

  insert into public.survey_answers (session_id, question_id, survey_version, option_ids, other_text, text_answer, locale)
  values (s.id, p_question_id, v.survey_version, coalesce(p_option_ids, '{}'), other, txt, p_locale)
  on conflict (session_id, question_id) do update
    set option_ids = excluded.option_ids, other_text = excluded.other_text, text_answer = excluded.text_answer,
        locale = excluded.locale, updated_at = now();

  update public.research_sessions set survey_status = 'in_progress', last_locale = p_locale, updated_at = now() where id = s.id;
  perform public.tr_insert_event(s.id, 'survey_step_saved', s.id::text || ':survey_step_saved:' || p_question_id, p_locale => p_locale, p_meta => jsonb_build_object('question', p_question_id));
  return jsonb_build_object('status', 'ok');
end $$;

-- Invio finale atomico e idempotente: valida tutte le risposte e completa una sola volta.
create function public.tr_submit_survey(p_session_id uuid, p_answers jsonb, p_locale text)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  s public.research_sessions := public.tr_own_session(p_session_id);
  v public.research_versions;
  q public.survey_questions;
  a jsonb;
  opts text[];
  other text;
  txt text;
  err text;
  errors jsonb := '{}'::jsonb;
begin
  perform public.tr_check_locale(p_locale);
  if s.survey_status = 'completed' then return jsonb_build_object('status', 'already_completed'); end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then raise exception 'invalid_answers' using errcode = '22023'; end if;
  select * into v from public.research_versions where id = s.version_id;
  if exists (select 1 from jsonb_object_keys(p_answers) k where k not in (select question_id from public.survey_questions where survey_version = v.survey_version)) then
    raise exception 'invalid_answers:unknown_question' using errcode = '22023';
  end if;

  for q in select * from public.survey_questions where survey_version = v.survey_version order by position loop
    a := coalesce(p_answers -> q.question_id, '{}'::jsonb);
    if jsonb_typeof(a) <> 'object' or (a ? 'optionIds' and jsonb_typeof(a -> 'optionIds') <> 'array') then
      errors := errors || jsonb_build_object(q.question_id, 'malformed');
      continue;
    end if;
    opts := coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(a -> 'optionIds', '[]'::jsonb)) x), '{}');
    other := nullif(btrim(coalesce(a ->> 'otherText', '')), '');
    txt := nullif(btrim(coalesce(a ->> 'text', '')), '');
    if q.other_option is null or not (q.other_option = any (opts)) then other := null; end if;
    err := public.tr_answer_error(q, opts, other, txt, true);
    if err is not null then
      errors := errors || jsonb_build_object(q.question_id, err);
      continue;
    end if;
    insert into public.survey_answers (session_id, question_id, survey_version, option_ids, other_text, text_answer, locale, is_final, finalized_at)
    values (s.id, q.question_id, v.survey_version, opts, other, txt, p_locale, true, now())
    on conflict (session_id, question_id) do update
      set option_ids = excluded.option_ids, other_text = excluded.other_text, text_answer = excluded.text_answer,
          locale = excluded.locale, is_final = true, finalized_at = now(), updated_at = now();
  end loop;

  if errors <> '{}'::jsonb then
    raise exception 'invalid_answers' using errcode = '22023', detail = errors::text;
  end if;

  update public.research_sessions
     set survey_status = 'completed', completed_at = now(), survey_locale = p_locale, last_locale = p_locale, updated_at = now()
   where id = s.id;
  perform public.tr_insert_event(s.id, 'survey_completed', s.id::text || ':survey_completed', p_locale => p_locale);
  return jsonb_build_object('status', 'completed');
end $$;

-- ---------------------------------------------------------------- email facoltativa
create function public.tr_email_prompt(p_session_id uuid, p_action text, p_locale text)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  s public.research_sessions := public.tr_own_session(p_session_id);
begin
  perform public.tr_check_locale(p_locale);
  if s.survey_status <> 'completed' then raise exception 'survey_not_completed'; end if;
  if p_action = 'viewed' then
    update public.research_sessions
       set email_prompt_seen = true,
           email_status = case when email_status = 'not_shown' then 'pending' else email_status end,
           email_status_at = case when email_status = 'not_shown' then now() else email_status_at end
     where id = s.id;
    perform public.tr_insert_event(s.id, 'email_prompt_viewed', s.id::text || ':email_prompt_viewed', p_locale => p_locale);
  elsif p_action = 'declined' then
    update public.research_sessions
       set email_prompt_seen = true,
           email_status = case when email_status = 'submitted' then email_status else 'declined' end,
           email_status_at = case when email_status = 'submitted' then email_status_at else now() end
     where id = s.id;
    perform public.tr_insert_event(s.id, 'email_declined', s.id::text || ':email_declined', p_locale => p_locale);
  else
    raise exception 'invalid_action' using errcode = '22023';
  end if;
  return jsonb_build_object('status', 'ok');
end $$;

-- Registra l'email con consenso esplicito. La risposta è sempre identica: non rivela se l'indirizzo esisteva.
create function public.tr_submit_email(p_session_id uuid, p_email text, p_consent boolean, p_locale text)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  s public.research_sessions := public.tr_own_session(p_session_id);
  email text := lower(btrim(coalesce(p_email, '')));
  c public.contacts;
  cv text;
  already_linked boolean;
begin
  perform public.tr_check_locale(p_locale);
  if s.survey_status <> 'completed' then raise exception 'survey_not_completed'; end if;
  if p_consent is not true then raise exception 'consent_required' using errcode = '22023'; end if;
  if char_length(email) > 254 or email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'invalid_email' using errcode = '22023';
  end if;
  if (select count(*) from public.session_contacts sc where sc.session_id = s.id) >= 3 then raise exception 'rate_limited'; end if;

  select coalesce(p.privacy_version, 'unconfigured-test') into cv from public.privacy_config p where p.id = 1;

  insert into public.contacts (email_normalized, consent_version, locale)
  values (email, cv, p_locale)
  on conflict (email_normalized) do nothing
  returning * into c;

  if c.id is not null then
    insert into public.consent_events (contact_id, session_id, event_type, consent_version, actor)
    values (c.id, s.id, 'consent_given', cv, 'participant');
  else
    select * into c from public.contacts where email_normalized = email for update;
    already_linked := exists (select 1 from public.session_contacts sc where sc.session_id = s.id and sc.contact_id = c.id);
    if c.status = 'revoked' then
      -- nessuna riattivazione silenziosa: la richiesta resta da valutare da parte dei creator
      if not already_linked then
        update public.contacts set pending_request_after_revocation = true, last_request_at = now(), updated_at = now() where id = c.id;
        insert into public.consent_events (contact_id, session_id, event_type, consent_version, actor)
        values (c.id, s.id, 'request_after_revocation', cv, 'participant');
      end if;
    elsif not already_linked then
      update public.contacts set consented_at = now(), consent_version = cv, locale = p_locale, updated_at = now() where id = c.id;
      insert into public.consent_events (contact_id, session_id, event_type, consent_version, actor)
      values (c.id, s.id, 'consent_renewed', cv, 'participant');
    end if;
  end if;

  insert into public.session_contacts (session_id, contact_id) values (s.id, c.id) on conflict do nothing;
  update public.research_sessions set email_prompt_seen = true, email_status = 'submitted', email_status_at = now(), updated_at = now() where id = s.id;
  perform public.tr_insert_event(s.id, 'email_submitted', s.id::text || ':email_submitted', p_locale => p_locale);
  return jsonb_build_object('status', 'ok');
end $$;
