-- =====================================================================
-- AcidTrack — Schéma MVP
-- Suivi des camions d'acide sulfurique : Zambie -> RDC
-- À exécuter dans : Supabase Dashboard > SQL Editor > New query
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Nettoyage (idempotent, permet de rejouer le script)
-- ---------------------------------------------------------------------
drop table if exists incidents cascade;
drop table if exists documents cascade;
drop table if exists etape_evenements cascade;
drop table if exists paiements cascade;
drop table if exists camions cascade;
drop table if exists lots cascade;
drop table if exists commandes cascade;
drop table if exists clients cascade;
drop table if exists utilisateurs cascade;
drop table if exists organisations cascade;
drop table if exists etapes_referentiel cascade;

drop type if exists statut_etape cascade;
drop type if exists statut_camion cascade;
drop type if exists role_utilisateur cascade;
drop type if exists gravite_incident cascade;

-- ---------------------------------------------------------------------
-- 1. Types énumérés (cf. §6.2 du cahier des charges)
-- ---------------------------------------------------------------------
create type statut_etape as enum (
  'PLANIFIE',              -- Client : « À venir »
  'EN_ATTENTE_ACTION',     -- Client : « À traiter »
  'EN_COURS',              -- Client : « En cours »
  'EN_ATTENTE_VALIDATION', -- Client : « En vérification »
  'TERMINE',               -- Client : « Terminé »
  'BLOQUE',                -- Client : « Attention requise »
  'EN_RETARD',             -- Client : « En retard »
  'ANNULE'                 -- Client : « Annulé »
);

create type statut_camion as enum ('EN_COURS', 'TERMINE', 'BLOQUE', 'ANNULE');

create type role_utilisateur as enum ('ADMIN', 'OPS', 'TERRAIN', 'FINANCE', 'CLIENT');

create type gravite_incident as enum ('FAIBLE', 'MOYENNE', 'ELEVEE', 'CRITIQUE');

-- ---------------------------------------------------------------------
-- 2. Multi-tenant : organisations et utilisateurs
--    Toutes les tables métier portent organisation_id : l'isolation est
--    structurée dès le MVP, le durcissement RLS est un paramétrage.
-- ---------------------------------------------------------------------
create table organisations (
  id          uuid primary key default gen_random_uuid(),
  nom         text not null,
  plan        text not null default 'PILOTE',
  langue      text not null default 'fr',
  fuseau      text not null default 'Africa/Lubumbashi',
  statut      text not null default 'ACTIF',
  created_at  timestamptz not null default now()
);

