# Changelog

Toutes les modifications notables de ce projet sont documentées dans ce fichier.

## [0.3.0] - 2026-02-05

### Ajouté
- **Module 3 — Planning complet**
  - Page planning principale avec vues Remplaçants et Collaborateurs (onglets)
  - Affichage des infos complètes (noms, écoles) dans les cellules du planning
  - Calendriers mensuels pour les pages collaborateur, remplaçant et école
  - Créneaux matin/après-midi côte à côte sur une même ligne
  - Cellules de hauteur uniforme (50px)
  - Masquage de la colonne mercredi dans tous les calendriers
  - Colonnes de même largeur (`table-fixed`)
  - Bordures extérieures pour la colonne du jour actuel
  - Navigation semaine avec préservation du scroll
  - Hover sur les lignes avec outline
  - Import de disponibilités depuis fichiers Excel
  - Gestion des vacances scolaires (OpenHolidays API)

### Modifié
- **Pages détail** : Onglets "Informations" / "Planning" pour collaborateurs, remplaçants et écoles
- **Page titulaire** : Ajout colonne "Intervenant" dans les affectations
- **Listes** : Colonne "Statut" déplacée à droite pour directeurs et titulaires
- **Liste remplaçants** : Suppression des colonnes "Disponible" et "Contrat"
- **Paramètres** : Ajout pages backup, import, périodes, secteurs, système, utilisateurs

## [0.2.0] - 2026-02-02

### Ajouté
- **Module 2 — Établissements, Écoles, Classes, Directeurs, Titulaires**
  - Gestion hiérarchique : Établissement → École → Classe
  - CRUD complet pour établissements, écoles, classes
  - Gestion des directeurs avec historique de remplacements
  - Gestion des titulaires avec affectations et remplacements
  - Liaison collaborateurs-écoles
  - Pages liste et détail pour chaque entité
  - Page Documentation avec rendu Markdown des specs
  - Navigation sidebar enrichie

## [0.1.0] - 2026-02-02

### Ajouté
- **Module 1 — Collaborateurs**
  - CRUD complet des collaborateurs (nom, prénom, email, mobile, adresse, secteur, contrat, taux)
  - Import Excel avec mapping de colonnes et prévisualisation
  - Filtres par secteur, type de contrat, statut actif/inactif
  - Tri multi-colonnes sur la liste
  - Page détail avec formulaire d'édition en 2 colonnes
- **Infrastructure**
  - Authentification Lucia avec rôles (admin/user)
  - Gestion des types de contact
  - Gestion des secteurs
  - Système de logs
  - Layout dashboard avec sidebar et breadcrumbs
