/* Three storefront directions, switchable with ?variant=A|B|C. Prototype only. */
const products = [
  {
    id: "drag-harrow",
    name: "6 FT Heavy-Duty Drag Harrow & Driveway Grader",
    category: "Agriculture & Forestry",
    image: "./assets/products/product-01.webp",
    price: 123.99,
    compareAt: 189.99,
    dropPrice: 39.99,
    votes: 1847,
  },
  {
    id: "dog-crate",
    name: "Wooden Dog Crate Furniture with Barn Door",
    category: "Home & Furniture",
    image: "./assets/products/product-03.webp",
    price: 205.99,
    compareAt: 299.99,
    dropPrice: 59.99,
    votes: 1642,
  },
  {
    id: "truck-toolbox",
    name: "Heavy-Duty Steel Truck Bed Tool Box",
    category: "Automotive",
    image: "./assets/products/product-05.webp",
    price: 150.99,
    compareAt: 215.99,
    dropPrice: 49.99,
    votes: 1428,
  },
  {
    id: "mini-split",
    name: "24,000 BTU 21 SEER2 Mini Split AC & Heat Pump",
    category: "Air Conditioners",
    image: "./assets/products/product-06.webp",
    price: 1135.99,
    compareAt: 1499.99,
    dropPrice: 399.99,
    votes: 1213,
  },
  {
    id: "log-lifter",
    name: "46.5-inch Cant Hook Log Roller & Lifter",
    category: "Tools & Equipment",
    image: "./assets/products/product-09.webp",
    price: 68.99,
    compareAt: 81.99,
    dropPrice: 19.99,
    votes: 987,
  },
  {
    id: "forest-rug",
    name: "9 × 12 Vintage Forest Botanical Area Rug",
    category: "Rugs",
    image: "./assets/products/product-12.webp",
    price: 79.99,
    compareAt: 109.99,
    dropPrice: 24.99,
    votes: 851,
  },
];

const variants = [
  { key: "A", label: "A · Drop Arena" },
  { key: "B", label: "B · Schedule First" },
  { key: "C", label: "C · Guided Quest" },
];

const phaseCopy = {
  voting: { chip: "Voting open", title: "You pick it. We drop it.", timer: 98236 },
  upcoming: { chip: "Next drop", title: "The queue is locked.", timer: 613 },
  live: { chip: "Live now", title: "Two units. Right now.", timer: 466 },
  soldout: { chip: "Drop closed", title: "Gone in a flash.", timer: 7198 },
};

const cookieVote = readCookie("garvee_bf_vote");
const state = {
  variant: normalizeVariant(new URLSearchParams(location.search).get("variant")),
  phase: "voting",
  loggedIn: false,
  booked: false,
  shared: false,
  stock: 2,
  claimed: false,
  reservationEnds: null,
  secondsRemaining: phaseCopy.voting.timer,
  votedProduct: products.some((product) => product.id === cookieVote) ? cookieVote : null,
};

if (state.votedProduct) {
  products.find((product) => product.id === state.votedProduct).votes += 1;
}

ensureVoterCookie();

const app = document.querySelector("#app");
const toast = document.querySelector("#toast");
const loginModal = document.querySelector("#loginModal");
const boundaryModal = document.querySelector("#boundaryModal");

function normalizeVariant(value) {
  const key = String(value || "A").toUpperCase();
  return variants.some((variant) => variant.key === key) ? key : "A";
}

function readCookie(name) {
  return document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.split("=")
    .slice(1)
    .join("=") || null;
}

function writeCookie(name, value) {
  document.cookie = `${name}=${encodeURIComponent(value)}; max-age=31536000; path=/; SameSite=Lax`;
}

function deleteCookie(name) {
  document.cookie = `${name}=; max-age=0; path=/; SameSite=Lax`;
}

