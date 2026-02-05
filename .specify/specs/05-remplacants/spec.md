# Module 5 — Remplaçants

## Description
Gestion des remplaçants (enseignants de remplacement) avec CRUD complet, import Excel, système de remarques et d'observateurs.

## Fonctionnalités
- Liste avec recherche, filtres (disponibilité, statut actif), tri multi-colonnes
- Création via page dédiée
- Page détail avec formulaire d'édition en 2 colonnes
- Système de remarques datées et attribuées à un utilisateur
- Système d'observateurs (collaborateurs qui suivent un remplaçant) avec recherche
- Import Excel avec preview et mapping flexible

## Tables

### `remplacants`
| Colonne | Type | Description |
|---------|------|-------------|
| id | integer | PK auto |
| lastName | varchar(100) | Nom |
| firstName | varchar(100) | Prénom |
| address | text | Adresse |
| phone | varchar(30) | Téléphone |
| email | varchar(255) | Email |
| isAvailable | boolean | Disponible période actuelle |
| availabilityNote | text | Note de disponibilité |
| contractStartDate | date | Date début contrat |
| contractEndDate | date | Date fin contrat |
| obsTemporaire | text | Observation temporaire (import) |
| isActive | boolean | Actif |
| createdBy/updatedBy | uuid | Audit |
| createdAt/updatedAt | timestamp | Audit |

### `remplacant_remarques`
| Colonne | Type | Description |
|---------|------|-------------|
| id | integer | PK auto |
| remplacantId | integer | FK → remplacants |
| content | text | Contenu de la remarque |
| createdBy | uuid | Auteur (FK → users) |
| createdAt | timestamp | Date création |

### `remplacant_observateurs`
| Colonne | Type | Description |
|---------|------|-------------|
| id | integer | PK auto |
| remplacantId | integer | FK → remplacants |
| collaborateurId | integer | FK → collaborateurs |
| createdBy | uuid | Qui a assigné |
| createdAt | timestamp | Date assignation |

## API

### Remplaçants
- `GET /api/remplacants` — Liste avec filtres (search, isActive, isAvailable)
- `POST /api/remplacants` — Création (admin)
- `GET /api/remplacants/:id` — Détail
- `PATCH /api/remplacants/:id` — Mise à jour (admin)
- `DELETE /api/remplacants/:id` — Suppression (admin)

### Remarques
- `GET /api/remplacants/:id/remarques` — Liste des remarques
- `POST /api/remplacants/:id/remarques` — Ajout remarque (admin)

### Observateurs
- `GET /api/remplacants/:id/observateurs` — Liste des observateurs
- `POST /api/remplacants/:id/observateurs` — Ajout observateur (admin)
- `DELETE /api/remplacants/:id/observateurs` — Retrait observateur (admin)

### Import
- `POST /api/remplacants/import` — Import Excel (admin)
- `POST /api/remplacants/import?preview=true` — Preview sans insertion

## Import Excel

### Feuille cible
Recherche automatique d'une feuille contenant "rempl" ou "liste", sinon première feuille.

### Colonnes mappées
| Colonne Excel | Champ DB | Notes |
|---------------|----------|-------|
| Noms | lastName, firstName | Parsing automatique "Marie DUPONT" → nom: "DUPONT", prénom: "Marie" (noms en MAJUSCULES) |
| Adresse | address | |
| Téléphone | phone | |
| Email | email | |
| Disponible période actuelle | isAvailable | "disponible"/"oui" → true, "non"/"indisponible" → false |
| Remarques maj le 28.11.25 vg | remplacant_remarques | Crée une remarque avec date 28/11/2025 |
| Contrat horaire du | contractStartDate | Format mm/dd/yy ou date Excel |
| fin contrat horaire | contractEndDate | Format mm/dd/yy ou date Excel |
| Obs | obsTemporaire | |

### Logique d'upsert
1. Match par email si présent
2. Sinon match par lastName + firstName
3. Création si non trouvé, mise à jour sinon

## UI

### Liste `/remplacants`
- Filtres: recherche (nom, prénom, email), disponibilité, statut actif
- Colonnes: Nom, Contact, Disponible, Statut, Contrat (dates)
- Tri: nom, email, disponibilité, statut

### Détail `/remplacants/[id]`
- Section gauche: Informations (nom, prénom, adresse, téléphone, email, dates contrat, obs temporaire)
- Section droite: Disponibilité (toggle + note), Statut (toggle actif)
- Section remarques: Liste chronologique, ajout via modal
- Section observateurs: Liste avec suppression, ajout via modal avec recherche nom/prénom

### Création `/remplacants/new`
- Formulaire: nom, prénom, adresse, téléphone, email, dates contrat

### Import `/remplacants/import`
- Wizard 3 étapes: upload → preview → import
- Affichage des colonnes détectées dans l'Excel
- Tableau de preview avec toutes les colonnes parsées
- Compteurs: total, valides, erreurs
- Résultat: créés, mis à jour, remarques créées, erreurs
