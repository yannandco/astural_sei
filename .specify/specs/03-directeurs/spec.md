# Module 2 — Directeurs

## Description
Gestion des directeurs d'école avec historique de remplacements.

## Tables

### directeurs
| Champ | Type | Description |
|-------|------|-------------|
| id | integer (PK) | Auto-incrémenté |
| lastName | varchar(100) | Nom |
| firstName | varchar(100) | Prénom |
| email | varchar(255) | Email |
| phone | varchar(30) | Téléphone |
| isActive | boolean | Statut actif |

### directeur_remplacements
| Champ | Type | Description |
|-------|------|-------------|
| id | integer (PK) | Auto-incrémenté |
| ecoleId | FK→ecoles | Cascade |
| directeurOriginalId | FK→directeurs | Cascade |
| remplacantDirecteurId | FK→directeurs | Cascade |
| dateDebut | date | Début remplacement |
| dateFin | date | Fin remplacement |
| motif | text | Motif du remplacement |

## API
- `GET/POST /api/directeurs` — Liste et création
- `GET/PATCH/DELETE /api/directeurs/:id` — Détail (avec écoles + historique), modification, suppression
- `GET/POST /api/directeurs/:id/remplacements` — Historique des remplacements
