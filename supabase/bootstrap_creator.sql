-- Bootstrap dei creator (da eseguire SOLO nel SQL Editor di Supabase, mai dal sito pubblico).
--
-- 1. Supabase Dashboard → Authentication → Users → "Add user" → "Create new user":
--    inserisci email e password del membro del gruppo (spunta "Auto Confirm User").
-- 2. Copia lo "User UID" dell'utente appena creato.
-- 3. Sostituisci l'UUID qui sotto ed esegui la query.
--
-- Ruoli:
--   owner  → statistiche, partecipazioni, contatti/email, export contatti, cancellazioni, impostazioni
--   viewer → statistiche e partecipazioni, senza email né azioni di modifica
--
-- Nessun utente diventa creator da solo: solo chi ha accesso al SQL Editor può modificare questa tabella.

insert into public.creator_members (user_id, role, label)
values ('00000000-0000-0000-0000-000000000000', 'owner', 'Nome del membro del gruppo')
on conflict (user_id) do update set role = excluded.role, label = excluded.label;

-- Per rimuovere un creator:
-- delete from public.creator_members where user_id = '00000000-0000-0000-0000-000000000000';
