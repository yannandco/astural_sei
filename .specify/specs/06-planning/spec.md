# Module 6 — Planning

## Description
Gestion du calendrier et de la planification des remplaçants : disponibilités récurrentes par périodes, disponibilités spécifiques, affectations aux collaborateurs.

## Concepts clés

### Granularité temporelle
- **Jours** : Lundi, Mardi, Jeudi, Vendredi (mercredi masqué)
- **Créneaux** : Matin / Après-midi / Journée complète
- **Périodes** : Plages de dates avec patterns de récurrence

### Types de disponibilité
1. **Périodes de récurrence** : Patterns hebdomadaires valables sur une plage de dates
2. **Disponibilités spécifiques** : Dates ponctuelles (ajout ou exception)
3. **Affectations** : Remplaçant assigné à un collaborateur pour une période

### Priorité d'affichage (du plus prioritaire au moins)
1. Affectation → Violet
2. Exception (indisponible) → Rouge
3. Disponibilité spécifique → Vert foncé
4. Récurrence active → Vert clair
5. Par défaut → Gris (indisponible)

## Tables

### remplacant_disponibilites_periodes
| Champ | Type | Description |
|-------|------|-------------|
| id | integer (PK) | Auto-incrémenté |
| remplacantId | FK→remplacants | Cascade |
| nom | text | Nom de la période (ex: "Semestre 1 2025-2026") |
| dateDebut | date | Début de la période |
| dateFin | date | Fin de la période |
| isActive | boolean | Statut actif |

### remplacant_disponibilites_recurrentes
| Champ | Type | Description |
|-------|------|-------------|
| id | integer (PK) | Auto-incrémenté |
| periodeId | FK→periodes | Cascade (lié à une période) |
| jourSemaine | enum | lundi, mardi, mercredi, jeudi, vendredi |
| creneau | enum | matin, apres_midi, journee |

### remplacant_disponibilites_specifiques
| Champ | Type | Description |
|-------|------|-------------|
| id | integer (PK) | Auto-incrémenté |
| remplacantId | FK→remplacants | Cascade |
| date | date | Date spécifique |
| creneau | enum | matin, apres_midi, journee |
| isAvailable | boolean | true=disponible, false=exception |
| note | text | Note optionnelle |

### remplacant_affectations
| Champ | Type | Description |
|-------|------|-------------|
| id | integer (PK) | Auto-incrémenté |
| remplacantId | FK→remplacants | Cascade |
| collaborateurId | FK→collaborateurs | Cascade |
| ecoleId | FK→ecoles | Set null |
| dateDebut | date | Début affectation |
| dateFin | date | Fin affectation |
| creneau | enum | matin, apres_midi, journee |
| motif | text | Motif du remplacement |
| isActive | boolean | Statut actif |

### vacances_scolaires_cache
| Champ | Type | Description |
|-------|------|-------------|
| id | integer (PK) | Auto-incrémenté |
| annee | integer | Année scolaire |
| type | enum | vacances, ferie |
| nom | varchar | Nom des vacances |
| dateDebut | date | Début |
| dateFin | date | Fin |
| fetchedAt | timestamp | Date de récupération API |

## API

### Périodes de disponibilité
- `GET /api/remplacants/:id/disponibilites/periodes` — Liste des périodes avec récurrences
- `POST /api/remplacants/:id/disponibilites/periodes` — Créer une période (avec récurrences)
- `PATCH /api/remplacants/:id/disponibilites/periodes` — Modifier une période
- `DELETE /api/remplacants/:id/disponibilites/periodes?periodeId=X` — Supprimer une période

### Récurrences
- `GET /api/remplacants/:id/disponibilites/recurrentes?date=YYYY-MM-DD` — Récurrences actives pour une date
- `POST /api/remplacants/:id/disponibilites/recurrentes` — Ajouter une récurrence à une période
- `DELETE /api/remplacants/:id/disponibilites/recurrentes?recurrenceId=X` — Supprimer une récurrence

### Disponibilités spécifiques
- `GET /api/remplacants/:id/disponibilites/specifiques?startDate=X&endDate=Y` — Liste par plage
- `POST /api/remplacants/:id/disponibilites/specifiques` — Ajouter
- `DELETE /api/remplacants/:id/disponibilites/specifiques?date=X&creneau=Y` — Supprimer

