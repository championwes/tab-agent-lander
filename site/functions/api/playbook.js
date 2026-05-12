/**
 * POST /api/playbook
 *
 * Sends the Growth Playbook PDF link to the requester and notifies the
 * internal recipient. Optional webhook pass-through (LEAD_WEBHOOK_URL).
 */

import {
  DEFAULTS,
  escapeHtml,
  forwardWebhook,
  json,
  sendEmail,
} from "./_lib.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const name = (body.name || "").toString().trim();
  const email = (body.email || "").toString().trim();
  if (!name || !email) {
    return json({ error: "name and email required" }, 400);
  }

  const company = (body.company || "").toString().trim();
  const years = (body.years || "").toString().trim();

  const siteUrl = env.SITE_URL || new URL(request.url).origin || DEFAULTS.SITE_URL;
  const notifyTo = env.NOTIFY_EMAIL || DEFAULTS.NOTIFY_EMAIL;
  const fromEmail = env.FROM_EMAIL || DEFAULTS.FROM_EMAIL;
  const replyTo = extractAddress(fromEmail);
  const pdfUrl = `${siteUrl.replace(/\/$/, "")}/playbook.pdf`;

  body.tag = "playbook-download";
  await forwardWebhook(env, body);

  // 1. Email the playbook to the lead
  const leadEmail = sendEmail(env, {
    to: email,
    subject: "Your TAB Growth Playbook (PDF inside)",
    replyTo,
    html: leadHtml({ name, pdfUrl, siteUrl }),
  });

  // 2. Notify TAB internally
  const notifyEmail = sendEmail(env, {
    to: notifyTo,
    subject: `New playbook download — ${name}`,
    replyTo: email,
    html: notifyHtml({ name, email, company, years }),
  });

  await Promise.all([leadEmail, notifyEmail]);

  console.log("PLAYBOOK_LEAD", JSON.stringify({ name, email, company, years }));

  return json({ ok: true, downloadUrl: "/playbook.pdf" });
}

function extractAddress(from) {
  const m = from.match(/<([^>]+)>/);
  return m ? m[1] : from;
}

function leadHtml({ name, pdfUrl, siteUrl }) {
  const firstName = escapeHtml(name.split(/\s+/)[0] || name);
  return baseShell(`
    <p>Hi ${firstName},</p>
    <p>Thanks for grabbing the <strong>TAB Growth Playbook</strong>. It covers both halves of the move — the transition mechanics that protect your customer book on the way in, and the operational levers that let you scale past your solo ceiling once you're settled.</p>
    <p style="margin: 28px 0;">
      <a href="${escapeHtml(pdfUrl)}"
         style="display:inline-block;background:#0d3b66;color:#ffffff;font-weight:600;text-decoration:none;padding:14px 22px;border-radius:6px;">
        Download the playbook (PDF)
      </a>
    </p>
    <p>If you'd rather skip ahead, our leadership team (Mark, Brian, Chad) does discovery calls personally — no recruiter pitch. Reply to this email or grab a slot here:<br/>
      <a href="https://meetings-na2.hubspot.com/brian-aubuchon?uuid=6d1750eb-50ef-4dce-ad5d-9bf71dc2f1e6">Book a discovery call</a>
    </p>
    <p>Talk soon,<br/>The TAB team</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0;" />
    <p style="font-size:12px;color:#6b7280;">If the button above doesn't work, paste this into your browser:<br/>
      <span style="word-break:break-all;">${escapeHtml(pdfUrl)}</span>
    </p>
    <p style="font-size:12px;color:#6b7280;">TAB · <a href="${escapeHtml(siteUrl)}" style="color:#6b7280;">${escapeHtml(siteUrl.replace(/^https?:\/\//, ""))}</a></p>
  `);
}

function notifyHtml({ name, email, company, years }) {
  return baseShell(`
    <h2 style="margin:0 0 14px;color:#0d3b66;">Playbook download</h2>
    <table style="border-collapse:collapse;width:100%;font-size:14px;">
      <tbody>
        ${row("Name", name)}
        ${row("Email", `<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>`)}
        ${row("Company", company || "—")}
        ${row("Years as agent", years || "—")}
      </tbody>
    </table>
  `);
}

function row(label, value) {
  return `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;width:160px;">${escapeHtml(label)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#111827;">${value}</td>
    </tr>
  `;
}

function baseShell(inner) {
  return `<!doctype html>
<html><body style="margin:0;background:#f5f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;background:#ffffff;">
    ${inner}
  </div>
</body></html>`;
}
