# Security Audit Report — Astural SEI

**Date** : 2026-02-26
**Auditor** : Claude AI
**Scope** : Full application security review (OWASP Top 10, Next.js-specific, Better Auth)
**Stack** : Next.js 15, Better Auth 1.4.19, Drizzle ORM, PostgreSQL, Twilio

---

## Executive Summary

**6 critiques, 16 moyens, 10 faibles** issues identifiees.

**6 critiques corrigees, 1 moyen corrige.**

Les corrections implementees couvrent :
- C-01 a C-06 : toutes les issues critiques
- M-03 : headers de securite
- M-12 : messages d'erreur backup generiques (corrige dans le cadre de C-05)
- M-16 : mot de passe DB via env (corrige dans le cadre de C-05)
- L-10 : validation filename backup stricte (corrige dans le cadre de C-05)

---

## Issues Critiques

### C-01 : Routes GET sans authentification — Exposition PII — CORRIGE

| Route | Donnees exposees |
|-------|-----------------|
| `GET /api/collaborateurs/[id]` | Adresse, telephone, email, contrat, sexe |
| `GET /api/titulaires/[id]` | Email, telephone, affectations |
| `GET /api/directeurs/[id]` | Email, telephone, ecoles |
| `GET /api/ecoles/[id]` | Titulaires, collaborateurs, directeur |
| `GET /api/etablissements/[id]` | Directeur, adresse, contact |
| `GET /api/classes/[id]` | Informations de classe |
| `GET /api/sectors` + `[id]` | Secteurs |
| `GET /api/contact-types` + `[id]` | Types de contact |
| `GET /api/docs` + `[...path]` | Documentation interne, specs |

**Impact** : Un attaquant non authentifie peut enumerer les IDs sequentiels (1, 2, 3...) et extraire les donnees personnelles de tous les employes. Violation RGPD.
**Correction** : `await requireAuth()` ajoute a chaque GET handler + catch 401 pour `'Non authentifié'` et `'Compte désactivé'`.

---

### C-02 : Pas de middleware centralisee — CORRIGE

**Fichier** : `middleware.ts` — CREE
**Correction** : Middleware Next.js qui verifie la presence du cookie de session (`better-auth.session_token` ou `__Secure-better-auth.session_token`). Routes API sans cookie recoivent 401, pages dashboard redirigent vers `/login`. Exclut `/api/auth/*` et `/api/whatsapp/webhook`.

---

### C-03 : Pas de rate limiting sur le login — CORRIGE

**Fichiers** : `app/api/auth/login/route.ts`, `app/api/auth/[...all]/route.ts`
**Correction** : Rate limiter en memoire (`lib/rate-limit.ts`) — 10 tentatives par IP par fenetre de 15 minutes. Retourne 429 au-dela. Applique sur le login custom ET le catch-all Better Auth.

---

### C-04 : Webhook WhatsApp sans verification Twilio — CORRIGE

**Fichier** : `app/api/whatsapp/webhook/route.ts`
**Correction** : Validation du header `X-Twilio-Signature` via `twilio.validateRequest()`. Retourne 403 (TwiML vide) si signature invalide. Package `twilio` ajoute aux dependances.

---

### C-05 : Injection de commandes dans les routes backup — CORRIGE

**Fichiers** : `app/api/backup/route.ts`, `app/api/backup/[filename]/route.ts`
**Corrections** :
1. `findPgBinary()` : `exec('find ...' + name)` remplace par `execFile('find', [args])` — plus d'injection possible
2. `PGPASSWORD` : passe via option `env` au lieu d'etre dans la commande shell — invisible dans `ps aux`
3. Operations non compressees : `execFile` avec tableau d'arguments (pas de shell)
4. Validation filename : regex stricte `/^backup_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}(_[a-zA-Z0-9_-]+)?\.sql(\.gz)?$/`
5. Erreurs : messages generiques retournes au client, details logges cote serveur uniquement
6. Whitelist des binaires PG autorises (`ALLOWED_PG_BINARIES`)

---

### C-06 : Utilisateurs desactives gardent leur session — CORRIGE

