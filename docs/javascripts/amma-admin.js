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
    await showDashboard(data.session.user.email);
  } else {
    showLogin();
  }
}

function bindAdminEvents() {
  document
    .getElementById("amma-admin-login-form")
    ?.addEventListener("submit", handleAdminLogin);
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
    await showDashboard(data.user.email);
    window.refreshAmmaHeaderActions?.();
    form.reset();
  } catch (error) {
    console.error(error);
    message.textContent = "Connexion impossible ou accès admin non autorisé.";
  } finally {
    button.disabled = false;
  }
}

async function showDashboard(email) {
  document.querySelector("[data-admin-view='login']").hidden = true;
  document.querySelector("[data-admin-view='dashboard']").hidden = false;
  document.getElementById("amma-admin-user").textContent = email || "";
  await loadAdminReservations();
}

function showLogin() {
  document.querySelector("[data-admin-view='dashboard']").hidden = true;
  document.querySelector("[data-admin-view='login']").hidden = false;
  document.getElementById("amma-admin-user").textContent = "";
  document.getElementById("amma-admin-summary").innerHTML = "";
  document.getElementById("amma-admin-table").innerHTML = "";
  document.getElementById("amma-admin-message").textContent = "";
}

async function loadAdminReservations() {
  const message = document.getElementById("amma-admin-message");
  const table = document.getElementById("amma-admin-table");

  message.textContent = "Chargement des rendez-vous…";
  table.innerHTML = "";

  try {
    const { data, error } = await adminSupabaseClient.rpc("admin_list_amma_reservations");

    if (error) throw error;

    renderAdminSummary(data || []);
    renderAdminTable(data || []);
    message.textContent = "";
  } catch (error) {
    console.error(error);
    message.textContent = "Impossible de charger l’administration AMMA.";
  }
}

function renderAdminSummary(rows) {
  const total = rows.length;
  const booked = rows.filter((row) => row.booked).length;
  const free = total - booked;
  const pending = rows.reduce((sum, row) => sum + Number(row.pending_requests || 0), 0);

  document.getElementById("amma-admin-summary").innerHTML = `
    <div class="amma-admin-stat">
      <span>${total}</span>
      <strong>Créneaux</strong>
    </div>
    <div class="amma-admin-stat">
      <span>${booked}</span>
      <strong>Réservés</strong>
    </div>
    <div class="amma-admin-stat">
      <span>${free}</span>
      <strong>Libres</strong>
    </div>
    <div class="amma-admin-stat">
      <span>${pending}</span>
      <strong>Demandes en attente</strong>
    </div>
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
