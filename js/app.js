// Dream Team Travel — Booking flow

const { COMPANY, ROUTES,
  seatsAvailable, getDeparturesFor, findRoute, primaryRoutes, groupByRegion
} = window.DTT;

// ===== Stanje rezervacije =====
const state = {
  routeId: null,
  date: null,
  pax: 1,
  tripType: "oneWay", // ili "return"
  time: null,
  pickup: "",
  dropoff: "",
  fullname: "",
  phone: "",
  email: "",
  note: "",
  whatsappOpt: true,
};

// ===== Init =====
document.addEventListener("DOMContentLoaded", () => {
  populateRouteSelect();
  setDefaultDate();
  renderRouteGrid();
  bindSearch();
  bindFlowControls();
  bindStep2();
  bindStep3();
});

// ===== Helpers =====
function fmtEur(n) { return "€" + n; }
function fmtDateLong(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("sr-RS", { weekday: "short", day: "numeric", month: "long" });
}
function genRef() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "DTT-";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
function flagFor(country) {
  return { "Hrvatska":"🇭🇷","Slovenija":"🇸🇮","Italija":"🇮🇹",
    "S. Makedonija":"🇲🇰","BiH":"🇧🇦","Srbija":"🇷🇸" }[country] || "🌍";
}

// ===== Search form (hero) =====
function populateRouteSelect() {
  const sel = document.getElementById("route");
  const groups = groupByRegion(primaryRoutes());
  sel.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = ""; placeholder.disabled = true; placeholder.selected = true;
  placeholder.textContent = "Odaberi grad...";
  sel.appendChild(placeholder);

  for (const region of Object.keys(groups)) {
    const og = document.createElement("optgroup");
    og.label = region;
    for (const r of groups[region]) {
      const opt = document.createElement("option");
      opt.value = r.id;
      opt.textContent = `${r.city} — od ${fmtEur(r.oneWay)} / osobi`;
      og.appendChild(opt);
    }
    sel.appendChild(og);
  }
}

function setDefaultDate() {
  const dt = document.getElementById("date");
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const today = new Date();
  dt.min = today.toISOString().slice(0,10);
  dt.value = tomorrow.toISOString().slice(0,10);
}

function bindSearch() {
  const form = document.getElementById("search-form");
  form.addEventListener("submit", e => {
    e.preventDefault();
    const routeId = document.getElementById("route").value;
    const date = document.getElementById("date").value;
    const pax = parseInt(document.getElementById("pax").value, 10);
    const tripType = form.tripType.value;
    if (!routeId) { alert("Molim te izaberi destinaciju."); return; }
    if (!date) { alert("Molim te izaberi datum."); return; }

    Object.assign(state, { routeId, date, pax, tripType });
    openFlow();
  });
}

