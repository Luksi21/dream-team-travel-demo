// Dream Team Travel — Admin panel

const SESSION_KEY = "dtt:admin:session";

document.addEventListener("DOMContentLoaded", () => {
  window.Store._reseed();
  bindLogin();
  if (sessionStorage.getItem(SESSION_KEY) === "1") enterApp();

  bindTabs();
  bindManifest();
  bindNewBooking();
  bindReseed();
  bindLogout();

  // Live re-render kada se nešto promeni (drugi tab, customer rezerviše)
  window.Store.onChange(renderAll);
});

// ===== Auth =====
function bindLogin() {
  document.getElementById("login-form").addEventListener("submit", e => {
    e.preventDefault();
    const v = document.getElementById("admin-pass").value;
    if (v === "demo" || v === "demo123") {
      sessionStorage.setItem(SESSION_KEY, "1");
      enterApp();
    } else {
      alert("Pogrešna lozinka. Demo lozinka je: demo");
    }
  });
}

function enterApp() {
  document.getElementById("admin-gate").hidden = true;
  document.getElementById("admin-app").hidden = false;
  renderAll();
}

function bindLogout() {
  document.getElementById("logout-btn").addEventListener("click", () => {
    sessionStorage.removeItem(SESSION_KEY);
    location.reload();
  });
}

function bindReseed() {
  document.getElementById("reseed-btn").addEventListener("click", () => {
    if (!confirm("Obrisati sve rezervacije i vratiti demo podatke?")) return;
    window.Store._clearAll();
    window.Store._reseed();
    renderAll();
  });
}

// ===== Tabs =====
function bindTabs() {
  document.querySelectorAll(".admin-tabs button").forEach(b => {
    b.addEventListener("click", () => {
      document.querySelectorAll(".admin-tabs button").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      const tab = b.dataset.tab;
      document.getElementById("tab-upcoming").hidden = tab !== "upcoming";
      document.getElementById("tab-all").hidden = tab !== "all";
      document.getElementById("tab-routes").hidden = tab !== "routes";
    });
  });
  document.getElementById("all-search").addEventListener("input", () => renderAllBookings());
}

// ===== Render orchestrator =====
function renderAll() {
  renderKPIs();
  renderUpcoming();
  renderAllBookings();
  renderRoutesOverview();
}

// ===== KPIs =====
function renderKPIs() {
  const s = window.Store.stats();
  document.getElementById("k-today-deps").textContent = s.todayBookings;
  document.getElementById("k-today-pax").textContent = s.todayPax;
  document.getElementById("k-week").textContent = s.weekBookings;
  document.getElementById("k-rev").textContent = "€" + s.revenueWeek;
}

// ===== Upcoming departures table =====
function renderUpcoming() {
  const ups = window.Store.upcomingDepartures();
  const table = document.getElementById("dep-table");

  if (!ups.length) {
    table.innerHTML = `<div class="empty">Nema nadolazećih polazaka sa rezervacijama. Klikni "Nova rezervacija" za ručni unos.</div>`;
    return;
  }

  // Grupiši po datumu
  const byDate = {};
  for (const d of ups) {
    if (!byDate[d.date]) byDate[d.date] = [];
    byDate[d.date].push(d);
  }

  table.innerHTML = Object.entries(byDate).map(([date, deps]) => `
    <div class="date-group">
      <div class="date-head">${fmtDateLong(date)}</div>
      ${deps.map(d => {
        const fill = d.taken / 8;
        const cls = fill >= 1 ? "full" : fill >= .75 ? "high" : fill >= .5 ? "mid" : "low";
        return `
        <div class="dep-row ${d.closed ? 'closed' : ''}" data-route="${d.route.id}" data-date="${d.date}" data-time="${d.time}">
          <div class="dr-time">${d.time}</div>
          <div class="dr-route">
            <strong>Beograd → ${d.route.city}</strong>
            <small>${d.route.region} · ~${d.route.durationH}h</small>
          </div>
          <div class="dr-fill">
            <div class="fill-bar"><div class="fill-fg ${cls}" style="width:${fill*100}%"></div></div>
            <div class="fill-text">${d.taken}/8 · ${d.seatsLeft} slobodno</div>
          </div>
          <div class="dr-revenue">€${revenueFor(d)}</div>
          <div class="dr-status">
            ${d.closed ? '<span class="status-pill cancel">Zatvoreno</span>' : ''}
            <span class="chev">›</span>
          </div>
        </div>`;
      }).join("")}
    </div>
  `).join("");

  table.querySelectorAll(".dep-row").forEach(row => {
    row.addEventListener("click", () => {
      openManifest(row.dataset.route, row.dataset.date, row.dataset.time);
    });
  });
}