**Fichier** : `lib/auth/server.ts:54-62`
**Correction** : `requireAuth()` verifie maintenant `user.isActive` et lance `'Compte désactivé'` si le compte est inactif. Toutes les routes (56 fichiers) catchent desormais les deux messages (`'Non authentifié'` et `'Compte désactivé'`) pour retourner 401.

---

## Issues Moyennes

### M-01 : IDOR — Utilisateurs portail peuvent lire les donnees de tous les employes

**Fichiers** : 13+ routes GET utilisent `requireAuth()` au lieu de `requireRole(['admin', 'user'])`
**Routes concernees** : `/api/remplacants/[id]/*`, `/api/collaborateurs/[id]/*`, `/api/absences/*`, `/api/planning/*`, `/api/whatsapp/responses`
**Impact** : Un collaborateur/remplacant connecte au portail peut acceder aux absences, remarques, planning, et disponibilites de TOUS les employes.
**Correction** : Changer `requireAuth()` en `requireRole(['admin', 'user'])` pour les routes dashboard. Utiliser `requireAdminOrSelfRemplacant()` pour les routes self-service.

---

### M-02 : Routes d'ecriture avec mauvais role check

| Route | Probleme |
|-------|----------|
| `POST /api/remplacants/[id]/remarques` | `requireAuth()` → devrait etre `requireRole(['admin', 'user'])` |
| `POST /api/collaborateurs/[id]/remarques` | idem |
| `DELETE /api/whatsapp/responses/[id]` | idem |
| `POST /api/whatsapp` | Un portail user peut envoyer des WhatsApp via Twilio |

---

### M-03 : Aucun header de securite configure — CORRIGE

**Fichier** : `next.config.js`
**Correction** : Ajout de la fonction `headers()` avec :
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `X-DNS-Prefetch-Control: on`

---

### M-04 : Aucune validation de schema (zod) sur les routes API

**Impact** : Pas de validation de format email, longueur de chaine, format de date, types numeriques. Accepte des donnees arbitraires.
**Correction** : Implementer des schemas zod pour tous les corps POST/PATCH.

---

### M-05 : Pas de validation email

**Fichiers** : 10+ routes (users, collaborateurs, remplacants, directeurs, titulaires, etablissements)
**Correction** : Ajouter une regex email ou `z.string().email()`.

---

### M-06 : Pas de validation longueur de chaine

**Impact** : Un utilisateur peut soumettre des megaoctets de texte pour n'importe quel champ.
**Correction** : Ajouter des limites max (noms <= 100 chars, adresses <= 500, notes <= 2000).

---

### M-07 : Pas de validation format date sur routes admin

**Fichiers** : `remplacants/route.ts` (contractStartDate/EndDate), `collaborateurs/[id]/route.ts` (dateSortie), `whatsapp/route.ts` (dateDebut/dateFin)
**Note** : Les routes portail valident correctement les dates.

---

### M-08 : Pas de validation type/taille de fichier sur les imports

**Fichiers** : `collaborateurs/import`, `remplacants/import`, `etablissements/import`, `remplacants/import-disponibilites`
**Impact** : Fichiers tres volumineux = epuisement memoire. Fichiers XLSX malicieux = exploitation potentielle de vulnerabilites dans la lib `xlsx`.
**Correction** : Verifier extension `.xlsx`, MIME type, et taille max (ex: 10 MB).

---

### M-09 : Role utilisateur accepte sans validation

**Fichiers** : `users/route.ts:69`, `users/[id]/route.ts:58`
**Correction** : Valider contre `['admin', 'user', 'collaborateur', 'remplacant']`.

---

### M-10 : Mot de passe minimum trop faible

**Fichiers** : Portal access routes = 6 chars min. User creation = aucun minimum.
**Correction** : Minimum 8-12 caracteres partout.

---

### M-11 : Login fetche toute la ligne user (y compris hash password)

**Fichier** : `app/api/auth/login/route.ts:22` — `db.select().from(users)` sans `.select({...})`
**Impact** : Le hash password est en memoire; risque de fuite via logging ou serialisation accidentelle.
**Correction** : Utiliser `.select({ id, name, email, role, isActive, password })`.

---

### M-12 : Erreurs backup exposent des details internes — CORRIGE

