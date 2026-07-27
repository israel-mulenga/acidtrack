-- =====================================================================
-- AcidTrack — Notifications push (Web Push)
-- À exécuter APRÈS 01_schema.sql … 05_seed_auth.sql
--
-- Objectif : à chaque opération CRUD sur une table métier, une ligne est
-- écrite dans `notifications` (via un trigger générique). Chaque insertion
-- déclenche l'Edge Function `envoyer-push`, qui envoie une notification Web
-- Push à tous les abonnements (`push_subscriptions`) de l'organisation
-- concernée — y compris lorsque l'application est fermée (PWA installée).
--
-- Le modèle RLS reprend celui de 04_auth_rls.sql : isolation par
-- organisation via le helper `auth_org_id()` (dérivé de auth.uid() et de
-- utilisateurs.auth_id). `push_subscriptions` est en outre limité aux
-- propres lignes du compte connecté (auth_id = auth.uid()).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Nettoyage (idempotent, permet de rejouer le script)
-- ---------------------------------------------------------------------
drop table if exists notifications cascade;
drop table if exists push_subscriptions cascade;

-- ---------------------------------------------------------------------
-- 1. Abonnements Web Push d'un utilisateur
--    Un abonnement = un couple (navigateur, appareil) d'un compte donné.
--    `endpoint` est unique : réabonner un même appareil met à jour la ligne.
-- ---------------------------------------------------------------------
create table push_subscriptions (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references organisations(id) on delete cascade,
  -- Compte Supabase Auth propriétaire de l'abonnement
  auth_id          uuid not null,
  -- Ligne applicative correspondante (facultative : peut être résolue plus tard)
  utilisateur_id   uuid references utilisateurs(id) on delete cascade,
  endpoint         text not null unique,
  p256dh           text not null,
  auth             text not null,
  user_agent       text,
  created_at       timestamptz not null default now()
);

create index idx_push_subscriptions_org on push_subscriptions(organisation_id);

-- ---------------------------------------------------------------------
-- 2. Journal des notifications émises (une ligne par opération CRUD)
-- ---------------------------------------------------------------------
create table notifications (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references organisations(id) on delete cascade,
  table_source     text not null,
  operation        text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  record_id        uuid,
  titre            text not null,
  corps            text not null,
  payload          jsonb not null default '{}',
  created_at       timestamptz not null default now()
);

create index idx_notifications_org on notifications(organisation_id, created_at desc);

-- ---------------------------------------------------------------------
-- 3. RLS — isolation par organisation (cf. 04_auth_rls.sql)
--    `push_subscriptions` : chaque compte ne gère que ses propres lignes.
--    `notifications` : lecture pour les membres de l'organisation ; aucune
--    écriture directe (les lignes sont posées par le trigger SECURITY
--    DEFINER `fn_notifier_crud`).
-- ---------------------------------------------------------------------
alter table push_subscriptions enable row level security;
alter table notifications enable row level security;

-- Idempotence : on retire d'éventuelles policies d'une exécution précédente.
drop policy if exists push_subscriptions_lecture on push_subscriptions;
drop policy if exists push_subscriptions_insertion on push_subscriptions;
drop policy if exists push_subscriptions_maj on push_subscriptions;
drop policy if exists push_subscriptions_suppression on push_subscriptions;
drop policy if exists notifications_lecture on notifications;

create policy push_subscriptions_lecture on push_subscriptions
  for select to authenticated
  using (auth_id = auth.uid());

create policy push_subscriptions_insertion on push_subscriptions
  for insert to authenticated
  with check (auth_id = auth.uid() and organisation_id = auth_org_id());

create policy push_subscriptions_maj on push_subscriptions
  for update to authenticated
  using (auth_id = auth.uid())
  with check (auth_id = auth.uid() and organisation_id = auth_org_id());

create policy push_subscriptions_suppression on push_subscriptions
  for delete to authenticated
  using (auth_id = auth.uid());

create policy notifications_lecture on notifications
  for select to authenticated
  using (organisation_id = auth_org_id());

-- ---------------------------------------------------------------------
-- 4. Realtime : les clients ouverts reçoivent les nouvelles notifications
-- ---------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table notifications;
  alter publication supabase_realtime add table push_subscriptions;
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------
-- 5. Trigger générique CRUD -> notifications
--    Écrit une ligne lisible en français pour chaque INSERT/UPDATE/DELETE
--    d'une table métier. SECURITY DEFINER pour écrire malgré la RLS.
--    COALESCE(NEW, OLD) : fonctionne aussi bien en DELETE (OLD seul) qu'en
--    INSERT/UPDATE (NEW).
-- ---------------------------------------------------------------------
create or replace function fn_notifier_crud()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_org_id   uuid;
  v_record   uuid;
  v_ligne    jsonb;
  v_libelle  text;
  v_verbe    text;
  v_titre    text;
  v_corps    text;
