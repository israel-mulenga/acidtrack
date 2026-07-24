# AcidTrack

**Suivi des livraisons d'acide sulfurique — corridor Zambie → RDC.**

Application web responsive (PWA) permettant aux équipes opérations, aux agents
terrain et aux clients miniers de suivre chaque camion à travers les **7 macro-étapes**
du workflow, avec preuves documentaires, position et horodatage.

> MVP — périmètre volontairement restreint à la boucle de valeur principale
> (critères de recette AC-01 à AC-06 du cahier des charges).

---

## Stack

| Couche | Technologie |
| --- | --- |
| Front-end | React 19 + TypeScript + Vite |
| Styles | Tailwind CSS v4 |
| Icônes | Lucide React |
| Base de données | Supabase (PostgreSQL + RLS) |
| Stockage fichiers | Supabase Storage (bucket `preuves`) |
| Hébergement | Vercel |

---

## Démarrage

```bash
npm install
cp .env.example .env.local   # puis renseigner les clés Supabase
npm run dev
```

### Configuration Supabase

1. Créer un projet sur [supabase.com](https://supabase.com) (plan gratuit).
2. Dans **SQL Editor**, exécuter dans l'ordre :
   - `supabase/01_schema.sql` — tables, types, RLS, trigger, bucket de stockage
   - `supabase/02_seed.sql` — jeu de démonstration (1 commande, 2 lots, 5 camions)
   - `supabase/03_crud.sql` — référentiel paramétrable (points de chargement,
     itinéraires, modèles d'étapes) et rattachement des lots

   > `03_crud.sql` remplace la table figée `etapes_referentiel` par des
   > modèles d'étapes éditables depuis l'application. Une fois la migration
   > passée, ne rejouez plus `02_seed.sql` : relancez `01`, `02` puis `03`
   > dans l'ordre si vous repartez d'une base vierge.
3. Dans **Project Settings → API**, copier `Project URL` et la clé `anon public`
   dans `.env.local`.

---

## Périmètre fonctionnel

### Couvert par le MVP

- **Trois profils** : Opérations, Agent terrain, Client — bascule instantanée.
- **Hiérarchie métier** : commande → lot → dossier camion → événements.
- **Workflow 7 macro-étapes** avec chronologie verticale par camion.
- **Mise à jour d'étape** : champs dynamiques, capture GPS, photo/document réels
  déposés dans Supabase Storage, commentaire.
- **Contrôle documentaire bloquant** : une étape ne passe pas en `TERMINÉ`
  sans ses preuves obligatoires (AC-03).
- **Progression pondérée par le tonnage** au niveau du lot (§5 du cahier).
- **SLA et retards** calculés par étape (AC-05).
- **Incidents** : un incident critique bascule automatiquement le camion en
  `BLOQUÉ` (trigger Postgres).
- **Portail client** en lecture seule, sans exposition des données sensibles.

### Hors MVP — phase 2

Notifications push/e-mail/WhatsApp, saisie hors-ligne avec file de
synchronisation, export PDF signé, interface bilingue FR/EN, module Finance
complet, MFA, administration SaaS, import Excel, carte GPS temps réel,
durcissement RLS multi-tenant (la colonne `organisation_id` est déjà présente
sur toutes les tables : l'activation relève du paramétrage).

---

## Structure

```
src/
  components/     Composants d'interface réutilisables
  hooks/          Accès aux données Supabase
  lib/            Types, règles métier (workflow.ts), utilitaires
  pages/          Écrans par profil
  pages/admin/    Écrans de création et d'édition du référentiel
supabase/
  01_schema.sql   Schéma, RLS, trigger, bucket
  02_seed.sql     Données de démonstration
  03_crud.sql     Référentiel paramétrable et index
```

Toute la logique dérivée (progression, SLA, statut d'étape, complétude
documentaire) est centralisée dans `src/lib/workflow.ts`.