**Fichiers** : `app/api/backup/route.ts`, `app/api/backup/[filename]/route.ts`
**Correction** : Messages d'erreur generiques retournes au client (`'Erreur lors de la sauvegarde de la base de données'`, `'Erreur lors de la restauration'`). Details complets logges cote serveur uniquement.

---

### M-13 : Vulnerabilite `xlsx` (Prototype Pollution + ReDoS)

**Fichier** : `package.json` — `xlsx ^0.18.5`
**Note** : Pas de fix upstream disponible.
**Correction** : Envisager la migration vers `exceljs` ou `sheetjs-ce`.

---

### M-14 : Session token expose dans le retour de `validateRequest`

**Fichier** : `lib/auth/server.ts:47`
**Impact** : Risque d'exposition accidentelle si l'objet session est serialise vers le client.
**Correction** : Ne retourner que `id`, `userId`, `expiresAt` dans la session.

---

### M-15 : Pas de protection CSRF explicite

**Impact** : Better Auth utilise `SameSite: lax` par defaut, ce qui offre une protection partielle. Mais aucune configuration explicite.
**Correction** : Configurer explicitement `SameSite` et `secure` dans la config Better Auth.

---

### M-16 : Mot de passe DB injecte dans commandes shell — CORRIGE

**Fichiers** : `app/api/backup/route.ts`, `app/api/backup/[filename]/route.ts`
**Correction** : `PGPASSWORD` passe via l'option `env` de `execFile`/`exec`. N'apparait plus dans la ligne de commande ni dans `ps aux`.

---

## Issues Faibles

| # | Description | Fichier | Statut |
|---|-------------|---------|--------|
| L-01 | Session 30 jours sans re-authentification pour ops sensibles | `lib/auth/index.ts:33` | |
| L-02 | Message "Compte desactive" revele l'existence du compte | `login/route.ts:36` | |
| L-03 | `console.error` log l'objet erreur complet (50+ fichiers) | Application-wide | |
| L-04 | `.env.example` incomplet (manque TWILIO, BETTER_AUTH) | `.env.example` | |
| L-05 | `.returning()` sans filtre dans les routes access | `*/access/route.ts:125` | |
| L-06 | `parseInt` sans `isNaN` check | `whatsapp/responses/route.ts:32` | |
| L-07 | `minimatch` ReDoS (devDependency) | transitive | |
| L-08 | `esbuild` vuln via drizzle-kit (devDependency) | transitive | |
| L-09 | Vacances scolaires accessible aux portail users | `vacances-scolaires/route.ts` | |
| L-10 | Backup filename validation insuffisante | `backup/[filename]/route.ts` | CORRIGE |

---

## Bonnes Pratiques Deja en Place

| # | Description |
|---|-------------|
| GP-01 | Argon2id avec parametres OWASP (memoryCost: 19456, timeCost: 2) |
| GP-02 | Parametres Argon2 identiques sur les 5 endpoints de hachage |
| GP-03 | RBAC coherent sur toutes les ops destructives (POST/PATCH/DELETE admin) |
| GP-04 | Auto-suppression admin empechee |
| GP-05 | Messages d'erreur generiques sur login (sauf compte desactive) |
| GP-06 | Champs `role`, `isActive`, `lastLoginAt` marques `input: false` dans Better Auth |
| GP-07 | Login via POST body (pas de credentials en URL) |
| GP-08 | `.env` correctement dans `.gitignore` |
| GP-09 | Pas de variables `NEXT_PUBLIC_*` avec secrets |
| GP-10 | TypeScript strict mode active |
| GP-11 | Routes portail avec `getPortailUser()` et verification d'ownership correcte |
| GP-12 | Routes self-service remplacant avec `requireAdminOrSelfRemplacant()` correcte |
| GP-13 | SQL parametre via Drizzle ORM (pas de SQL injection) |
| GP-14 | Pas de `dangerouslySetInnerHTML` ni `innerHTML` |
| GP-15 | Protection path traversal correcte sur `/api/docs/[...path]` |
| GP-16 | CORS par defaut same-origin (le plus restrictif) |

---

## Plan de Remediation (par priorite)

