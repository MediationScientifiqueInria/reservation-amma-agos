import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@^9";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type BookingRow = {
  id: number;
  firstname: string;
  lastname: string;
  email: string;
  confirmation_email_sent_at: string | null;
  amma_slots: {
    session_date: string;
    start_time: string;
    end_time: string;
  } | null;
};

type BookingRequestRow = {
  id: number;
  firstname: string;
  lastname: string;
  email: string;
  confirmation_email_sent_at: string | null;
  confirmed_at: string | null;
  expires_at: string;
  amma_slots: {
    session_date: string;
    start_time: string;
    end_time: string;
    booked: boolean;
  } | null;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const mode = String(body.mode || "booking");

    if (mode === "request") {
      return await sendRequestEmail(body);
    }

    if (mode === "booking") {
      return await sendBookingEmail(body);
    }

    return json({ error: "invalid_email_mode" }, 400);
  } catch (error) {
    console.error(error);
    return json({ error: "email_send_failed" }, 500);
  }
});

async function sendRequestEmail(body: Record<string, unknown>) {
  const requestToken = String(body.requestToken || "").trim();
  const confirmationUrl = String(body.confirmationUrl || "").trim();

  if (!isUuid(requestToken)) {
    return json({ error: "invalid_request_token" }, 400);
  }

  if (!isHttpUrl(confirmationUrl)) {
    return json({ error: "invalid_confirmation_url" }, 400);
  }

  const supabase = getSupabaseClient();

  const { data, error: requestError } = await supabase
    .from("amma_booking_requests")
    .select(
      `
        id,
        firstname,
        lastname,
        email,
        confirmation_email_sent_at,
        confirmed_at,
        expires_at,
        amma_slots (
          session_date,
          start_time,
          end_time,
          booked
        )
      `,
    )
    .eq("confirmation_token", requestToken)
    .maybeSingle();

  if (requestError) throw requestError;
  const bookingRequest = data as BookingRequestRow | null;

  if (!bookingRequest || !bookingRequest.amma_slots) {
    return json({ error: "request_not_found" }, 404);
  }

  if (bookingRequest.confirmed_at) {
    return json({ ok: true, alreadyConfirmed: true });
  }

  if (bookingRequest.confirmation_email_sent_at) {
    return json({ ok: true, alreadySent: true });
  }

  const transporter = createTransporter();

  await transporter.sendMail({
    from: formatFromAddress(),
    to: bookingRequest.email,
    bcc: getOptionalEnv("SMTP_BCC"),
    subject: "Confirmez votre rendez-vous AMMA",
    text: buildRequestTextEmail(bookingRequest, confirmationUrl),
    html: buildRequestHtmlEmail(bookingRequest, confirmationUrl),
  });

  const { error: updateError } = await supabase
    .from("amma_booking_requests")
    .update({ confirmation_email_sent_at: new Date().toISOString() })
    .eq("id", bookingRequest.id);

  if (updateError) throw updateError;

  return json({ ok: true });
}

async function sendBookingEmail(body: Record<string, unknown>) {
  const cancellationToken = String(body.cancellationToken || "").trim();
  const cancelUrl = String(body.cancelUrl || "").trim();

  if (!isUuid(cancellationToken)) {
    return json({ error: "invalid_cancellation_token" }, 400);
  }

  if (!isHttpUrl(cancelUrl)) {
    return json({ error: "invalid_cancel_url" }, 400);
  }

  const supabase = getSupabaseClient();

  const { data, error: bookingError } = await supabase
    .from("amma_bookings")
    .select(
      `
        id,
        firstname,
        lastname,
        email,
        confirmation_email_sent_at,
        amma_slots (
          session_date,
          start_time,
          end_time
        )
      `,
    )
    .eq("cancellation_token", cancellationToken)
    .maybeSingle();

  if (bookingError) throw bookingError;
  const booking = data as BookingRow | null;

  if (!booking || !booking.amma_slots) {
    return json({ error: "booking_not_found" }, 404);
  }

  if (booking.confirmation_email_sent_at) {
    return json({ ok: true, alreadySent: true });
  }

  const transporter = createTransporter();

  await transporter.sendMail({
    from: formatFromAddress(),
    to: booking.email,
    bcc: getOptionalEnv("SMTP_BCC"),
    subject: "Confirmation de votre rendez-vous AMMA",
    text: buildTextEmail(booking, cancelUrl),
    html: buildHtmlEmail(booking, cancelUrl),
  });

  const { error: updateError } = await supabase
    .from("amma_bookings")
    .update({ confirmation_email_sent_at: new Date().toISOString() })
    .eq("id", booking.id);

  if (updateError) throw updateError;

  return json({ ok: true });
}

