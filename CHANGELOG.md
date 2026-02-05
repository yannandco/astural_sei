# Changelog

Toutes les modifications notables de ce projet sont documentées dans ce fichier.

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
