# Constitution du projet SEI

## Mission
SEI (Suivi des Enseignants Itinérants) est une application de gestion pour Astural, permettant le suivi des collaborateurs itinérants, de leurs affectations dans les écoles, et de la planification des interventions et remplacements.

## Principes techniques
- **Stack** : Next.js 15, React 18, Drizzle ORM, PostgreSQL, Lucia Auth, Tailwind CSS
- **Langue UI** : Français (messages d'erreur, labels, navigation)
- **Architecture API** : Routes REST avec `{ data }` en succès, `{ error }` en erreur
- **Authentification** : Rôles `admin` et `user`, protection via `requireRole()` / `requireAuth()`
- **Base de données** : IDs auto-incrémentés (integer), audit (createdAt, updatedAt, createdBy, updatedBy)
- **Frontend** : Client components avec fetch API, modals pour création, pages détail avec formulaires

## Hiérarchie métier
```
Établissement (directeurId optionnel)
      │
      └── École (directeurId optionnel, peut surcharger celui de l'établissement)
              │
              ├── Classe
              ├── Directeur (avec historique remplacements)
              ├── Titulaire (avec affectations + remplacements)
              └── Collaborateur (liaisons via collaborateur_ecoles)

Remplaçant
      │
      ├── Périodes de disponibilité (récurrences hebdomadaires)
      ├── Disponibilités spécifiques (dates ponctuelles)
      └── Affectations (remplacement d'un collaborateur)
```

## Modules
1. **Collaborateurs** — Gestion des collaborateurs itinérants
2. **Établissements/Écoles/Classes** — Hiérarchie des structures scolaires
3. **Directeurs** — Gestion des directeurs avec historique de remplacements
4. **Titulaires** — Gestion des titulaires avec affectations et remplacements
5. **Remplaçants** — Gestion des remplaçants avec remarques et observateurs
6. **Planning** — Calendrier des disponibilités et affectations des remplaçants

## Conventions
- Tables en snake_case, colonnes en snake_case
- TypeScript en camelCase
- CSS via classes utilitaires Tailwind + classes DS custom (ds-header, ds-table, etc.)
- Barrel exports dans `lib/db/schema/index.ts`
