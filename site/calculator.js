/* ============================================
   TAB Commission Calculator + Lead capture
   ============================================
   Inputs:
     - Annual customer revenue (top-line, what TAB bills the customer — NOT gross profit)
     - Region (Domestic / International)
     - Current commission split %
     - Optional GP margin (default 15%) and optional loads per month

   Tiers (agency contract, Appendix D — unchanged in the 9/24/2026 revision):
     Domestic:  ≤ $5M 65% · $5M–$10M 70% · $10M–$20M 75% · > $20M 80%
     International: flat 60%

   Cost-share plan (Appendix E): $19.85 per shipment, shown only when the
   visitor enters loads per month.
   Sign-on bonus: one-time, up to 10% of last year's commission income
   (proof: 1099 / W-8BEN), shown separately from the recurring annual lift.
   Asset/line-haul commission is intentionally excluded (different formula).
   ============================================ */

const DOMESTIC_TIERS = [
  { minRev: 0,          maxRev: 5_000_000,  split: 0.65, label: "≤ $5M" },
  { minRev: 5_000_000,  maxRev: 10_000_000, split: 0.70, label: "$5M – $10M" },
  { minRev: 10_000_000, maxRev: 20_000_000, split: 0.75, label: "$10M – $20M" },
  { minRev: 20_000_000, maxRev: Infinity,   split: 0.80, label: "> $20M" },
];

const INTERNATIONAL_SPLIT = 0.60;
const ASSUMED_GP_MARGIN = 0.15;   // 15% historical blended margin
const CSP_PER_SHIPMENT = 19.85;   // cost-share plan, per load
const SIGNON_BONUS_RATE = 0.10;   // up to 10% of prior-year commission income

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

function calculate({ annualRevenue, region, currentSplit, gpMargin, loadsPerMonth }) {
  const margin = gpMargin > 0 ? gpMargin : ASSUMED_GP_MARGIN;
  const grossProfit = annualRevenue * margin;
  const { split: tabSplit, tierLabel } = tabSplitFor(annualRevenue, region);

  const currentTake = grossProfit * (currentSplit / 100);
  const tabTake = grossProfit * tabSplit;                    // commission before cost-share
  const cspAnnual = loadsPerMonth > 0 ? loadsPerMonth * 12 * CSP_PER_SHIPMENT : 0;
  const tabNet = tabTake - cspAnnual;                        // after cost-share
  const delta = (loadsPerMonth > 0 ? tabNet : tabTake) - currentTake;
  const liftPct = currentTake > 0 ? (delta / currentTake) * 100 : 0;
  const signOnBonus = currentTake * SIGNON_BONUS_RATE;      // one-time, year one only

  return { grossProfit, margin, tabSplit, tierLabel, currentTake, tabTake,
           loadsPerMonth, cspAnnual, tabNet, delta, liftPct, signOnBonus };
}

/* ============================================
   Calculator wiring
   ============================================ */
const calcForm = $("#calc-form");
const resultBox = $("#calc-result");

if (calcForm && resultBox) {
  const numbersBox = resultBox.querySelector(".calc-numbers");
  const leadFormBox = $("#lead-form");
  const placeholderText = resultBox.querySelector(".calc-result-head .muted");

  const regionSelect = $("#region");
  const splitHelp = $("#currentSplit-help");
  const splitHelpDomestic = "Most agents fall between 50% and 70%.";
  const splitHelpIntl =
    "International agents earn a flat 60% at TAB regardless of current split. Enter your current split to see the comparison.";

  regionSelect.addEventListener("change", () => {
    splitHelp.textContent =
      regionSelect.value === "international" ? splitHelpIntl : splitHelpDomestic;
  });

  calcForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const annualRevenue = Number($("#annualRevenue").value) || 0;
    const region = regionSelect.value;
    const currentSplit = Number($("#currentSplit").value) || 0;
    const gpMarginPct = Number($("#gpMargin").value) || 0;
    const gpMargin = gpMarginPct > 0 ? gpMarginPct / 100 : ASSUMED_GP_MARGIN;
    const loadsPerMonth = Number($("#loadsPerMonth").value) || 0;

    if (!region) { regionSelect.focus(); return; }
    if (annualRevenue <= 0 || currentSplit <= 0) return;

    const r = calculate({ annualRevenue, region, currentSplit, gpMargin, loadsPerMonth });

    $("#r-tier").textContent = `${Math.round(r.tabSplit * 100)}% — ${r.tierLabel}`;
    $("#r-gp").textContent = `${fmt(r.grossProfit)} (at ${Math.round(r.margin * 100)}% margin)`;
    $("#r-current").textContent = fmt(r.currentTake);
    $("#r-tab").textContent = fmt(r.tabTake);

    // Cost-share rows only appear when the visitor entered loads per month.
    const hasLoads = loadsPerMonth > 0;
    $("#row-csp").hidden = !hasLoads;
    $("#row-net").hidden = !hasLoads;
    $("#disc-csp").hidden = !hasLoads;
    $("#r-tab-label").textContent = hasLoads ? "You at TAB (commission)" : "You at TAB";
    if (hasLoads) {
      $("#r-csp").textContent = `−${fmt(r.cspAnnual)}`;
      $("#r-net").textContent = fmt(r.tabNet);
    }

    const deltaSign = r.delta >= 0 ? "+" : "−";
    $("#r-delta").textContent = `${deltaSign}${fmt(Math.abs(r.delta))} / year`;
    $("#r-pct").textContent = `${r.liftPct >= 0 ? "+" : ""}${r.liftPct.toFixed(0)}%`;
    $("#r-bonus").textContent = fmt(r.signOnBonus);

    numbersBox.hidden = false;
    leadFormBox.hidden = false;
    if (placeholderText) placeholderText.style.display = "none";

    resultBox.dataset.payload = JSON.stringify({
      inputs: { annualRevenue, region, currentSplit, gpMarginPct: gpMarginPct || 15, loadsPerMonth },
      results: r,
    });

    resultBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
}

