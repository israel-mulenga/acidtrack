-- =====================================================================
-- 07_super_admin.sql — Superviseur plateforme (super-administrateur)
-- ---------------------------------------------------------------------
-- Un « super-admin » n'appartient à AUCUNE organisation : il n'a pas de
-- ligne dans `utilisateurs`. À la connexion, l'application ne lui présente
-- que le panneau de supervision multi-organisations (lecture seule).
--
-- L'isolation par organisation (04_auth_rls.sql) reste totalement intacte :
-- l'accès transverse passe uniquement par des fonctions SECURITY DEFINER
-- protégées par `est_super_admin()`, qui renvoient des données AGRÉGÉES.
-- Aucune politique RLS métier n'est affaiblie.
--
-- Amorçage : après avoir créé le compte Supabase Auth du superviseur,
-- insérez son identifiant (auth.users.id) dans `plateforme_admins` :
--
--   insert into plateforme_admins (auth_id, nom, email)
--   values ('<AUTH_USER_ID>', 'Superviseur', 'superviseur@acidtrack.app');
--
-- =====================================================================

create table if not exists plateforme_admins (
  auth_id     uuid primary key,
  nom         text,
  email       text,
  created_at  timestamptz not null default now()
);

alter table plateforme_admins enable row level security;

-- Un utilisateur connecté ne peut vérifier que sa PROPRE présence.
drop policy if exists plateforme_admins_self on plateforme_admins;
create policy plateforme_admins_self on plateforme_admins
  for select to authenticated
  using (auth_id = auth.uid());

-- ---------------------------------------------------------------------
-- Détermine si le compte connecté est un superviseur plateforme.
-- ---------------------------------------------------------------------
create or replace function est_super_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from plateforme_admins where auth_id = auth.uid()
  );
$$;

grant execute on function est_super_admin() to authenticated;

-- ---------------------------------------------------------------------
-- Tableau de bord global : une ligne agrégée par organisation.
-- Réservé aux superviseurs (sinon exception).
-- ---------------------------------------------------------------------
create or replace function admin_tableau_bord()
returns table (
  organisation_id     uuid,
  organisation_nom    text,
  organisation_statut text,
  organisation_plan   text,
  nb_utilisateurs     bigint,
  nb_lots             bigint,
  camions_actifs      bigint,
  camions_en_transit  bigint,
  camions_livres      bigint,
  camions_bloques     bigint,
  camions_en_retard   bigint,
  tonnage_total       numeric,
  tonnage_livre       numeric
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not est_super_admin() then
    raise exception 'Accès refusé : réservé aux super-administrateurs';
  end if;

  return query
  with dernier_evt as (
    select distinct on (e.camion_id)
      e.camion_id, e.statut
    from etape_evenements e
    order by e.camion_id, e.created_at desc
  ),
  cam as (
    select
      c.organisation_id,
      c.statut,
      c.etape_courante,
      c.tonnage_net_t,
      (
        c.statut not in ('TERMINE', 'ANNULE')
        and (de.statut is distinct from 'EN_ATTENTE_VALIDATION')
        and mel.sla_heures is not null
        and extract(epoch from (now() - c.derniere_maj_at)) / 3600 > mel.sla_heures
      ) as en_retard
    from camions c
    join lots l on l.id = c.lot_id
    -- Le SLA vit dans le modèle d'étapes du lot (cf. 03_crud.sql, qui a
    -- remplacé la table globale `etapes_referentiel` par `modeles_etapes_lignes`).
    left join modeles_etapes_lignes mel
      on mel.modele_id = l.modele_etapes_id
     and mel.numero = c.etape_courante
    left join dernier_evt de on de.camion_id = c.id
  )
  select
    o.id,
    o.nom,
    o.statut,
    o.plan,
    (select count(*) from utilisateurs u where u.organisation_id = o.id),
    (select count(*) from lots l where l.organisation_id = o.id),
    count(cam.*) filter (where cam.statut <> 'ANNULE'),
    count(cam.*) filter (
      where cam.statut = 'EN_COURS'
        and cam.etape_courante > 1
        and cam.etape_courante <= 6
    ),
    count(cam.*) filter (where cam.statut = 'TERMINE'),
    count(cam.*) filter (where cam.statut = 'BLOQUE'),
    count(cam.*) filter (where cam.en_retard),
    coalesce(sum(cam.tonnage_net_t) filter (where cam.statut <> 'ANNULE'), 0),
    coalesce(sum(cam.tonnage_net_t) filter (where cam.statut = 'TERMINE'), 0)
  from organisations o
  left join cam on cam.organisation_id = o.id
  group by o.id, o.nom, o.statut, o.plan
  order by o.nom;
end;
$$;

grant execute on function admin_tableau_bord() to authenticated;

-- ---------------------------------------------------------------------
-- Liste de tous les utilisateurs, toutes organisations confondues.
-- Réservé aux superviseurs (sinon exception).
-- ---------------------------------------------------------------------
create or replace function admin_utilisateurs()
returns table (
  organisation_id  uuid,
  organisation_nom text,
  utilisateur_id   uuid,
  nom              text,
  role             role_utilisateur,
  email            text,
  telephone        text,
  statut           text,
  created_at       timestamptz
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not est_super_admin() then
    raise exception 'Accès refusé : réservé aux super-administrateurs';
  end if;

  return query
  select
    u.organisation_id,
    o.nom,
    u.id,
    u.nom,
    u.role,
    u.email,
    u.telephone,
    u.statut,
    u.created_at
  from utilisateurs u
  join organisations o on o.id = u.organisation_id
  order by o.nom, u.nom;
end;
$$;

grant execute on function admin_utilisateurs() to authenticated;
