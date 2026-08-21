# Prototype de réservation AMMA

Ce dossier est préparé pour le dépôt de réservation AMMA.

Le dépôt utilise MkDocs Material, avec les contenus dans `docs/`, et charge déjà
des fichiers CSS/JS personnalisés via `mkdocs.yml`.

## Ce qui est déjà prêt

- Une page `docs/index.md`
- Une interface adaptée mobile / ordinateur
- Les 20 créneaux visibles dans l'Evento 2026 :
  - mardi 15 septembre
  - jeudi 15 octobre
  - jeudi 12 novembre
  - mardi 8 décembre
- Les états **Libre** et **Réservé**
- Un formulaire prénom / nom / e-mail Inria
- Blocage atomique d'un créneau côté PostgreSQL
- Aucun nom d'autre participant affiché
- Un lien d'annulation individuel
- Un e-mail automatique de confirmation via Supabase Edge Function + SMTP
- Un mode démonstration sans backend tant que Supabase n'est pas configuré

## 1 — Copier les fichiers dans le dépôt

Copier :

- `docs/index.md`
- `docs/javascripts/amma.js`
- `docs/stylesheets/amma.css`

à la même place dans le dépôt GitHub.

Voir `PATCH-mkdocs.yml.txt` pour les deux lignes à ajouter à `mkdocs.yml`.

À ce stade, le site fonctionne déjà en **mode démonstration** : les réservations
sont simulées dans le navigateur et disparaissent au rechargement.

## 2 — Créer le backend Supabase

Créer un projet Supabase, puis ouvrir **SQL Editor** et exécuter :

`supabase/amma.sql`

Le script crée :

- `amma_slots` : uniquement les dates/heures et le statut du créneau
- `amma_bookings` : prénom, nom, e-mail et token d'annulation
- `book_amma_slot(...)` : réservation atomique
- `cancel_amma_booking(...)` : annulation sécurisée par token

La table contenant les noms et e-mails n'est pas lisible par les visiteurs.

## 3 — Brancher la page sur Supabase

Dans `docs/javascripts/amma.js`, remplacer :

```js
const SUPABASE_URL = "https://VOTRE-PROJET.supabase.co";
const SUPABASE_ANON_KEY = "VOTRE_CLE_ANON";
```

par l'URL du projet et la clé **anon** / **publishable** fournie par Supabase.

Ne jamais utiliser de clé `service_role` dans le navigateur.

Dès que ces deux valeurs sont renseignées, le mode démonstration s'arrête
automatiquement et la page utilise la vraie base de données.

## 4 — Activer l'e-mail de confirmation Gmail

La fonction Edge est dans :

`supabase/functions/send-email/index.ts`

Elle envoie l'e-mail après réservation en utilisant les secrets SMTP stockés
côté Supabase. Ne jamais mettre le mot de passe d'application Gmail dans
`docs/javascripts/amma.js`.

Installer la CLI Supabase si besoin, puis depuis la racine du dépôt :

```bash
supabase login
supabase link --project-ref muzyvmdswsccrvntgann
```

Ajouter les secrets. Remplacer l'adresse et le mot de passe par tes vraies
valeurs :

```bash
supabase secrets set SMTP_HOST=smtp.gmail.com
supabase secrets set SMTP_PORT=587
supabase secrets set SMTP_SECURE=false
supabase secrets set SMTP_USER=ton.email@gmail.com
supabase secrets set SMTP_PASS=ton_mot_de_passe_application_google
supabase secrets set SMTP_FROM=ton.email@gmail.com
supabase secrets set SMTP_SENDER_NAME="AMMA Inria Grenoble"
supabase secrets set SMTP_BCC=adresse.copie.cachee@example.com
```

`SMTP_BCC` est optionnel. Il permet d'envoyer automatiquement chaque
confirmation en copie cachée à une adresse interne.

Déployer la fonction :

```bash
supabase functions deploy send-email --no-verify-jwt
```

Si le script SQL a déjà été exécuté avant l'ajout des e-mails, relancer
`supabase/amma.sql` dans le SQL Editor. Il ajoutera notamment la colonne
`confirmation_email_sent_at` sans supprimer les réservations existantes.

## 5 — Tester avant diffusion

À vérifier :

1. Deux navigateurs affichent le même créneau comme Libre.
2. Le premier réserve.
3. Le second tente de réserver le même créneau : sa réservation est refusée.
4. Le créneau apparaît désormais Réservé.
5. Le lien d'annulation libère le créneau.
6. Un e-mail de confirmation arrive sur l'adresse utilisée.
7. Aucun nom ni e-mail n'est visible dans les outils réseau lors du chargement
   de la liste des créneaux.

## Point RGPD

La V1 collecte uniquement prénom, nom, e-mail Inria et créneau.

Il restera à décider d'une durée de conservation et, idéalement, à ajouter une
suppression automatique des anciennes réservations. Le prototype ne fait
volontairement pas cette hypothèse à ta place.

## Pour une V2

Les améliorations naturelles seraient :

- page d'administration
- export CSV
- e-mail automatique de confirmation
- création de nouvelles journées depuis l'interface
- verrouillage à une réservation par adresse e-mail et par journée
- purge automatique des données après chaque session
