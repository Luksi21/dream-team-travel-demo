// Dream Team Travel — Customer booking flow (IIFE wrapped)
(function () {
  "use strict";

  const D = window.DTT;
  const S = window.Store;

  if (!D || !S) {
    console.error("[app.js] DTT or Store not loaded.");
    return;
  }

  const state = {
    routeId: null, date: null, pax: 1, tripType: "oneWay",
    time: null, pickup: "", dropoff: "",
    fullname: "", phone: "", email: "", note: "",
    whatsappOpt: true, _step: 1,
  };

  // ===== Helpers =====
  const fmtEur = n => "€" + n;
  function fmtDateLong(iso) {
    return new Date(iso + "T00:00:00").toLocaleDateString("sr-RS",
      { weekday: "short", day: "numeric", month: "long" });
  }
  function fmtDateShort(iso) {
    return new Date(iso + "T00:00:00").toLocaleDateString("sr-RS",
      { weekday: "short", day: "numeric", month: "short" });
  }
  function flagFor(country) {
    return ({ "Hrvatska":"🇭🇷","Slovenija":"🇸🇮","Italija":"🇮🇹",
      "S. Makedonija":"🇲🇰","BiH":"🇧🇦","Srbija":"🇷🇸" })[country] || "🌍";
  }
  // Pomera dispatch da možemo wrap-ovati u try/catch
  function $(id) { return document.getElementById(id); }
  function on(id, event, handler) {
    const el = $(id);
    if (!el) { console.warn(`[app] #${id} ne postoji`); return; }
    el.addEventListener(event, (...args) => {
      try { handler(...args); }
      catch (e) { console.error(`[app] handler ${id}:${event}`, e); alert("Greška: " + e.message); }
    });
  }

  // ===== Init =====
  function init() {
    try {
      S._reseed();
      populateRouteSelect();
      setDefaultDate();
      renderRouteGrid();
      renderTestimonials();
      renderActivityTicker();
      bindSearch();
      bindFlowControls();
      bindStep2();
      bindStep3();
      bindLookup();

      S.onChange(() => {
        if (!$("flow").hidden && state._step === 1) renderStep1();
        renderActivityTicker();
      });
      console.log("[app] inicijalizovano ✓");
    } catch (e) {
      console.error("[app] init crash:", e);
      alert("Greška pri pokretanju aplikacije. Pogledaj konzolu.");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // ===== Search form =====
  function populateRouteSelect() {
    const sel = $("route");
    if (!sel) return;
    const groups = D.groupByRegion(D.primaryRoutes());
    sel.innerHTML = "";
    const ph = document.createElement("option");
    ph.value = ""; ph.disabled = true; ph.selected = true;
    ph.textContent = "Odaberi grad...";
    sel.appendChild(ph);
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
    const dt = $("date");
    if (!dt) return;
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    dt.min = new Date().toISOString().slice(0, 10);
    dt.value = tomorrow.toISOString().slice(0, 10);
  }

  function bindSearch() {
    const form = $("search-form");
    if (!form) return;
    form.addEventListener("submit", e => {
      e.preventDefault();
      try {
        const routeId = $("route").value;
        const date = $("date").value;
        const pax = parseInt($("pax").value, 10) || 1;
        const tripType = form.tripType.value;
        if (!routeId) { alert("Molim te izaberi destinaciju."); return; }
        if (!date) { alert("Molim te izaberi datum."); return; }
        Object.assign(state, { routeId, date, pax, tripType });
        openFlow();
      } catch (e) { console.error("[app] submit:", e); }
    });
  }

  // ===== Marketing route grid =====
  function renderRouteGrid() {
    const grid = $("route-grid");
    if (!grid) return;
    const featured = D.primaryRoutes().slice(0, 6);
    grid.innerHTML = featured.map(r => `
      <button class="route-card-rich" type="button" data-id="${r.id}">
        <div class="rcr-img" data-city="${r.id}">
          <span class="rcr-flag">${flagFor(r.country)}</span>
          <span class="rcr-badge">${r.durationH}h vožnje</span>
        </div>
        <div class="rcr-body">
          <h3>${r.city}</h3>
          <p class="rcr-region">${r.region}</p>
          ${r.blurb ? `<p class="rcr-blurb">${r.blurb}</p>` : ""}
          <div class="rcr-foot">
            <div><span class="rcr-price">${fmtEur(r.oneWay)}</span><small> / osobi</small></div>
            <span class="rcr-cta">Rezerviši →</span>
          </div>
        </div>
      </button>
    `).join("");
    grid.querySelectorAll(".route-card-rich").forEach(card => {
      card.addEventListener("click", () => {
        $("route").value = card.dataset.id;
        $("booking").scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  // ===== Testimonials =====
  const TESTIMONIALS = [
    { name: "Stefan M.", date: "pre 2 nedelje", stars: 5, text: "Vozač Marko nas je preuzeo tačno na vreme sa Vračara i odvezao do hotela u Rovinju. Kombi je nov, čist, ima i WiFi. Sve je teklo glatko i bez stresa. Preporuka!" },
    { name: "Jelena P.",  date: "pre mesec dana", stars: 5, text: "Drugi put putujemo sa Dream Team-om za Istru. Cene su poštene, plaćanje kod vozača, deca su imala auto-sedište bez problema. Najbolji izbor za relaciju Beograd-Pula." },
    { name: "Nikola Đ.",  date: "pre 3 nedelje", stars: 5, text: "Rezervisali smo dan pre puta — bez problema. Stigli smo do Splita u 7 ujutru, taman za check-in. Vozač je profesionalan, ljubazan." },
    { name: "Marija S.",  date: "pre 2 meseca", stars: 5, text: "Najjeftinija opcija za Zagreb, brza i pouzdana. Bus traje 10h, ovde smo bili tu za 6. Kombi je udoban, sedišta sa naslonom za glavu." },
    { name: "Aleksandar V.", date: "pre 6 dana", stars: 5, text: "Stigli smo iz Beograda u Opatiju za 7 i po sati uz jednu pauzu. Sve top, ne menjam za autobus." },
    { name: "Tamara R.",  date: "pre nedelju dana", stars: 5, text: "Brzo i ljubazno potvrđeno preko WhatsApp-a. Vozač je zvao 30 min ranije. Sigurna preporuka." },
  ];

  function renderTestimonials() {
    const wrap = $("testimonials");
    if (!wrap) return;
    wrap.innerHTML = TESTIMONIALS.map(t => `
      <article class="testimonial">
        <div class="t-stars">${"★".repeat(t.stars)}</div>
        <p class="t-text">"${t.text}"</p>
        <div class="t-meta">
          <span class="t-avatar">${t.name.split(" ").map(w => w[0]).join("")}</span>
          <div>
            <strong>${t.name}</strong>
            <small>${t.date} · Google recenzija</small>
          </div>
        </div>
      </article>
    `).join("");
  }

  // ===== Live activity ticker =====
  function renderActivityTicker() {
    const t = $("activity-ticker");
    if (!t) return;
    const recent = S.all()
      .filter(b => b.status === "confirmed")
      .slice(0, 8);
    if (!recent.length) {
      t.innerHTML = `<span>🟢 Sistem aktivan · prijavi se i rezerviši</span>`;
      return;
    }
    const items = recent.map(b => {
      const parts = (b.fullname || "Putnik").split(" ");
      const display = parts[0] + (parts[1] ? " " + parts[1][0] + "." : "");
      return `<span class="tk-item">🟢 <strong>${display}</strong> rezerv. <em>${b.routeCity}</em></span>`;
    });
    // dupliciramo da animacija deluje beskonačno
    t.innerHTML = items.join(" · ") + " · " + items.join(" · ");
  }

  // ===== Flow =====
  function openFlow() {
    $("flow").hidden = false;
    $("flow").scrollIntoView({ behavior: "smooth", block: "start" });
    goToStep(1);
    renderStep1();
    renderFlowSummary();
  }

  function goToStep(n) {
    for (let i = 1; i <= 3; i++) {
      const stepEl = $(`step-${i}`);
      if (stepEl) stepEl.hidden = i !== n;
      const dot = document.querySelector(`.flow-progress .step[data-step="${i}"]`);
      if (dot) {
        dot.classList.toggle("active", i === n);
        dot.classList.toggle("done", i < n);
      }
    }
    state._step = n;
  }

  function bindFlowControls() {
    on("flow-back", "click", () => {
      if (state._step > 1) {
        goToStep(state._step - 1);
        if (state._step === 1) renderStep1();
      } else {
        $("flow").hidden = true;
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  }

  function renderFlowSummary() {
    const r = D.findRoute(state.routeId);
    if (!r) return;
    const tt = state.tripType === "return" ? "povratak" : "u jednom pravcu";
    $("flow-summary").innerHTML = `
      <strong>Beograd → ${r.city}</strong>
      ${state.pax} ${state.pax === 1 ? "putnik" : "putnika"} · ${tt}
    `;
  }

  // ===== STEP 1 =====
  function renderStep1() {
    const route = D.findRoute(state.routeId);
    if (!route) return;

    // 7-dnevni kalendar — "enough" računa max u jednom polasku (a ne sumu)
    const cal = $("week-calendar");
    cal.innerHTML = "";
    for (let i = 0; i < 7; i++) {
      const d = new Date(); d.setDate(d.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      const times = D.getDeparturesFor(iso);
      const maxFreeInOne = Math.max(...times.map(t => D.seatsAvailable(state.routeId, iso, t)));
      const enough = maxFreeInOne >= state.pax;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cal-day" + (iso === state.date ? " active" : "") + (!enough ? " full" : "");
      btn.innerHTML = `
        <span class="cal-dow">${d.toLocaleDateString("sr-RS", { weekday: "short" }).replace(".", "")}</span>
        <span class="cal-day-num">${d.getDate()}</span>
        <span class="cal-seats">${enough ? maxFreeInOne + " slob." : "puno"}</span>
      `;
      btn.addEventListener("click", () => {
        state.date = iso;
        renderStep1();
      });
      cal.appendChild(btn);
    }

    // Lista polazaka
    const list = $("departure-list");
    const times = D.getDeparturesFor(state.date);
    list.innerHTML = "";

    for (const time of times) {
      const seats = D.seatsAvailable(state.routeId, state.date, time);
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
        const dc = $("dropoff-city");
        if (dc) dc.textContent = `u ${route.city}`;
        goToStep(2);
      });
      list.appendChild(btn);
    }

    const anyOK = times.some(t => D.seatsAvailable(state.routeId, state.date, t) >= state.pax);
    if (!anyOK) {
      const banner = document.createElement("div");
      banner.className = "empty-banner";
      banner.innerHTML = `Za ${state.pax} putnika nema dovoljno mesta na ovom datumu. Probaj drugi dan ili nas pozovi — često imamo dodatni kombi za grupe.`;
      list.appendChild(banner);
    }

    $("step-1-date").textContent = fmtDateLong(state.date);
  }

  // ===== STEP 2 =====
  function bindStep2() {
    on("to-step-3", "click", () => {
      const pickup = $("pickup").value.trim();
      const dropoff = $("dropoff").value.trim();
      const fullname = $("fullname").value.trim();
      const phone = $("phone").value.trim();
      const email = $("email").value.trim();
      const note = $("note").value.trim();
      const whatsappOpt = $("whatsapp-opt").checked;

      if (!pickup) { alert("Unesi pickup adresu u Beogradu."); $("pickup").focus(); return; }
      if (!dropoff) { alert("Unesi adresu/hotel dolaska."); $("dropoff").focus(); return; }
      if (!fullname || fullname.length < 3) { alert("Unesi ime i prezime."); $("fullname").focus(); return; }
      if (!phone || phone.length < 6) { alert("Unesi telefon — vozač te zove pre polaska."); $("phone").focus(); return; }

      Object.assign(state, { pickup, dropoff, fullname, phone, email, note, whatsappOpt });
      renderStep3();
      goToStep(3);
    });
  }

  // ===== STEP 3 =====
  function renderStep3() {
    const r = D.findRoute(state.routeId);
    const price = state.tripType === "return" ? r.return : r.oneWay;
    const total = price * state.pax;

    $("review-card").innerHTML = `
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

    $("price-per").textContent = fmtEur(price);
    $("price-pax").textContent = `× ${state.pax}`;
    $("price-total").textContent = fmtEur(total);
  }

  function bindStep3() {
    on("confirm", "click", () => {
      if (!$("terms").checked) {
        alert("Molim te prihvati uslove prevoza.");
        return;
      }

      const seats = D.seatsAvailable(state.routeId, state.date, state.time);
      if (seats < state.pax) {
        alert("Žao nam je — neko je rezervisao mesta u međuvremenu. Vraćamo te na izbor polaska.");
        goToStep(1); renderStep1();
        return;
      }

      const r = D.findRoute(state.routeId);
      const price = state.tripType === "return" ? r.return : r.oneWay;
      const total = price * state.pax;

      const booking = S.create({
        routeId: r.id, routeCity: r.city,
        date: state.date, time: state.time,
        pax: state.pax, tripType: state.tripType, totalPrice: total,
        pickup: state.pickup, dropoff: state.dropoff,
        fullname: state.fullname, phone: state.phone,
        email: state.email, note: state.note,
        whatsappOpt: state.whatsappOpt, source: "web",
      });

      showConfirmation(booking);
    });

    const closeModal = () => {
      $("confirm-overlay").hidden = true;
      $("flow").hidden = true;
      $("search-form").reset();
      setDefaultDate();
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    on("close-confirm", "click", closeModal);
    $("confirm-overlay").addEventListener("click", e => {
      if (e.target.id === "confirm-overlay") closeModal();
    });
    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && !$("confirm-overlay").hidden) closeModal();
    });
  }

  function showConfirmation(booking) {
    $("confirm-code").textContent = booking.ref;

    const msg = encodeURIComponent(
`Zdravo Dream Team Travel!
Imam rezervaciju ${booking.ref}.

Linija: Beograd → ${booking.routeCity}
Datum: ${fmtDateLong(booking.date)}
Polazak: ${booking.time}h
Putnika: ${booking.pax}
Pickup: ${booking.pickup}
Dolazak: ${booking.dropoff}
Ime: ${booking.fullname}
Telefon: ${booking.phone}
Ukupno: ${fmtEur(booking.totalPrice)} (plaćanje kod vozača)

${booking.note ? "Napomena: " + booking.note : ""}`);

    $("whatsapp-link").href = `https://wa.me/${D.COMPANY.whatsapp}?text=${msg}`;
    $("confirm-overlay").hidden = false;
  }

  // ===== Lookup =====
  function bindLookup() {
    const overlay = $("lookup-overlay");
    if (!overlay) return;
    const closeBtn = $("close-lookup");
    const form = $("lookup-form");
    const results = $("lookup-results");

    const open = () => { overlay.hidden = false; $("lookup-phone").focus(); };
    const close = () => { overlay.hidden = true; results.innerHTML = ""; form.reset(); };

    const openBtn = $("open-lookup");
    if (openBtn) openBtn.addEventListener("click", e => { e.preventDefault(); open(); });
    const footBtn = $("open-lookup-foot");
    if (footBtn) footBtn.addEventListener("click", e => { e.preventDefault(); open(); });

    closeBtn.addEventListener("click", close);
    overlay.addEventListener("click", e => { if (e.target.id === "lookup-overlay") close(); });
    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && !overlay.hidden) close();
    });

    form.addEventListener("submit", e => {
      e.preventDefault();
      const phone = $("lookup-phone").value.trim();
      if (!phone) return;
      renderLookupResults(S.byPhone(phone));
    });

    function renderLookupResults(list) {
      if (!list.length) {
        results.innerHTML = `<div class="lookup-empty">Nema rezervacija za ovaj broj. <br><small>Pomoć: probaj uneti samo poslednjih 8 cifara.</small></div>`;
        return;
      }
      results.innerHTML = list.map(b => {
        const cancelled = b.status === "cancelled";
        const past = b.date < new Date().toISOString().slice(0, 10);
        const within24h = (new Date(b.date + "T" + b.time + ":00") - new Date()) < 24 * 3600 * 1000;
        const canCancel = !cancelled && !past && !within24h;
        return `
          <div class="lookup-item ${cancelled ? 'cancelled' : ''}">
            <div class="li-head">
              <strong>Beograd → ${b.routeCity}</strong>
              <span class="status-pill ${cancelled ? 'cancel' : past ? 'done' : 'ok'}">
                ${cancelled ? 'Otkazano' : past ? 'Završeno' : 'Aktivno'}
              </span>
            </div>
            <div class="li-meta">${fmtDateShort(b.date)} · ${b.time}h · ${b.pax} ${b.pax===1?'putnik':'putnika'} · ${fmtEur(b.totalPrice)}</div>
            <div class="li-ref">Ref: <strong>${b.ref}</strong></div>
            ${canCancel ? `<button class="btn-cancel" data-ref="${b.ref}">Otkaži rezervaciju</button>` : ""}
          </div>
        `;
      }).join("");

      results.querySelectorAll(".btn-cancel").forEach(btn => {
        btn.addEventListener("click", () => {
          if (!confirm("Sigurno otkazujete rezervaciju?")) return;
          S.cancel(btn.dataset.ref);
          const phone = $("lookup-phone").value.trim();
          renderLookupResults(S.byPhone(phone));
        });
      });
    }
  }
})();
