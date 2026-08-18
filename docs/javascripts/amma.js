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
let slots = [];
let selectedSlot = null;

const app = document.getElementById("amma-app");

if (app) {
  initAmma();
}

async function initAmma() {
  if (AMMA_DEMO_MODE) {
    slots = structuredClone(AMMA_DEMO_SLOTS);
    renderSlots();
    return;
  }

  await loadSupabaseLibrary();
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  await refreshSlots();
}

function loadSupabaseLibrary() {
  return new Promise((resolve, reject) => {
    if (window.supabase) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
    script.onload = resolve;
    script.onerror = () => reject(new Error("Impossible de charger Supabase."));
    document.head.appendChild(script);
  });
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
  message.textContent = "Réservation en cours…";

  try {
    let cancellationToken;

    if (AMMA_DEMO_MODE) {
      const localSlot = slots.find((s) => s.id === selectedSlot.id);
      if (localSlot.booked) throw new Error("slot_taken");
      localSlot.booked = true;
      cancellationToken = "demo";
    } else {
      const { data, error } = await supabaseClient.rpc("book_amma_slot", {
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

      cancellationToken = data;
    }

    const bookedSlot = { ...selectedSlot };
    closeBooking();

    if (!AMMA_DEMO_MODE) {
      await refreshSlots();
    } else {
      renderSlots();
    }

    showConfirmation(bookedSlot, cancellationToken);
  } catch (error) {
    console.error(error);

    if (error.message === "slot_taken") {
      message.textContent =
        "Désolée, ce créneau vient d’être réservé par quelqu’un d’autre. " +
        "Choisis-en un autre.";
      if (!AMMA_DEMO_MODE) await refreshSlots();
    } else {
      message.textContent =
        "La réservation n’a pas pu être enregistrée. Merci de réessayer.";
    }
  } finally {
    confirmButton.disabled = false;
  }
});

function showConfirmation(slot, token) {
  const box = document.getElementById("amma-confirmation");
  const text = document.getElementById("amma-confirmation-text");
  const link = document.getElementById("amma-cancel-link");

  text.textContent =
    `Ton rendez-vous est réservé le ${formatDate(slot.session_date)} ` +
    `de ${shortTime(slot.start_time)} à ${shortTime(slot.end_time)}.`;

  if (AMMA_DEMO_MODE) {
    link.textContent = "Lien d’annulation disponible une fois Supabase configuré.";
    link.removeAttribute("href");
  } else {
    const url = new URL(window.location.href);
    url.searchParams.set("cancel", token);
    link.href = url.toString();
    link.textContent = url.toString();
  }

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
      "Veux-tu vraiment annuler ta réservation AMMA et libérer ce créneau ?"
    );
    if (!confirmed) return;

    const { data, error } = await supabaseClient.rpc("cancel_amma_booking", {
      p_token: token,
    });

    if (error) throw error;

    const url = new URL(window.location.href);
    url.searchParams.delete("cancel");
    window.history.replaceState({}, "", url);

    alert(data ? "Ton créneau a bien été libéré." : "Cette réservation n’existe plus.");
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