### Affectations
- `GET /api/remplacants/:id/affectations?startDate=X&endDate=Y` — Liste par plage
- `POST /api/remplacants/:id/affectations` — Créer
- `PATCH /api/remplacants/:id/affectations` — Modifier
- `DELETE /api/remplacants/:id/affectations?affectationId=X` — Supprimer

### Planning global
- `GET /api/planning?startDate=X&endDate=Y` — Vue tous remplaçants (avec périodes)
- `GET /api/planning/collaborateurs?startDate=X&endDate=Y` — Vue collaborateurs remplacés

### Planning par entité
- `GET /api/collaborateurs/:id/planning?startDate=X&endDate=Y` — Planning d'un collaborateur
- `GET /api/ecoles/:id/planning?month=YYYY-MM` — Planning d'une école

### Vacances scolaires
- `GET /api/vacances-scolaires?startDate=X&endDate=Y` — Liste des vacances/fériés
- `POST /api/vacances-scolaires` — Forcer mise à jour depuis OpenHolidays API

## UI

### Composants (`components/planning/`)
| Composant | Description |
|-----------|-------------|
| `MonthCalendar` | Calendrier mensuel remplaçant (matin/AM côte à côte) |
| `CollaborateurMonthCalendar` | Calendrier mensuel collaborateur |
| `EcoleMonthCalendar` | Calendrier mensuel école |
| `CollaborateurPlanning` | Planning semaine collaborateur |
| `WeekCalendar` | Grille calendrier semaine (Lu-Ve) |
| `WeekNavigation` | Navigation ← Semaine → |
| `RecurringAvailabilityEditor` | Gestion des périodes et récurrences |
| `PeriodeModal` | Modal création/édition de période |
| `CalendarCell` | Cellule individuelle (compact pour calendriers mensuels) |
| `CellContextMenu` | Menu contextuel au clic |
| `AssignmentModal` | Modal création affectation |
| `SpecificDateModal` | Modal ajout disponibilité/exception |
| `PlanningLegend` | Légende des couleurs |
| `types.ts` | Types partagés, helpers (getWeekDates, formatDate, JOURS_CALENDRIER) |

### Page Planning (`/planning`)
Vue globale hebdomadaire avec deux onglets :
1. **Remplaçants** : Tous les remplaçants avec disponibilités et infos complètes (noms, écoles) dans les cellules
2. **Collaborateurs** : Collaborateurs avec présences et remplacements

Features :
- Navigation semaine avec préservation du scroll
- Colonnes matin/après-midi côte à côte pour chaque jour
- Mercredi masqué (`JOURS_CALENDRIER` = Lu, Ma, Je, Ve)
- Header sticky avec onglets et navigation
- Hover outline sur les lignes
- Bordures extérieures pour la colonne du jour actuel
- Colonnes de même largeur (`table-fixed`)

### Calendriers mensuels (sous-pages Planning)
Chaque fiche détail (collaborateur, remplaçant, école) a un onglet "Planning" avec un calendrier mensuel :
- Matin et après-midi côte à côte sur une même ligne
- Cellules de hauteur uniforme (50px)
- Numéro de jour en haut à gauche de la cellule matin
- Numéro de semaine à gauche
- Navigation mois ← → avec bouton "Aujourd'hui"
- Infos complètes dans les cellules (noms, écoles)

### Fiche Remplaçant — Section Planning
- Éditeur de périodes de disponibilité (liste de périodes avec grille de récurrences)
- Calendrier mensuel interactif avec menu contextuel
- Liste des affectations

### Codes couleur (Tailwind)
- **Disponible récurrent** : `bg-green-100 border-green-300`
- **Disponible spécifique** : `bg-green-200 border-green-400`
- **Affecté** : `bg-purple-100 border-purple-300`
- **Exception (indispo)** : `bg-red-100 border-red-300`
- **Indisponible (défaut)** : `bg-gray-100 border-gray-300`
- **Vacances** : `bg-yellow-100 border-yellow-300`

## Intégration vacances scolaires

### Source : OpenHolidays API
- URL : https://openholidaysapi.org
- Gratuit, sans authentification
- Endpoint vacances : `GET /SchoolHolidays?countryIsoCode=CH&subdivisionCode=CH-GE&validFrom=X&validTo=Y`
- Endpoint fériés : `GET /PublicHolidays?countryIsoCode=CH&subdivisionCode=CH-GE&validFrom=X&validTo=Y`

### Cache
- Données stockées en base pour éviter appels répétés
- Mise à jour automatique si données manquantes
- Cache valide 30 jours