function ensureVoterCookie() {
  if (!readCookie("garvee_bf_voter")) {
    writeCookie("garvee_bf_voter", `v_${crypto.randomUUID().slice(0, 8)}`);
  }
}

function rankedProducts() {
  return [...products].sort((a, b) => b.votes - a.votes || a.id.localeCompare(b.id));
}

function currentProduct() {
  return rankedProducts()[0];
}

function money(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function eligibilityCount() {
  return [state.loggedIn, state.booked, state.shared].filter(Boolean).length;
}

function isEligible() {
  return eligibilityCount() === 3;
}

function phaseStatus() {
  if (state.phase === "soldout") return "Sold out";
  if (state.phase === "live") return `${state.stock} left`;
  if (state.phase === "upcoming") return "Starting soon";
  return "Projected #1";
}

function countdownMarkup(seconds = state.secondsRemaining) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `
    <div class="countdown" data-countdown aria-label="Countdown">
      ${days ? `<span><strong data-time="days">${String(days).padStart(2, "0")}</strong><small>days</small></span>` : ""}
      <span><strong data-time="hours">${String(hours).padStart(2, "0")}</strong><small>hrs</small></span>
      <span><strong data-time="minutes">${String(minutes).padStart(2, "0")}</strong><small>min</small></span>
      <span><strong data-time="seconds">${String(secs).padStart(2, "0")}</strong><small>sec</small></span>
    </div>`;
}

function productSummary(product, layout = "arena") {
  const soldOut = state.phase === "soldout" || state.stock === 0;
  const disabled = state.phase !== "live" || soldOut || !isEligible() || state.claimed;
  let cta = "Complete 3 steps to unlock";
  if (state.phase === "voting") cta = "Drop opens after voting closes";
  if (state.phase === "upcoming") cta = "Unlock complete · waiting for drop";
  if (state.phase === "live" && isEligible()) cta = `Claim 1 of ${state.stock} at ${money(product.dropPrice)}`;
  if (soldOut) cta = "Sold out · see the next drop";
  if (state.claimed) cta = "Reserved in this demo";

  return `
    <div class="${layout}-product-top">
      <span class="status-chip ${state.phase === "live" ? "is-live" : ""}">${phaseCopy[state.phase].chip}</span>
      <span class="inventory-number">${phaseStatus()}<br>2 units per drop</span>
    </div>
    <img src="${product.image}" alt="${product.name}" />
    <div>
      <p class="eyebrow">Rank #1 · ${product.category}</p>
      <h2>${product.name}</h2>
      <div class="${layout}-product-price">
        <div><strong>${money(product.dropPrice)}</strong> <del>${money(product.price)}</del></div>
        <span class="vote-count">${product.votes.toLocaleString()} votes</span>
      </div>
      <div class="progress-bar" aria-label="${state.stock} of 2 units remaining"><i style="width:${state.stock * 50}%"></i></div>
      <button class="button button-primary button-full" type="button" data-action="claim" ${disabled ? "disabled" : ""}>${cta}</button>
      ${reservationMarkup()}
    </div>`;
}

function reservationMarkup() {
  if (!state.claimed || !state.reservationEnds) return "";
  return `<div class="reservation-card"><p>Demo reservation expires in</p><strong data-reservation>05:00</strong></div>`;
}

function qualificationMarkup(compact = false) {
  const steps = [
    { key: "login", number: "01", title: "Sign in", detail: state.loggedIn ? "Demo customer connected" : "Shopify Customer Account" },
    { key: "book", number: "02", title: "Book the event", detail: state.booked ? "Reminder is on" : "Reserve your access" },
    { key: "share", number: "03", title: "Share the event", detail: state.shared ? "Share action recorded" : "Click to complete in demo" },
  ];
  return `
    <div class="qualification-steps ${compact ? "is-compact" : ""}">
      ${steps.map((step) => `
        <button class="qualification-step ${state[step.key === "book" ? "booked" : step.key === "share" ? "shared" : "loggedIn"] ? "is-complete" : ""}" type="button" data-action="${step.key}">
          <b>${state[step.key === "book" ? "booked" : step.key === "share" ? "shared" : "loggedIn"] ? "✓" : step.number}</b>
          <span><strong>${step.title}</strong><br><small>${step.detail}</small></span>
          <span aria-hidden="true">→</span>
        </button>`).join("")}
    </div>`;
}

