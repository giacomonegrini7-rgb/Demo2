-- Test di integrazione database: RLS, RPC, isolamento tra partecipanti, creator, contatti e modalità live.
-- Eseguito da scripts/test-db.sh dopo le migrazioni, con lo stub di auth.uid().

create schema t;
grant usage on schema t to anon, authenticated;

create function t.expect_error(p_sql text, p_pattern text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm ~ p_pattern then return; end if;
    raise exception 'Errore inatteso per [%]: % (atteso ~ %)', p_sql, sqlerrm, p_pattern;
  end;
  raise exception 'Nessun errore per [%], atteso ~ %', p_sql, p_pattern;
end $$;

create function t.ok(p_cond boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_cond is not true then raise exception 'ASSERZIONE FALLITA: %', p_msg; end if;
end $$;
grant execute on all functions in schema t to anon, authenticated;

-- identità: due partecipanti anonimi (A, B), un creator owner (C), un creator viewer (V), un terzo partecipante (D)
insert into public.creator_members (user_id, role, label) values
  ('33333333-3333-3333-3333-333333333333', 'owner', 'test owner'),
  ('44444444-4444-4444-4444-444444444444', 'viewer', 'test viewer');

\set as_anon 'reset role; select set_config(''request.jwt.claim.sub'', '''', false); set role anon;'
\set as_a 'reset role; select set_config(''request.jwt.claim.sub'', ''11111111-1111-1111-1111-111111111111'', false); set role authenticated;'
\set as_b 'reset role; select set_config(''request.jwt.claim.sub'', ''22222222-2222-2222-2222-222222222222'', false); set role authenticated;'
\set as_c 'reset role; select set_config(''request.jwt.claim.sub'', ''33333333-3333-3333-3333-333333333333'', false); set role authenticated;'
\set as_v 'reset role; select set_config(''request.jwt.claim.sub'', ''44444444-4444-4444-4444-444444444444'', false); set role authenticated;'
\set as_d 'reset role; select set_config(''request.jwt.claim.sub'', ''55555555-5555-5555-5555-555555555555'', false); set role authenticated;'

-- ------------------------------------------------------------ anon
:as_anon
select t.ok((public.tr_public_config() ->> 'mode') = 'test', 'config pubblica leggibile, modalità test di default');
select t.ok((public.tr_public_config() -> 'privacy') = 'null'::jsonb, 'informativa incompleta non esposta');
select t.expect_error($$select public.tr_start_session('it', current_date, null)$$, 'permission denied');
select t.expect_error($$select count(*) from public.research_sessions$$, 'permission denied');

-- ------------------------------------------------------------ partecipante A
:as_a
select (public.tr_start_session('it', current_date, null)) ->> 'id' as sa \gset
select t.ok((public.tr_start_session('it', current_date, :'sa') ->> 'id') = :'sa', 'refresh riprende la stessa partecipazione');
select t.ok((select count(*) from public.research_sessions) = 1, 'A vede solo la propria sessione');
select t.ok((select is_test from public.research_sessions where id = :'sa'), 'is_test deciso dal server (modalità test)');
select t.expect_error($$select public.tr_start_session('it', current_date + 5, null)$$, 'invalid_reference_date');
select t.expect_error($$select public.tr_start_session('fr', current_date, null)$$, 'invalid_locale');

-- intervalli non validi e partenza fuori elenco
select t.expect_error(format($$select public.tr_save_search(%L, 'venice', current_date + 1, current_date + 2, null, 'it')$$, :'sa'), 'invalid_interval');
select t.expect_error(format($$select public.tr_save_search(%L, 'venice', current_date, current_date + 4, null, 'it')$$, :'sa'), 'invalid_interval');
select t.expect_error(format($$select public.tr_save_search(%L, 'venice', current_date + 10, current_date + 15, null, 'it')$$, :'sa'), 'invalid_interval');
select t.expect_error(format($$select public.tr_save_search(%L, 'modena', current_date + 1, current_date + 5, null, 'it')$$, :'sa'), 'invalid_origin');
select t.expect_error(format($$select public.tr_save_search(%L, 'venice', current_date + 1, current_date + 5, -5, 'it')$$, :'sa'), 'invalid_budget');

-- ricerca valida Venezia: calcoli dal catalogo server
select public.tr_save_search(:'sa', 'venice', current_date + 1, current_date + 5, 30000, 'it') as snap \gset
select t.ok((:'snap'::jsonb ->> 'revision')::int = 1, 'prima revisione');
select t.ok(jsonb_array_length(:'snap'::jsonb -> 'offers') = 4, 'quattro offerte');
select t.ok((select string_agg(o ->> 'destinationId', ',' order by (o ->> 'position')::int) from jsonb_array_elements(:'snap'::jsonb -> 'offers') o) = 'vienna,budapest,verona,valencia', 'ordine base');
select t.ok((select (o ->> 'tripTotalCents')::int from jsonb_array_elements(:'snap'::jsonb -> 'offers') o where o ->> 'destinationId' = 'verona') = 21400, 'Venezia-Verona 214 EUR');
select t.ok((select (o ->> 'hotelSavingsPercentX10')::int from jsonb_array_elements(:'snap'::jsonb -> 'offers') o where o ->> 'destinationId' = 'verona') = 423, 'risparmio 42,3%');
select t.ok((select (o ->> 'withinBudget')::boolean from jsonb_array_elements(:'snap'::jsonb -> 'offers') o where o ->> 'destinationId' = 'verona'), 'Verona entro budget 300');
select t.ok(not (select (o ->> 'withinBudget')::boolean from jsonb_array_elements(:'snap'::jsonb -> 'offers') o where o ->> 'destinationId' = 'budapest'), 'Budapest fuori budget');
select t.ok((:'snap'::jsonb ->> 'checkOut') = to_char(current_date + 3, 'YYYY-MM-DD'), 'check-out = inizio + 2');

-- accessi diretti in scrittura negati
select t.expect_error(format($$update public.research_sessions set is_test = false where id = %L$$, :'sa'), 'permission denied');
select t.expect_error(format($$insert into public.survey_answers (session_id, question_id, survey_version, locale) values (%L, 'c1', 'x', 'it')$$, :'sa'), 'permission denied');
select t.expect_error($$insert into public.creator_members (user_id, role) values ('11111111-1111-1111-1111-111111111111', 'owner')$$, 'permission denied');
select t.expect_error($$update public.search_snapshots set budget_cents = 1$$, 'permission denied');
select t.ok((select count(*) from public.session_events) = 0, 'A non legge gli eventi (solo creator)');
select t.ok((select count(*) from public.contacts) = 0, 'A non legge i contatti');
select t.ok((select count(*) from public.creator_members) = 0, 'A non vede creator_members');
select t.ok((public.tr_admin_me() ->> 'role') is null, 'A non è creator');
select t.expect_error(format($$select public.tr_admin_delete_session(%L, 'prova')$$, :'sa'), 'forbidden');
select t.expect_error($$select public.tr_admin_update_settings('live', null)$$, 'forbidden');

-- sequenza eventi
select t.expect_error(format($$select public.tr_log_event(%L, gen_random_uuid(), 'survey_completed', 1, null, 'it')$$, :'sa'), 'event_not_allowed');
select t.expect_error(format($$select public.tr_log_event(%L, gen_random_uuid(), 'offer_opened', 1, 'lisbon', 'it')$$, :'sa'), 'invalid_destination');
select t.expect_error(format($$select public.tr_log_event(%L, gen_random_uuid(), 'checkout_started', 1, 'verona', 'it')$$, :'sa'), 'invalid_sequence');
select t.expect_error(format($$select public.tr_log_event(%L, gen_random_uuid(), 'simulated_payment_completed', 1, 'verona', 'it')$$, :'sa'), 'invalid_sequence');
select t.ok((public.tr_log_event(:'sa', gen_random_uuid(), 'offers_viewed', 1, null, 'it') ->> 'status') = 'ok', 'offers_viewed');
select t.ok((public.tr_log_event(:'sa', gen_random_uuid(), 'offers_viewed', 1, null, 'it') ->> 'status') = 'duplicate', 'offers_viewed deduplicato per revisione');
select t.ok((public.tr_log_event(:'sa', gen_random_uuid(), 'offer_opened', 1, 'verona', 'it') ->> 'status') = 'ok', 'offer_opened');
select t.ok((public.tr_log_event(:'sa', gen_random_uuid(), 'offer_selected', 1, 'verona', 'it') ->> 'status') = 'ok', 'offer_selected');
select t.ok((public.tr_log_event(:'sa', gen_random_uuid(), 'checkout_started', 1, 'verona', 'it') ->> 'status') = 'ok', 'checkout_started');
select gen_random_uuid() as payid \gset
select t.ok((public.tr_log_event(:'sa', :'payid', 'simulated_payment_completed', 1, 'verona', 'it') ->> 'status') = 'ok', 'pagamento simulato');
select t.ok((public.tr_log_event(:'sa', :'payid', 'simulated_payment_completed', 1, 'verona', 'it') ->> 'status') = 'duplicate', 'stesso event_id: nessun duplicato');
select t.ok((public.tr_log_event(:'sa', gen_random_uuid(), 'simulated_payment_completed', 1, 'verona', 'it') ->> 'status') = 'duplicate', 'doppio clic: nessuna seconda transazione');
select t.ok((public.tr_log_event(:'sa', gen_random_uuid(), 'simulated_transfer_completed', 1, 'verona', 'it') ->> 'status') = 'ok', 'trasferimento simulato');
select t.ok((public.tr_log_event(:'sa', gen_random_uuid(), 'feedback_started', 1, null, 'it', null, '{"entry":"outcome","email":"x@y.z"}') ->> 'status') = 'ok', 'feedback_started');

-- nuova ricerca invalida la selezione
select public.tr_save_search(:'sa', 'venice', current_date + 2, current_date + 9, null, 'en') ->> 'revision' as rev2 \gset
select t.ok(:'rev2'::int = 2, 'seconda revisione');
select t.ok((select selected_destination_id is null from public.research_sessions where id = :'sa'), 'selezione invalidata');
select t.expect_error(format($$select public.tr_log_event(%L, gen_random_uuid(), 'offer_opened', 1, 'verona', 'it')$$, :'sa'), 'stale_revision');

-- regole del questionario (bozze)
select t.expect_error(format($$select public.tr_save_answer(%L, 'c5', array['c5_01','c5_02','c5_03','c5_04'], null, null, 'it')$$, :'sa'), 'too_many');
select t.expect_error(format($$select public.tr_save_answer(%L, 'c5', array['c5_09','c5_01'], null, null, 'it')$$, :'sa'), 'exclusive');
select t.expect_error(format($$select public.tr_save_answer(%L, 'c6', array['c6_06','c6_07'], null, null, 'it')$$, :'sa'), 'exclusive');
select t.expect_error(format($$select public.tr_save_answer(%L, 'c6', array['c6_01','c6_06'], null, null, 'it')$$, :'sa'), 'exclusive');
select t.expect_error(format($$select public.tr_save_answer(%L, 'v2', array['v2_01','v2_02','v2_03'], null, null, 'it')$$, :'sa'), 'too_many');
select t.expect_error(format($$select public.tr_save_answer(%L, 'v2', array['v2_08','v2_01'], null, null, 'it')$$, :'sa'), 'exclusive');
select t.expect_error(format($$select public.tr_save_answer(%L, 'c1', array['c1_01','c1_02'], null, null, 'it')$$, :'sa'), 'single');
select t.expect_error(format($$select public.tr_save_answer(%L, 'c1', array['c9_01'], null, null, 'it')$$, :'sa'), 'unknown_option');
select t.expect_error(format($$select public.tr_save_answer(%L, 'c7', '{}', null, repeat('x', 1501), 'it')$$, :'sa'), 'too_long|check');
select public.tr_save_answer(:'sa', 'c4', array['c4_01'], 'testo nascosto', null, 'it');
select t.ok((select other_text is null from public.survey_answers where session_id = :'sa' and question_id = 'c4'), 'Altro non selezionato: testo non salvato');

-- invio finale: incompleto → errore; completo → completato una volta
select t.expect_error(format($$select public.tr_submit_survey(%L, '{"c1":{"optionIds":["c1_01"]}}', 'it')$$, :'sa'), 'invalid_answers');
select t.ok((select survey_status from public.research_sessions where id = :'sa') = 'in_progress', 'nessun completamento parziale');
\set full_answers '{"c1":{"optionIds":["c1_02"]},"c2":{"optionIds":["c2_04"]},"c3":{"optionIds":["c3_02"]},"c4":{"optionIds":["c4_06"],"otherText":"=1+1 viaggi di lavoro"},"c5":{"optionIds":["c5_01","c5_10"],"otherText":"<script>alert(1)</script>"},"c6":{"optionIds":["c6_02","c6_03"]},"c7":{"optionIds":[]},"v1":{"optionIds":["v1_03"]},"v2":{"optionIds":["v2_01","v2_05"]},"v3":{"optionIds":["v3_13"]}}'
select t.ok((public.tr_submit_survey(:'sa', :'full_answers', 'en') ->> 'status') = 'completed', 'questionario completato senza C7');
select t.ok((public.tr_submit_survey(:'sa', :'full_answers', 'en') ->> 'status') = 'already_completed', 'invio idempotente');
select t.ok((select count(*) from public.survey_answers where session_id = :'sa' and is_final) = 10, '10 risposte finali');
select t.ok((select text_answer is null from public.survey_answers where session_id = :'sa' and question_id = 'c7'), 'C7 vuota registrata come vuota');
select t.expect_error(format($$select public.tr_save_answer(%L, 'c1', array['c1_05'], null, null, 'it')$$, :'sa'), 'session_completed');
select t.expect_error(format($$select public.tr_save_search(%L, 'venice', current_date + 1, current_date + 5, null, 'it')$$, :'sa'), 'session_completed');

-- email
select t.expect_error(format($$select public.tr_submit_email(%L, 'test@example.com', false, 'it')$$, :'sa'), 'consent_required');
select t.expect_error(format($$select public.tr_submit_email(%L, 'non-valida', true, 'it')$$, :'sa'), 'invalid_email');
select public.tr_email_prompt(:'sa', 'viewed', 'it');
select t.ok((select email_status from public.research_sessions where id = :'sa') = 'pending', 'email pendente dopo la visualizzazione');
select t.ok((public.tr_submit_email(:'sa', '  Test.User+tr@Example.COM ', true, 'it') ->> 'status') = 'ok', 'email registrata');
select t.ok((public.tr_submit_email(:'sa', 'test.user+tr@example.com', true, 'it') ->> 'status') = 'ok', 'reinvio idempotente');
select public.tr_email_prompt(:'sa', 'declined', 'it');
select t.ok((select email_status from public.research_sessions where id = :'sa') = 'submitted', 'un declined successivo non annulla l''invio');

-- ------------------------------------------------------------ partecipante B: isolamento
:as_b
select (public.tr_start_session('sv', current_date, :'sa')) ->> 'id' as sb \gset
select t.ok(:'sb' <> :'sa', 'B non può riprendere la sessione di A');
select t.ok((select count(*) from public.research_sessions) = 1, 'B vede solo la propria sessione');
select t.ok((select count(*) from public.survey_answers) = 0, 'B non legge risposte altrui');
select t.ok((select count(*) from public.search_snapshots) = 0, 'B non legge snapshot altrui');
select t.expect_error(format($$select public.tr_save_search(%L, 'venice', current_date + 1, current_date + 5, null, 'it')$$, :'sa'), 'session_not_found');
select t.expect_error(format($$select public.tr_save_answer(%L, 'c1', array['c1_01'], null, null, 'it')$$, :'sa'), 'session_not_found');
select t.expect_error(format($$select public.tr_submit_email(%L, 'b@example.com', true, 'it')$$, :'sa'), 'session_not_found');
select t.expect_error(format($$select public.tr_submit_email(%L, 'b@example.com', true, 'it')$$, :'sb'), 'survey_not_completed');
-- Valencia vede Lisbona e non Valencia
select public.tr_save_search(:'sb', 'valencia', current_date + 1, current_date + 14, null, 'sv') as snapb \gset
select t.ok((select string_agg(o ->> 'destinationId', ',' order by (o ->> 'position')::int) from jsonb_array_elements(:'snapb'::jsonb -> 'offers') o) = 'vienna,budapest,verona,lisbon', 'Lisbona solo per Valencia');
select t.ok((select (o ->> 'tripTotalCents')::int from jsonb_array_elements(:'snapb'::jsonb -> 'offers') o where o ->> 'destinationId' = 'lisbon') = 46400, 'Valencia-Lisbona 464 EUR');
select public.tr_log_event(:'sb', gen_random_uuid(), 'no_offer_selected', 1, null, 'sv');
select public.tr_log_event(:'sb', gen_random_uuid(), 'feedback_started', 1, null, 'sv', null, '{"entry":"results"}');
select public.tr_submit_survey(:'sb', :'full_answers', 'sv');

-- ------------------------------------------------------------ viewer
:as_v
select t.ok((select count(*) from public.research_sessions) = 2, 'viewer vede entrambe le partecipazioni');
select t.ok((select count(*) from public.session_events) > 0, 'viewer legge gli eventi');
select t.ok((select count(*) from public.contacts) = 0, 'viewer non legge i contatti');
select t.expect_error(format($$select public.tr_admin_delete_session(%L, 'prova viewer')$$, :'sb'), 'forbidden');

-- ------------------------------------------------------------ owner
:as_c
select t.ok((public.tr_admin_me() ->> 'role') = 'owner', 'C è owner');
select t.ok((select count(*) from public.research_sessions) = 2, 'owner vede entrambe le partecipazioni');
select t.ok((select count(*) from public.contacts) = 1, 'un solo contatto normalizzato');
select t.ok((select email_normalized from public.contacts) = 'test.user+tr@example.com', 'email normalizzata senza togliere suffissi');
select t.ok((select count(*) from public.session_contacts) = 1, 'un solo collegamento sessione-contatto');
select t.ok((select meta from public.session_events where session_id = :'sa' and event_type = 'feedback_started') = '{"entry": "outcome"}'::jsonb, 'metadati limitati all''allowlist');
select t.ok((select count(*) from public.session_events where session_id = :'sa' and event_type = 'simulated_payment_completed') = 1, 'un solo pagamento simulato');
select id as cid from public.contacts \gset
select public.tr_admin_revoke_contact(:'cid', 'richiesta via email');
select t.ok((select status from public.contacts) = 'revoked', 'contatto revocato');

-- dopo la revoca un nuovo invio non riattiva automaticamente
:as_b
select t.ok((public.tr_submit_email(:'sb', 'TEST.user+tr@example.com', true, 'sv') ->> 'status') = 'ok', 'risposta identica: nessuna enumerazione');
:as_c
select t.ok((select status = 'revoked' and pending_request_after_revocation from public.contacts), 'revoca non annullata, richiesta in attesa');
select public.tr_admin_reactivate_contact(:'cid', 'nuovo consenso esplicito del ' || current_date);
select t.ok((select status from public.contacts) = 'active', 'riattivazione esplicita da owner');
select t.ok((select count(*) from public.consent_events) = 4, 'eventi di consenso tracciati');

-- modalità live: bloccata senza informativa, poi attivata
select t.expect_error($$select public.tr_admin_update_settings('live', null)$$, 'privacy_not_configured');
select public.tr_admin_update_settings('live', '{"controllerName":"Gruppo di ricerca Travel Recovery","contactEmail":"team@example.org","legalBasis":"consent","responsesRetentionMonths":"12","contactsRetentionMonths":"24","privacyVersion":"2026-10-v1"}');
select t.ok((select collection_mode from public.app_config) = 'live', 'live attivo con informativa completa');
select t.expect_error($$select public.tr_admin_update_settings('live', '{"controllerName":""}')$$, 'privacy_not_configured');
select t.ok((select collection_mode from public.app_config) = 'live', 'tentativo fallito annullato');

:as_d
select (public.tr_start_session('es', current_date, null)) ->> 'mode' as dmode \gset
select t.ok(:'dmode' = 'live', 'nuove partecipazioni live non sono di test');
select t.ok((public.tr_public_config() -> 'privacy' ->> 'contactEmail') = 'team@example.org', 'informativa pubblicata solo se completa');

-- cancellazione con traccia minima
:as_c
select public.tr_admin_delete_session(:'sb', 'richiesta del partecipante');
select t.ok((select count(*) from public.survey_answers where session_id = :'sb') = 0, 'cancellazione a cascata delle risposte');
select t.ok((select count(*) from public.session_events where session_id = :'sb') = 0, 'cancellazione a cascata degli eventi');
select t.ok((select count(*) from public.admin_actions where action = 'delete_session') = 1, 'azione tracciata');

reset role;
\echo '  ok: sicurezza, isolamento e flusso'
