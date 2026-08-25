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
- Envoi d'un lien de confirmation avant réservation
- Blocage atomique d'un créneau côté PostgreSQL au clic sur le lien
- Aucun nom d'autre participant affiché
- Un lien d'annulation individuel
- Un e-mail automatique de confirmation via Supabase Edge Function + SMTP
- Un e-mail automatique d'annulation, avec l'admin en copie
- Une page d'administration `/admin/` pour consulter les créneaux et
  réservations
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
- `amma_booking_requests` : demandes en attente de confirmation par e-mail
- `amma_bookings` : prénom, nom, e-mail et token d'annulation
- `amma_cancellations` : trace technique permettant l'e-mail d'annulation
- `amma_admins` : e-mails autorisés à consulter l'administration
- `create_amma_booking_request(...)` : création d'un lien de confirmation
- `confirm_amma_booking_request(...)` : réservation atomique au clic
- `cancel_amma_booking(...)` : annulation sécurisée par token
- `admin_list_amma_reservations(...)` : lecture admin des créneaux et réservations
- `admin_list_amma_sessions(...)` : lecture admin des sessions
- `admin_create_amma_session(...)` : création admin d'une session complète
- `admin_update_amma_session(...)` : modification admin d'une date de session
  complète et de sa visibilité
- `admin_delete_amma_session(...)` : suppression admin d'une session complète
- `book_amma_slot(...)` : ancienne réservation directe, conservée mais non
  exposée aux visiteurs

La table contenant les noms et e-mails n'est pas lisible par les visiteurs. Les
admins ne reçoivent pas non plus d'accès direct `UPDATE` aux tables : les
modifications passent par des fonctions RPC sécurisées.

Les sessions masquées restent visibles dans l'administration, mais leurs
créneaux ne sont pas affichés sur la page publique et ne peuvent pas être
réservés.

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

Elle envoie le lien de confirmation, l'e-mail final après réservation, puis
l'e-mail d'annulation si une personne libère son créneau, en utilisant les
secrets SMTP stockés côté Supabase. Ne jamais mettre le mot de passe
d'application Gmail dans
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

`SMTP_BCC` est optionnel. Il permet d'envoyer automatiquement les e-mails en
copie cachée à une adresse interne, y compris pour les annulations.

Déployer la fonction :

```bash
supabase functions deploy send-email --no-verify-jwt
```

Si le script SQL a déjà été exécuté avant l'ajout des e-mails, relancer
`supabase/amma.sql` dans le SQL Editor. Il ajoutera notamment la table
`amma_booking_requests` et les fonctions de confirmation sans supprimer les
réservations existantes.

## 5 — Activer l'administration

La page admin est disponible dans :

`docs/admin/index.md`

Elle est servie à l'adresse `/admin/`, mais les données nominatives ne sont
renvoyées que pour les utilisateurs connectés et autorisés.

Créer d'abord un utilisateur dans Supabase :

`Authentication > Users > Add user`

Puis autoriser son adresse e-mail dans le SQL Editor :

```sql
insert into public.amma_admins (email)
values (lower('prenom.nom@inria.fr'))
on conflict (email) do nothing;
```

La page admin affiche les créneaux, les réservations confirmées et le nombre de
demandes en attente par créneau.

Pour ajouter d'autres admins, répéter les deux étapes : créer/inviter le compte
dans Supabase Auth, puis insérer son e-mail dans `amma_admins`.

Le dashboard `/admin/` sert au suivi des rendez-vous. La gestion des créneaux
est disponible sur `/admin/slots/`, accessible depuis le bouton `Gérer les
créneaux`. Cette page permet de créer, modifier, masquer et supprimer les
sessions. Une suppression ou un changement de date est refusé si la session
contient déjà des réservations ou des demandes de confirmation actives.
