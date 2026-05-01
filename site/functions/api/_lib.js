/**
 * Shared helpers for TAB landing-page Cloudflare Pages Functions.
 *
 * Email is sent through Resend. Configure via env vars in the CF Pages
 * dashboard:
 *
 *   RESEND_API_KEY     — required, Resend API key (re_...)
 *   FROM_EMAIL         — optional, defaults to "TAB Agents <agents@growwithtab.com>"
 *   NOTIFY_EMAIL       — optional, defaults to "wes@championdigitalmedia.com"
 *   SITE_URL           — optional, defaults to "https://growwithtab.com"
 *   LEAD_WEBHOOK_URL   — optional pass-through (Zapier/Make/HubSpot/etc.)
 */

export const DEFAULTS = {
  FROM_EMAIL: "TAB Agents <agents@growwithtab.com>",
  NOTIFY_EMAIL: "wes@championdigitalmedia.com",
  SITE_URL: "https://growwithtab.com",
};

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function fmtUsd(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export async function sendEmail(env, { to, subject, html, replyTo }) {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("RESEND_API_KEY not set; skipping email send");
    return { ok: false, reason: "no_api_key" };
  }

  const from = env.FROM_EMAIL || DEFAULTS.FROM_EMAIL;
  const payload = {
    from,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  };
  if (replyTo) payload.reply_to = replyTo;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("Resend send failed", res.status, text);
      return { ok: false, status: res.status, body: text };
    }
    return { ok: true };
  } catch (err) {
    console.error("Resend fetch error", err);
    return { ok: false, error: String(err) };
  }
}

export async function forwardWebhook(env, body) {
  const url = env.LEAD_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error("webhook forward failed", err);
  }
}
