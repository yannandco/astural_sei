# SEI — Vue d'ensemble

## Structure du projet

```
astural_sei/
├── app/
│   ├── (dashboard)/          # Pages protégées avec layout sidebar
│   │   ├── collaborateurs/   # Module 1 : gestion des collaborateurs
│   │   ├── remplacants/      # Module 5 : gestion des remplaçants
│   │   ├── etablissements/   # Module 2 : établissements
│   │   ├── ecoles/           # Module 2 : écoles (détail)
│   │   ├── directeurs/       # Module 3 : directeurs
│   │   ├── titulaires/       # Module 4 : titulaires
│   │   ├── planning/         # Module 6 : planning des remplaçants
│   │   ├── documentation/    # Affichage specs/changelog
│   │   └── parametres/       # Paramètres système
│   ├── api/                  # Routes API REST
│   └── login/                # Page de connexion
├── components/
│   └── planning/             # Composants calendrier/planning
├── lib/
│   ├── auth/                 # Lucia auth + helpers
│   └── db/
│       └── schema/           # Drizzle schema (tables, enums, relations)
├── .specify/                 # Spécifications du projet
│   ├── memory/               # Constitution du projet
│   └── specs/                # Specs par module + data model + user stories
└── public/                   # Assets statiques
```

## Modules

| Module | Description | Statut |
|--------|-------------|--------|
| 1 — Collaborateurs | CRUD + import Excel | ✅ Terminé |
| 2 — Établissements | Hiérarchie établissements/écoles/classes | ✅ Terminé |
| 3 — Directeurs | CRUD + historique remplacements | ✅ Terminé |
| 4 — Titulaires | CRUD + affectations + remplacements | ✅ Terminé |
| 5 — Remplaçants | CRUD + import + remarques + observateurs | ✅ Terminé |
| 6 — Planning | Disponibilités, périodes, affectations, vues globales | ✅ Terminé |

## Navigation

### Sidebar
```
Personnel
├── Collaborateurs
├── Remplaçants
└── Planning (nouveau)

Structure
├── Établissements
├── Écoles
├── Directeurs
└── Titulaires

Système
├── Paramètres
└── Documentation
```

## Points clés

### Relation Directeur ↔ Établissement/École
- Un établissement peut avoir un directeur principal
- Chaque école peut avoir son propre directeur (surcharge)
- Si l'école n'a pas de directeur, elle hérite de celui de l'établissement

### Planning des remplaçants
- **Périodes** : Plages de dates avec patterns de récurrence hebdomadaire
- **Disponibilités spécifiques** : Dates ponctuelles (ajout ou exception)
- **Affectations** : Remplacement d'un collaborateur par un remplaçant
- **Vues** : Onglet remplaçants + onglet collaborateurs

## Commandes

```bash
npm run dev          # Serveur développement
npm run build        # Build production
npm run db:push      # Push schema en DB
npm run db:studio    # Interface Drizzle Studio
npm run typecheck    # Vérification TypeScript
```

## Documentation

- `/.specify/memory/constitution.md` — Principes et architecture
- `/.specify/specs/data-model.md` — Schéma de données complet
- `/.specify/specs/user-stories.md` — User stories par module
- `/.specify/specs/XX-module/spec.md` — Spec détaillée par module
