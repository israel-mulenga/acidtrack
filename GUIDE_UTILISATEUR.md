# Guide d'utilisation — AcidTrack

Ce guide s'adresse à toute personne qui découvre l'application, sans connaissance technique préalable. Il décrit, dans l'ordre logique, comment mettre en place les données puis utiliser AcidTrack au quotidien.

---

## 1. Comptes de démonstration (pour tester tout de suite)

Une organisation « Sulfachem Logistics » est déjà préchargée avec des commandes, lots, camions, documents et un incident. Cinq comptes y sont rattachés — **mot de passe identique pour tous** :

| Mot de passe |
| --- |
| `AcidTrack2024!` |

| Rôle | Nom | E-mail | Ce qu'il peut faire |
| --- | --- | --- | --- |
| **Administrateur** | Sarah Ilunga | `admin@sulfachem.cd` | Tout : référentiel, commercial, utilisateurs, organisation |
| **Opérations** | Joseph Kabeya | `ops@sulfachem.cd` | Référentiel, commercial, validation des étapes, incidents |
| **Agent terrain** | Alain Tshibangu | `terrain@sulfachem.cd` | Saisie des étapes et ouverture d'incidents sur ses camions |
| **Finance** | Nadine Kalonji | `finance@sulfachem.cd` | Saisie, documents sensibles (avis bancaires, quittances) |
| **Client** | Patrick Mwamba | `patrick@kcc.cd` | Portail client en lecture seule (ses livraisons uniquement) |

Connexion : ouvrir l'application → écran **Connexion** → saisir l'e-mail et le mot de passe ci-dessus.

> En développement, un sélecteur de compte apparaît dans le menu du compte (en haut à droite) pour basculer instantanément entre ces 5 profils sans se déconnecter/reconnecter manuellement.

---

## 2. Créer sa propre organisation (parcours réel, sans SQL)

Si l'on veut démarrer avec une organisation vierge plutôt que les données de démonstration :

1. Sur l'écran de connexion, cliquer sur **Créer un compte**.
2. Choisir l'onglet **Nouvelle organisation**.
3. Renseigner : nom de l'organisation, nom complet, e-mail, mot de passe (8 caractères minimum).
4. Valider : le compte est créé, la personne devient automatiquement **Administrateur**, et l'application s'ouvre directement dessus.

### Inviter les autres utilisateurs

1. Se connecter avec le compte Administrateur.
2. Aller dans **Administration → Utilisateurs → Nouvel utilisateur**.
3. Renseigner nom, rôle, e-mail (et le client rattaché si le rôle est *Client*).
4. Valider : l'invitation est créée (statut *Invitation en attente*).
5. Communiquer l'adresse e-mail utilisée à la personne concernée.
6. Cette personne va sur l'écran de connexion → **Créer un compte** → onglet **J'ai été invité(e)** → saisit **la même adresse e-mail** et choisit son mot de passe.
7. Elle est immédiatement rattachée à l'organisation et connectée à l'application, avec le rôle défini à l'étape 3.

> Chaque organisation est totalement isolée : impossible de voir les données d'une autre organisation, quel que soit le rôle.

---

## 3. Ordre préférentiel de création des données

Respecter cet ordre évite les listes déroulantes vides pendant la saisie. Tout se fait dans **Administration**, sans SQL.

