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
2. **Authentication → Providers → Email** : désactiver *Confirm email* (permet
   à l'inscription de démo d'ouvrir une session immédiatement).
3. Dans **SQL Editor**, exécuter dans l'ordre :
   - `supabase/01_schema.sql` — tables, types, trigger, bucket de stockage
   - `supabase/02_seed.sql` — jeu de démonstration (1 commande, 2 lots, 5 camions)
   - `supabase/03_crud.sql` — référentiel paramétrable (points de chargement,
     itinéraires, modèles d'étapes) et rattachement des lots
   - `supabase/04_auth_rls.sql` — authentification Supabase Auth, fonctions de
     création / invitation d'organisation, RLS multi-tenant
   - `supabase/05_seed_auth.sql` — comptes Auth des 5 profils de démonstration
     (mot de passe unique : `AcidTrack2024!`)
   - `supabase/06_notifications.sql` — notifications push : tables
     `push_subscriptions` / `notifications`, RLS, trigger CRUD générique et
     déclenchement de l'Edge Function (voir « Notifications push » ci-dessous)
   - `supabase/07_super_admin.sql` — superviseur plateforme : table
     `plateforme_admins` et fonctions de supervision multi-organisations
     (voir « Superviseur plateforme » ci-dessous)

   > L'ordre est important : `04` ajoute la colonne `utilisateurs.auth_id`
   > qu'utilise `05`. Si vous repartez d'une base vierge, rejouez les sept
   > scripts dans l'ordre `01` → `07`.
4. Dans **Project Settings → API**, copier `Project URL` et la clé `anon public`
   dans `.env.local`.

### Authentification

L'authentification est réelle (Supabase Auth, e-mail/mot de passe) :

- **Créer une organisation** (`/inscription`) : self-service, devient ADMIN.
- **Rejoindre une organisation** : un ADMIN invite un e-mail depuis
  Administration → Utilisateurs ; la personne s'inscrit ensuite avec cette
  même adresse (onglet « J'ai été invité(e) » de `/inscription`).
- **Isolation des données** : chaque table métier est filtrée par RLS sur
  l'organisation du compte connecté ; un compte Client est en outre restreint
  à ses propres commandes/lots/camions/documents visibles (§ `04_auth_rls.sql`).

En développement, `VITE_DEV_PROFILE_SWITCH=true` (voir `.env.example`) affiche
un sélecteur de compte démo dans l'en-tête : il se connecte réellement avec
l'un des 5 comptes seedés par `05_seed_auth.sql` (mot de passe `AcidTrack2024!`),
ce qui exerce la vraie RLS plutôt qu'une simulation.

---

## Périmètre fonctionnel

### Couvert par le MVP

- **Authentification réelle** (Supabase Auth) : création d'organisation,
  invitation d'utilisateurs, réinitialisation de mot de passe, isolation
  stricte des données par organisation et par client via RLS (AC-09).
- **Cinq rôles** : Administrateur, Opérations, Agent terrain, Finance, Client.
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

Notifications e-mail/WhatsApp (les invitations se transmettent
manuellement pour le MVP, sans envoi d'e-mail automatisé), saisie hors-ligne
avec file de synchronisation, export PDF signé, interface bilingue FR/EN,
module Finance complet, authentification multifacteur, import Excel, carte
GPS temps réel.

> Les **notifications push** (Web Push) sont désormais implémentées — voir la
> section « Notifications push » ci-dessous.

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
  01_schema.sql     Schéma, trigger, bucket
  02_seed.sql       Données de démonstration
  03_crud.sql       Référentiel paramétrable et index
  04_auth_rls.sql   Auth Supabase, RPC organisation/invitation, RLS multi-tenant
  05_seed_auth.sql  Comptes Auth des profils de démonstration
  06_notifications.sql  Tables push, trigger CRUD, déclenchement Edge Function
  07_super_admin.sql    Superviseur plateforme (supervision multi-organisations)
  functions/
    envoyer-push/   Edge Function Deno d'envoi des Web Push
```

Toute la logique dérivée (progression, SLA, statut d'étape, complétude
documentaire) est centralisée dans `src/lib/workflow.ts`.

---

## Notifications push

Chaque opération CRUD sur une table métier (`clients`, `commandes`, `lots`,
`camions`, `etape_evenements`, `documents`, `incidents`, `paiements`,
`utilisateurs`) écrit une ligne dans `notifications` via un trigger générique,
puis l'Edge Function `envoyer-push` envoie une notification Web Push à tous les
appareils abonnés de l'organisation — **y compris application fermée** (PWA
installée). Un service worker personnalisé (`src/sw.ts`) reçoit le push et
affiche la notification.

### 1. Générer les clés VAPID

```bash
npx web-push generate-vapid-keys
```

Reporter la clé **publique** dans `.env.local` (elle est exposée au navigateur) :

```
VITE_VAPID_PUBLIC_KEY=<clé_publique>
```

### 2. Configurer les secrets de l'Edge Function

```bash
supabase secrets set \
  VAPID_PUBLIC_KEY=<clé_publique> \
  VAPID_PRIVATE_KEY=<clé_privée> \
  VAPID_SUBJECT="mailto:admin@acidtrack.app"
```

`SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont fournis automatiquement à la
fonction par la plateforme.

### 3. Déployer la fonction

```bash
supabase functions deploy envoyer-push
```

### 4. Déclencher la fonction à chaque notification

`06_notifications.sql` installe un trigger `AFTER INSERT ON notifications` qui
appelle la fonction via **pg_net**. Configurer une fois, dans l'éditeur SQL :

```sql
alter database postgres
  set app.settings.edge_function_url =
  'https://<PROJECT_REF>.supabase.co/functions/v1/envoyer-push';
alter database postgres
  set app.settings.service_role_key = '<SERVICE_ROLE_KEY>';
```

> **L'en-tête `Authorization` est obligatoire.** Par défaut, les Edge Functions
> Supabase vérifient le JWT (`verify_jwt = true`). Le trigger envoie donc
> `Authorization: Bearer <service_role_key>` — **c'est pourquoi le second
> `alter database` ci-dessus est indispensable.** Sans lui, l'appel renvoie
> **401**, aucun push n'est envoyé, et la notification n'apparaît que dans
> l'application (toast) — jamais dans la barre système. Ne retirez pas cet
> en-tête du trigger.
>
> _Alternative_ : déployer la fonction sans vérification JWT
> (`supabase functions deploy envoyer-push --no-verify-jwt`) ; l'appel
> fonctionne alors même sans en-tête, au prix d'un endpoint public.

> Si l'extension `pg_net` n'est pas disponible sur votre projet, supprimez le
> trigger `trg_declencher_push` et configurez plutôt un **Database Webhook**
> (Dashboard → Database → Webhooks) sur `INSERT` de `notifications`, pointant
> vers l'URL de la fonction `envoyer-push`.

### 5. Activer côté utilisateur

Dans l'application, le menu compte propose « Activer les notifications » : le
navigateur demande la permission puis enregistre l'abonnement dans
`push_subscriptions`.

> **HTTPS requis** (satisfait par le déploiement Vercel). Sur **iOS 16.4+**, la
> réception de notifications push exige que la PWA soit **installée** sur
> l'écran d'accueil.

### Dépannage : « la notification n'apparaît que dans l'application »

Symptôme : le toast in-app s'affiche (Realtime) mais **aucune bannière système**
n'apparaît, y compris application fermée. Cela signifie que l'Edge Function
n'est jamais exécutée. Vérifier dans l'ordre :

1. **En-tête d'autorisation du trigger** (cause la plus fréquente) : tester
   l'appel de la fonction à la main. Sans en-tête → `401` ; avec le
   `service_role` → `{"envoyes":N}` :

   ```bash
   # Sans en-tête : doit renvoyer 401
   curl -i -X POST 'https://<PROJECT_REF>.supabase.co/functions/v1/envoyer-push' \
     -H 'Content-Type: application/json' -d '{"notification_id":"<UUID>"}'

   # Avec le service_role : doit renvoyer {"envoyes":N}
   curl -i -X POST 'https://<PROJECT_REF>.supabase.co/functions/v1/envoyer-push' \
     -H 'Content-Type: application/json' \
     -H 'Authorization: Bearer <SERVICE_ROLE_KEY>' \
     -d '{"notification_id":"<UUID>"}'
   ```

   Si le premier renvoie 401 et le second réussit, (re)configurez
   `app.settings.service_role_key` (étape 4) et **conservez l'en-tête
   `Authorization` dans `fn_declencher_push`**.
2. **Secrets VAPID** : `VAPID_PUBLIC_KEY` de la fonction doit correspondre à
   `VITE_VAPID_PUBLIC_KEY` du front (même paire de clés), sinon les services
   push rejettent l'envoi.
3. **Permission navigateur** : la permission de notification doit être accordée
   et l'abonnement présent dans `push_subscriptions`.
4. **Système d'exploitation** : sur iOS, PWA **installée** requise ; sur macOS,
   autoriser les notifications de Chrome/Safari dans Réglages Système.

---

## Superviseur plateforme

Un **super-admin** (superviseur) supervise **toutes les organisations** en
lecture seule. Il n'appartient à aucune organisation : il n'a **pas** de ligne
`utilisateurs`. À la connexion, l'application ne lui présente que le **panneau
de supervision** (`src/pages/PanneauAdmin.tsx`) — tableau de bord agrégé par
organisation et liste des utilisateurs de chaque organisation.

L'isolation par organisation (`04_auth_rls.sql`) reste intacte : l'accès
transverse passe uniquement par des fonctions `SECURITY DEFINER`
(`admin_tableau_bord()`, `admin_utilisateurs()`) protégées par
`est_super_admin()`.

**Créer un superviseur** :

1. Créer un compte Supabase Auth pour le superviseur (Dashboard →
   Authentication → Add user), **sans** l'inviter dans une organisation.
2. Récupérer son `id` dans `auth.users`, puis dans SQL Editor :

   ```sql
   insert into plateforme_admins (auth_id, nom, email)
   values ('<AUTH_USER_ID>', 'Superviseur', 'superviseur@acidtrack.app');
   ```

À sa prochaine connexion, il arrive directement sur le panneau de supervision.
