/*
 * Administration AMMA — front statique + Supabase Auth
 *
 * La page /admin/ ne donne accès aux données nominatives qu'aux utilisateurs
 * authentifiés dont l'e-mail est présent dans public.amma_admins.
 */

const AMMA_ADMIN_SUPABASE_URL = "https://muzyvmdswsccrvntgann.supabase.co";
const AMMA_ADMIN_SUPABASE_ANON_KEY = "sb_publishable_ZqKhjZqSUBDygROcyc0EHw_ZRDDQIRQ";

const adminApp = document.getElementById("amma-admin-app");

let adminSupabaseClient = null;

if (adminApp) {
  initAmmaAdmin();
}

async function initAmmaAdmin() {
  await loadAdminSupabaseLibrary();
  adminSupabaseClient = window.supabase.createClient(
    AMMA_ADMIN_SUPABASE_URL,
    AMMA_ADMIN_SUPABASE_ANON_KEY
  );

  bindAdminEvents();

  const { data } = await adminSupabaseClient.auth.getSession();
  if (data.session) {
    try {
      await showAuthenticatedAdminView(data.session.user.email);
    } catch (error) {
      console.error(error);
      await adminSupabaseClient.auth.signOut();
      showLogin("Connexion impossible ou accès admin non autorisé.");
    }
  } else {
    showLogin();
  }
}

function bindAdminEvents() {
  document
    .getElementById("amma-admin-login-form")
    ?.addEventListener("submit", handleAdminLogin);
  document
    .getElementById("amma-admin-create-session-form")
    ?.addEventListener("submit", handleCreateSession);
  document
    .getElementById("amma-admin-sessions-table")
    ?.addEventListener("click", handleSessionAction);
}

