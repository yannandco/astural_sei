# Astural SEI — Project Context

## Documentation
**IMPORTANT:** Quand l'utilisateur demande de "mettre à jour la documentation", il faut mettre à jour les fichiers dans le dossier `.specify/` :
- `.specify/specs/` — Spécifications des modules
- `.specify/memory/constitution.md` — Constitution du projet

## Stack
- **Next.js 15** + React 18, App Router
- **Drizzle ORM** + PostgreSQL (driver: `postgres`)
- **Lucia Auth v3** (cookie sessions, Argon2), roles: `admin` / `user`
- **Tailwind CSS** with custom DS classes (ds-header, ds-table, modal-*, btn, form-input, status-badge-*)
- **Heroicons** (`@heroicons/react/24/outline`)
- **No external component library** — tout est fait en pur Tailwind + classes DS custom

## Database
- Connection: `lib/db/index.ts` → exporte `db` (drizzle instance) et `schema`
- Schemas barrel: `lib/db/schema/index.ts`
- Scripts: `npm run db:push` (drizzle-kit push), `npm run typecheck` (tsc --noEmit)
- IDs: `integer().primaryKey().generatedAlwaysAsIdentity()` (sauf users = UUID)
- Audit: `createdAt`, `updatedAt` (timestamps TZ), `createdBy`/`updatedBy` (FK→users, set null)
- Colonnes DB en snake_case, TypeScript en camelCase

## Auth
- `lib/auth/server.ts` : `validateRequest()`, `requireAuth()`, `requireRole(['admin'])`
- Les erreurs auth sont des `throw new Error('Non authentifié')` / `'Accès non autorisé'`
- API catch: tester `(error as Error).message` pour 401/403

## API Pattern
```typescript
// Route params (Next.js 15)
type RouteParams = { params: Promise<{ id: string }> }

// Response format
{ data: ... }     // succès
{ error: '...' }  // erreur (messages en français)

// Auth
await requireAuth()           // GET public
await requireRole(['admin'])  // POST/PATCH/DELETE
```

## UI Patterns
- Pages: `'use client'`, fetch API, useState/useEffect/useCallback/useMemo
- Table: classes `ds-table`, `ds-table-header`, `ds-table-row`, `ds-table-cell`
- Header: `ds-header`, `ds-header-content`, `ds-header-left`, `ds-header-icon-wrapper`
- Empty: `ds-empty-state`, `ds-empty-state-content`, `ds-empty-state-icon-wrapper`
- Modal: `modal-overlay`, `modal-container`, `modal-header`, `modal-body`, `modal-footer`
- Boutons: `btn btn-primary`, `btn btn-secondary`
- Forms: `form-group`, `form-label`, `form-input`, `form-textarea`
- Status: `status-badge-success`, `status-badge-gray`
- Layout détail: `grid grid-cols-1 lg:grid-cols-[1fr_440px] gap-10`
- Sections: `ds-table-container` > `p-5` > `h2.text-sm.font-semibold.text-purple-700.uppercase`
- Tri: sortable headers avec ChevronUp/DownIcon
- Recherche: debounce 300ms via setTimeout dans useEffect
- Navigation détail: `router.push()` sur clic table row

## Modules implémentés

### Module 1 — Collaborateurs (v0.1.0)
- Schema: `lib/db/schema/collaborateurs.ts`, `sectors.ts`, `contacts.ts`, `enums.ts`
- API: `/api/collaborateurs`, `/api/collaborateurs/[id]`, `/api/collaborateurs/import`
- API: `/api/sectors`, `/api/contact-types`, `/api/contact-types/[id]`
- UI: `/collaborateurs` (liste + modal création), `/collaborateurs/[id]` (détail/édition avec onglets Informations/Planning)
- UI: `/collaborateurs/import` (import Excel)

### Module 1b — Remplaçants
- Schema: `lib/db/schema/remplacants.ts` — 3 tables:
  - `remplacants` (nom, prénom, adresse, téléphone, email, isAvailable, contractStartDate, contractEndDate, obsTemporaire)
  - `remplacant_remarques` (remarques datées avec auteur)
  - `remplacant_observateurs` (collaborateurs qui suivent le remplaçant)
- API:
  - `/api/remplacants` + `/api/remplacants/[id]`
  - `/api/remplacants/[id]/remarques`
  - `/api/remplacants/[id]/observateurs`
  - `/api/remplacants/import` (import Excel avec preview)
  - `/api/remplacants/import-disponibilites` (import disponibilités Excel)
- UI:
  - `/remplacants` — liste avec filtres (disponibilité, statut), tri, colonnes: Nom, Contact, Statut
  - `/remplacants/[id]` — détail/édition avec onglets Informations/Planning, remarques, observateurs
  - `/remplacants/new` — création
  - `/remplacants/import` — import Excel (feuille "Liste rempl.")
  - `/remplacants/import-disponibilites` — import disponibilités depuis Excel

