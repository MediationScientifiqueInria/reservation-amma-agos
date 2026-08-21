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

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const cancellationToken = String(body.cancellationToken || "").trim();
    const cancelUrl = String(body.cancelUrl || "").trim();

    if (!isUuid(cancellationToken)) {
      return json({ error: "invalid_cancellation_token" }, 400);
    }

    if (!isHttpUrl(cancelUrl)) {
      return json({ error: "invalid_cancel_url" }, 400);
    }

    const supabaseUrl = requireEnv("SUPABASE_URL");
    const supabaseKey = getSupabaseSecretKey();
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });

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

    const transporter = nodemailer.createTransport({
      host: requireEnv("SMTP_HOST"),
      port: Number(requireEnv("SMTP_PORT")),
      secure: Deno.env.get("SMTP_SECURE") === "true",
      requireTLS: Deno.env.get("SMTP_PORT") === "587",
      auth: {
        user: requireEnv("SMTP_USER"),
        pass: requireEnv("SMTP_PASS"),
      },
    });

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
  } catch (error) {
    console.error(error);
    return json({ error: "email_send_failed" }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return Response.json(payload, {
    status,
    headers: corsHeaders,
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