function revenueFor(d) {
  return window.Store.bookingsForDeparture(d.route.id, d.date, d.time)
    .filter(b => b.status === "confirmed")
    .reduce((s, b) => s + (b.totalPrice || 0), 0);
}

// ===== All bookings table =====
function renderAllBookings() {
  const q = (document.getElementById("all-search")?.value || "").toLowerCase().trim();
  const list = window.Store.all().filter(b => {
    if (!q) return true;
    return (b.fullname || "").toLowerCase().includes(q) ||
           (b.phone || "").toLowerCase().includes(q) ||
           (b.ref || "").toLowerCase().includes(q) ||
           (b.routeCity || "").toLowerCase().includes(q);
  });

  const table = document.getElementById("bookings-table");
  if (!list.length) {
    table.innerHTML = `<div class="empty">Nema rezervacija ${q ? "za zadati kriterijum" : "u sistemu"}.</div>`;
    return;
  }

  table.innerHTML = `
    <div class="b-row b-head">
      <div>Ref</div><div>Putnik</div><div>Linija</div><div>Polazak</div><div>Pax</div><div>Cena</div><div>Status</div>
    </div>
    ${list.map(b => `
      <div class="b-row ${b.status}">
        <div class="b-ref" data-label="Ref">${b.ref}</div>
        <div data-label="Putnik">
          <strong>${b.fullname}</strong>
          <small>${b.phone}</small>
        </div>
        <div data-label="Linija">Beograd → ${b.routeCity}</div>
        <div data-label="Polazak">${fmtDateShort(b.date)} <small>${b.time}h</small></div>
        <div data-label="Pax">${b.pax}</div>
        <div data-label="Cena">€${b.totalPrice}</div>
        <div data-label="Status">
          <span class="status-pill ${b.status === 'cancelled' ? 'cancel' : 'ok'}">
            ${b.status === 'cancelled' ? 'Otkazano' : 'Potvrđeno'}
          </span>
        </div>
      </div>
    `).join("")}
  `;
}

// ===== Routes overview =====
function renderRoutesOverview() {
  const today = new Date().toISOString().slice(0, 10);
  const weekTo = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  const routes = window.DTT.primaryRoutes().filter(r => r.country === "Hrvatska");
  const stats = routes.map(r => {
    const bs = window.Store.all().filter(b =>
      b.routeId === r.id && b.status === "confirmed" &&
      b.date >= today && b.date <= weekTo
    );
    return {
      route: r,
      bookings: bs.length,
      pax: bs.reduce((s, b) => s + (b.pax || 0), 0),
      revenue: bs.reduce((s, b) => s + (b.totalPrice || 0), 0),
    };
  }).sort((a, b) => b.revenue - a.revenue);

  document.getElementById("routes-table").innerHTML = `
    <div class="r-row r-head">
      <div>Linija</div><div>Cena (od)</div><div>Rezervacija</div><div>Putnika</div><div>Prihod (14d)</div>
    </div>
    ${stats.map(s => `
      <div class="r-row">
        <div><strong>Beograd → ${s.route.city}</strong> <small>${s.route.region}</small></div>
        <div>€${s.route.oneWay}</div>
        <div>${s.bookings}</div>
        <div>${s.pax}</div>
        <div>€${s.revenue}</div>
      </div>
    `).join("")}
  `;
}

