---
title: Gérer les sessions
description: Gestion des sessions AMMA
hide:
  - navigation
  - toc
---

# Gérer les sessions

<div id="amma-admin-app" class="amma-admin" data-admin-page="slots">
  <section class="amma-admin-login" data-admin-view="login">
    <form id="amma-admin-login-form">
      <h2>Connexion</h2>

      <label for="amma-admin-email">Adresse e-mail</label>
      <input id="amma-admin-email" name="email" type="email" autocomplete="email" required>

      <label for="amma-admin-password">Mot de passe</label>
      <input
        id="amma-admin-password"
        name="password"
        type="password"
        autocomplete="current-password"
        required
      >

      <button type="submit" class="amma-primary">Se connecter</button>
      <p id="amma-admin-login-message" class="amma-form-message" aria-live="polite"></p>
    </form>
  </section>

  <section class="amma-admin-slots" data-admin-view="slots" hidden>
    <div class="amma-admin-toolbar">
      <div>
        <p class="amma-admin-kicker">Connecté</p>
        <p id="amma-admin-user" class="amma-admin-user"></p>
      </div>
      <a class="amma-secondary amma-admin-back-link" href="../">Retour dashboard</a>
    </div>

    <section class="amma-admin-panel" aria-labelledby="amma-admin-create-session-title">
      <div class="amma-admin-section-header">
        <h2 id="amma-admin-create-session-title">Ajouter une session</h2>
      </div>

      <form id="amma-admin-create-session-form" class="amma-admin-session-form">
        <label for="amma-admin-new-session-date">Date de session</label>
        <input id="amma-admin-new-session-date" name="session_date" type="date" required>

        <label class="amma-admin-checkbox">
          <input name="visible" type="checkbox">
          <span>Visible</span>
        </label>

        <button type="submit" class="amma-primary">Créer</button>
      </form>
    </section>

    <section class="amma-admin-panel" aria-labelledby="amma-admin-sessions-title">
      <div class="amma-admin-section-header">
        <h2 id="amma-admin-sessions-title">Sessions existantes</h2>
      </div>

      <p id="amma-admin-session-message" class="amma-form-message" aria-live="polite"></p>
      <div id="amma-admin-sessions-table" class="amma-admin-table"></div>
    </section>
  </section>
</div>
