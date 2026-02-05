# Module 2 — Établissements, Écoles, Classes

## Description
Gestion hiérarchique des établissements scolaires : Établissement → École → Classe.

## Hiérarchie et Directeurs

```
Établissement (directeurId optionnel)
      │
      └── École (directeurId optionnel)
              │
              └── Classe
```

### Relation Directeur-Établissement-École

- Un **établissement** peut avoir un **directeur principal** assigné (`directeurId`)
- Chaque **école** peut avoir son **propre directeur** (`directeurId`)
- Si une école a un `directeurId` défini, c'est ce directeur qui est affiché
- Si une école n'a pas de directeur spécifique, elle peut utiliser le directeur de l'établissement (à gérer côté UI)

**Cas d'usage typique** :
- Un établissement avec plusieurs écoles partage le même directeur → Définir le directeur au niveau établissement
- Une école a un directeur différent → Définir le directeur au niveau école (surcharge)

## Tables

### etablissements
| Champ | Type | Description |
|-------|------|-------------|
| id | integer (PK) | Auto-incrémenté |
| name | varchar(200) | Nom de l'établissement |
| address | text | Adresse |
| postalCode | varchar(10) | Code postal |
| city | varchar(100) | Ville |
| phone | varchar(30) | Téléphone |
| email | varchar(255) | Email |
| directeurId | FK→directeurs | Directeur principal de l'établissement (optionnel) |
| isActive | boolean | Statut actif |

### ecoles
| Champ | Type | Description |
|-------|------|-------------|
| id | integer (PK) | Auto-incrémenté |
| name | varchar(200) | Nom de l'école |
| etablissementId | FK→etablissements | Cascade delete |
| directeurId | FK→directeurs | Directeur de l'école (set null on delete, optionnel) |
| address | text | Adresse |
| phone | varchar(30) | Téléphone |
| email | varchar(255) | Email |
| remplacementApresJours | integer | Nombre de jours avant déclenchement remplacement |
| commentaires | text | Commentaires libres |
| isActive | boolean | Statut actif |

### classes
| Champ | Type | Description |
|-------|------|-------------|
| id | integer (PK) | Auto-incrémenté |
| name | varchar(100) | Nom de la classe |
| ecoleId | FK→ecoles | Cascade delete |
| isActive | boolean | Statut actif |

### collaborateur_ecoles
| Champ | Type | Description |
|-------|------|-------------|
| id | integer (PK) | Auto-incrémenté |
| collaborateurId | FK→collaborateurs | Cascade |
| ecoleId | FK→ecoles | Cascade |
| classeId | FK→classes | Set null |
| periodeId | FK→periodes_scolaires | Période scolaire |
| dateDebut | date | Début affectation |
| dateFin | date | Fin affectation |
| joursPresence | text | JSON des jours/créneaux de présence |
| isActive | boolean | Statut actif |

## API

### Établissements
- `GET /api/etablissements` — Liste avec directeur
- `POST /api/etablissements` — Création (admin)
- `GET /api/etablissements/:id` — Détail avec écoles
- `PATCH /api/etablissements/:id` — Modification (admin)
- `DELETE /api/etablissements/:id` — Suppression (admin)

### Écoles
- `GET /api/ecoles` — Liste avec établissement et directeur
- `POST /api/ecoles` — Création (admin)
- `GET /api/ecoles/:id` — Détail avec classes, directeur, établissement
- `PATCH /api/ecoles/:id` — Modification (admin)
- `DELETE /api/ecoles/:id` — Suppression cascade classes (admin)

### Classes
- `GET /api/classes?ecoleId=X` — Liste par école
- `POST /api/classes` — Création (admin)
- `GET /api/classes/:id` — Détail
- `PATCH /api/classes/:id` — Modification (admin)
- `DELETE /api/classes/:id` — Suppression (admin)

### Liaisons
- `GET /api/collaborateurs/:id/ecoles` — Écoles d'un collaborateur
- `POST /api/collaborateurs/:id/ecoles` — Ajouter liaison
- `DELETE /api/collaborateurs/:id/ecoles?ecoleId=X` — Supprimer liaison

## UI

### Fiche Établissement (`/etablissements/[id]`)
- Informations générales (nom, adresse, contact)
- Directeur principal (dropdown)
- Liste des écoles avec ajout inline

### Fiche École (`/ecoles/[id]`)
- Informations générales
- Directeur (dropdown, peut être différent de l'établissement)
- Liste des classes avec ajout inline