// ===== Manifest modal =====
let currentDep = null;
function openManifest(routeId, date, time) {
  const route = window.DTT.findRoute(routeId);
  const passengers = window.Store.bookingsForDeparture(routeId, date, time);
  const confirmed = passengers.filter(p => p.status === "confirmed");
  const closed = window.Store.isClosed(routeId, date, time);
  currentDep = { routeId, date, time };

  document.getElementById("manifest-title").textContent =
    `Beograd → ${route.city} · ${time}h`;
  document.getElementById("manifest-sub").innerHTML =
    `${fmtDateLong(date)} · ${confirmed.reduce((s, p) => s + p.pax, 0)}/8 putnika · €${confirmed.reduce((s, p) => s + p.totalPrice, 0)} prihoda`;

  document.getElementById("manifest-body").innerHTML = passengers.length
    ? passengers.map(p => `
        <div class="mf-row ${p.status === 'cancelled' ? 'cancelled' : ''}">
          <div class="mf-main">
            <strong>${p.fullname}</strong>
            <span class="status-pill ${p.status === 'cancelled' ? 'cancel' : 'ok'}">
              ${p.status === 'cancelled' ? 'Otkazano' : `${p.pax} ${p.pax===1?'putnik':'putnika'}`}
            </span>
          </div>
          <div class="mf-meta">
            📞 <a href="tel:${p.phone}">${p.phone}</a>
            ${p.email ? ` · ✉ ${p.email}` : ""}
            · €${p.totalPrice} · ref ${p.ref}
          </div>
          <div class="mf-pickup">📍 <em>Pickup:</em> ${p.pickup}</div>
          <div class="mf-pickup">🏁 <em>Dolazak:</em> ${p.dropoff}</div>
          ${p.note ? `<div class="mf-note">📝 ${p.note}</div>` : ""}
          ${p.status === 'confirmed' ? `<button class="btn-cancel-sm" data-ref="${p.ref}">Otkaži ovu rezervaciju</button>` : ""}
        </div>
      `).join("")
    : `<div class="empty">Još nema putnika.</div>`;

  document.getElementById("close-departure-btn").textContent =
    closed ? "Otvori polazak" : "Zatvori polazak";

  document.getElementById("manifest-body").querySelectorAll(".btn-cancel-sm").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      if (!confirm("Otkazati ovu rezervaciju?")) return;
      window.Store.cancel(btn.dataset.ref);
      openManifest(routeId, date, time);
    });
  });

  document.getElementById("manifest-overlay").hidden = false;
}

function bindManifest() {
  const overlay = document.getElementById("manifest-overlay");
  const close = () => overlay.hidden = true;
  document.getElementById("close-manifest").addEventListener("click", close);
  overlay.addEventListener("click", e => { if (e.target.id === "manifest-overlay") close(); });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && !overlay.hidden) close();
  });

  document.getElementById("close-departure-btn").addEventListener("click", () => {
    if (!currentDep) return;
    const { routeId, date, time } = currentDep;
    if (window.Store.isClosed(routeId, date, time)) {
      window.Store.openDeparture(routeId, date, time);
    } else {
      if (!confirm("Zatvoriti ovaj polazak za dalje rezervacije?")) return;
      window.Store.closeDeparture(routeId, date, time, "admin");
    }
    openManifest(routeId, date, time);
  });
}

