/**
 * POST /api/lead
 *
 * Calculator submissions. Sends the lead a recap of their projection and
 * notifies the internal recipient. Optional webhook pass-through
 * (LEAD_WEBHOOK_URL).
 */

import {
  DEFAULTS,
  escapeHtml,
  fmtUsd,
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

  const phone = (body.phone || "").toString().trim();
  const company = (body.company || "").toString().trim();
  const inputs = body.inputs || {};
  const results = body.results || {};

  const siteUrl = env.SITE_URL || new URL(request.url).origin || DEFAULTS.SITE_URL;
  const notifyTo = env.NOTIFY_EMAIL || DEFAULTS.NOTIFY_EMAIL;
  const fromEmail = env.FROM_EMAIL || DEFAULTS.FROM_EMAIL;
  const replyTo = extractAddress(fromEmail);

  await forwardWebhook(env, body);

  const leadEmail = sendEmail(env, {
    to: email,
    subject: "Your TAB earnings projection",
    replyTo,
    html: leadHtml({ name, inputs, results, siteUrl }),
  });

  const notifyEmail = sendEmail(env, {
    to: notifyTo,
    subject: `New calculator lead — ${name}${results.delta ? ` (+${fmtUsd(results.delta)} lift)` : ""}`,
    replyTo: email,
    html: notifyHtml({ name, email, phone, company, inputs, results }),
  });

  await Promise.all([leadEmail, notifyEmail]);

  console.log("LEAD", JSON.stringify({ name, email, phone, company, inputs, results }));

  return json({ ok: true });
}

function extractAddress(from) {
  const m = from.match(/<([^>]+)>/);
  return m ? m[1] : from;
}

function leadHtml({ name, inputs, results, siteUrl }) {
  const firstName = escapeHtml(name.split(/\s+/)[0] || name);
  const tabSplitPct = results.tabSplit ? `${Math.round(results.tabSplit * 100)}%` : "—";
  const lift = results.delta != null ? fmtUsd(results.delta) : "—";
  const liftPct =
    results.liftPct != null ? `${results.liftPct >= 0 ? "+" : ""}${results.liftPct.toFixed(0)}%` : "";
  const pdfUrl = `${siteUrl.replace(/\/$/, "")}/playbook.pdf`;

  return baseShell(`
    <p>Hi ${firstName},</p>
    <p>Here's the breakdown from the TAB earnings calculator — based on what you entered.</p>
    <table style="border-collapse:collapse;width:100%;font-size:14px;margin:18px 0;">
      <tbody>
        ${row("Annual customer revenue", fmtUsd(inputs.annualRevenue))}
        ${row("Region", escapeHtml((inputs.region || "domestic") === "international" ? "International" : "USA"))}
        ${row("Current split", `${escapeHtml(inputs.currentSplit ?? "—")}%`)}
        ${row("GP margin used", `${escapeHtml(inputs.gpMarginPct ?? 15)}%`)}
        ${row("Estimated gross profit", fmtUsd(results.grossProfit))}
        ${row("You today", fmtUsd(results.currentTake))}
        ${row("You at TAB", `<strong>${fmtUsd(results.tabTake)}</strong> (${tabSplitPct})`)}
        ${row("Annual lift", `<strong style="color:#0d3b66;">+${lift} ${liftPct}</strong>`)}
      </tbody>
    </table>
    <p style="font-size:13px;color:#6b7280;"><strong>For illustration only.</strong> Based on TAB's published commission tiers and a 15% historical industry margin — not a guaranteed offer.</p>

    <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0;" />
    <h3 style="margin:0 0 10px;color:#0d3b66;font-size:17px;">While you're here — grab the Growth Playbook</h3>
    <p>The companion PDF to your projection. How TAB agents protect their book on the way in and scale past their solo ceiling once they're settled.</p>
    <p style="margin:18px 0 28px;">
      <a href="${escapeHtml(pdfUrl)}"
         style="display:inline-block;background:#0d3b66;color:#ffffff;font-weight:600;text-decoration:none;padding:12px 20px;border-radius:6px;">
        Download the Growth Playbook (PDF)
      </a>
    </p>

    <p style="margin:22px 0;">Want to talk through your numbers? Mark, Brian, or Chad will follow up directly — or grab a slot:<br/>
      <a href="https://meetings-na2.hubspot.com/brian-aubuchon?uuid=6d1750eb-50ef-4dce-ad5d-9bf71dc2f1e6">Book a discovery call</a>
    </p>
    <p>Talk soon,<br/>The TAB team</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0;" />
    <p style="font-size:12px;color:#6b7280;">TAB · <a href="${escapeHtml(siteUrl)}" style="color:#6b7280;">${escapeHtml(siteUrl.replace(/^https?:\/\//, ""))}</a></p>
  `);
}

function notifyHtml({ name, email, phone, company, inputs, results }) {
  const tabSplitPct = results.tabSplit ? `${Math.round(results.tabSplit * 100)}%` : "—";
  const liftPct =
    results.liftPct != null ? `${results.liftPct >= 0 ? "+" : ""}${results.liftPct.toFixed(0)}%` : "";

  return baseShell(`
    <h2 style="margin:0 0 14px;color:#0d3b66;">New calculator lead</h2>
    <table style="border-collapse:collapse;width:100%;font-size:14px;">
      <tbody>
        ${row("Name", escapeHtml(name))}
        ${row("Email", `<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>`)}
        ${row("Phone", phone || "—")}
        ${row("Company", company || "—")}
      </tbody>
    </table>
    <h3 style="margin:24px 0 10px;color:#0d3b66;font-size:15px;">Their projection</h3>
    <table style="border-collapse:collapse;width:100%;font-size:14px;">
      <tbody>
        ${row("Annual revenue", fmtUsd(inputs.annualRevenue))}
        ${row("Region", escapeHtml((inputs.region || "domestic") === "international" ? "International" : "USA"))}
        ${row("Current split", `${escapeHtml(inputs.currentSplit ?? "—")}%`)}
        ${row("GP margin used", `${escapeHtml(inputs.gpMarginPct ?? 15)}%`)}
        ${row("You today", fmtUsd(results.currentTake))}
        ${row("You at TAB", `${fmtUsd(results.tabTake)} (${tabSplitPct})`)}
        ${row("Annual lift", `<strong>+${fmtUsd(results.delta)} ${liftPct}</strong>`)}
      </tbody>
    </table>
  `);
}

function row(label, value) {
  return `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;width:200px;">${escapeHtml(label)}</td>
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
