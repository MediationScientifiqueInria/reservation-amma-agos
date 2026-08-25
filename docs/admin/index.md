---
title: Administration
description: Administration des rendez-vous AMMA
hide:
  - toc
---

# Administration AMMA

<div id="amma-admin-app" class="amma-admin">
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

  <section class="amma-admin-dashboard" data-admin-view="dashboard" hidden>
    <div class="amma-admin-toolbar">
      <div>
        <p class="amma-admin-kicker">Connecté</p>
        <p id="amma-admin-user" class="amma-admin-user"></p>
      </div>
      <div class="amma-admin-actions">
        <button type="button" class="amma-secondary" id="amma-admin-refresh">Actualiser</button>
        <button type="button" class="amma-secondary" id="amma-admin-logout">Déconnexion</button>
      </div>
    </div>

    <div id="amma-admin-summary" class="amma-admin-summary"></div>

    <div id="amma-admin-message" class="amma-form-message" aria-live="polite"></div>
    <div id="amma-admin-table" class="amma-admin-table"></div>
  </section>
</div>