function loadAdminSupabaseLibrary() {
  if (window.loadAmmaSupabaseLibrary) {
    return window.loadAmmaSupabaseLibrary();
  }

  return new Promise((resolve, reject) => {
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
}

async function handleAdminLogin(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const message = document.getElementById("amma-admin-login-message");
  const button = form.querySelector("button[type='submit']");

  message.textContent = "Connexion…";
  button.disabled = true;

  try {
    const { data, error } = await adminSupabaseClient.auth.signInWithPassword({
      email: form.email.value.trim().toLowerCase(),
      password: form.password.value,
    });

    if (error) throw error;
    await showAuthenticatedAdminView(data.user.email);
    window.refreshAmmaHeaderActions?.();
    form.reset();
  } catch (error) {
    console.error(error);
    message.textContent = "Connexion impossible ou accès admin non autorisé.";
  } finally {
    button.disabled = false;
  }
}

async function showAuthenticatedAdminView(email) {
  await ensureAdminAccess();

  const page = getAdminPage();

  hideAdminViews();
  const view = document.querySelector(`[data-admin-view='${page}']`);
  if (view) view.hidden = false;

  const user = document.getElementById("amma-admin-user");
  if (user) user.textContent = email || "";

  if (page === "dashboard") {
    await loadDashboardData();
  }

  if (page === "slots") {
    await loadSlotsAdminData();
  }
}

async function ensureAdminAccess() {
  const { data, error } = await adminSupabaseClient.rpc("is_amma_admin");
  if (error) throw error;
  if (!data) throw new Error("admin_access_required");
}

function showLogin(message = "") {
  hideAdminViews();
  document.querySelector("[data-admin-view='login']").hidden = false;
  setAdminText("amma-admin-login-message", message);
  setAdminText("amma-admin-user", "");
  setAdminHtml("amma-admin-summary", "");
  setAdminHtml("amma-admin-sessions-table", "");
  setAdminText("amma-admin-session-message", "");
  setAdminHtml("amma-admin-table", "");
  setAdminText("amma-admin-message", "");
}

function hideAdminViews() {
  document.querySelectorAll("[data-admin-view]").forEach((view) => {
    view.hidden = true;
  });
}

function setAdminText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function setAdminHtml(id, value) {
  const element = document.getElementById(id);
  if (element) element.innerHTML = value;
}

function getAdminPage() {
  return adminApp.dataset.adminPage || "dashboard";
}

async function refreshAdminCurrentPage() {
  if (getAdminPage() === "slots") {
    await loadSlotsAdminData();
    return;
  }

  await loadDashboardData();
}

async function loadDashboardData() {
  const reservationMessage = document.getElementById("amma-admin-message");

  setAdminText("amma-admin-message", "Chargement des rendez-vous…");

  try {
    const [sessions, reservations] = await Promise.all([
      loadAdminSessions(),
      loadAdminReservations(),
    ]);

    renderAdminSummary(sessions, reservations);
    renderAdminTable(reservations);
    if (reservationMessage) reservationMessage.textContent = "";
  } catch (error) {
    console.error(error);
    setAdminText("amma-admin-message", getAdminErrorMessage(error));
  }
}

async function loadSlotsAdminData() {
  const message = document.getElementById("amma-admin-session-message");

  setAdminText("amma-admin-session-message", "Chargement des créneaux…");

  try {
    const sessions = await loadAdminSessions();
    renderSessionTable(sessions);
    if (message) message.textContent = "";
  } catch (error) {
    console.error(error);
    setAdminText("amma-admin-session-message", getAdminErrorMessage(error));
  }
}

async function loadAdminSessions() {
  const { data, error } = await adminSupabaseClient.rpc("admin_list_amma_sessions");
  if (error) throw error;
  return data || [];
}

async function loadAdminReservations() {
  const { data, error } = await adminSupabaseClient.rpc("admin_list_amma_reservations");
  if (error) throw error;
  return data || [];
}

async function handleCreateSession(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const message = document.getElementById("amma-admin-session-message");
  const button = form.querySelector("button[type='submit']");

  message.textContent = "Création de la session…";
  button.disabled = true;

  try {
    const { error } = await adminSupabaseClient.rpc("admin_create_amma_session", {
      p_session_date: form.session_date.value,
      p_visible: form.visible.checked,
    });

    if (error) throw error;

    form.reset();
    message.textContent = "Session créée.";
    await refreshAdminCurrentPage();
  } catch (error) {
    console.error(error);
    message.textContent = getAdminErrorMessage(error);
  } finally {
    button.disabled = false;
  }
}

async function handleSessionAction(event) {
  const button = event.target.closest("[data-session-action]");
  if (!button) return;

  const row = button.closest("[data-session-date]");
  if (!row) return;

  const currentDate = row.dataset.sessionDate;
  const newDate = row.querySelector("[data-session-date-input]").value;
  const visible = row.querySelector("[data-session-visible]").checked;
  const action = button.dataset.sessionAction;

  if (action === "update") {
    await updateSession(button, currentDate, newDate, visible);
  }

  if (action === "delete") {
    await deleteSession(button, currentDate);
  }
}

async function updateSession(button, currentDate, newDate, visible) {
  const message = document.getElementById("amma-admin-session-message");

  message.textContent = "Mise à jour de la session…";
  button.disabled = true;

  try {
    const { error } = await adminSupabaseClient.rpc("admin_update_amma_session", {
      p_current_session_date: currentDate,
      p_new_session_date: newDate,
      p_visible: visible,
    });

    if (error) throw error;

    message.textContent = "Session mise à jour.";
    await refreshAdminCurrentPage();
  } catch (error) {
    console.error(error);
    message.textContent = getAdminErrorMessage(error);
  } finally {
    button.disabled = false;
  }
}

async function deleteSession(button, sessionDate) {
  const message = document.getElementById("amma-admin-session-message");
  const confirmed = window.confirm(
    "Supprimer cette session ? Cette action supprimera ses créneaux si aucune réservation n'existe."
  );

  if (!confirmed) return;

  message.textContent = "Suppression de la session…";
  button.disabled = true;

  try {
    const { error } = await adminSupabaseClient.rpc("admin_delete_amma_session", {
      p_session_date: sessionDate,
    });

    if (error) throw error;

    message.textContent = "Session supprimée.";
    await refreshAdminCurrentPage();
  } catch (error) {
    console.error(error);
    message.textContent = getAdminErrorMessage(error);
  } finally {
    button.disabled = false;
  }
}

function renderAdminSummary(sessions, reservations) {
  const visibleSessions = sessions.filter((session) => session.visible).length;
  const booked = reservations.filter((row) => row.booked).length;
  const pending = sessions.reduce((sum, session) => sum + Number(session.pending_requests || 0), 0);

  document.getElementById("amma-admin-summary").innerHTML = `
    <div class="amma-admin-stat">
      <span>${sessions.length}</span>
      <strong>Sessions</strong>
    </div>
    <div class="amma-admin-stat">
      <span>${visibleSessions}</span>
      <strong>Visibles</strong>
    </div>
    <div class="amma-admin-stat">
      <span>${booked}</span>
      <strong>Réservés</strong>
    </div>
    <div class="amma-admin-stat">
      <span>${pending}</span>
      <strong>Demandes en attente</strong>
    </div>
  `;
}

function renderSessionTable(sessions) {
  const table = document.getElementById("amma-admin-sessions-table");

  if (!sessions.length) {
    table.innerHTML = '<p class="amma-admin-empty">Aucune session trouvée.</p>';
    return;
  }

  table.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Visible</th>
          <th>Créneaux</th>
          <th>Réservés</th>
          <th>Demandes</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${sessions.map(renderSessionRow).join("")}
      </tbody>
    </table>
  `;
}

function renderSessionRow(session) {
  return `
    <tr data-session-date="${escapeAdminHtml(session.session_date)}">
      <td>
        <input
          class="amma-admin-date-input"
          data-session-date-input
          type="date"
          value="${escapeAdminHtml(session.session_date)}"
        >
      </td>
      <td>
        <label class="amma-admin-checkbox">
          <input data-session-visible type="checkbox" ${session.visible ? "checked" : ""}>
          <span>${session.visible ? "Oui" : "Non"}</span>
        </label>
      </td>
      <td>${escapeAdminHtml(String(session.slots_count || 0))}</td>
      <td>${escapeAdminHtml(String(session.booked_count || 0))}</td>
      <td>${escapeAdminHtml(String(session.pending_requests || 0))}</td>
      <td>
        <div class="amma-admin-row-actions">
          <button type="button" class="amma-secondary" data-session-action="update">Enregistrer</button>
          <button type="button" class="amma-secondary" data-session-action="delete">Supprimer</button>
        </div>
      </td>
    </tr>
  `;
}

function renderAdminTable(rows) {
  const table = document.getElementById("amma-admin-table");

  if (!rows.length) {
    table.innerHTML = '<p class="amma-admin-empty">Aucun créneau trouvé.</p>';
    return;
  }

  table.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Horaire</th>
          <th>Visibilité</th>
          <th>Statut</th>
          <th>Participant</th>
          <th>E-mail</th>
          <th>Réservé le</th>
          <th>Demandes</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(renderAdminRow).join("")}
      </tbody>
    </table>
  `;
}

function renderAdminRow(row) {
  const participant = [row.firstname, row.lastname].filter(Boolean).join(" ");

  return `
    <tr>
      <td>${escapeAdminHtml(formatAdminDate(row.session_date))}</td>
      <td>${escapeAdminHtml(shortAdminTime(row.start_time))} - ${escapeAdminHtml(shortAdminTime(row.end_time))}</td>
      <td>
        <span class="amma-admin-status ${row.visible ? "is-free" : "is-hidden"}">
          ${row.visible ? "Visible" : "Masquée"}
        </span>
      </td>
      <td>
        <span class="amma-admin-status ${row.booked ? "is-booked" : "is-free"}">
          ${row.booked ? "Réservé" : "Libre"}
        </span>
      </td>
      <td>${escapeAdminHtml(participant || "-")}</td>
      <td>${escapeAdminHtml(row.email || "-")}</td>
      <td>${escapeAdminHtml(formatAdminDateTime(row.booked_at))}</td>
      <td>${escapeAdminHtml(String(row.pending_requests || 0))}</td>
    </tr>
  `;
}

function getAdminErrorMessage(error) {
  const message = `${error?.message || ""} ${error?.details || ""}`;

  if (message.includes("admin_access_required")) {
    return "Accès admin non autorisé.";
  }

  if (message.includes("session_already_exists")) {
    return "Une session existe déjà à cette date.";
  }

  if (message.includes("target_session_already_exists")) {
    return "Impossible de déplacer la session : une session existe déjà à la nouvelle date.";
  }

  if (message.includes("session_not_found")) {
    return "Session introuvable.";
  }

  if (message.includes("session_has_bookings")) {
    return "Impossible de modifier ou supprimer cette date : elle contient déjà des réservations.";
  }

  if (message.includes("session_has_pending_requests")) {
    return "Impossible de modifier ou supprimer cette date : des demandes de confirmation sont encore actives.";
  }

  if (message.includes("missing_session_date")) {
    return "Merci de choisir une date.";
  }

  return "Action impossible pour le moment.";
}

function formatAdminDate(isoDate) {
  if (!isoDate) return "-";

  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${isoDate}T12:00:00`));
}

function formatAdminDateTime(value) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function shortAdminTime(time) {
  if (!time) return "-";
  return time.slice(0, 5).replace(":", "h");
}

function escapeAdminHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
