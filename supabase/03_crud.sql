-- =====================================================================
-- AcidTrack — Migration 03 : référentiel paramétrable et CRUD applicatif
--
-- À exécuter APRÈS 01_schema.sql et 02_seed.sql.
-- Le script est idempotent : il peut être rejoué sans dommage.
--
-- Objet :
--   1. Points de chargement (§3.1)
--   2. Itinéraires, porteurs des jalons réellement empruntés (AC-06)
--   3. Modèles d'étapes paramétrables, en remplacement de la table figée
--      `etapes_referentiel`
--   4. Rattachement des lots à un itinéraire et à un modèle
--
-- Après cette migration, plus aucune donnée métier n'a besoin d'être créée
-- en SQL : toute la création se fait depuis l'application.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Points de chargement
-- ---------------------------------------------------------------------
create table if not exists points_chargement (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references organisations(id) on delete cascade,
  nom              text not null,
  ville            text,
  pays             text not null default 'Zambie',
  contact_nom      text,
  contact_tel      text,
  actif            boolean not null default true,
  created_at       timestamptz not null default now(),
  unique (organisation_id, nom)
);

-- ---------------------------------------------------------------------
-- 2. Modèles d'étapes
--    Un modèle = une séquence de 7 macro-étapes paramétrées (libellé,
--    responsable, SLA, documents bloquants, champs métier).
--    Remplace la table `etapes_referentiel`, qui était globale et figée.
-- ---------------------------------------------------------------------
create table if not exists modeles_etapes (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references organisations(id) on delete cascade,
  nom              text not null,
  description      text,
  par_defaut       boolean not null default false,
  actif            boolean not null default true,
  created_at       timestamptz not null default now(),
  unique (organisation_id, nom)
);

create table if not exists modeles_etapes_lignes (
  id                uuid primary key default gen_random_uuid(),
  modele_id         uuid not null references modeles_etapes(id) on delete cascade,
  numero            int not null check (numero between 1 and 7),
  code              text not null,
  libelle           text not null,
  objectif          text not null default '',
  responsable       text not null default '',
  sla_heures        int not null default 24 check (sla_heures > 0),
  -- Documents dont la présence est BLOQUANTE pour clôturer l'étape (§12.3)
  documents_requis  text[] not null default '{}',
  -- Schéma des champs métier, rendu dynamiquement par le formulaire
  champs            jsonb not null default '[]',
  unique (modele_id, numero)
);

-- ---------------------------------------------------------------------
-- 3. Itinéraires
--    `jalons` porte les points de contrôle réellement empruntés : c'est
--    cette colonne qui masque les jalons Kolwezi sur une route
--    Lubumbashi (critère AC-06), au lieu d'une table de correspondance
--    codée en dur dans le front.
-- ---------------------------------------------------------------------
create table if not exists itineraires (
  id                   uuid primary key default gen_random_uuid(),
  organisation_id      uuid not null references organisations(id) on delete cascade,
  nom                  text not null,
  point_chargement_id  uuid references points_chargement(id) on delete set null,
  origine              text not null default 'Zambie',
  destination          text not null,
  corridor             text not null,
  jalons               text[] not null default '{}',
  distance_km          int,
  duree_estimee_h      int,
  modele_etapes_id     uuid references modeles_etapes(id) on delete set null,
  actif                boolean not null default true,
  created_at           timestamptz not null default now(),
  unique (organisation_id, nom)
);

-- ---------------------------------------------------------------------
-- 4. Rattachement des lots
-- ---------------------------------------------------------------------
alter table lots add column if not exists itineraire_id uuid references itineraires(id) on delete set null;
alter table lots add column if not exists modele_etapes_id uuid references modeles_etapes(id) on delete set null;

-- Désactivation logique des clients plutôt que suppression : les
-- commandes historiques doivent rester consultables.
alter table clients add column if not exists actif boolean not null default true;

-- ---------------------------------------------------------------------
-- 5. Reprise de l'existant
--    Le contenu de `etapes_referentiel` devient le modèle par défaut.
-- ---------------------------------------------------------------------
do $$
declare
  v_org    uuid;
  v_modele uuid;
