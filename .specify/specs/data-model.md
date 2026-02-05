# Data Model — SEI

## Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           STRUCTURE SCOLAIRE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────┐          ┌─────────────────┐                         │
│   │  ÉTABLISSEMENT  │ 1────N > │     ÉCOLE       │                         │
│   │  - name         │          │  - name         │                         │
│   │  - directeurId ─┼──────┐   │  - directeurId ─┼───┐                     │
│   └─────────────────┘      │   └────────┬────────┘   │                     │
│                            │            │            │                     │
│                            │       1────┴────N       │                     │
│                            │            │            │                     │
│                            │   ┌────────▼────────┐   │                     │
│                            │   │     CLASSE      │   │                     │
│                            │   │  - name         │   │                     │
│                            │   └─────────────────┘   │                     │
│                            │                         │                     │
└────────────────────────────┼─────────────────────────┼─────────────────────┘
                             │                         │
                             ▼                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PERSONNES                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐  │
│   │   DIRECTEUR     │       │   TITULAIRE     │       │  COLLABORATEUR  │  │
│   │  - lastName     │       │  - lastName     │       │  - lastName     │  │
│   │  - firstName    │       │  - firstName    │       │  - firstName    │  │
│   └────────┬────────┘       └────────┬────────┘       └────────┬────────┘  │
│            │                         │                         │           │
│   ┌────────▼────────┐       ┌────────▼────────┐       ┌────────▼────────┐  │
│   │   DIRECTEUR_    │       │   TITULAIRE_    │       │  COLLABORATEUR_ │  │
│   │  REMPLACEMENTS  │       │  AFFECTATIONS   │       │     ECOLES      │  │
│   └─────────────────┘       │  REMPLACEMENTS  │       └─────────────────┘  │
│                             └─────────────────┘                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           REMPLAÇANTS & PLANNING                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────┐                                                       │
│   │   REMPLAÇANT    │                                                       │
│   │  - lastName     │                                                       │
│   │  - firstName    │                                                       │
│   │  - isAvailable  │                                                       │
│   └────────┬────────┘                                                       │
│            │                                                                │
│      ┌─────┼─────┬──────────────┬──────────────┐                           │
│      │     │     │              │              │                           │
│      ▼     ▼     ▼              ▼              ▼                           │
│  ┌───────┐ ┌───────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
│  │REMARQ.│ │OBSERV.│ │   PÉRIODES   │ │ DISPONIB.    │ │ AFFECTATIONS │   │
│  └───────┘ └───────┘ │ (récurrences)│ │ SPÉCIFIQUES  │ │ (remplacem.) │   │
│                      └──────┬───────┘ └──────────────┘ └──────────────┘   │
│                             │                                              │
│                      ┌──────▼───────┐                                      │
│                      │ RÉCURRENCES  │                                      │
│                      │ (jour+créne.)│                                      │
│                      └──────────────┘                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Relations clés

### Établissement ↔ Directeur
- Un **établissement** peut avoir un directeur principal (`etablissements.directeurId`)
- Chaque **école** peut avoir son propre directeur (`ecoles.directeurId`)
- Si l'école n'a pas de directeur défini, elle hérite conceptuellement de celui de l'établissement
- Cette surcharge permet de gérer les cas où une école a un directeur différent

### Remplaçant ↔ Disponibilités

```
REMPLAÇANT
    │
    └── PÉRIODES (dateDebut, dateFin, nom)
            │
            └── RÉCURRENCES (jourSemaine, creneau)
                 ex: "Lundi matin", "Mardi après-midi"
```

Une **période** définit une plage de dates pendant laquelle des **récurrences** hebdomadaires s'appliquent.
Exemple : "Du 1er sept au 20 déc : disponible lundi matin et jeudi journée"

### Affectation (Remplacement)

```
REMPLAÇANT ─── affecte ───► COLLABORATEUR
                   │
                   ├── dateDebut/dateFin
                   ├── creneau (matin/après-midi/journée)
                   └── ecoleId (lieu du remplacement)
```

## Tables par domaine

### Structure scolaire
| Table | Description |
|-------|-------------|
| `etablissements` | Établissements scolaires |
| `ecoles` | Écoles (appartiennent à un établissement) |
| `classes` | Classes (appartiennent à une école) |
| `periodes_scolaires` | Années/périodes scolaires (R25, R26...) |

### Personnel
| Table | Description |
|-------|-------------|
| `directeurs` | Directeurs d'écoles |
| `directeur_remplacements` | Historique des remplacements de directeurs |
| `titulaires` | Titulaires de classe |
| `titulaire_affectations` | Affectations des titulaires aux écoles/classes |
| `titulaire_remplacements` | Historique des remplacements de titulaires |
| `collaborateurs` | Collaborateurs itinérants |
| `collaborateur_ecoles` | Liaisons collaborateur ↔ école |

### Remplaçants
| Table | Description |
|-------|-------------|
| `remplacants` | Remplaçants disponibles |
| `remplacant_remarques` | Remarques datées sur un remplaçant |
| `remplacant_observateurs` | Collaborateurs qui suivent un remplaçant |

### Planning
| Table | Description |
|-------|-------------|
| `remplacant_disponibilites_periodes` | Périodes de disponibilité avec dates |
| `remplacant_disponibilites_recurrentes` | Récurrences hebdomadaires (liées aux périodes) |
| `remplacant_disponibilites_specifiques` | Dates ponctuelles (ajout ou exception) |
| `remplacant_affectations` | Affectations remplaçant → collaborateur |
| `vacances_scolaires_cache` | Cache des vacances scolaires (OpenHolidays API) |

### Autres
| Table | Description |
|-------|-------------|
| `ecole_taux` | Taux par école et période |
| `sectors` | Secteurs géographiques |
| `contact_types` | Types de contact |
| `collaborateur_contacts` | Contacts des collaborateurs |

## Enums

| Enum | Valeurs |
|------|---------|
| `jour_semaine` | lundi, mardi, mercredi, jeudi, vendredi |
| `creneau` | matin, apres_midi, journee |
| `vacances_type` | vacances, ferie |

## Conventions

### IDs
- Tables principales : `integer().primaryKey().generatedAlwaysAsIdentity()`
- Table `users` (auth) : `uuid`

### Audit
Toutes les tables principales ont :
- `createdAt` : timestamp with timezone
- `updatedAt` : timestamp with timezone
- `createdBy` : FK→users (set null on delete)
- `updatedBy` : FK→users (set null on delete)

### Nommage
- Tables : `snake_case` (ex: `collaborateur_ecoles`)
- Colonnes : `snake_case` (ex: `date_debut`)
- TypeScript : `camelCase` (ex: `dateDebut`)
