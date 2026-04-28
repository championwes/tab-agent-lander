/* ============================================
   TAB Commission Calculator + Lead capture
   ============================================
   Inputs:
     - Annual customer revenue (top-line, what TAB bills the customer — NOT gross profit)
     - Region (Domestic / International)
     - Current commission split %

   Tiers (per Brian, 4/27 sync):
     Domestic:
       ≤ $5M       → 65%
       $5M–$10M    → 70%
       $10M–$20M   → 75%
       > $20M      → 80%
     International:
       Flat 60% (caps at 60)

   GP assumption for take-home math: 15% (historical industry blend per Mark).
   Asset/line-haul bonus is intentionally excluded — different formula, and
   agents are not incentivized to sell assets.
   ============================================ */

const DOMESTIC_TIERS = [
  { minRev: 0,         maxRev: 5_000_000,   split: 0.65, label: "≤ $5M" },
  { minRev: 5_000_000, maxRev: 10_000_000,  split: 0.70, label: "$5M – $10M" },
  { minRev: 10_000_000, maxRev: 20_000_000, split: 0.75, label: "$10M – $20M" },
  { minRev: 20_000_000, maxRev: Infinity,   split: 0.80, label: "> $20M" },
];

const INTERNATIONAL_SPLIT = 0.60;
const ASSUMED_GP_MARGIN = 0.15; // 15% historical blended margin

/* ---------- Endpoint placeholders ---------- */
const LEAD_ENDPOINT = "/api/lead";
const PLAYBOOK_ENDPOINT = "/api/playbook";

/* ============================================
   Helpers
   ============================================ */
const $ = (sel) => document.querySelector(sel);
const fmt = (n) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function tabSplitFor(annualRevenue, region) {
  if (region === "international") {
    return { split: INTERNATIONAL_SPLIT, tierLabel: "International agent (flat)" };
  }
  for (const tier of DOMESTIC_TIERS) {
    if (annualRevenue >= tier.minRev && annualRevenue < tier.maxRev) {
      return { split: tier.split, tierLabel: `Domestic agent · ${tier.label}` };
    }
  }
  return { split: DOMESTIC_TIERS[0].split, tierLabel: DOMESTIC_TIERS[0].label };
}

function calculate({ annualRevenue, region, currentSplit, gpMargin }) {
  const margin = gpMargin > 0 ? gpMargin : ASSUMED_GP_MARGIN;
  const grossProfit = annualRevenue * margin;

  const { split: tabSplit, tierLabel } = tabSplitFor(annualRevenue, region);

  const currentTake = grossProfit * (currentSplit / 100);
  const tabTake = grossProfit * tabSplit;
  const delta = tabTake - currentTake;
  const liftPct = currentTake > 0 ? (delta / currentTake) * 100 : 0;

  return {
    grossProfit,
    margin,
    tabSplit,
    tierLabel,
    currentTake,
    tabTake,
    delta,
    liftPct,
  };
}

/* ============================================
   Calculator wiring
   ============================================ */
const calcForm = $("#calc-form");
const resultBox = $("#calc-result");
const numbersBox = resultBox.querySelector(".calc-numbers");
const leadFormBox = $("#lead-form");
const placeholderText = resultBox.querySelector(".calc-result-head .muted");

calcForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const annualRevenue = Number($("#annualRevenue").value) || 0;
  const region = $("#region").value || "domestic";
  const currentSplit = Number($("#currentSplit").value) || 0;
  const gpMarginPct = Number($("#gpMargin").value) || 0;
  const gpMargin = gpMarginPct > 0 ? gpMarginPct / 100 : ASSUMED_GP_MARGIN;

  if (annualRevenue <= 0 || currentSplit <= 0) return;

  const r = calculate({ annualRevenue, region, currentSplit, gpMargin });

  $("#r-tier").textContent = `${Math.round(r.tabSplit * 100)}% — ${r.tierLabel}`;
  $("#r-gp").textContent = `${fmt(r.grossProfit)} (at ${Math.round(r.margin * 100)}% margin)`;
  $("#r-current").textContent = fmt(r.currentTake);
  $("#r-tab").textContent = fmt(r.tabTake);

  const deltaSign = r.delta >= 0 ? "+" : "−";
  $("#r-delta").textContent = `${deltaSign}${fmt(Math.abs(r.delta))} / year`;
  $("#r-pct").textContent = `${r.liftPct >= 0 ? "+" : ""}${r.liftPct.toFixed(0)}%`;

  numbersBox.hidden = false;
  leadFormBox.hidden = false;
  if (placeholderText) placeholderText.style.display = "none";

  resultBox.dataset.payload = JSON.stringify({
    inputs: { annualRevenue, region, currentSplit, gpMarginPct: gpMarginPct || 15 },
    results: r,
  });

  resultBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
});

/* ============================================
   Lead form submissions
   ============================================ */
async function submitLead(form, endpoint, extraPayload = {}) {
  const fd = new FormData(form);
  const data = Object.fromEntries(fd.entries());
  const payload = { ...data, ...extraPayload, submittedAt: new Date().toISOString() };

  const btn = form.querySelector("button[type=submit]");
  const originalText = btn.textContent;
  btn.textContent = "Sending…";
  btn.disabled = true;

  try {
    await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => null);

    form.innerHTML = `
      <div class="lead-success">
        <h4>You're in.</h4>
        <p>Check your inbox in the next minute. Mark, Brian, or Chad will follow up personally — no auto-pilot recruiter pitch.</p>
      </div>
    `;
  } catch (err) {
    btn.textContent = originalText;
    btn.disabled = false;
    alert("Something went wrong — please email Brian@tab-llc.com directly.");
  }
}

document.addEventListener("submit", (e) => {
  if (e.target.id === "lead-form") {
    e.preventDefault();
    const calcPayload = resultBox.dataset.payload
      ? JSON.parse(resultBox.dataset.payload)
      : {};
    submitLead(e.target, LEAD_ENDPOINT, { source: "calculator", ...calcPayload });
  }

  if (e.target.id === "playbook-form") {
    e.preventDefault();
    submitLead(e.target, PLAYBOOK_ENDPOINT, { source: "playbook" });
  }
});

/* ============================================
   Misc
   ============================================ */
document.getElementById("year").textContent = new Date().getFullYear();

const style = document.createElement("style");
style.textContent = `
  .lead-success { text-align: center; padding: 16px 0; }
  .lead-success h4 { color: var(--navy); font-size: 1.2rem; margin: 0 0 8px; }
  .lead-success p { color: var(--ink-2); font-size: 0.95rem; margin: 0; }
`;
document.head.appendChild(style);
