-- =====================================================================
-- AcidTrack — Authentification réelle (Supabase Auth) et RLS multi-tenant
-- À exécuter APRÈS 01_schema.sql et 02_seed.sql
--
-- Principe : un utilisateur Supabase Auth (auth.users) est rattaché à une
-- ligne `utilisateurs` via `auth_id`. Toutes les policies RLS s'appuient
-- sur ce rattachement pour ne jamais exposer les données d'une autre
-- organisation (AC-09) — et, pour un compte Client, pour ne jamais exposer
-- les dossiers d'un autre client.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Rattachement Auth <-> utilisateurs
-- ---------------------------------------------------------------------
alter table utilisateurs
  add column if not exists auth_id uuid references auth.users(id) on delete set null;

create unique index if not exists utilisateurs_auth_id_uniq on utilisateurs(auth_id);

-- Une adresse e-mail ne peut être invitée qu'une fois par organisation ;
-- c'est aussi elle qui sert de clé de rapprochement lors de l'auto-inscription.
create unique index if not exists utilisateurs_org_email_uniq
  on utilisateurs(organisation_id, lower(email))
  where email is not null;

-- Cycle de vie d'un compte : INVITE (créé par un admin, pas encore réclamé),
-- ACTIF, SUSPENDU (accès coupé sans supprimer l'historique de saisie).
alter table utilisateurs
  drop constraint if exists utilisateurs_statut_check;
alter table utilisateurs
  add constraint utilisateurs_statut_check
  check (statut in ('INVITE', 'ACTIF', 'SUSPENDU'));

-- ---------------------------------------------------------------------
-- 2. Détails d'organisation (§ profil organisation)
-- ---------------------------------------------------------------------
alter table organisations
  add column if not exists devise text not null default 'USD';
alter table organisations
  add column if not exists logo_url text;
alter table organisations
  drop constraint if exists organisations_statut_check;
alter table organisations
  add constraint organisations_statut_check check (statut in ('ACTIF', 'SUSPENDU'));

-- ---------------------------------------------------------------------
-- 3. Fonctions utilitaires — SECURITY DEFINER pour échapper à la RLS
--    de `utilisateurs` sans quoi une policy qui les appelle créerait une
--    récursion infinie sur cette même table.
-- ---------------------------------------------------------------------
create or replace function auth_utilisateur_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select id from utilisateurs where auth_id = auth.uid() and statut <> 'SUSPENDU' limit 1;
$$;

create or replace function auth_org_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select organisation_id from utilisateurs where auth_id = auth.uid() and statut <> 'SUSPENDU' limit 1;
$$;

create or replace function auth_role()
returns role_utilisateur
language sql stable security definer set search_path = public
as $$
  select role from utilisateurs where auth_id = auth.uid() and statut <> 'SUSPENDU' limit 1;
$$;

create or replace function auth_client_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select client_id from utilisateurs where auth_id = auth.uid() and statut <> 'SUSPENDU' limit 1;
$$;

-- Un compte Client ne voit que les commandes de son client (AC-09).
-- Vérifie l'appartenance via la chaîne commande -> lot -> camion.
create or replace function client_voit_commande(p_client_id uuid)
returns boolean language sql stable as $$
  select auth_role() <> 'CLIENT' or p_client_id = auth_client_id();
$$;

-- ---------------------------------------------------------------------
-- 4. Inscription et invitations — RPC SECURITY DEFINER
--    Ce sont les seules portes d'entrée pour créer une organisation ou
--    rattacher un compte : la table `organisations` n'a pas de policy
--    d'insertion directe (cf. section 6).
-- ---------------------------------------------------------------------

-- Création d'une nouvelle organisation par son premier administrateur.
-- Appelée juste après `supabase.auth.signUp` : l'appelant doit déjà avoir
-- une session (auth.uid() non nul).
create or replace function creer_organisation(p_nom_org text, p_nom_utilisateur text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_org_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise.';
  end if;

  if exists (select 1 from utilisateurs where auth_id = auth.uid()) then
    raise exception 'Ce compte est déjà rattaché à une organisation.';
  end if;

  insert into organisations (nom) values (trim(p_nom_org))
  returning id into v_org_id;

  insert into utilisateurs (organisation_id, nom, role, email, auth_id, statut)
  values (v_org_id, trim(p_nom_utilisateur), 'ADMIN', auth.email(), auth.uid(), 'ACTIF');

  return v_org_id;
end;
$$;

-- Invitation d'un utilisateur par un administrateur de l'organisation
-- courante. La ligne est créée sans auth_id : elle est « réclamée » au
-- premier login de la personne invitée (cf. rejoindre_organisation).
create or replace function inviter_utilisateur(
  p_email text,
  p_nom text,
  p_role role_utilisateur,
  p_client_id uuid default null
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_org_id uuid := auth_org_id();
  v_id uuid;
begin
  if v_org_id is null then
    raise exception 'Compte non rattaché à une organisation.';
  end if;
  if auth_role() <> 'ADMIN' then
    raise exception 'Seul un administrateur peut inviter un utilisateur.';
  end if;
  if p_role = 'CLIENT' and p_client_id is null then
    raise exception 'Un compte Client doit être rattaché à un client.';
  end if;
  if p_role = 'CLIENT' and not exists (
    select 1 from clients where id = p_client_id and organisation_id = v_org_id
  ) then
    raise exception 'Client introuvable dans cette organisation.';
  end if;

  insert into utilisateurs (organisation_id, nom, role, email, client_id, statut)
  values (v_org_id, trim(p_nom), p_role, lower(trim(p_email)), p_client_id, 'INVITE')
  returning id into v_id;

  return v_id;
end;
$$;

-- Rattachement du compte Auth qui vient de se créer (signUp) à l'invitation
-- correspondant à son adresse e-mail. Si aucune invitation n'existe, refuse :
-- on ne permet pas la création libre de comptes en dehors de la création
-- d'organisation ou d'une invitation explicite (isolation des données).
create or replace function rejoindre_organisation()
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_org_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise.';
  end if;

  if exists (select 1 from utilisateurs where auth_id = auth.uid()) then
    raise exception 'Ce compte est déjà rattaché à une organisation.';
  end if;

  update utilisateurs
  set auth_id = auth.uid(), statut = 'ACTIF'
  where lower(email) = lower(auth.email())
    and auth_id is null
    and statut = 'INVITE'
  returning organisation_id into v_org_id;

  if v_org_id is null then
    raise exception 'Aucune invitation trouvée pour cette adresse e-mail.';
  end if;

  return v_org_id;
end;
$$;

grant execute on function creer_organisation(text, text) to authenticated;
grant execute on function inviter_utilisateur(text, text, role_utilisateur, uuid) to authenticated;
grant execute on function rejoindre_organisation() to authenticated;

-- ---------------------------------------------------------------------
-- 5. RLS — retrait des policies de démonstration
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'organisations','utilisateurs','clients','commandes','lots','camions',
    'etape_evenements','documents','incidents','paiements',
    'points_chargement','itineraires','modeles_etapes','modeles_etapes_lignes'
  ]
  loop
    if to_regclass(t) is not null then
      execute format('drop policy if exists demo_full_access on %I', t);
    end if;
  end loop;
end $$;

-- Script idempotent : on retire d'éventuelles policies posées par une
-- exécution précédente avant de les recréer.
do $$
declare p record;
begin
  for p in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in (
        'organisations','utilisateurs','clients','commandes','lots','camions',
        'etape_evenements','documents','incidents','paiements'
      )
      and policyname <> 'demo_full_access'
  loop
    execute format('drop policy if exists %I on %I', p.policyname, p.tablename);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 6. organisations — lecture et mise à jour par les membres, jamais
--    d'insertion/suppression directe (uniquement via creer_organisation)
-- ---------------------------------------------------------------------
create policy organisations_lecture on organisations
  for select to authenticated using (id = auth_org_id());

create policy organisations_maj on organisations
  for update to authenticated
  using (id = auth_org_id() and auth_role() = 'ADMIN')
  with check (id = auth_org_id() and auth_role() = 'ADMIN');

-- ---------------------------------------------------------------------
-- 7. utilisateurs — visibilité de son organisation + de soi-même
--    (le « soi-même » couvre l'instant qui suit un signUp, avant que
--    auth_org_id() ne puisse résoudre l'organisation)
-- ---------------------------------------------------------------------
create policy utilisateurs_lecture on utilisateurs
  for select to authenticated
  using (organisation_id = auth_org_id() or auth_id = auth.uid());

create policy utilisateurs_ecriture on utilisateurs
  for insert to authenticated
  with check (organisation_id = auth_org_id() and auth_role() = 'ADMIN');

create policy utilisateurs_maj on utilisateurs
  for update to authenticated
  using (organisation_id = auth_org_id() and auth_role() = 'ADMIN')
  with check (organisation_id = auth_org_id() and auth_role() = 'ADMIN');

create policy utilisateurs_suppression on utilisateurs
  for delete to authenticated
  using (organisation_id = auth_org_id() and auth_role() = 'ADMIN' and auth_id is distinct from id);

-- ---------------------------------------------------------------------
-- 8. Référentiel de l'organisation : clients, points de chargement,
--    itinéraires, modèles d'étapes — accès complet aux membres de
--    l'organisation, en écriture pour tous sauf Client (permissions
--    applicatives déjà vides pour ce rôle, la RLS le confirme).
-- ---------------------------------------------------------------------
create policy clients_lecture on clients
  for select to authenticated
  using (organisation_id = auth_org_id() and client_voit_commande(id));

create policy clients_ecriture on clients
  for all to authenticated
  using (organisation_id = auth_org_id() and auth_role() <> 'CLIENT')
  with check (organisation_id = auth_org_id() and auth_role() <> 'CLIENT');

do $$
declare t text;
begin
  foreach t in array array['points_chargement','itineraires','modeles_etapes','modeles_etapes_lignes','etapes_referentiel']
  loop
    if to_regclass(t) is not null then
      execute format('drop policy if exists %I_org on %I', t, t);
      execute format(
        'create policy %I_org on %I for all to authenticated using (organisation_id = auth_org_id()) with check (organisation_id = auth_org_id())',
        t, t
      );
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 9. Hiérarchie commerciale — isolation par organisation, puis par
--    client pour les comptes Client (lecture seule pour ce rôle).
-- ---------------------------------------------------------------------
create policy commandes_lecture on commandes
  for select to authenticated
  using (organisation_id = auth_org_id() and client_voit_commande(client_id));

create policy commandes_ecriture on commandes
  for insert to authenticated
  with check (organisation_id = auth_org_id() and auth_role() <> 'CLIENT');
create policy commandes_maj on commandes
  for update to authenticated
  using (organisation_id = auth_org_id() and auth_role() <> 'CLIENT')
  with check (organisation_id = auth_org_id() and auth_role() <> 'CLIENT');
create policy commandes_suppression on commandes
  for delete to authenticated
  using (organisation_id = auth_org_id() and auth_role() <> 'CLIENT');

create policy lots_lecture on lots
  for select to authenticated
  using (
    organisation_id = auth_org_id()
    and (auth_role() <> 'CLIENT' or exists (
      select 1 from commandes c where c.id = lots.commande_id and c.client_id = auth_client_id()
    ))
  );
create policy lots_ecriture on lots
  for all to authenticated
  using (organisation_id = auth_org_id() and auth_role() <> 'CLIENT')
  with check (organisation_id = auth_org_id() and auth_role() <> 'CLIENT');

create policy camions_lecture on camions
  for select to authenticated
  using (
    organisation_id = auth_org_id()
    and (auth_role() <> 'CLIENT' or exists (
      select 1 from lots l join commandes c on c.id = l.commande_id
      where l.id = camions.lot_id and c.client_id = auth_client_id()
    ))
  );
create policy camions_ecriture on camions
  for insert to authenticated
  with check (organisation_id = auth_org_id() and auth_role() <> 'CLIENT');
create policy camions_maj on camions
  for update to authenticated
  using (organisation_id = auth_org_id() and auth_role() <> 'CLIENT')
  with check (organisation_id = auth_org_id() and auth_role() <> 'CLIENT');
create policy camions_suppression on camions
  for delete to authenticated
  using (organisation_id = auth_org_id() and auth_role() = 'ADMIN');

-- ---------------------------------------------------------------------
-- 10. Étapes, documents, incidents, paiements — même logique d'isolation.
--     Le rôle Client ne saisit jamais d'étape (droits applicatifs vides) ;
--     la RLS l'interdit également en écriture.
-- ---------------------------------------------------------------------
create policy evenements_lecture on etape_evenements
  for select to authenticated
  using (
    organisation_id = auth_org_id()
    and (auth_role() <> 'CLIENT' or exists (
      select 1 from camions ca join lots l on l.id = ca.lot_id join commandes c on c.id = l.commande_id
      where ca.id = etape_evenements.camion_id and c.client_id = auth_client_id()
    ))
  );
create policy evenements_ecriture on etape_evenements
  for insert to authenticated
  with check (organisation_id = auth_org_id() and auth_role() <> 'CLIENT');
create policy evenements_maj on etape_evenements
  for update to authenticated
  using (organisation_id = auth_org_id() and auth_role() <> 'CLIENT')
  with check (organisation_id = auth_org_id() and auth_role() <> 'CLIENT');

create policy documents_lecture on documents
  for select to authenticated
  using (
    organisation_id = auth_org_id()
    and (
      auth_role() <> 'CLIENT'
      or (visible_client and exists (
        select 1 from camions ca join lots l on l.id = ca.lot_id join commandes c on c.id = l.commande_id
        where ca.id = documents.camion_id and c.client_id = auth_client_id()
      ))
    )
  );
create policy documents_ecriture on documents
  for insert to authenticated
  with check (organisation_id = auth_org_id() and auth_role() <> 'CLIENT');
create policy documents_maj on documents
  for update to authenticated
  using (organisation_id = auth_org_id() and auth_role() <> 'CLIENT')
  with check (organisation_id = auth_org_id() and auth_role() <> 'CLIENT');

create policy incidents_lecture on incidents
  for select to authenticated
  using (
    organisation_id = auth_org_id()
    and (auth_role() <> 'CLIENT' or exists (
      select 1 from camions ca join lots l on l.id = ca.lot_id join commandes c on c.id = l.commande_id
      where ca.id = incidents.camion_id and c.client_id = auth_client_id()
    ))
  );
create policy incidents_ecriture on incidents
  for insert to authenticated
  with check (organisation_id = auth_org_id() and auth_role() <> 'CLIENT');
create policy incidents_maj on incidents
  for update to authenticated
  using (organisation_id = auth_org_id() and auth_role() <> 'CLIENT')
  with check (organisation_id = auth_org_id() and auth_role() <> 'CLIENT');

create policy paiements_lecture on paiements
  for select to authenticated
  using (
    organisation_id = auth_org_id()
    and (auth_role() <> 'CLIENT' or exists (
      select 1 from commandes c where c.id = paiements.commande_id and c.client_id = auth_client_id()
    ))
  );
create policy paiements_ecriture on paiements
  for all to authenticated
  using (organisation_id = auth_org_id() and auth_role() in ('ADMIN','OPS','FINANCE'))
  with check (organisation_id = auth_org_id() and auth_role() in ('ADMIN','OPS','FINANCE'));

-- ---------------------------------------------------------------------
-- 11. Storage — les preuves ne sont plus accessibles en anonyme.
--     Convention de chemin : <organisation_id>/<camion_id>/... n'est pas
--     imposée par l'app pour le MVP ; l'isolation réelle des pièces
--     jointes reste portée par la table `documents` (URL signée côté
--     lecture serait l'étape suivante hors périmètre MVP).
-- ---------------------------------------------------------------------
drop policy if exists preuves_lecture on storage.objects;
create policy preuves_lecture on storage.objects
  for select to authenticated using (bucket_id = 'preuves');

drop policy if exists preuves_depot on storage.objects;
create policy preuves_depot on storage.objects
  for insert to authenticated with check (bucket_id = 'preuves');
