---
title: Accueil
description: Réservez votre créneau de massage AMMA à Inria Grenoble
hide:
  - navigation
  - toc
---

# Massages AMMA Inria Grenoble — 2026

<div class="amma-intro">
  <p>
    Ces massages ont lieu au centre Inria de Grenoble, à Montbonnot-Saint-Martin. <br>
    
    Choisissez un créneau marqué <strong>Libre</strong>. <br>
    
    Un lien de confirmation vous sera envoyé par e-mail. <br>
    
    Le créneau sera réservé après clic sur ce lien.
  </p>
  <p class="amma-note">
    Les noms des personnes inscrites ne sont jamais affichés.
  </p>
</div>

<div id="amma-app">
  <p class="amma-loading">Chargement des créneaux…</p>
</div>

<dialog id="amma-booking-dialog" class="amma-dialog">
  <form id="amma-booking-form" method="dialog">
    <button type="button" class="amma-dialog-close" aria-label="Fermer">×</button>

    <h2>Réserver ce créneau</h2>
    <p id="amma-selected-slot" class="amma-selected-slot"></p>

    <label for="amma-firstname">Prénom</label>
    <input id="amma-firstname" name="firstname" autocomplete="given-name" required>

    <label for="amma-lastname">Nom</label>
    <input id="amma-lastname" name="lastname" autocomplete="family-name" required>

    <label for="amma-email">Adresse e-mail Inria</label>
    <input
      id="amma-email"
      name="email"
      type="email"
      autocomplete="email"
      placeholder="prenom.nom@inria.fr"
      required
    >

    <p class="amma-privacy">
      Ces informations sont utilisées uniquement pour gérer vos rendez-vous AMMA.
    </p>

    <div class="amma-dialog-actions">
      <button type="button" class="amma-secondary" id="amma-cancel-booking">Annuler</button>
      <button type="submit" class="amma-primary" id="amma-confirm-booking">Recevoir le lien</button>
    </div>

    <p id="amma-form-message" class="amma-form-message" aria-live="polite"></p>
  </form>
</dialog>

<div id="amma-confirmation" class="amma-confirmation" hidden>
  <h2>Suivi de réservation</h2>
  <p id="amma-confirmation-text"></p>
  <p id="amma-cancel-note" hidden>
    <strong>Important :</strong> Conservez le lien d’annulation affiché ci-dessous si vous souhaitez libérer votre créneau.
  </p>
  <p id="amma-email-status" class="amma-email-status" aria-live="polite"></p>
  <p>
    <a id="amma-cancel-link" href="#"></a>
  </p>
</div>