### Immediat (P0) — FAIT
1. ~~Ajouter `requireAuth()` aux 12 routes GET sans auth (C-01)~~ CORRIGE
2. ~~Creer `middleware.ts` centralisee (C-02)~~ CORRIGE
3. ~~Ajouter verification `isActive` dans `requireAuth()` (C-06)~~ CORRIGE

### Urgent (P1) — FAIT
4. ~~Ajouter rate limiting sur login + catch-all auth (C-03)~~ CORRIGE
5. ~~Valider signature Twilio sur webhook WhatsApp (C-04)~~ CORRIGE
6. ~~Corriger les injections de commandes backup (C-05)~~ CORRIGE
7. Corriger les role checks portail→admin (M-01, M-02)

### Important (P2) — 1/4 FAIT
8. ~~Ajouter headers de securite dans `next.config.js` (M-03)~~ CORRIGE
9. Implementer validation zod sur les routes API (M-04 a M-09)
10. Renforcer politique de mot de passe (M-10)
11. Filtrer les select/returning pour exclure les champs sensibles (M-11, M-14)

### Amelioration (P3)
12. Nettoyer les logs d'erreurs pour la production (L-03)
13. Completer `.env.example` (L-04)
14. Evaluer remplacement de `xlsx` (M-13)
15. Reduire duree de session a 7-14 jours (L-01)

---

## Historique des corrections

| Date | Issues corrigees | Fichiers modifies |
|------|-----------------|-------------------|
| 2026-02-26 | C-01 a C-06, M-03, M-12, M-16, L-10 | 21 fichiers modifies/crees + 56 routes maj pour `Compte désactivé` |

### Detail des fichiers modifies (2026-02-26)

| Fichier | Action | Issue |
|---------|--------|-------|
| `lib/auth/server.ts` | MODIFIE — isActive check dans requireAuth() | C-06 |
| `middleware.ts` | CREE — verification cookie session | C-02 |
| `lib/rate-limit.ts` | CREE — rate limiter en memoire | C-03 |
| `app/api/auth/login/route.ts` | MODIFIE — rate limit par IP | C-03 |
| `app/api/auth/[...all]/route.ts` | MODIFIE — wrapper POST avec rate limit | C-03 |
| `app/api/whatsapp/webhook/route.ts` | MODIFIE — validation signature Twilio | C-04 |
| `app/api/backup/route.ts` | MODIFIE — execFile, PGPASSWORD via env, erreurs generiques | C-05 |
| `app/api/backup/[filename]/route.ts` | MODIFIE — execFile, PGPASSWORD via env, regex filename | C-05 |
| `app/api/collaborateurs/[id]/route.ts` | MODIFIE — requireAuth GET | C-01 |
| `app/api/titulaires/[id]/route.ts` | MODIFIE — requireAuth GET | C-01 |
| `app/api/directeurs/[id]/route.ts` | MODIFIE — requireAuth GET | C-01 |
| `app/api/ecoles/[id]/route.ts` | MODIFIE — requireAuth GET | C-01 |
| `app/api/etablissements/[id]/route.ts` | MODIFIE — requireAuth GET | C-01 |
| `app/api/classes/[id]/route.ts` | MODIFIE — requireAuth GET | C-01 |
| `app/api/sectors/route.ts` | MODIFIE — requireAuth GET | C-01 |
| `app/api/sectors/[id]/route.ts` | MODIFIE — requireAuth GET | C-01 |
| `app/api/contact-types/route.ts` | MODIFIE — requireAuth GET | C-01 |
| `app/api/contact-types/[id]/route.ts` | MODIFIE — requireAuth GET | C-01 |
| `app/api/docs/route.ts` | MODIFIE — requireAuth GET | C-01 |
| `app/api/docs/[...path]/route.ts` | MODIFIE — requireAuth GET | C-01 |
| `next.config.js` | MODIFIE — security headers | M-03 |
| 56 routes API | MODIFIE — catch `'Compte désactivé'` pour 401 | C-06 |

---

*Cet audit couvre la securite au niveau applicatif. L'infrastructure, l'hebergement et la securite reseau sont hors perimetre. Un test de penetration professionnel est recommande avant la mise en production.*
