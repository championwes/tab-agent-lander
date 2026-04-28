/**
 * Cloudflare Pages Function — POST /api/lead
 *
 * Accepts calculator + playbook lead submissions.
 * For now: logs the payload and forwards to a webhook if configured.
 *
 * To wire up real delivery, set ONE of these env vars in the Pages dashboard:
 *   - LEAD_WEBHOOK_URL    → any HTTPS endpoint (Zapier, Make, n8n, Slack incoming webhook)
 *   - HUBSPOT_FORM_URL    → HubSpot Forms API submit URL
 *   - LEAD_FORWARD_EMAIL  → (future) integrate with Mailchannels for email
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  // Basic validation
  if (!body.email || !body.name) {
    return json({ error: "name and email required" }, 400);
  }

  // Forward to webhook if configured
  const webhook = env.LEAD_WEBHOOK_URL;
  if (webhook) {
    try {
      await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (err) {
      console.error("webhook forward failed", err);
    }
  }

  // Log to CF observability
  console.log("LEAD", JSON.stringify(body));

  return json({ ok: true });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