function voteGridMarkup() {
  const ranked = rankedProducts();
  return `
    <div class="vote-grid">
      ${ranked.map((product, index) => `
        <article class="vote-card ${index === 0 ? "is-leader" : ""}">
          <span class="vote-rank">#${index + 1}</span>
          <img src="${product.image}" alt="${product.name}" loading="lazy" />
          <div class="vote-card-body">
            <p class="eyebrow">${product.category}</p>
            <h3>${product.name}</h3>
            <div class="price-row"><span><strong>${money(product.dropPrice)}</strong> drop</span><del>${money(product.price)}</del></div>
            <div class="vote-row">
              <span class="vote-count">${product.votes.toLocaleString()} votes</span>
              <button class="vote-button" type="button" data-action="vote" data-product-id="${product.id}" ${state.votedProduct || state.phase !== "voting" ? "disabled" : ""}>
                ${state.votedProduct === product.id ? "Your pick ✓" : state.votedProduct ? "Vote used" : state.phase !== "voting" ? "Voting locked" : "Vote for this"}
              </button>
            </div>
          </div>
        </article>`).join("")}
    </div>
    <p class="vote-caption">Demo voter ID: ${readCookie("garvee_bf_voter") || "not set"} · Cookie ID is a light participation limit, not proof of one person.</p>`;
}

function scheduleMarkup(limit = products.length) {
  return `
    <div class="schedule-list">
      ${rankedProducts().slice(0, limit).map((product, index) => {
        const hour = 8 + index * 2;
        const status = index === 0 && state.phase === "live" ? "Live" : index === 0 && state.phase === "soldout" ? "Sold out" : state.phase === "voting" ? "Projected" : "Scheduled";
        return `
          <article class="schedule-row">
            <time datetime="2026-11-27T${String(hour).padStart(2, "0")}:00:00-05:00">NOV 27<br>${hour > 12 ? hour - 12 : hour}:00 ${hour >= 12 ? "PM" : "AM"} ET</time>
            <span class="rank-number">${String(index + 1).padStart(2, "0")}</span>
            <img src="${product.image}" alt="" loading="lazy" />
            <div><h3>${product.name}</h3><p>${money(product.dropPrice)} · 2 units · Rank #${index + 1}</p></div>
            <span class="schedule-badge ${status === "Live" ? "is-live" : status === "Sold out" ? "is-soldout" : ""}">${status}</span>
          </article>`;
      }).join("")}
    </div>`;
}

function howMarkup() {
  return `
    <div class="how-grid">
      <article class="how-card"><b>01</b><h3>Vote once</h3><p>Pick the product you want most. The browser Cookie keeps one casual vote in this prototype.</p></article>
      <article class="how-card"><b>02</b><h3>Lock the ranking</h3><p>When voting closes, the ranking becomes the schedule. One product takes each two-hour slot.</p></article>
      <article class="how-card"><b>03</b><h3>Unlock access</h3><p>Sign in, book the event, and trigger the share action before a live claim is enabled.</p></article>
      <article class="how-card"><b>04</b><h3>Race for two</h3><p>Each drop releases two units. Shopify inventory, not this prototype, must arbitrate a real sale.</p></article>`;
}

function commonVoteSection() {
  return `
    <section class="vote-section" id="vote">
      <div class="section-heading">
        <div><p class="eyebrow">Community queue · ${state.phase === "voting" ? "updates live" : "ranking locked"}</p><h2>Vote the deals into order</h2></div>
        <p>The most-voted product earns the first slot. Ties resolve by a fixed merchant priority in production.</p>
      </div>
      ${voteGridMarkup()}
    </section>`;
}

