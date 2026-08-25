/*
 * Réservations AMMA — front statique GitHub Pages + Supabase
 *
 * À configurer :
 *   1. Créer le projet Supabase.
 *   2. Exécuter supabase/amma.sql.
 *   3. Remplacer SUPABASE_URL et SUPABASE_ANON_KEY ci-dessous.
 *
 * IMPORTANT :
 * - La clé "anon" Supabase est faite pour être publique dans un front web.
 * - Ne jamais mettre ici une clé service_role.
 */

const SUPABASE_URL = "https://muzyvmdswsccrvntgann.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_ZqKhjZqSUBDygROcyc0EHw_ZRDDQIRQ";

const AMMA_DEMO_MODE =
  SUPABASE_URL.includes("VOTRE-PROJET") ||
  SUPABASE_ANON_KEY.includes("VOTRE_CLE_ANON");

const AMMA_DEMO_SLOTS = [
  ["2026-09-15", "11:30", "12:00"],
  ["2026-09-15", "12:00", "12:30"],
  ["2026-09-15", "12:30", "13:00"],
  ["2026-09-15", "13:10", "13:40"],
  ["2026-09-15", "13:40", "14:10"],

  ["2026-10-15", "11:30", "12:00"],
  ["2026-10-15", "12:00", "12:30"],
  ["2026-10-15", "12:30", "13:00"],
  ["2026-10-15", "13:10", "13:40"],
  ["2026-10-15", "13:40", "14:10"],

  ["2026-11-12", "11:30", "12:00"],
  ["2026-11-12", "12:00", "12:30"],
  ["2026-11-12", "12:30", "13:00"],
  ["2026-11-12", "13:10", "13:40"],
  ["2026-11-12", "13:40", "14:10"],

  ["2026-12-08", "11:30", "12:00"],
  ["2026-12-08", "12:00", "12:30"],
  ["2026-12-08", "12:30", "13:00"],
  ["2026-12-08", "13:10", "13:40"],
  ["2026-12-08", "13:40", "14:10"],
].map((slot, i) => ({
  id: `demo-${i + 1}`,
  session_date: slot[0],
  start_time: slot[1],
  end_time: slot[2],
  booked: false,
}));

let supabaseClient = null;
let supabaseLibraryPromise = null;
let slots = [];
let selectedSlot = null;

const app = document.getElementById("amma-app");

if (app) {
  initAmma();
}

initAmmaHeaderActions();
window.refreshAmmaHeaderActions = refreshAmmaHeaderActions;
window.loadAmmaSupabaseLibrary = loadSupabaseLibrary;

async function initAmma() {
  if (AMMA_DEMO_MODE) {
    slots = structuredClone(AMMA_DEMO_SLOTS);
    renderSlots();
    return;
  }

  await loadSupabaseLibrary();
  getSupabaseClient();
  await refreshSlots();
}