begin
  -- La ligne pertinente selon l'opération
  if tg_op = 'DELETE' then
    v_ligne := to_jsonb(old);
  else
    v_ligne := to_jsonb(new);
  end if;

  v_org_id := coalesce(
    (v_ligne ->> 'organisation_id')::uuid,
    nullif(v_ligne ->> 'organisation_id', '')::uuid
  );
  -- Sécurité : sans organisation identifiable, on n'émet rien.
  if v_org_id is null then
    return coalesce(new, old);
  end if;

  v_record := nullif(v_ligne ->> 'id', '')::uuid;

  -- Libellé métier lisible par table
  v_libelle := case tg_table_name
    when 'clients'          then 'Client'
    when 'commandes'        then 'Commande'
    when 'lots'             then 'Lot'
    when 'camions'          then 'Camion'
    when 'etape_evenements' then 'Événement d''étape'
    when 'documents'        then 'Document'
    when 'incidents'        then 'Incident'
    when 'paiements'        then 'Paiement'
    when 'utilisateurs'     then 'Utilisateur'
    else tg_table_name
  end;

  v_verbe := case tg_op
    when 'INSERT' then 'créé(e)'
    when 'UPDATE' then 'modifié(e)'
    when 'DELETE' then 'supprimé(e)'
    else lower(tg_op)
  end;

  v_titre := v_libelle || ' ' || v_verbe;
  v_corps := coalesce(
    v_ligne ->> 'reference',
    v_ligne ->> 'raison_sociale',
    v_ligne ->> 'nom',
    v_ligne ->> 'description',
    v_libelle
  );

  insert into notifications (
    organisation_id, table_source, operation, record_id, titre, corps, payload
  )
  values (
    v_org_id,
    tg_table_name,
    tg_op,
    v_record,
    v_titre,
    v_corps,
    jsonb_build_object(
      'table_source', tg_table_name,
      'operation', tg_op,
      'record_id', v_record
    )
  );

  return coalesce(new, old);
end;
$$;

-- Rattachement du trigger aux tables métier
do $$
declare t text;
begin
  foreach t in array array[
    'clients','commandes','lots','camions','etape_evenements',
    'documents','incidents','paiements','utilisateurs'
  ]
  loop
    if to_regclass(t) is not null then
      execute format('drop trigger if exists trg_notifier_crud on %I', t);
      execute format(
        'create trigger trg_notifier_crud after insert or update or delete on %I for each row execute function fn_notifier_crud()',
        t
      );
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 6. Déclenchement de l'Edge Function à chaque nouvelle notification
--    Approche préférée : pg_net (extension `net`) appelle l'Edge Function
--    en HTTP POST avec l'id de la ligne. La fonction lit ensuite la
--    notification et envoie les Web Push.
--
--    CONFIGURATION REQUISE (via l'éditeur SQL, une seule fois) :
--      -- URL de l'Edge Function déployée :
--      alter database postgres
--        set app.settings.edge_function_url =
--        'https://<PROJECT_REF>.supabase.co/functions/v1/envoyer-push';
--      -- Clé service_role (Project Settings > API), pour autoriser l'appel :
--      alter database postgres
--        set app.settings.service_role_key = '<SERVICE_ROLE_KEY>';
--
--    Si l'extension `pg_net` n'est pas disponible sur votre projet,
--    supprimez ce trigger et configurez plutôt un Database Webhook
--    (Dashboard > Database > Webhooks) sur INSERT de `notifications`
--    pointant vers l'Edge Function (voir README, section « Notifications
--    push »).
-- ---------------------------------------------------------------------
create extension if not exists pg_net;

create or replace function fn_declencher_push()
returns trigger
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_url text := current_setting('app.settings.edge_function_url', true);
  v_key text := current_setting('app.settings.service_role_key', true);
begin
  -- Sans URL configurée, on ne fait rien (le journal reste néanmoins écrit).
  if v_url is null or v_url = '' then
    raise log 'fn_declencher_push : app.settings.edge_function_url non configuré, push ignoré';
    return new;
  end if;

  -- L'en-tête Authorization est OBLIGATOIRE : par défaut, les Edge Functions
  -- Supabase vérifient le JWT (verify_jwt = true). Sans un Bearer valide,
  -- l'appel renvoie 401 et AUCUN push n'est envoyé — la notification
  -- n'apparaît alors que dans l'application (toast temps réel), jamais dans
  -- la barre de notification du système.
  if v_key is null or v_key = '' then
    raise log 'fn_declencher_push : app.settings.service_role_key non configuré, l''appel renverra 401';
  end if;

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(v_key, '')
    ),
    body    := jsonb_build_object('notification_id', new.id)
  );

  return new;
end;
$$;

drop trigger if exists trg_declencher_push on notifications;
create trigger trg_declencher_push
  after insert on notifications
  for each row execute function fn_declencher_push();
