# Module 1 — Collaborateurs

## Description
Gestion des collaborateurs itinérants d'Astural avec CRUD complet et import Excel.

## Fonctionnalités
- Liste avec recherche, filtres (secteur, contrat, statut), tri multi-colonnes
- Création via modal
- Page détail avec formulaire d'édition en 2 colonnes
- Import Excel avec mapping de colonnes et prévisualisation

## Tables
- `collaborateurs` — Données personnelles, contrat, secteur

## API
- `GET /api/collaborateurs` — Liste avec filtres
- `POST /api/collaborateurs` — Création (admin)
- `GET /api/collaborateurs/:id` — Détail
- `PATCH /api/collaborateurs/:id` — Mise à jour (admin)
- `DELETE /api/collaborateurs/:id` — Suppression (admin)
- `POST /api/collaborateurs/import` — Import Excel (admin)
- `POST /api/collaborateurs/import?preview=true` — Preview sans insertion

## Import Excel

### Colonnes mappées
| Colonne Excel | Champ DB | Notes |
|---------------|----------|-------|
| Nom collaborateur / Nom | lastName, firstName | Parsing automatique "Marie DUPONT" → nom: "DUPONT", prénom: "Marie" (noms en MAJUSCULES) |
| Nom de famille | lastName | Utilisé directement si présent |
| Prénom | firstName | Utilisé directement si présent |
| Adresse | address | |
| Code postal | postalCode | |
| Ville | city | |
| Mobile professionnel | mobilePro | |
| Email | email | |
| Secteur principal | secteurId | Créé automatiquement si inexistant |
| Taux | taux | |
| Contrat | contratType | CDI, CDD, Mixte |
| Sexe | sexe | M, F |
| Date de sortie | dateSortie | Format mm/dd/yy ou date Excel |

### Logique d'upsert
1. Match par email si présent
2. Sinon match par lastName + firstName
3. Création si non trouvé, mise à jour sinon