### Module 2 — Établissements, Écoles, Classes, Directeurs, Titulaires (v0.2.0)
- Schema: `lib/db/schema/etablissements.ts` — 9 tables:
  - `etablissements`, `ecoles`, `classes`
  - `directeurs`, `titulaires`
  - `collaborateurEcoles`, `titulaireAffectations`
  - `directeurRemplacements`, `titulaireRemplacements`
- API CRUD:
  - `/api/etablissements` + `/api/etablissements/[id]`
  - `/api/ecoles` + `/api/ecoles/[id]` + `/api/ecoles/[id]/planning`
  - `/api/classes` + `/api/classes/[id]`
  - `/api/directeurs` + `/api/directeurs/[id]` + `/api/directeurs/[id]/remplacements`
  - `/api/titulaires` + `/api/titulaires/[id]` (avec intervenants) + `/api/titulaires/[id]/affectations` + `/api/titulaires/[id]/remplacements`
  - `/api/collaborateurs/[id]/ecoles` + `/api/collaborateurs/[id]/planning`
  - `/api/docs` + `/api/docs/[...path]` (sert CHANGELOG.md et .specify/)
- UI:
  - `/etablissements` — liste avec filtres, modal création
  - `/etablissements/[id]` — détail + section écoles avec ajout école (modal)
  - `/ecoles/[id]` — détail avec onglets Informations/Planning, dropdown directeur, ajout classes inline
  - `/directeurs` — liste (colonnes: Nom, Email, Établissement, École, Statut)
  - `/directeurs/[id]` — détail, écoles actuelles, historique remplacements
  - `/titulaires` — liste (colonnes: Nom, Email, Établissement, École, Statut)
  - `/titulaires/[id]` — détail, affectations avec colonne Intervenant, historique remplacements
  - `/documentation` — arborescence fichiers MD + rendu markdown

### Module 3 — Planning (v0.3.0)
- Schema: `lib/db/schema/planning.ts` — 5 tables:
  - `remplacantDisponibilitesPeriodes`, `remplacantDisponibilitesRecurrentes`
  - `remplacantDisponibilitesSpecifiques`, `remplacantAffectations`
  - `vacancesScolairesCache`
- API:
  - `/api/planning` — Vue globale remplaçants
  - `/api/planning/collaborateurs` — Vue collaborateurs
  - `/api/remplacants/[id]/disponibilites/periodes` + `/recurrentes` + `/specifiques`
  - `/api/remplacants/[id]/affectations`
  - `/api/vacances-scolaires`
- UI:
  - `/planning` — Vue hebdomadaire avec onglets Remplaçants/Collaborateurs
  - Calendriers mensuels dans les onglets Planning de chaque fiche (collaborateur, remplaçant, école)
- Composants: `components/planning/` (MonthCalendar, CollaborateurMonthCalendar, EcoleMonthCalendar, CalendarCell, etc.)
- Features: mercredi masqué, matin/AM côte à côte, cellules 50px, infos complètes dans cellules, today highlighting

## Sidebar navigation (layout.tsx)
3 sections :
- **Personnel** : Collaborateurs
- **Structure** : Établissements, Écoles, Directeurs, Titulaires
- **Système** : Paramètres, Documentation

## Hiérarchie métier
```
Établissement (1) → (N) École (1) → (N) Classe
                         │
                         ├── directeurId → Directeur (dropdown sur fiche école)
                         ├── Titulaires (via titulaire_affectations)
                         └── Collaborateurs (via collaborateur_ecoles)

Directeur ← directeur_remplacements (historique)
Titulaire ← titulaire_remplacements (historique)
```

## Fichiers clés
| Fichier | Rôle |
|---------|------|
| `lib/db/schema/index.ts` | Barrel export tous les schemas |
| `lib/db/index.ts` | Connexion DB + export `db` |
| `lib/auth/server.ts` | validateRequest, requireAuth, requireRole |
| `lib/auth/lucia.ts` | Config Lucia + Drizzle adapter |
| `app/(dashboard)/layout.tsx` | Sidebar, breadcrumbs, auth check |
| `drizzle.config.ts` | Config drizzle-kit |
| `.env` | DATABASE_URL |
| `CHANGELOG.md` | Historique des versions |
| `.specify/` | Specs du projet (constitution, quickstart, modules) |

## Commandes
```bash
npm run dev          # Serveur de développement
npm run db:push      # Appliquer le schema en DB
npm run typecheck    # Vérification TypeScript
npm run build        # Build production
npm run db:studio    # Interface Drizzle Studio
```

## Référence app Astural (look & feel)
Le design s'inspire de l'app de facturation Astural :
`/Users/long/Claude Code Repo/Astural/REPAS/app_astural_Facturation_Externats/`
- Couleur primaire: purple (violet Astural)
- Globals CSS avec design system custom
- Logo: `/public/Astural-Logotype.svg`
