// Dream Team Travel — Admin panel (IIFE wrapped)
(function () {
  "use strict";

  const D = window.DTT;
  const S = window.Store;
  if (!D || !S) { console.error("[admin] DTT or Store not loaded."); return; }

  const SESSION_KEY = "dtt:admin:session";
  let currentDep = null;

  function $(id) { return document.getElementById(id); }

  function init() {
    try {
      S._reseed();
      bindLogin();
      if (sessionStorage.getItem(SESSION_KEY) === "1") enterApp();
      bindTabs();
      bindManifest();
      bindNewBooking();
      bindReseed();
      bindLogout();
      S.onChange(renderAll);
      console.log("[admin] inicijalizovano ✓");
    } catch (e) {
      console.error("[admin] init:", e);
      alert("Greška pri pokretanju admin panela. Pogledaj konzolu.");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // ===== Auth =====
  function bindLogin() {
    $("login-form").addEventListener("submit", e => {
      e.preventDefault();
      const v = $("admin-pass").value;
      if (v === "demo" || v === "demo123") {
        sessionStorage.setItem(SESSION_KEY, "1");
        enterApp();
      } else {
        alert("Pogrešna lozinka. Demo lozinka je: demo");
      }
    });
  }

  function enterApp() {
    $("admin-gate").hidden = true;
    $("admin-app").hidden = false;
    renderAll();
  }

  function bindLogout() {
    $("logout-btn").addEventListener("click", () => {
      sessionStorage.removeItem(SESSION_KEY);
      location.reload();
    });
  }

  function bindReseed() {
    $("reseed-btn").addEventListener("click", () => {
      if (!confirm("Obrisati sve rezervacije i vratiti demo podatke?")) return;
      S._clearAll();
      S._reseed();
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
        $("tab-upcoming").hidden = tab !== "upcoming";
        $("tab-all").hidden = tab !== "all";
        $("tab-routes").hidden = tab !== "routes";
      });
    });
    const search = $("all-search");
    if (search) search.addEventListener("input", renderAllBookings);
  }

  // ===== Orchestrator =====
  function renderAll() {
    renderKPIs();
    renderUpcoming();
    renderAllBookings();
    renderRoutesOverview();
  }

  function renderKPIs() {
    const s = S.stats();
    $("k-today-deps").textContent = s.todayBookings;
    $("k-today-pax").textContent = s.todayPax;
    $("k-week").textContent = s.weekBookings;
    $("k-rev").textContent = "€" + s.revenueWeek;
  }

  function renderUpcoming() {
    const ups = S.upcomingDepartures();
    const table = $("dep-table");
    if (!ups.length) {
      table.innerHTML = `<div class="empty">Nema nadolazećih polazaka sa rezervacijama. Klikni "Nova rezervacija" za ručni unos.</div>`;
      return;
    }
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
    return S.bookingsForDeparture(d.route.id, d.date, d.time)
      .filter(b => b.status === "confirmed")
      .reduce((s, b) => s + (b.totalPrice || 0), 0);
  }

  function renderAllBookings() {
    const q = ($("all-search")?.value || "").toLowerCase().trim();
    const list = S.all().filter(b => {
      if (!q) return true;
      return (b.fullname || "").toLowerCase().includes(q) ||
             (b.phone || "").toLowerCase().includes(q) ||
             (b.ref || "").toLowerCase().includes(q) ||
             (b.routeCity || "").toLowerCase().includes(q);
    });

    const table = $("bookings-table");
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
          <div data-label="Putnik"><strong>${b.fullname}</strong><small>${b.phone}</small></div>
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

  function renderRoutesOverview() {
    const today = new Date().toISOString().slice(0, 10);
    const weekTo = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
    const routes = D.primaryRoutes().filter(r => r.country === "Hrvatska");
    const stats = routes.map(r => {
      const bs = S.all().filter(b =>
        b.routeId === r.id && b.status === "confirmed" &&
        b.date >= today && b.date <= weekTo
      );
      return {
        route: r, bookings: bs.length,
        pax: bs.reduce((s, b) => s + (b.pax || 0), 0),
        revenue: bs.reduce((s, b) => s + (b.totalPrice || 0), 0),
      };
    }).sort((a, b) => b.revenue - a.revenue);

    $("routes-table").innerHTML = `
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

  // ===== Manifest =====
  function openManifest(routeId, date, time) {
    const route = D.findRoute(routeId);
    const passengers = S.bookingsForDeparture(routeId, date, time);
    const confirmed = passengers.filter(p => p.status === "confirmed");
    const closed = S.isClosed(routeId, date, time);
    currentDep = { routeId, date, time };

    $("manifest-title").textContent = `Beograd → ${route.city} · ${time}h`;
    $("manifest-sub").innerHTML =
      `${fmtDateLong(date)} · ${confirmed.reduce((s, p) => s + p.pax, 0)}/8 putnika · €${confirmed.reduce((s, p) => s + p.totalPrice, 0)} prihoda`;

    $("manifest-body").innerHTML = passengers.length
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

    $("close-departure-btn").textContent = closed ? "Otvori polazak" : "Zatvori polazak";

    $("manifest-body").querySelectorAll(".btn-cancel-sm").forEach(btn => {
      btn.addEventListener("click", e => {
        e.stopPropagation();
        if (!confirm("Otkazati ovu rezervaciju?")) return;
        S.cancel(btn.dataset.ref);
        openManifest(routeId, date, time);
      });
    });

    $("manifest-overlay").hidden = false;
  }

  function bindManifest() {
    const overlay = $("manifest-overlay");
    const close = () => overlay.hidden = true;
    $("close-manifest").addEventListener("click", close);
    overlay.addEventListener("click", e => { if (e.target.id === "manifest-overlay") close(); });
    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && !overlay.hidden) close();
    });

    $("close-departure-btn").addEventListener("click", () => {
      if (!currentDep) return;
      const { routeId, date, time } = currentDep;
      if (S.isClosed(routeId, date, time)) {
        S.openDeparture(routeId, date, time);
      } else {
        if (!confirm("Zatvoriti ovaj polazak za dalje rezervacije?")) return;
        S.closeDeparture(routeId, date, time, "admin");
      }
      openManifest(routeId, date, time);
    });
  }

  // ===== New booking =====
  function bindNewBooking() {
    const overlay = $("new-overlay");
    const open = () => { populateNewRoutes(); setNewDefaults(); refreshNewPrice(); overlay.hidden = false; };
    const close = () => { overlay.hidden = true; $("new-form").reset(); };

    $("new-booking-btn").addEventListener("click", open);
    $("cancel-new").addEventListener("click", close);
    overlay.addEventListener("click", e => { if (e.target.id === "new-overlay") close(); });

    ["n-route", "n-date", "n-time", "n-pax", "n-trip"].forEach(id =>
      $(id).addEventListener("change", () => {
        if (id === "n-date") refreshNewTimes();
        refreshNewPrice();
      })
    );

    $("new-form").addEventListener("submit", e => {
      e.preventDefault();
      const routeId = $("n-route").value;
      const date = $("n-date").value;
      const time = $("n-time").value;
      const pax = parseInt($("n-pax").value, 10);
      const tripType = $("n-trip").value;
      const pickup = $("n-pickup").value.trim();
      const dropoff = $("n-dropoff").value.trim();
      const fullname = $("n-name").value.trim();
      const phone = $("n-phone").value.trim();
      const note = $("n-note").value.trim();
      if (!routeId || !date || !time || !fullname || !phone || !pickup) {
        alert("Popuni sva obavezna polja."); return;
      }
      if (D.seatsAvailable(routeId, date, time) < pax) {
        alert("Nema dovoljno mesta na ovom polasku."); return;
      }
      const route = D.findRoute(routeId);
      const total = (tripType === "return" ? route.return : route.oneWay) * pax;
      S.create({
        routeId, routeCity: route.city,
        date, time, pax, tripType, totalPrice: total,
        pickup, dropoff: dropoff || (route.city + " — dogovor"),
        fullname, phone, email: "", note,
        whatsappOpt: false, source: "admin",
      });
      close();
    });
  }

  function populateNewRoutes() {
    const sel = $("n-route");
    const groups = D.groupByRegion(D.primaryRoutes());
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
    $("n-date").value = d.toISOString().slice(0, 10);
    $("n-date").min = new Date().toISOString().slice(0, 10);
    refreshNewTimes();
  }

  function refreshNewTimes() {
    const date = $("n-date").value;
    const sel = $("n-time");
    sel.innerHTML = "";
    if (!date) return;
    for (const t of D.getDeparturesFor(date)) {
      const opt = document.createElement("option");
      opt.value = t; opt.textContent = t + "h";
      sel.appendChild(opt);
    }
  }

  function refreshNewPrice() {
    const routeId = $("n-route").value;
    const pax = parseInt($("n-pax").value, 10) || 1;
    const trip = $("n-trip").value;
    if (!routeId) { $("n-price").textContent = ""; return; }
    const r = D.findRoute(routeId);
    const total = (trip === "return" ? r.return : r.oneWay) * pax;
    const date = $("n-date").value;
    const time = $("n-time").value;
    const left = (date && time) ? D.seatsAvailable(routeId, date, time) : 8;
    $("n-price").innerHTML = `<span>Cena: €${total} · slobodno mesta: ${left}/8</span>`;
  }

  function fmtDateLong(iso) {
    return new Date(iso + "T00:00:00").toLocaleDateString("sr-RS",
      { weekday: "long", day: "numeric", month: "long" });
  }
  function fmtDateShort(iso) {
    return new Date(iso + "T00:00:00").toLocaleDateString("sr-RS",
      { weekday: "short", day: "numeric", month: "short" });
  }
})();
