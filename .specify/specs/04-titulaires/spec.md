# Module 2 — Titulaires

## Description
Gestion des titulaires de classe avec affectations (école + classe) et historique de remplacements.

## Tables

### titulaires
| Champ | Type | Description |
|-------|------|-------------|
| id | integer (PK) | Auto-incrémenté |
| lastName | varchar(100) | Nom |
| firstName | varchar(100) | Prénom |
| email | varchar(255) | Email |
| phone | varchar(30) | Téléphone |
| isActive | boolean | Statut actif |

### titulaire_affectations
| Champ | Type | Description |
|-------|------|-------------|
| id | integer (PK) | Auto-incrémenté |
| titulaireId | FK→titulaires | Cascade |
| ecoleId | FK→ecoles | Cascade |
| classeId | FK→classes | Set null |
| dateDebut | date | Début affectation |
| dateFin | date | Fin affectation |
| isActive | boolean | Statut actif |

### titulaire_remplacements
| Champ | Type | Description |
|-------|------|-------------|
| id | integer (PK) | Auto-incrémenté |
| affectationId | FK→titulaire_affectations | Cascade |
| titulaireOriginalId | FK→titulaires | Cascade |
| remplacantTitulaireId | FK→titulaires | Cascade |
| dateDebut | date | Début remplacement |
| dateFin | date | Fin remplacement |
| motif | text | Motif du remplacement |

## API
- `GET/POST /api/titulaires` — Liste et création
- `GET/PATCH/DELETE /api/titulaires/:id` — Détail (avec affectations + remplacements), modification, suppression
- `GET/POST /api/titulaires/:id/affectations` — Gestion des affectations
- `GET/POST /api/titulaires/:id/remplacements` — Historique des remplacements