// ===== New booking modal =====
function bindNewBooking() {
  const overlay = document.getElementById("new-overlay");
  const open = () => {
    populateNewRoutes();
    setNewDefaults();
    refreshNewPrice();
    overlay.hidden = false;
  };
  const close = () => { overlay.hidden = true; document.getElementById("new-form").reset(); };

  document.getElementById("new-booking-btn").addEventListener("click", open);
  document.getElementById("cancel-new").addEventListener("click", close);
  overlay.addEventListener("click", e => { if (e.target.id === "new-overlay") close(); });

  ["n-route", "n-date", "n-time", "n-pax", "n-trip"].forEach(id =>
    document.getElementById(id).addEventListener("change", () => {
      if (id === "n-date") refreshNewTimes();
      refreshNewPrice();
    })
  );

  document.getElementById("new-form").addEventListener("submit", e => {
    e.preventDefault();
    const routeId = document.getElementById("n-route").value;
    const date = document.getElementById("n-date").value;
    const time = document.getElementById("n-time").value;
    const pax = parseInt(document.getElementById("n-pax").value, 10);
    const tripType = document.getElementById("n-trip").value;
    const pickup = document.getElementById("n-pickup").value.trim();
    const dropoff = document.getElementById("n-dropoff").value.trim();
    const fullname = document.getElementById("n-name").value.trim();
    const phone = document.getElementById("n-phone").value.trim();
    const note = document.getElementById("n-note").value.trim();
    if (!routeId || !date || !time || !fullname || !phone || !pickup) {
      alert("Popuni sva obavezna polja (linija, datum, polazak, ime, telefon, pickup)."); return;
    }
    if (window.DTT.seatsAvailable(routeId, date, time) < pax) {
      alert("Nema dovoljno mesta na ovom polasku."); return;
    }
    const route = window.DTT.findRoute(routeId);
    const total = (tripType === "return" ? route.return : route.oneWay) * pax;

    window.Store.create({
      routeId, routeCity: route.city,
      date, time, pax, tripType,
      totalPrice: total,
      pickup, dropoff: dropoff || (route.city + " — dogovor"),
      fullname, phone, email: "", note,
      whatsappOpt: false, source: "admin",
    });
    close();
  });
}

function populateNewRoutes() {
  const sel = document.getElementById("n-route");
  const groups = window.DTT.groupByRegion(window.DTT.primaryRoutes());
  sel.innerHTML = "";
  for (const region of Object.keys(groups)) {
    const og = document.createElement("optgroup");
    og.label = region;
    for (const r of groups[region]) {
      const opt = document.createElement("option");
      opt.value = r.id;
      opt.textContent = `${r.city} — od €${r.oneWay}`;
      og.appendChild(opt);
    }
    sel.appendChild(og);
  }
}

function setNewDefaults() {
  const d = new Date(); d.setDate(d.getDate() + 1);
  document.getElementById("n-date").value = d.toISOString().slice(0, 10);
  document.getElementById("n-date").min = new Date().toISOString().slice(0, 10);
  refreshNewTimes();
}

function refreshNewTimes() {
  const date = document.getElementById("n-date").value;
  const sel = document.getElementById("n-time");
  sel.innerHTML = "";
  if (!date) return;
  for (const t of window.DTT.getDeparturesFor(date)) {
    const opt = document.createElement("option");
    opt.value = t; opt.textContent = t + "h";
    sel.appendChild(opt);
  }
}

function refreshNewPrice() {
  const routeId = document.getElementById("n-route").value;
  const pax = parseInt(document.getElementById("n-pax").value, 10) || 1;
  const trip = document.getElementById("n-trip").value;
  if (!routeId) { document.getElementById("n-price").textContent = ""; return; }
  const r = window.DTT.findRoute(routeId);
  const total = (trip === "return" ? r.return : r.oneWay) * pax;
  const date = document.getElementById("n-date").value;
  const time = document.getElementById("n-time").value;
  const left = (date && time) ? window.DTT.seatsAvailable(routeId, date, time) : 8;
  document.getElementById("n-price").innerHTML = `
    <span>Cena: €${total} · slobodno mesta: ${left}/8</span>
  `;
}

// ===== Format helpers =====
function fmtDateLong(iso) {
  return new Date(iso + "T00:00:00").toLocaleDateString("sr-RS",
    { weekday: "long", day: "numeric", month: "long" });
}
function fmtDateShort(iso) {
  return new Date(iso + "T00:00:00").toLocaleDateString("sr-RS",
    { weekday: "short", day: "numeric", month: "short" });
}