function commonScheduleSection() {
  return `
    <section class="schedule-section" id="schedule">
      <div class="section-heading">
        <div><p class="eyebrow">Friday, November 27 · Eastern Time</p><h2>Two units, every two hours</h2></div>
        <p>${state.phase === "voting" ? "Projected from the live vote. The final queue locks when voting closes." : "Queue locked. Set a reminder for the slots you care about."}</p>
      </div>
      ${scheduleMarkup()}
    </section>`;
}

function commonHowSection() {
  return `
    <section class="how-section" id="how">
      <div class="section-heading"><div><p class="eyebrow">Fair rules, visible states</p><h2>One simple path to the drop</h2></div></div>
      ${howMarkup()}
    </section>`;
}

function renderVariantA() {
  const product = currentProduct();
  return `
    <div class="page-shell variant-a" id="top">
      <section class="arena-hero" id="live">
        <div class="arena-left">
          <p class="eyebrow">Black Friday · Vote & Drop · 2026</p>
          <h1 class="hero-title">Crowd picks.<br><em>Prices fall.</em></h1>
          <p class="hero-copy">You decide the queue. Every two hours, the next crowd favorite goes live with only two units at the event price.</p>
          <div class="arena-meta">
            <span class="status-chip ${state.phase === "live" ? "is-live" : ""}">${phaseCopy[state.phase].chip}</span>
            ${countdownMarkup()}
          </div>
        </div>
        <article class="arena-right arena-product">${productSummary(product, "arena")}</article>
      </section>
      <section class="qualification-card" aria-label="Flash sale eligibility">
        <div><p class="eyebrow">Your access pass</p><h3>${eligibilityCount()}/3 steps complete</h3><p>Complete all three before the product goes live.</p></div>
        ${qualificationMarkup()}
      </section>
      ${commonVoteSection()}
      ${commonScheduleSection()}
      ${commonHowSection()}
    </div>`;
}

function renderVariantB() {
  const product = currentProduct();
  return `
    <div class="page-shell variant-b" id="top">
      <section class="editorial-hero">
        <div>
          <p class="eyebrow">GARVEE Black Friday · 2026</p>
          <h1 class="hero-title">The<br>people's<br><em>queue.</em></h1>
        </div>
        <div class="hero-side">
          <div class="hero-side-top"><span class="status-chip ${state.phase === "live" ? "is-live" : ""}">${phaseCopy[state.phase].chip}</span>${countdownMarkup()}</div>
          <div><h2>${phaseCopy[state.phase].title}</h2><p class="hero-copy">Six products enter. Your votes write Friday's schedule. Two units unlock at each two-hour mark.</p><a class="button button-accent" href="#schedule">See the drop timetable ↓</a></div>
        </div>
      </section>
      <section class="schedule-section" id="schedule">
        <div class="section-heading"><div><p class="eyebrow">Projected drop order</p><h2>Your Friday, mapped out</h2></div><p>Voting closes Thursday at 11:59 PM ET. After that, this order is final.</p></div>
        ${scheduleMarkup()}
      </section>
      <section class="live-strip" id="live">
        <article class="live-strip-product">
          <img src="${product.image}" alt="${product.name}" />
          <div><span class="status-chip ${state.phase === "live" ? "is-live" : ""}">${phaseCopy[state.phase].chip}</span><h2>${product.name}</h2><p><strong>${money(product.dropPrice)}</strong> <del>${money(product.price)}</del> · ${state.stock} of 2 remaining</p><button class="button button-primary button-full" type="button" data-action="claim" ${state.phase !== "live" || !isEligible() || state.stock === 0 || state.claimed ? "disabled" : ""}>${state.claimed ? "Reserved in this demo" : state.phase === "soldout" ? "Sold out" : isEligible() ? "Claim the drop" : "Complete access pass"}</button>${reservationMarkup()}</div>
        </article>
        <aside class="qualification-card"><p class="eyebrow">Access pass</p><h3>${eligibilityCount()}/3 complete</h3><p>Login, booking, and share action are simulated.</p>${qualificationMarkup(true)}</aside>
      </section>
      ${commonVoteSection()}
      ${commonHowSection()}
    </div>`;
}

