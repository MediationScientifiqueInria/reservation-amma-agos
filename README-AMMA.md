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
- `amma_admins` : e-mails autorisés à consulter l'administration
- `create_amma_booking_request(...)` : création d'un lien de confirmation
- `confirm_amma_booking_request(...)` : réservation atomique au clic
- `cancel_amma_booking(...)` : annulation sécurisée par token
- `admin_list_amma_reservations(...)` : lecture admin des créneaux et réservations
- `book_amma_slot(...)` : ancienne réservation directe, conservée mais non
  exposée aux visiteurs

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

Elle envoie le lien de confirmation, puis l'e-mail final après réservation, en
utilisant les secrets SMTP stockés côté Supabase. Ne jamais mettre le mot de
passe d'application Gmail dans
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

La modification des créneaux n'est pas encore disponible dans l'interface.

## 6 — Tester avant diffusion

À vérifier :

1. Deux navigateurs affichent le même créneau comme Libre.
2. Le premier demande le créneau et reçoit un lien de confirmation.
3. Le créneau reste Libre tant que le lien n'a pas été cliqué.
4. Le premier clique le lien : le créneau devient Réservé.
5. Le second tente de confirmer le même créneau : sa réservation est refusée.
6. Le lien d'annulation libère le créneau.
7. Un e-mail de confirmation arrive sur l'adresse utilisée.
8. Aucun nom ni e-mail n'est visible dans les outils réseau lors du chargement
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
- transformer `supabase/amma.sql` en migrations Supabase dans
  `supabase/migrations/`
- ajouter un flow d'invitation admin depuis `/admin/` avec validation explicite
  par un admin existant
