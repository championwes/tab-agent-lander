/**
 * Cloudflare Pages Function — POST /api/playbook
 *
 * Same shape as /api/lead, but tagged separately so you can route playbook
 * downloads into a different sequence (e.g. send the PDF link in the
 * follow-up email).
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  if (!body.email || !body.name) {
    return json({ error: "name and email required" }, 400);
  }

  body.tag = "playbook-download";

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

  console.log("PLAYBOOK_LEAD", JSON.stringify(body));

  return json({
    ok: true,
    // Once the real PDF is hosted, return a signed URL here
    downloadUrl: "/playbook-placeholder.pdf",
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