function renderVariantC() {
  const product = currentProduct();
  return `
    <div class="page-shell variant-c" id="top">
      <section class="guided-hero" id="live">
        <div class="guided-hero-grid">
          <div class="guided-copy">
            <p class="eyebrow">Black Friday · Community Drop</p>
            <h1 class="hero-title">Vote.<br>Unlock.<br><em>Race.</em></h1>
            <p class="hero-copy">A guided path from your pick to the two-unit drop. Know exactly what to do before the clock hits zero.</p>
            <div class="arena-meta"><span class="status-chip ${state.phase === "live" ? "is-live" : ""}">${phaseCopy[state.phase].chip}</span>${countdownMarkup()}</div>
          </div>
          <article class="guided-product">${productSummary(product, "guided")}</article>
        </div>
      </section>
      <section class="journey-section">
        <div class="journey-card">
          <div class="journey-progress" aria-label="${eligibilityCount()} of 3 eligibility steps complete"><i class="is-complete"></i><i class="${state.loggedIn ? "is-complete" : ""}"></i><i class="${state.booked ? "is-complete" : ""}"></i><i class="${state.shared ? "is-complete" : ""}"></i></div>
          <div class="journey-body"><div><p class="eyebrow">Your drop readiness</p><h3>${isEligible() ? "You're ready to race" : `Finish ${3 - eligibilityCount()} more step${3 - eligibilityCount() === 1 ? "" : "s"}`}</h3></div>${qualificationMarkup()}</div>
        </div>
      </section>
      ${commonVoteSection()}
      ${commonScheduleSection()}
      ${commonHowSection()}
    </div>`;
}

function render() {
  app.innerHTML = state.variant === "B" ? renderVariantB() : state.variant === "C" ? renderVariantC() : renderVariantA();
  const activeVariant = variants.find((variant) => variant.key === state.variant);
  document.querySelector("[data-variant-label]").textContent = activeVariant.label;
  document.querySelector("[data-account-label]").textContent = state.loggedIn ? "Demo customer" : "Sign in";
  document.querySelector(".account-pill").classList.toggle("is-logged-in", state.loggedIn);
  document.querySelectorAll("[data-phase]").forEach((button) => button.classList.toggle("is-active", button.dataset.phase === state.phase));
  updateTimers();
}