// ===== Route grid (marketing sekcija) =====
function renderRouteGrid() {
  const grid = document.getElementById("route-grid");
  const featured = primaryRoutes().slice(0, 6); // top 6 hrvatskih
  grid.innerHTML = "";
  for (const r of featured) {
    const card = document.createElement("button");
    card.className = "route-card";
    card.type = "button";
    card.innerHTML = `
      <div class="route-flag">${flagFor(r.country)}</div>
      <h3>${r.city} <span class="from-arrow">← Beograd</span></h3>
      <div class="region">${r.region} · ${r.durationH}h vožnje</div>
      <div class="price-row">
        <div class="price">${fmtEur(r.oneWay)} <small>od / osobi</small></div>
        <div class="arrow">→</div>
      </div>
    `;
    card.addEventListener("click", () => {
      document.getElementById("route").value = r.id;
      document.getElementById("booking").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    grid.appendChild(card);
  }
}

// ===== Flow open / step nav =====
function openFlow() {
  document.getElementById("flow").hidden = false;
  document.getElementById("flow").scrollIntoView({ behavior: "smooth", block: "start" });
  goToStep(1);
  renderStep1();
  renderFlowSummary();
}

function goToStep(n) {
  for (let i = 1; i <= 3; i++) {
    document.getElementById(`step-${i}`).hidden = i !== n;
    const dot = document.querySelector(`.flow-progress .step[data-step="${i}"]`);
    dot.classList.toggle("active", i === n);
    dot.classList.toggle("done", i < n);
  }
  state._step = n;
}

function bindFlowControls() {
  document.getElementById("flow-back").addEventListener("click", () => {
    if (state._step > 1) {
      goToStep(state._step - 1);
    } else {
      document.getElementById("flow").hidden = true;
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });
}

function renderFlowSummary() {
  const r = findRoute(state.routeId);
  if (!r) return;
  const tt = state.tripType === "return" ? "povratak" : "u jednom pravcu";
  document.getElementById("flow-summary").innerHTML = `
    <strong>Beograd → ${r.city}</strong>
    ${fmtDateLong(state.date)} · ${state.pax} ${state.pax === 1 ? "putnik" : "putnika"} · ${tt}
  `;
}

// ===== STEP 1: Odabir polaska =====
function renderStep1() {
  const list = document.getElementById("departure-list");
  const route = findRoute(state.routeId);
  const times = getDeparturesFor(state.date);
  list.innerHTML = "";

  for (const time of times) {
    const seats = seatsAvailable(state.routeId, state.date, time);
    const enough = seats >= state.pax;
    const price = state.tripType === "return" ? route.return : route.oneWay;
    const total = price * state.pax;

    let pillClass = "ok", pillText = `${seats} slobodnih mesta`;
    if (seats === 0) { pillClass = "none"; pillText = "Rasprodato"; }
    else if (seats <= 2) { pillClass = "low"; pillText = `Samo ${seats} ${seats===1?"mesto":"mesta"}!`; }

    const btn = document.createElement("button");
    btn.className = "departure";
    btn.type = "button";
    btn.disabled = !enough;
    const [depH] = time.split(":").map(Number);
    const arrH = Math.round(depH + route.durationH) % 24;
    const overnight = depH + route.durationH >= 24;
    const arrivalHint = `Dolazak u ${route.city} ~${String(arrH).padStart(2,"0")}:00${overnight ? " narednog dana" : ""} · ~${route.durationH}h vožnje`;
    btn.innerHTML = `
      <div class="dep-time">${time}<small>${time === "23:00" ? "noćni" : "jutarnji"}</small></div>
      <div class="dep-mid">
        <h3>Beograd → ${route.city}</h3>
        <p>${arrivalHint}</p>
      </div>
      <div class="dep-right">
        <span class="seats-pill ${pillClass}">${pillText}</span>
        <div class="dep-price">${fmtEur(total)}<small>ukupno za ${state.pax} ${state.pax===1?"osobu":"osoba"}</small></div>
      </div>
    `;
    btn.addEventListener("click", () => {
      if (!enough) return;
      state.time = time;
      document.getElementById("dropoff-city").textContent = `u ${route.city}`;
      goToStep(2);
    });
    list.appendChild(btn);
  }

  // Ako nijedan polazak nema dovoljno mesta — info banner
  const anyOK = times.some(t => seatsAvailable(state.routeId, state.date, t) >= state.pax);
  if (!anyOK) {
    const banner = document.createElement("div");
    banner.style.cssText = "padding:14px;border-radius:14px;background:rgba(212,82,74,.08);color:#7a2620;font-size:14px;margin-top:6px;";
    banner.innerHTML = `Za ${state.pax} putnika nema dovoljno mesta na ovom datumu. Probaj drugi datum ili nas pozovi — često imamo dodatni kombi za grupe.`;
    list.appendChild(banner);
  }
}

// ===== STEP 2: Pickup + putnici =====
function bindStep2() {
  document.getElementById("to-step-3").addEventListener("click", () => {
    const pickup = document.getElementById("pickup").value.trim();
    const dropoff = document.getElementById("dropoff").value.trim();
    const fullname = document.getElementById("fullname").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const email = document.getElementById("email").value.trim();
    const note = document.getElementById("note").value.trim();
    const whatsappOpt = document.getElementById("whatsapp-opt").checked;

    if (!pickup) { alert("Unesi pickup adresu u Beogradu."); return; }
    if (!dropoff) { alert("Unesi adresu/hotel dolaska."); return; }
    if (!fullname || fullname.length < 3) { alert("Unesi ime i prezime."); return; }
    if (!phone || phone.length < 6) { alert("Unesi telefon — vozač te zove pre polaska."); return; }

    Object.assign(state, { pickup, dropoff, fullname, phone, email, note, whatsappOpt });
    renderStep3();
    goToStep(3);
  });
}

// ===== STEP 3: Pregled =====
function renderStep3() {
  const r = findRoute(state.routeId);
  const price = state.tripType === "return" ? r.return : r.oneWay;
  const total = price * state.pax;

  document.getElementById("review-card").innerHTML = `
    <div class="r-row"><span>Linija</span><strong>Beograd → ${r.city}</strong></div>
    <div class="r-row"><span>Datum</span><strong>${fmtDateLong(state.date)}</strong></div>
    <div class="r-row"><span>Polazak</span><strong>${state.time}h (${state.time === "23:00" ? "noćni" : "jutarnji"})</strong></div>
    <div class="r-row"><span>Tip puta</span><strong>${state.tripType === "return" ? "Povratna karta" : "U jednom pravcu"}</strong></div>
    <div class="r-row"><span>Pickup</span><strong>${state.pickup}</strong></div>
    <div class="r-row"><span>Dolazak</span><strong>${state.dropoff}</strong></div>
    <div class="r-row"><span>Putnika</span><strong>${state.pax}</strong></div>
    <div class="r-row"><span>Kontakt</span><strong>${state.fullname} · ${state.phone}</strong></div>
    ${state.note ? `<div class="r-row"><span>Napomena</span><strong>${state.note}</strong></div>` : ""}
  `;

  document.getElementById("price-per").textContent = fmtEur(price);
  document.getElementById("price-pax").textContent = `× ${state.pax}`;
  document.getElementById("price-total").textContent = fmtEur(total);
}

function bindStep3() {
  document.getElementById("confirm").addEventListener("click", () => {
    if (!document.getElementById("terms").checked) {
      alert("Molim te prihvati uslove prevoza.");
      return;
    }
    showConfirmation();
  });

  document.getElementById("close-confirm").addEventListener("click", () => {
    document.getElementById("confirm-overlay").hidden = true;
    document.getElementById("flow").hidden = true;
    document.getElementById("search-form").reset();
    setDefaultDate();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

function showConfirmation() {
  const ref = genRef();
  document.getElementById("confirm-code").textContent = ref;

  const r = findRoute(state.routeId);
  const price = state.tripType === "return" ? r.return : r.oneWay;
  const total = price * state.pax;
  const msg = encodeURIComponent(
`Zdravo Dream Team Travel!
Imam rezervaciju ${ref}.

Linija: Beograd → ${r.city}
Datum: ${fmtDateLong(state.date)}
Polazak: ${state.time}h
Putnika: ${state.pax}
Pickup: ${state.pickup}
Dolazak: ${state.dropoff}
Ime: ${state.fullname}
Telefon: ${state.phone}
Ukupno: ${fmtEur(total)} (plaćanje kod vozača)

${state.note ? "Napomena: " + state.note : ""}`);

  document.getElementById("whatsapp-link").href =
    `https://wa.me/${COMPANY.whatsapp}?text=${msg}`;

  document.getElementById("confirm-overlay").hidden = false;
}