/* ============================================
   Lead form submissions
   ============================================ */
/* Capture UTM + click-id params on page load so we can attach them to
   every form submission. Powers ad-attribution in the lead notifications. */
const ATTRIBUTION_PARAMS = (() => {
  try {
    const sp = new URLSearchParams(window.location.search);
    const keys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "li_fat_id", "gclid"];
    const out = {};
    for (const k of keys) {
      const v = sp.get(k);
      if (v) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
})();

async function submitLead(form, endpoint, extraPayload = {}) {
  const fd = new FormData(form);
  const data = Object.fromEntries(fd.entries());
  const payload = {
    ...data,
    ...extraPayload,
    attribution: ATTRIBUTION_PARAMS,
    pageUrl: window.location.href,
    submittedAt: new Date().toISOString(),
  };

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
        <p>Check your inbox in the next minute. Mark, our Director of Agency Opportunities, will follow up personally — no auto-pilot recruiter pitch.</p>
      </div>
    `;
  } catch (err) {
    btn.textContent = originalText;
    btn.disabled = false;
    alert("Something went wrong — please email agents@growwithtab.com directly.");
  }
}

document.addEventListener("submit", (e) => {
  if (e.target.id === "lead-form") {
    e.preventDefault();
    const calcPayload = resultBox && resultBox.dataset.payload ? JSON.parse(resultBox.dataset.payload) : {};
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

/* Testimonial videos — toggle a blue overlay on each card until it plays.
   The overlay sits on .testimonial-thumb::before and is faded out when
   the wrapper carries the .is-playing class. */
document.querySelectorAll(".testimonial-video").forEach((video) => {
  const thumb = video.closest(".testimonial-thumb");
  if (!thumb) return;
  video.addEventListener("play", () => thumb.classList.add("is-playing"));
  video.addEventListener("pause", () => thumb.classList.remove("is-playing"));
  video.addEventListener("ended", () => thumb.classList.remove("is-playing"));
});

/* Testimonial gallery — scroll-snap carousel with arrows + dots */
(function () {
  const track = document.getElementById("testimonial-track");
  const dotsContainer = document.getElementById("testimonial-dots");
  if (!track) return;

  const cards = Array.from(track.querySelectorAll(".testimonial-card"));
  const arrows = document.querySelectorAll(".testimonial-arrow");
  if (cards.length === 0) return;

  // Build dots: one per card
  cards.forEach((_, i) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.role = "tab";
    dot.setAttribute("aria-label", `Go to testimonial ${i + 1}`);
    dot.addEventListener("click", () => scrollToCard(i));
    dotsContainer.appendChild(dot);
  });
  const dots = Array.from(dotsContainer.querySelectorAll("button"));

  function scrollToCard(idx) {
    const card = cards[Math.max(0, Math.min(cards.length - 1, idx))];
    if (!card) return;
    track.scrollTo({ left: card.offsetLeft - track.offsetLeft, behavior: "smooth" });
  }

  function activeIndex() {
    // The card whose left edge is closest to the track's scrollLeft
    const sl = track.scrollLeft;
    let best = 0, bestDelta = Infinity;
    cards.forEach((card, i) => {
      const delta = Math.abs((card.offsetLeft - track.offsetLeft) - sl);
      if (delta < bestDelta) { bestDelta = delta; best = i; }
    });
    return best;
  }

  function updateUI() {
    const idx = activeIndex();
    dots.forEach((d, i) => d.setAttribute("aria-current", i === idx ? "true" : "false"));

    // Arrow disabled state — fully scrolled left/right
    const maxScroll = track.scrollWidth - track.clientWidth;
    arrows.forEach((btn) => {
      const dir = Number(btn.dataset.dir);
      if (dir < 0) btn.disabled = track.scrollLeft <= 1;
      else btn.disabled = track.scrollLeft >= maxScroll - 1;
    });
  }

  arrows.forEach((btn) => {
    btn.addEventListener("click", () => {
      const dir = Number(btn.dataset.dir);
      scrollToCard(activeIndex() + dir);
    });
  });

  let raf;
  track.addEventListener("scroll", () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(updateUI);
  });
  window.addEventListener("resize", updateUI);
  updateUI();
})();

/* Hero earnings preview — count-up the big lift number on first paint */
(function () {
  const el = document.querySelector(".hero-preview-number");
  if (!el) return;
  const target = Number(el.dataset.target || 0);
  if (!target || target <= 0) return;

  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) {
    el.textContent = `$${target.toLocaleString("en-US")}`;
    return;
  }

  const duration = 1600;
  const start = performance.now() + 350; // small delay so the page settles
  const tick = (now) => {
    const t = Math.max(0, Math.min(1, (now - start) / duration));
    const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
    const value = Math.round(target * eased);
    el.textContent = `$${value.toLocaleString("en-US")}`;
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})();

const style = document.createElement("style");
style.textContent = `
  .lead-success { text-align: center; padding: 16px 0; }
  .lead-success h4 { color: var(--navy); font-size: 1.2rem; margin: 0 0 8px; }
  .lead-success p { color: var(--ink-2); font-size: 0.95rem; margin: 0; }
`;
document.head.appendChild(style);