function updateTimers() {
  const seconds = Math.max(0, state.secondsRemaining);
  const values = {
    days: Math.floor(seconds / 86400),
    hours: Math.floor((seconds % 86400) / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
  };
  document.querySelectorAll("[data-time]").forEach((node) => {
    node.textContent = String(values[node.dataset.time]).padStart(2, "0");
  });
  document.querySelectorAll("[data-reservation]").forEach((node) => {
    const remaining = Math.max(0, Math.ceil((state.reservationEnds - Date.now()) / 1000));
    node.textContent = `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;
  });
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => toast.classList.remove("is-visible"), 3200);
}

function changeVariant(direction) {
  const currentIndex = variants.findIndex((variant) => variant.key === state.variant);
  const nextIndex = (currentIndex + direction + variants.length) % variants.length;
  state.variant = variants[nextIndex].key;
  const url = new URL(location.href);
  url.searchParams.set("variant", state.variant);
  history.replaceState({}, "", url);
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setPhase(phase) {
  state.phase = phase;
  state.secondsRemaining = phaseCopy[phase].timer;
  state.stock = phase === "soldout" ? 0 : 2;
  state.claimed = false;
  state.reservationEnds = null;
  const consolePanel = document.querySelector(".console-panel");
  const consoleToggle = document.querySelector(".console-toggle");
  if (consolePanel && consoleToggle) {
    consolePanel.hidden = true;
    consoleToggle.setAttribute("aria-expanded", "false");
    consoleToggle.querySelector("strong").textContent = "＋";
  }
  render();
  showToast(`Previewing ${phaseCopy[phase].chip.toLowerCase()} state.`);
}

function completeStep(step) {
  if (step === "login") {
    if (state.loggedIn) return showToast("Demo customer is already signed in.");
    loginModal.showModal();
    return;
  }
  if (!state.loggedIn) {
    showToast("Sign in before completing the access pass.");
    loginModal.showModal();
    return;
  }
  if (step === "book") {
    state.booked = true;
    render();
    showToast("Event booked. A production build would save this to the customer record.");
    return;
  }
  if (!state.booked) return showToast("Book the event before recording a share action.");
  state.shared = true;
  render();
  showToast("Share action recorded for the demo. External posting is not verified.");
}

function vote(productId) {
  if (state.phase !== "voting") return showToast("Voting is locked in this preview state.");
  if (state.votedProduct) return showToast("This browser's demo vote has already been used.");
  const product = products.find((item) => item.id === productId);
  if (!product) return;
  product.votes += 1;
  state.votedProduct = product.id;
  writeCookie("garvee_bf_vote", product.id);
  render();
  showToast(`Vote counted for ${product.name}.`);
}

function claimDrop() {
  if (state.phase !== "live" || !isEligible() || state.stock === 0 || state.claimed) return;
  state.stock -= 1;
  state.claimed = true;
  state.reservationEnds = Date.now() + 5 * 60 * 1000;
  render();
  showToast("One unit reserved in this prototype. No Shopify inventory was changed.");
}

function resetDemo() {
  deleteCookie("garvee_bf_vote");
  deleteCookie("garvee_bf_voter");
  location.reload();
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action], [data-phase]");
  if (!target) return;
  if (target.dataset.phase) return setPhase(target.dataset.phase);
  const action = target.dataset.action;
  if (action === "previous-variant") return changeVariant(-1);
  if (action === "next-variant") return changeVariant(1);
  if (action === "open-boundary") return boundaryModal.showModal();
  if (action === "close-modal") return target.closest("dialog")?.close();
  if (action === "login") return completeStep("login");
  if (action === "book") return completeStep("book");
  if (action === "share") return completeStep("share");
  if (action === "complete-login") {
    state.loggedIn = true;
    loginModal.close();
    render();
    return showToast("Signed in as a simulated Shopify customer.");
  }
  if (action === "vote") return vote(target.dataset.productId);
  if (action === "claim") return claimDrop();
  if (action === "reset-demo") return resetDemo();
  if (action === "toggle-console") {
    const panel = document.querySelector(".console-panel");
    panel.hidden = !panel.hidden;
    target.setAttribute("aria-expanded", String(!panel.hidden));
    target.querySelector("strong").textContent = panel.hidden ? "＋" : "−";
  }
});

document.addEventListener("keydown", (event) => {
  const active = document.activeElement;
  if (["INPUT", "TEXTAREA"].includes(active?.tagName) || active?.isContentEditable || document.querySelector("dialog[open]")) return;
  if (event.key === "ArrowLeft") changeVariant(-1);
  if (event.key === "ArrowRight") changeVariant(1);
});

document.querySelectorAll("dialog").forEach((dialog) => {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
});

setInterval(() => {
  if (state.secondsRemaining > 0) state.secondsRemaining -= 1;
  if (state.claimed && state.reservationEnds <= Date.now()) {
    state.claimed = false;
    state.reservationEnds = null;
    state.stock += 1;
    render();
    showToast("Demo reservation expired. The unit is available again.");
  } else {
    updateTimers();
  }
}, 1000);

render();