create table utilisateurs (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references organisations(id) on delete cascade,
  nom              text not null,
  role             role_utilisateur not null,
  email            text,
  telephone        text,
  -- Renseigné quand le rôle est CLIENT : restreint la visibilité à ce client
  client_id        uuid,
  statut           text not null default 'ACTIF',
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. Référentiel métier : clients / mines
-- ---------------------------------------------------------------------
create table clients (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references organisations(id) on delete cascade,
  raison_sociale   text not null,
  mine             text,
  ville            text,
  contact_nom      text,
  contact_tel      text,
  created_at       timestamptz not null default now()
);

alter table utilisateurs
  add constraint utilisateurs_client_fk
  foreign key (client_id) references clients(id) on delete set null;

-- ---------------------------------------------------------------------
-- 4. Hiérarchie : Commande -> Lot -> Dossier camion (cf. §5)
-- ---------------------------------------------------------------------
create table commandes (
  id                   uuid primary key default gen_random_uuid(),
  organisation_id      uuid not null references organisations(id) on delete cascade,
  client_id            uuid not null references clients(id) on delete restrict,
  reference            text not null unique,
  produit              text not null default 'Acide sulfurique H2SO4',
  concentration        text default '98%',
  quantite_commandee_t numeric(12,2) not null,
  prix_unitaire_usd    numeric(12,2),
  origine              text not null default 'Zambie',
  destination          text not null,
  conditions_paiement  text,
  statut               text not null default 'EN_COURS',
  created_at           timestamptz not null default now()
);

create table lots (
  id                   uuid primary key default gen_random_uuid(),
  organisation_id      uuid not null references organisations(id) on delete cascade,
  commande_id          uuid not null references commandes(id) on delete cascade,
  reference            text not null unique,
  corridor             text not null,
  destination          text not null,       -- Lubumbashi | Likasi | Kolwezi
  quantite_planifiee_t numeric(12,2) not null,
  nb_camions_prevu     int not null default 0,
  periode_debut        date,
  periode_fin          date,
  statut               text not null default 'EN_COURS',
  created_at           timestamptz not null default now()
);

-- « Dossier camion » du cahier des charges. Une ligne = un camion sur un lot.
create table camions (
  id                   uuid primary key default gen_random_uuid(),
  organisation_id      uuid not null references organisations(id) on delete cascade,
  lot_id               uuid not null references lots(id) on delete cascade,
  reference            text not null unique,
  plaque_tracteur      text not null,
  plaque_citerne       text,
  transporteur         text,
  chauffeur_nom        text,
  chauffeur_tel        text,
  capacite_t           numeric(10,2),
  tonnage_net_t        numeric(10,2) not null,
  numeros_scelles      text,
  -- Étape courante : 1 à 7 (cf. §6). 8 = dossier clôturé.
  etape_courante       int not null default 1 check (etape_courante between 1 and 8),
  statut               statut_camion not null default 'EN_COURS',
  eta                  timestamptz,
  derniere_position_lat  numeric(10,6),
  derniere_position_lng  numeric(10,6),
  derniere_position_lib  text,
  derniere_maj_at      timestamptz not null default now(),
  derniere_maj_par     text,
  created_at           timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 5. Référentiel des 7 macro-étapes (cf. §6)
--    Pilote le formulaire dynamique, les documents obligatoires et le SLA.
-- ---------------------------------------------------------------------
create table etapes_referentiel (
  numero            int primary key check (numero between 1 and 7),
  code              text not null unique,
  libelle           text not null,
  objectif          text not null,
  responsable       text not null,
  sla_heures        int not null,
  -- Documents dont la présence est BLOQUANTE pour passer en TERMINE (§12.3)
  documents_requis  text[] not null default '{}',
  -- Schéma des champs métier obligatoires, rendu dynamiquement par le front
  champs            jsonb not null default '[]'
);

-- ---------------------------------------------------------------------
-- 6. Événements d'étape — table APPEND-ONLY (§12.5 : versionnement)
--    Aucune ligne n'est jamais modifiée hormis la validation/rejet.
-- ---------------------------------------------------------------------
create table etape_evenements (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references organisations(id) on delete cascade,
  camion_id        uuid not null references camions(id) on delete cascade,
  etape_numero     int not null check (etape_numero between 1 and 7),
  statut           statut_etape not null,
  commentaire      text,
  donnees          jsonb not null default '{}',
  position_lat     numeric(10,6),
  position_lng     numeric(10,6),
  position_lib     text,
  position_source  text,                 -- 'GPS' | 'MANUEL'
  auteur_nom       text not null,
  auteur_role      role_utilisateur not null,
  -- Cycle de validation (§8.3.5)
  valide_par       text,
  valide_at        timestamptz,
  motif_rejet      text,
  version          int not null default 1,
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 7. Documents / preuves
-- ---------------------------------------------------------------------
create table documents (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references organisations(id) on delete cascade,
  camion_id        uuid not null references camions(id) on delete cascade,
  evenement_id     uuid references etape_evenements(id) on delete set null,
  etape_numero     int check (etape_numero between 1 and 7),
  type             text not null,        -- BL, TICKET_PESEE, COA, POD, ...
  nom_fichier      text not null,
  chemin_storage   text,                 -- clé dans le bucket 'preuves'
  url              text,
  mime             text,
  taille_octets    bigint,
  visible_client   boolean not null default true,
  statut           text not null default 'VALIDE',  -- VALIDE | EXPIRE | REJETE
  depose_par       text,
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 8. Incidents / blocages (§8.9)
-- ---------------------------------------------------------------------
create table incidents (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references organisations(id) on delete cascade,
  camion_id        uuid not null references camions(id) on delete cascade,
  etape_numero     int check (etape_numero between 1 and 7),
  categorie        text not null,        -- DOUANE, PANNE, RETARD, QUALITE, ...
  gravite          gravite_incident not null,
  description      text not null,
  responsable      text,
  plan_action      text,
  statut           text not null default 'OUVERT',  -- OUVERT | RESOLU
  ouvert_par       text,
  resolu_at        timestamptz,
  resolution       text,
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 9. Paiements (§8.8) — lecture/affichage dans le MVP
-- ---------------------------------------------------------------------
create table paiements (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references organisations(id) on delete cascade,
  commande_id      uuid not null references commandes(id) on delete cascade,
  camion_id        uuid references camions(id) on delete set null,
  type             text not null,        -- INITIAL | FINAL
  montant          numeric(14,2) not null,
  devise           text not null default 'USD',
  reference        text,
  date_valeur      date,
  statut           text not null default 'RECU',  -- ATTENDU | RECU | LITIGE
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 10. Index utiles aux écrans
-- ---------------------------------------------------------------------
create index idx_camions_lot        on camions(lot_id);
create index idx_camions_org        on camions(organisation_id);
create index idx_lots_commande      on lots(commande_id);
create index idx_evt_camion         on etape_evenements(camion_id, etape_numero);
create index idx_evt_created        on etape_evenements(created_at desc);
create index idx_docs_camion        on documents(camion_id);
create index idx_incidents_camion   on incidents(camion_id);

-- ---------------------------------------------------------------------
-- 11. Règle métier automatisée : un incident CRITIQUE ouvert bloque
--     immédiatement le camion (§8.9). Sa résolution le débloque.
-- ---------------------------------------------------------------------
create or replace function fn_incident_bloque_camion()
returns trigger
language plpgsql
as $$
begin
  if new.gravite = 'CRITIQUE' and new.statut = 'OUVERT' then
    update camions set statut = 'BLOQUE', derniere_maj_at = now() where id = new.camion_id;
  elsif new.statut = 'RESOLU' then
    -- On ne débloque que s'il ne reste aucun autre incident critique ouvert
    if not exists (
      select 1 from incidents
      where camion_id = new.camion_id
        and gravite = 'CRITIQUE'
        and statut = 'OUVERT'
        and id <> new.id
    ) then
      update camions
      set statut = case when etape_courante >= 8 then 'TERMINE' else 'EN_COURS' end,
          derniere_maj_at = now()
      where id = new.camion_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_incident_bloque_camion
after insert or update on incidents
for each row execute function fn_incident_bloque_camion();

-- ---------------------------------------------------------------------
-- 12. Vue de progression pondérée par le tonnage (§5)
--     « somme(tonnage × progression) ÷ tonnage total du lot »
--     La progression du lot est DÉRIVÉE, jamais saisie (§12.6).
-- ---------------------------------------------------------------------
create or replace view v_lots_progression as
select
  l.id                                as lot_id,
  l.reference,
  count(c.id)                         as nb_camions,
  coalesce(sum(c.tonnage_net_t), 0)   as tonnage_total,
  coalesce(
    sum(c.tonnage_net_t * least(greatest(c.etape_courante - 1, 0), 7) / 7.0)
      / nullif(sum(c.tonnage_net_t), 0) * 100,
    0
  )::numeric(5,2)                     as progression_pct,
  count(*) filter (where c.statut = 'BLOQUE')  as nb_bloques,
  count(*) filter (where c.statut = 'TERMINE') as nb_termines
from lots l
left join camions c on c.lot_id = l.id and c.statut <> 'ANNULE'
group by l.id, l.reference;

-- ---------------------------------------------------------------------
-- 13. RLS — activée sur toutes les tables.
--     MVP : politique démo permissive (le rôle applicatif est porté par
--     le sélecteur de profil côté front). En production, remplacer la
--     policy 'demo_full_access' par un filtre sur organisation_id issu
--     du JWT : using (organisation_id = auth.jwt() ->> 'org_id')
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'organisations','utilisateurs','clients','commandes','lots','camions',
    'etapes_referentiel','etape_evenements','documents','incidents','paiements'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists demo_full_access on %I', t);
    execute format(
      'create policy demo_full_access on %I for all to anon, authenticated using (true) with check (true)', t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 14. Storage : bucket public pour les preuves (photos, BL, POD)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('preuves', 'preuves', true, 10485760)
on conflict (id) do update set public = true, file_size_limit = 10485760;

drop policy if exists preuves_lecture on storage.objects;
create policy preuves_lecture on storage.objects
  for select to anon, authenticated using (bucket_id = 'preuves');

drop policy if exists preuves_depot on storage.objects;
create policy preuves_depot on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'preuves');

-- ---------------------------------------------------------------------
-- 15. Realtime : la timeline et le portail client se rafraîchissent seuls
-- ---------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table camions;
  alter publication supabase_realtime add table etape_evenements;
  alter publication supabase_realtime add table incidents;
exception when duplicate_object then null;
end $$;