begin
  select id into v_org from organisations order by created_at limit 1;
  if v_org is null then
    raise notice 'Aucune organisation : migration des modèles ignorée.';
    return;
  end if;

  insert into modeles_etapes (organisation_id, nom, description, par_defaut)
  values (
    v_org,
    'Corridor Zambie → RDC (standard)',
    'Séquence de référence en sept macro-étapes, du chargement à la clôture.',
    true
  )
  on conflict (organisation_id, nom) do update set par_defaut = true
  returning id into v_modele;

  if v_modele is null then
    select id into v_modele
      from modeles_etapes
     where organisation_id = v_org and nom = 'Corridor Zambie → RDC (standard)';
  end if;

  -- Copie des 7 étapes historiques si la table d'origine existe encore
  if to_regclass('public.etapes_referentiel') is not null then
    insert into modeles_etapes_lignes
      (modele_id, numero, code, libelle, objectif, responsable, sla_heures, documents_requis, champs)
    select v_modele, e.numero, e.code, e.libelle, e.objectif, e.responsable,
           e.sla_heures, e.documents_requis, e.champs
      from etapes_referentiel e
    on conflict (modele_id, numero) do nothing;
  end if;

  update lots set modele_etapes_id = v_modele where modele_etapes_id is null;
end $$;

-- ---------------------------------------------------------------------
-- 6. Points de chargement et itinéraires de départ
--    Déduits des lots existants pour que l'application soit cohérente
--    dès la première ouverture.
-- ---------------------------------------------------------------------
do $$
declare
  v_org    uuid;
  v_modele uuid;
  v_point  uuid;
  r        record;
  v_jalons text[];
begin
  select id into v_org from organisations order by created_at limit 1;
  if v_org is null then return; end if;

  select id into v_modele from modeles_etapes
   where organisation_id = v_org and par_defaut limit 1;

  insert into points_chargement (organisation_id, nom, ville, pays)
  values (v_org, 'Terminal acide de Ndola', 'Ndola', 'Zambie')
  on conflict (organisation_id, nom) do nothing;

  select id into v_point from points_chargement
   where organisation_id = v_org and nom = 'Terminal acide de Ndola';

  -- Un itinéraire par destination réellement utilisée
  for r in select distinct destination, corridor from lots loop
    v_jalons := case r.destination
      when 'Lubumbashi' then array['Kasumbalesa', 'Péage Lubumbashi']
      when 'Likasi'     then array['Kasumbalesa', 'Péage Lubumbashi', 'Likasi']
      else array['Kasumbalesa', 'Péage Lubumbashi', 'Likasi', 'Fungurume', 'Péage Kolwezi']
    end;

    insert into itineraires
      (organisation_id, nom, point_chargement_id, origine, destination,
       corridor, jalons, modele_etapes_id)
    values
      (v_org, 'Ndola → ' || r.destination, v_point, 'Zambie', r.destination,
       r.corridor, v_jalons, v_modele)
    on conflict (organisation_id, nom) do update
      set jalons = excluded.jalons,
          corridor = excluded.corridor,
          modele_etapes_id = excluded.modele_etapes_id;
  end loop;

  -- Rattachement des lots existants
  update lots l
     set itineraire_id = i.id
    from itineraires i
   where i.organisation_id = l.organisation_id
     and i.destination = l.destination
     and l.itineraire_id is null;
end $$;

-- ---------------------------------------------------------------------
-- 7. La table figée n'a plus de raison d'être : le référentiel est
--    désormais paramétrable depuis l'application.
-- ---------------------------------------------------------------------
drop table if exists etapes_referentiel;

-- ---------------------------------------------------------------------
-- 8. RLS sur les nouvelles tables (même politique démo que 01_schema)
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'points_chargement','itineraires','modeles_etapes','modeles_etapes_lignes'
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
-- 9. Index de confort sur les listes CRUD
-- ---------------------------------------------------------------------
create index if not exists idx_lots_commande on lots(commande_id);
create index if not exists idx_camions_lot on camions(lot_id);
create index if not exists idx_commandes_client on commandes(client_id);
create index if not exists idx_itineraires_org on itineraires(organisation_id);
create index if not exists idx_lignes_modele on modeles_etapes_lignes(modele_id, numero);
