-- Funzioni dell'area creator. Ogni funzione verifica l'appartenenza a creator_members:
-- l'autenticazione da sola (anche anonima) non basta.

create function public.tr_require_owner() returns uuid
language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not public.tr_is_owner() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return auth.uid();
end $$;

create function public.tr_admin_me() returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select jsonb_build_object('role', m.role, 'label', m.label) from public.creator_members m where m.user_id = (select auth.uid())),
    jsonb_build_object('role', null))
$$;

create function public.tr_admin_delete_session(p_session_id uuid, p_note text)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  actor uuid := public.tr_require_owner();
  n integer;
begin
  if p_note is null or char_length(btrim(p_note)) < 3 then raise exception 'note_required' using errcode = '22023'; end if;
  delete from public.research_sessions where id = p_session_id;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'session_not_found' using errcode = 'P0002'; end if;
  insert into public.admin_actions (actor_id, action, target_id, note) values (actor, 'delete_session', p_session_id::text, left(p_note, 500));
  return jsonb_build_object('status', 'deleted');
end $$;

create function public.tr_admin_set_test(p_session_id uuid, p_is_test boolean, p_note text)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  actor uuid := public.tr_require_owner();
begin
  update public.research_sessions set is_test = p_is_test, updated_at = now() where id = p_session_id;
  if not found then raise exception 'session_not_found' using errcode = 'P0002'; end if;
  insert into public.admin_actions (actor_id, action, target_id, note)
  values (actor, 'set_test', p_session_id::text, left(coalesce(p_note, '') || ' [is_test=' || p_is_test || ']', 500));
  return jsonb_build_object('status', 'ok');
end $$;

create function public.tr_admin_revoke_contact(p_contact_id uuid, p_note text)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  actor uuid := public.tr_require_owner();
begin
  update public.contacts
     set status = 'revoked', revoked_at = now(), pending_request_after_revocation = false, updated_at = now()
   where id = p_contact_id;
  if not found then raise exception 'contact_not_found' using errcode = 'P0002'; end if;
  insert into public.consent_events (contact_id, event_type, actor, actor_id, note) values (p_contact_id, 'revoked', 'creator', actor, left(p_note, 500));
  insert into public.admin_actions (actor_id, action, target_id, note) values (actor, 'revoke_contact', p_contact_id::text, left(p_note, 500));
  return jsonb_build_object('status', 'revoked');
end $$;

-- Riattiva solo un contatto revocato che ha inviato una nuova richiesta esplicita dopo la revoca.
create function public.tr_admin_reactivate_contact(p_contact_id uuid, p_note text)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  actor uuid := public.tr_require_owner();
  c public.contacts;
begin
  select * into c from public.contacts where id = p_contact_id for update;
  if not found then raise exception 'contact_not_found' using errcode = 'P0002'; end if;
  if c.status <> 'revoked' or not c.pending_request_after_revocation then raise exception 'no_pending_request'; end if;
  update public.contacts
     set status = 'active', revoked_at = null, pending_request_after_revocation = false, consented_at = coalesce(c.last_request_at, now()), updated_at = now()
   where id = c.id;
  insert into public.consent_events (contact_id, event_type, actor, actor_id, note) values (c.id, 'reactivated_on_new_request', 'creator', actor, left(p_note, 500));
  insert into public.admin_actions (actor_id, action, target_id, note) values (actor, 'reactivate_contact', c.id::text, left(p_note, 500));
  return jsonb_build_object('status', 'active');
end $$;

-- Aggiorna informativa e modalità di raccolta. Il vincolo differito impedisce live senza informativa completa.
create function public.tr_admin_update_settings(p_mode text, p_privacy jsonb)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  actor uuid := public.tr_require_owner();
begin
  if p_mode not in ('test', 'live') then raise exception 'invalid_mode' using errcode = '22023'; end if;
  if p_privacy is not null then
    update public.privacy_config set
      controller_name = nullif(btrim(p_privacy ->> 'controllerName'), ''),
      contact_email = nullif(lower(btrim(p_privacy ->> 'contactEmail')), ''),
      legal_basis = nullif(p_privacy ->> 'legalBasis', ''),
      responses_retention_months = nullif(p_privacy ->> 'responsesRetentionMonths', '')::integer,
      contacts_retention_months = nullif(p_privacy ->> 'contactsRetentionMonths', '')::integer,
      project_context = nullif(btrim(p_privacy ->> 'projectContext'), ''),
      privacy_version = nullif(btrim(p_privacy ->> 'privacyVersion'), ''),
      updated_at = now()
    where id = 1;
  end if;
  if p_mode = 'live' and not public.tr_privacy_ready() then raise exception 'privacy_not_configured'; end if;
  update public.app_config set collection_mode = p_mode, updated_at = now(), updated_by = actor where id = 1;
  insert into public.admin_actions (actor_id, action, target_id, note) values (actor, 'update_settings', 'app_config', 'mode=' || p_mode);
  return jsonb_build_object('status', 'ok', 'mode', p_mode, 'ready', public.tr_privacy_ready());
end $$;

-- ---------------------------------------------------------------- EXECUTE: solo ciò che serve, a chi serve
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.tr_public_config() to anon, authenticated;
grant execute on function public.tr_is_creator() to authenticated;
grant execute on function public.tr_is_owner() to authenticated;

grant execute on function public.tr_start_session(text, date, uuid) to authenticated;
grant execute on function public.tr_save_search(uuid, text, date, date, integer, text) to authenticated;
grant execute on function public.tr_log_event(uuid, uuid, text, integer, text, text, timestamptz, jsonb) to authenticated;
grant execute on function public.tr_save_answer(uuid, text, text[], text, text, text) to authenticated;
grant execute on function public.tr_submit_survey(uuid, jsonb, text) to authenticated;
grant execute on function public.tr_email_prompt(uuid, text, text) to authenticated;
grant execute on function public.tr_submit_email(uuid, text, boolean, text) to authenticated;

grant execute on function public.tr_admin_me() to authenticated;
grant execute on function public.tr_admin_delete_session(uuid, text) to authenticated;
grant execute on function public.tr_admin_set_test(uuid, boolean, text) to authenticated;
grant execute on function public.tr_admin_revoke_contact(uuid, text) to authenticated;
grant execute on function public.tr_admin_reactivate_contact(uuid, text) to authenticated;
grant execute on function public.tr_admin_update_settings(text, jsonb) to authenticated;