function json(payload: unknown, status = 200) {
  return Response.json(payload, {
    status,
    headers: corsHeaders,
  });
}

function getSupabaseClient() {
  return createClient(requireEnv("SUPABASE_URL"), getSupabaseSecretKey(), {
    auth: { persistSession: false },
  });
}

function createTransporter() {
  return nodemailer.createTransport({
    host: requireEnv("SMTP_HOST"),
    port: Number(requireEnv("SMTP_PORT")),
    secure: Deno.env.get("SMTP_SECURE") === "true",
    requireTLS: Deno.env.get("SMTP_PORT") === "587",
    auth: {
      user: requireEnv("SMTP_USER"),
      pass: requireEnv("SMTP_PASS"),
    },
  });
}

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function getOptionalEnv(name: string) {
  return Deno.env.get(name)?.trim() || undefined;
}

function getSupabaseSecretKey() {
  const legacyKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacyKey) return legacyKey;

  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (secretKeys) {
    const parsed = JSON.parse(secretKeys) as Record<string, string>;
    const firstKey = Object.values(parsed).find(Boolean);
    if (firstKey) return firstKey;
  }

  throw new Error("Missing Supabase secret key");
}

function formatFromAddress() {
  const from = requireEnv("SMTP_FROM");
  const senderName = Deno.env.get("SMTP_SENDER_NAME") || "AMMA Inria Grenoble";
  return `${senderName} <${from}>`;
}

function buildTextEmail(booking: BookingRow, cancelUrl: string) {
  const slot = booking.amma_slots!;
  return [
    `Bonjour ${booking.firstname},`,
    "",
    "Votre rendez-vous AMMA est confirme.",
    "",
    `Date : ${formatDate(slot.session_date)}`,
    `Horaire : ${shortTime(slot.start_time)} - ${shortTime(slot.end_time)}`,
    "",
    "Pour annuler votre reservation, utilisez ce lien :",
    cancelUrl,
    "",
    "Merci.",
  ].join("\n");
}

function buildRequestTextEmail(bookingRequest: BookingRequestRow, confirmationUrl: string) {
  const slot = bookingRequest.amma_slots!;
  return [
    `Bonjour ${bookingRequest.firstname},`,
    "",
    "Pour confirmer votre rendez-vous AMMA, cliquez sur ce lien :",
    confirmationUrl,
    "",
    `Date demandee : ${formatDate(slot.session_date)}`,
    `Horaire demande : ${shortTime(slot.start_time)} - ${shortTime(slot.end_time)}`,
    "",
    "Le creneau sera reserve uniquement apres votre clic sur le lien.",
    "Si quelqu'un confirme le meme creneau avant vous, il ne sera plus disponible.",
    "",
    "Merci.",
  ].join("\n");
}

function buildHtmlEmail(booking: BookingRow, cancelUrl: string) {
  const slot = booking.amma_slots!;
  return `
    <p>Bonjour ${escapeHtml(booking.firstname)},</p>
    <p>Votre rendez-vous AMMA est confirmé.</p>
    <p>
      <strong>Date :</strong> ${escapeHtml(formatDate(slot.session_date))}<br>
      <strong>Horaire :</strong> ${escapeHtml(shortTime(slot.start_time))} - ${escapeHtml(shortTime(slot.end_time))}
    </p>
    <p>
      Pour annuler votre réservation, utilisez ce lien :<br>
      <a href="${escapeHtml(cancelUrl)}">${escapeHtml(cancelUrl)}</a>
    </p>
    <p>Merci.</p>
  `;
}

function buildRequestHtmlEmail(bookingRequest: BookingRequestRow, confirmationUrl: string) {
  const slot = bookingRequest.amma_slots!;
  return `
    <p>Bonjour ${escapeHtml(bookingRequest.firstname)},</p>
    <p>Pour confirmer votre rendez-vous AMMA, cliquez sur ce lien :</p>
    <p><a href="${escapeHtml(confirmationUrl)}">${escapeHtml(confirmationUrl)}</a></p>
    <p>
      <strong>Date demandée :</strong> ${escapeHtml(formatDate(slot.session_date))}<br>
      <strong>Horaire demandé :</strong> ${escapeHtml(shortTime(slot.start_time))} - ${escapeHtml(shortTime(slot.end_time))}
    </p>
    <p>
      Le créneau sera réservé uniquement après votre clic sur le lien.
      Si quelqu'un confirme le même créneau avant vous, il ne sera plus disponible.
    </p>
    <p>Merci.</p>
  `;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function formatDate(isoDate: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${isoDate}T12:00:00`));
}

function shortTime(time: string) {
  return time.slice(0, 5).replace(":", "h");
}

function escapeHtml(value: string) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