1. **Organisation** (`Administration → Organisation`) : nom, devise, fuseau horaire, langue, logo — déjà fait à l'inscription, à ajuster si besoin.
2. **Utilisateurs** (`Administration → Utilisateurs`) : inviter au moins un OPS et un Agent terrain.
3. **Clients** (`Administration → Clients`) : la mine ou société destinataire (raison sociale, ville, contact).
4. **Points de chargement** (`Administration → Points de chargement`) : usine ou terminal d'où partent les camions (nom, ville, pays).
5. **Modèles d'étapes** (`Administration → Modèles d'étapes`) : la séquence des 7 macro-étapes (voir §5). Un modèle par défaut existe déjà ; n'en créer un nouveau que pour un corridor aux règles différentes.
6. **Itinéraires** (`Administration → Itinéraires`) : relie un point de chargement à une destination, définit les jalons de route et le modèle d'étapes à appliquer.
7. **Commandes** (`Administration → Commandes`) : l'engagement commercial avec un client (référence, quantité commandée, prix, destination). *Nécessite un client créé à l'étape 3.*
8. **Lots** (`Administration → Lots et camions`) : découpage d'une commande en lots à planifier (référence, itinéraire, quantité planifiée). *Nécessite une commande et un itinéraire.*
9. **Camions** (bouton **Ajouter des camions** sur un lot) : création en série des dossiers camion (plaques, transporteur, chauffeur). *Nécessite un lot.*

Une fois les camions créés, le suivi quotidien (étapes, incidents) prend le relais — voir §4 et §6.

---

## 4. Utilisation quotidienne — suivi d'un camion

### Tour de contrôle (rôle Opérations/Admin/Finance)
Vue d'ensemble de tous les lots et camions en cours, avec les exceptions (retards, blocages) mises en avant. C'est l'écran d'accueil de ces rôles.

### Mes tâches (rôle Agent terrain)
Liste des camions dont c'est à l'agent terrain de saisir l'étape courante. C'est l'écran d'accueil de ce rôle.

### Fiche camion
Cliquer sur un camion depuis le Tour de contrôle, Mes tâches, ou une Vue de lot ouvre sa fiche : chronologie verticale des 7 étapes, statut de chacune, documents déposés, position GPS, et bouton pour ouvrir un incident.

### Saisir une étape
1. Depuis la fiche camion, ouvrir l'étape courante (surlignée, seule action possible — impossible de sauter une étape).
2. Remplir les champs métier (variables selon l'étape, voir §5), capturer la position GPS si demandé, joindre les documents obligatoires (photo ou PDF).
3. Ajouter un commentaire si utile.
4. Soumettre : l'étape passe en attente de validation (sauf pour un rôle qui valide déjà lui-même, comme Opérations).

### Valider ou rejeter une étape (rôle Opérations/Admin)
Depuis la fiche camion, sur une étape soumise : **Valider** (passe l'étape à *Terminé*, débloque l'étape suivante) ou **Rejeter** avec un motif (renvoie l'agent terrain corriger sa saisie).

> Une étape ne peut jamais passer à *Terminé* si les documents obligatoires listés dans le modèle d'étapes ne sont pas déposés (contrôle bloquant).

---

## 5. Les 7 macro-étapes (modèle par défaut)

| N° | Étape | Documents bloquants | Responsable |
| --- | --- | --- | --- |
| 1 | Chargement et préparation du produit | BL, Ticket de pesée, COA | Agent de chargement / Opérations |
| 2 | Paiement initial validé | Avis bancaire | Finance |
| 3 | Déclaration et sortie Zambie | Déclaration export, CMR | Transitaire / Douane Zambie |
| 4 | Déclaration et entrée RDC | Déclaration import, Quittance | Transitaire / Douane RDC |
| 5 | Transit intérieur et points de contrôle | Reçu péage | Escorteur / Chauffeur / Opérations |
| 6 | Arrivée à la mine et déchargement | POD, Ticket de pesée mine | Réception mine / Opérations |
| 7 | Retour du camion et règlement final | Facture finale, Preuve de solde | Opérations et Finance |

Chaque étape a un **SLA** (délai maximum en heures) : au-delà, le camion apparaît en retard dans le Tour de contrôle. Les champs métier et documents requis sont entièrement personnalisables dans `Administration → Modèles d'étapes`, y compris les jalons de route propres à chaque itinéraire (ex. : un trajet vers Kolwezi n'affiche pas les jalons de la route de Likasi).

---

## 6. Incidents

1. Depuis une fiche camion, bouton **Ouvrir un incident** : catégorie, gravité (mineure/majeure/critique), description, plan d'action.
2. Un incident de gravité **Critique** bloque automatiquement le camion (statut *Bloqué*), quel que soit l'endroit dans le workflow.
3. Pour lever le blocage : ouvrir l'incident et cliquer **Résoudre**, avec une description de la résolution.
4. Le camion redevient *En cours* (ou *Terminé* si toutes les étapes étaient déjà passées), sauf s'il reste un autre incident critique encore ouvert sur ce même camion.

---

## 7. Portail client

Les comptes de rôle **Client** n'ont accès qu'à un écran unique : leurs propres commandes, lots et camions, avec la progression, les statuts et les documents marqués *visibles client* (jamais les prix, avis bancaires ou quittances). Aucune action de saisie n'y est possible.

---

## 8. Installer l'application (PWA)

AcidTrack s'installe comme une application native, avec un mode hors-ligne basique (consultation des dernières données reçues) :

- **Android / Chrome / Edge (desktop)** : un bandeau **Installer AcidTrack** apparaît automatiquement ; sinon, menu du compte (en haut à droite) → **Installer l'application**.
- **iOS Safari** : menu du compte → **Installer l'application** → suivre les deux étapes affichées (Partager → Sur l'écran d'accueil). `beforeinstallprompt` n'existe pas sur iOS, l'ajout est toujours manuel.
- Si le bandeau a été refusé par erreur, il reste malgré tout disponible via le menu du compte, qui ne se masque jamais définitivement.

---

## 9. Récapitulatif des droits par rôle

| Action | Admin | Opérations | Terrain | Finance | Client |
| --- | --- | --- | --- | --- | --- |
| Voir le tour de contrôle | ✓ | ✓ | — | ✓ | — |
| Saisir une étape | ✓ | ✓ | ✓ | ✓ | — |
| Valider / rejeter une étape | ✓ | ✓ | — | — | — |
| Ouvrir / résoudre un incident | ✓ | ✓ | Ouvrir seulement | — | — |
| Voir les documents sensibles (prix, avis bancaires) | ✓ | ✓ | — | ✓ | — |
| Gérer le référentiel (clients, itinéraires, modèles) | ✓ | ✓ | — | — | — |
| Gérer commandes/lots/camions | ✓ | ✓ | — | — | — |
| Gérer les utilisateurs et l'organisation | ✓ | — | — | — | — |
| Portail client (lecture seule, données propres) | — | — | — | — | ✓ |
