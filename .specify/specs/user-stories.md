# User Stories — SEI

## Vue d'ensemble des rôles

| Rôle | Description |
|------|-------------|
| **Admin** | Gestion complète (CRUD sur toutes les entités) |
| **User** | Consultation et actions limitées |

---

## Module 1 — Collaborateurs

### US-1.1 : Gestion des collaborateurs
**En tant qu'** admin
**Je veux** pouvoir créer, modifier et supprimer des collaborateurs
**Afin de** maintenir la liste des collaborateurs itinérants à jour

**Critères d'acceptation :**
- [ ] Formulaire de création avec nom, prénom, email, téléphone
- [ ] Import Excel depuis fichier existant
- [ ] Soft delete (isActive = false)
- [ ] Recherche par nom/prénom

### US-1.2 : Consultation des collaborateurs
**En tant qu'** utilisateur
**Je veux** voir la liste des collaborateurs avec filtres
**Afin de** trouver rapidement un collaborateur

---

## Module 2 — Établissements / Écoles / Classes

### US-2.1 : Hiérarchie scolaire
**En tant qu'** admin
**Je veux** gérer la hiérarchie Établissement → École → Classe
**Afin de** organiser les structures scolaires

**Critères d'acceptation :**
- [ ] Créer/modifier/supprimer des établissements
- [ ] Ajouter des écoles à un établissement
- [ ] Ajouter des classes à une école
- [ ] Suppression en cascade (école → classes)

### US-2.2 : Directeur d'établissement/école
**En tant qu'** admin
**Je veux** assigner un directeur à un établissement ou à une école spécifique
**Afin de** gérer les responsabilités

**Critères d'acceptation :**
- [ ] L'établissement peut avoir un directeur principal
- [ ] Chaque école peut surcharger avec son propre directeur
- [ ] Dropdown de sélection des directeurs actifs

---

## Module 3 — Directeurs

### US-3.1 : Gestion des directeurs
**En tant qu'** admin
**Je veux** gérer les directeurs et leur historique de remplacements
**Afin de** suivre qui dirige quelle école

**Critères d'acceptation :**
- [ ] CRUD directeurs
- [ ] Voir les écoles actuellement dirigées
- [ ] Historique des remplacements

---

## Module 4 — Titulaires

### US-4.1 : Affectations des titulaires
**En tant qu'** admin
**Je veux** affecter des titulaires aux écoles/classes
**Afin de** savoir qui enseigne où

**Critères d'acceptation :**
- [ ] Affecter un titulaire à une école + classe
- [ ] Définir dates début/fin
- [ ] Historique des remplacements

---

## Module 5 — Remplaçants

### US-5.1 : Gestion des remplaçants
**En tant qu'** admin
**Je veux** gérer la liste des remplaçants
**Afin de** savoir qui est disponible pour remplacer

**Critères d'acceptation :**
- [ ] CRUD remplaçants (nom, prénom, contact)
- [ ] Import Excel
- [ ] Statut de disponibilité global (isAvailable)
- [ ] Dates de contrat

### US-5.2 : Remarques et observateurs
**En tant qu'** admin
**Je veux** ajouter des remarques et assigner des observateurs aux remplaçants
**Afin de** suivre les informations importantes

**Critères d'acceptation :**
- [ ] Ajouter des remarques datées
- [ ] Assigner des collaborateurs comme observateurs
- [ ] Voir l'historique des remarques

---

## Module 6 — Planning

### US-6.1 : Périodes de disponibilité
**En tant qu'** admin
**Je veux** définir des périodes de disponibilité récurrente pour un remplaçant
**Afin de** savoir quand il est disponible chaque semaine

**Critères d'acceptation :**
- [ ] Créer une période avec dates début/fin
- [ ] Définir les jours/créneaux disponibles (ex: lundi matin, jeudi journée)
- [ ] Pouvoir créer plusieurs périodes (semestre 1, semestre 2...)
- [ ] Modifier/supprimer une période

### US-6.2 : Disponibilités spécifiques
**En tant qu'** admin
**Je veux** ajouter des disponibilités ponctuelles ou des exceptions
**Afin de** gérer les cas particuliers

**Critères d'acceptation :**
- [ ] Ajouter une disponibilité ponctuelle (date précise)
- [ ] Ajouter une exception (indisponible alors que normalement dispo)
- [ ] Note optionnelle sur l'exception

### US-6.3 : Affectations (remplacements)
**En tant qu'** admin
**Je veux** affecter un remplaçant à un collaborateur
**Afin de** planifier les remplacements

**Critères d'acceptation :**
- [ ] Sélectionner remplaçant, collaborateur, école
- [ ] Définir dates et créneau
- [ ] Ajouter un motif optionnel
- [ ] Voir l'affectation dans le calendrier

### US-6.4 : Vue planning remplaçants
**En tant qu'** utilisateur
**Je veux** voir la vue globale des disponibilités des remplaçants
**Afin de** trouver qui est disponible pour une date

**Critères d'acceptation :**
- [ ] Grille semaine avec tous les remplaçants
- [ ] Codes couleur (disponible, affecté, exception, indisponible)
- [ ] Navigation par semaine
- [ ] Affichage des vacances scolaires

### US-6.5 : Vue planning collaborateurs
**En tant qu'** utilisateur
**Je veux** voir qui remplace quels collaborateurs
**Afin de** savoir qui intervient où

**Critères d'acceptation :**
- [ ] Onglet "Collaborateurs" dans le planning
- [ ] Voir les collaborateurs ayant des remplacements
- [ ] Afficher le nom du remplaçant dans chaque créneau

### US-6.6 : Calendrier fiche remplaçant
**En tant qu'** admin
**Je veux** voir et gérer les disponibilités depuis la fiche remplaçant
**Afin de** avoir une vue individuelle

**Critères d'acceptation :**
- [ ] Calendrier semaine interactif
- [ ] Clic sur cellule → menu contextuel (ajouter exception, créer affectation...)
- [ ] Liste des affectations en cours

---

## Module Transverse — Vacances scolaires

### US-T.1 : Affichage des vacances
**En tant qu'** utilisateur
**Je veux** voir les vacances scolaires dans le calendrier
**Afin de** contextualiser les plannings

**Critères d'acceptation :**
- [ ] Bandeau jaune pour les semaines de vacances
- [ ] Récupération automatique depuis OpenHolidays API (Canton de Genève)
- [ ] Cache en base de données

---

## Priorités d'implémentation

| Priorité | Module | Statut |
|----------|--------|--------|
| P0 | Collaborateurs | ✅ Fait |
| P0 | Établissements/Écoles/Classes | ✅ Fait |
| P1 | Directeurs | ✅ Fait |
| P1 | Titulaires | ✅ Fait |
| P1 | Remplaçants | ✅ Fait |
| P2 | Planning (périodes, affectations) | ✅ Fait |
| P2 | Planning (vue globale, onglets) | ✅ Fait |
| P3 | Vacances scolaires | ✅ Fait |