function loadSupabaseLibrary() {
  if (supabaseLibraryPromise) return supabaseLibraryPromise;

  supabaseLibraryPromise = new Promise((resolve, reject) => {
    if (window.supabase) {
      resolve();
      return;
    }

    const existingScript = document.querySelector("script[data-amma-supabase]");
    if (existingScript) {
      existingScript.addEventListener("load", resolve, { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Impossible de charger Supabase.")),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.dataset.ammaSupabase = "true";
    script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
    script.onload = resolve;
    script.onerror = () => reject(new Error("Impossible de charger Supabase."));
    document.head.appendChild(script);
  });

  return supabaseLibraryPromise;
}

function getSupabaseClient() {
  if (!supabaseClient) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  return supabaseClient;
}

async function initAmmaHeaderActions() {
  if (AMMA_DEMO_MODE) return;
  await refreshAmmaHeaderActions();
}

async function refreshAmmaHeaderActions() {
  if (AMMA_DEMO_MODE) return;

  const container = getAmmaHeaderActionsContainer();
  if (!container) return;

  try {
    await loadSupabaseLibrary();
    const client = getSupabaseClient();
    const { data } = await client.auth.getSession();
    const session = data?.session;

    if (!session) {
      container.remove();
      return;
    }

    const { data: isAdmin, error } = await client.rpc("is_amma_admin");
    if (error) throw error;

    if (!isAdmin) {
      container.remove();
      return;
    }

    renderAmmaHeaderActions(container);
  } catch (error) {
    console.error(error);
    container.remove();
  }
}

function getAmmaHeaderActionsContainer() {
  const headerInner = document.querySelector(".md-header__inner");
  if (!headerInner) return null;

  let container = document.getElementById("amma-header-actions");
  if (!container) {
    container = document.createElement("nav");
    container.id = "amma-header-actions";
    container.className = "amma-header-actions";
    container.setAttribute("aria-label", "Administration AMMA");
    headerInner.appendChild(container);
  }

  return container;
}

function renderAmmaHeaderActions(container) {
  container.innerHTML = `
    <a class="amma-header-link" href="${escapeHtml(getAmmaBaseUrl())}">Accueil</a>
    <a class="amma-header-link" href="${escapeHtml(getAmmaAdminUrl())}">Admin</a>
    <button class="amma-header-button" type="button">Déconnexion</button>
  `;

  container
    .querySelector(".amma-header-button")
    ?.addEventListener("click", handleAmmaHeaderLogout);
}

async function handleAmmaHeaderLogout() {
  await loadSupabaseLibrary();
  await getSupabaseClient().auth.signOut();

  if (window.location.pathname.includes("/admin/")) {
    window.location.href = getAmmaBaseUrl();
    return;
  }

  window.location.reload();
}

function getAmmaAdminUrl() {
  return `${getAmmaBaseUrl()}admin/`;
}

function getAmmaBaseUrl() {
  const script = Array.from(document.scripts).find((item) =>
    item.src.includes("javascripts/amma.js")
  );
  if (!script?.src) return new URL("./", window.location.href).toString();

  return script.src.replace(/javascripts\/amma\.js(?:\?.*)?$/, "");
}

async function refreshSlots() {
  setLoading();

  const { data, error } = await supabaseClient
    .from("amma_slots")
    .select("id, session_date, start_time, end_time, booked")
    .order("session_date")
    .order("start_time");

  if (error) {
    showFatalError("Impossible de charger les créneaux pour le moment.");
    console.error(error);
    return;
  }

  slots = data;
  renderSlots();
}

function setLoading() {
  app.innerHTML = '<p class="amma-loading">Chargement des créneaux…</p>';
}

function showFatalError(message) {
  app.innerHTML = `<p class="amma-error">${escapeHtml(message)}</p>`;
}

function renderSlots() {
  const byDate = groupBy(slots, "session_date");

  let html = "";

  if (AMMA_DEMO_MODE) {
    html += `
      <div class="amma-demo-banner">
        Mode démonstration — les réservations sont temporaires et disparaissent
        au rechargement de la page.
      </div>
    `;
  }

  html += '<div class="amma-days">';

  for (const [date, dateSlots] of Object.entries(byDate)) {
    html += `
      <section class="amma-day">
        <h2>${formatDate(date)}</h2>
        <div class="amma-slots">
    `;

    for (const slot of dateSlots) {
      html += `
        <button
          class="amma-slot ${slot.booked ? "is-booked" : "is-free"}"
          data-slot-id="${slot.id}"
          ${slot.booked ? "disabled" : ""}
        >
          <span class="amma-slot-time">
            ${shortTime(slot.start_time)} – ${shortTime(slot.end_time)}
          </span>
          <span class="amma-slot-status">
            ${slot.booked ? "Réservé" : "Libre"}
          </span>
        </button>
      `;
    }

    html += "</div></section>";
  }

  html += "</div>";
  app.innerHTML = html;

  document.querySelectorAll(".amma-slot.is-free").forEach((button) => {
    button.addEventListener("click", () => openBooking(button.dataset.slotId));
  });
}

function openBooking(slotId) {
  selectedSlot = slots.find((slot) => String(slot.id) === String(slotId));
  if (!selectedSlot || selectedSlot.booked) return;

  const dialog = document.getElementById("amma-booking-dialog");
  const selected = document.getElementById("amma-selected-slot");
  const message = document.getElementById("amma-form-message");

  selected.textContent =
    `${formatDate(selectedSlot.session_date)}, ` +
    `${shortTime(selectedSlot.start_time)} – ${shortTime(selectedSlot.end_time)}`;

  message.textContent = "";
  dialog.showModal();
}

function closeBooking() {
  document.getElementById("amma-booking-dialog").close();
  document.getElementById("amma-booking-form").reset();
  selectedSlot = null;
}

document.getElementById("amma-cancel-booking")?.addEventListener("click", closeBooking);
document.querySelector(".amma-dialog-close")?.addEventListener("click", closeBooking);

document.getElementById("amma-booking-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!selectedSlot) return;

  const form = event.currentTarget;
  const message = document.getElementById("amma-form-message");
  const confirmButton = document.getElementById("amma-confirm-booking");

  const firstname = form.firstname.value.trim();
  const lastname = form.lastname.value.trim();
  const email = form.email.value.trim().toLowerCase();

  if (!firstname || !lastname || !email) {
    message.textContent = "Merci de remplir tous les champs.";
    return;
  }

  if (!email.endsWith("@inria.fr")) {
    message.textContent = "Merci d’utiliser une adresse e-mail @inria.fr.";
    return;
  }

  confirmButton.disabled = true;
  message.textContent = "Envoi du lien de confirmation…";

  try {
    if (AMMA_DEMO_MODE) {
      closeBooking();
      showRequestConfirmation();
      return;
    }

    const { data, error } = await supabaseClient.rpc("create_amma_booking_request", {
      p_slot_id: selectedSlot.id,
      p_firstname: firstname,
      p_lastname: lastname,
      p_email: email,
    });

    if (error) {
      if (
        error.message?.includes("slot_already_booked") ||
        error.details?.includes("slot_already_booked")
      ) {
        throw new Error("slot_taken");
      }
      throw error;
    }

    await sendRequestEmail(data, buildBookingConfirmationUrl(data));
    closeBooking();
    showRequestConfirmation();
  } catch (error) {
    console.error(error);

    if (error.message === "slot_taken") {
      message.textContent =
        "Ce créneau vient d’être réservé par quelqu’un d’autre. " +
        "Choisissez-en un autre.";
      if (!AMMA_DEMO_MODE) await refreshSlots();
    } else {
      message.textContent =
        "Le lien de confirmation n’a pas pu être envoyé. Merci de réessayer.";
    }
  } finally {
    confirmButton.disabled = false;
  }
});

function showRequestConfirmation() {
  const box = document.getElementById("amma-confirmation");
  const text = document.getElementById("amma-confirmation-text");
  const cancelNote = document.getElementById("amma-cancel-note");
  const link = document.getElementById("amma-cancel-link");
  const emailStatus = document.getElementById("amma-email-status");

  text.textContent =
    "Un lien de confirmation vient d’être envoyé. Le créneau sera réservé uniquement après clic sur ce lien.";
  emailStatus.textContent = "Pensez à vérifier vos indésirables si l’e-mail n’arrive pas.";
  cancelNote.hidden = true;
  link.textContent = "";
  link.removeAttribute("href");

  box.hidden = false;
  box.scrollIntoView({ behavior: "smooth", block: "center" });
}

function showConfirmation(slot, token) {
  const box = document.getElementById("amma-confirmation");
  const text = document.getElementById("amma-confirmation-text");
  const cancelNote = document.getElementById("amma-cancel-note");
  const link = document.getElementById("amma-cancel-link");
  const emailStatus = document.getElementById("amma-email-status");

  text.textContent =
    `Votre rendez-vous est réservé le ${formatDate(slot.session_date)} ` +
    `de ${shortTime(slot.start_time)} à ${shortTime(slot.end_time)}.`;

  let cancelUrl = "";

  if (AMMA_DEMO_MODE) {
    cancelNote.hidden = true;
    link.textContent = "Lien d’annulation disponible une fois Supabase configuré.";
    link.removeAttribute("href");
    emailStatus.textContent = "";
  } else {
    cancelNote.hidden = false;
    cancelUrl = buildCancellationUrl(token);
    link.href = cancelUrl;
    link.textContent = cancelUrl;
    emailStatus.textContent = "Envoi de l’e-mail de confirmation…";
  }

  box.hidden = false;
  box.scrollIntoView({ behavior: "smooth", block: "center" });

  return cancelUrl;
}

async function sendBookingEmail(cancellationToken, cancelUrl) {
  const emailStatus = document.getElementById("amma-email-status");

  try {
    const { data, error } = await supabaseClient.functions.invoke("send-email", {
      body: {
        mode: "booking",
        cancellationToken,
        cancelUrl,
      },
    });

    if (error) throw error;

    emailStatus.textContent = data?.alreadySent
      ? "L’e-mail de confirmation a déjà été envoyé."
      : "Un e-mail de confirmation vient d’être envoyé.";
  } catch (error) {
    console.error(error);
    emailStatus.textContent =
      "Réservation enregistrée, mais l’e-mail de confirmation n’a pas pu être envoyé.";
  }
}

async function sendRequestEmail(requestToken, confirmationUrl) {
  const { error } = await supabaseClient.functions.invoke("send-email", {
    body: {
      mode: "request",
      requestToken,
      confirmationUrl,
    },
  });

  if (error) throw error;
}

function buildBookingConfirmationUrl(token) {
  const url = new URL(window.location.href);
  url.searchParams.delete("cancel");
  url.searchParams.set("confirm", token);
  return url.toString();
}

function buildCancellationUrl(token) {
  const url = new URL(window.location.href);
  url.searchParams.delete("confirm");
  url.searchParams.set("cancel", token);
  return url.toString();
}

// Confirmation par token présent dans l'URL.
(async function handleBookingConfirmationLink() {
  const token = new URLSearchParams(window.location.search).get("confirm");
  if (!token || AMMA_DEMO_MODE) return;

  try {
    await loadSupabaseLibrary();
    if (!supabaseClient) {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }

    setConfirmationStatus("Confirmation de votre rendez-vous…");

    const { data, error } = await supabaseClient.rpc("confirm_amma_booking_request", {
      p_token: token,
    });

    if (error) {
      if (
        error.message?.includes("slot_already_booked") ||
        error.details?.includes("slot_already_booked")
      ) {
        setConfirmationStatus(
          "Ce créneau vient d’être réservé par quelqu’un d’autre. Merci d’en choisir un autre."
        );
        await refreshSlots();
        return;
      }

      if (
        error.message?.includes("request_expired") ||
        error.details?.includes("request_expired")
      ) {
        setConfirmationStatus(
          "Ce lien de confirmation a expiré. Merci de refaire une demande de réservation."
        );
        await refreshSlots();
        return;
      }

      throw error;
    }

    const result = Array.isArray(data) ? data[0] : data;
    const slot = {
      session_date: result.session_date,
      start_time: result.start_time,
      end_time: result.end_time,
    };
    const cancellationToken = result.cancellation_token;
    const cancelUrl = buildCancellationUrl(cancellationToken);

    const url = new URL(window.location.href);
    url.searchParams.delete("confirm");
    window.history.replaceState({}, "", url);

    await refreshSlots();
    showConfirmation(slot, cancellationToken);
    sendBookingEmail(cancellationToken, cancelUrl);
  } catch (error) {
    console.error(error);
    setConfirmationStatus("Impossible de confirmer la réservation pour le moment.");
  }
})();

function setConfirmationStatus(message) {
  const box = document.getElementById("amma-confirmation");
  const text = document.getElementById("amma-confirmation-text");
  const cancelNote = document.getElementById("amma-cancel-note");
  const link = document.getElementById("amma-cancel-link");
  const emailStatus = document.getElementById("amma-email-status");

  text.textContent = message;
  emailStatus.textContent = "";
  cancelNote.hidden = true;
  link.textContent = "";
  link.removeAttribute("href");
  box.hidden = false;
  box.scrollIntoView({ behavior: "smooth", block: "center" });
}

// Annulation par token présent dans l'URL.
(async function handleCancellationLink() {
  const token = new URLSearchParams(window.location.search).get("cancel");
  if (!token || AMMA_DEMO_MODE) return;

  try {
    await loadSupabaseLibrary();
    if (!supabaseClient) {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }

    const confirmed = window.confirm(
      "Voulez-vous vraiment annuler votre réservation AMMA et libérer ce créneau ?"
    );
    if (!confirmed) return;

    const { data, error } = await supabaseClient.rpc("cancel_amma_booking", {
      p_token: token,
    });

    if (error) throw error;

    const url = new URL(window.location.href);
    url.searchParams.delete("cancel");
    window.history.replaceState({}, "", url);

    alert(data ? "Votre créneau a bien été libéré." : "Cette réservation n’existe plus.");
    await refreshSlots();
  } catch (error) {
    console.error(error);
    alert("Impossible d’annuler la réservation pour le moment.");
  }
})();

function groupBy(items, key) {
  return items.reduce((acc, item) => {
    (acc[item[key]] ||= []).push(item);
    return acc;
  }, {});
}

function formatDate(isoDate) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${isoDate}T12:00:00`));
}

function shortTime(time) {
  return time.slice(0, 5).replace(":", "h");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
