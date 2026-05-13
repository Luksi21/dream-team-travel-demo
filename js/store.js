// Dream Team Travel — localStorage store + seed data
// Sve rezervacije se čuvaju lokalno tako da:
//   - kapaciteti se ažuriraju u realnom vremenu
//   - admin panel vidi pravi sadržaj
//   - customer i admin tab se sinhronizuju (storage event)

const KEY_BOOKINGS = "dtt:bookings:v1";
const KEY_CLOSURES = "dtt:closures:v1"; // zatvoreni polasci
const KEY_SEEDED   = "dtt:seeded:v2";   // flag da seed nije ponovo izveden

// ===== Public API =====
const Store = {
  all,
  byRef,
  byPhone,
  create,
  cancel,
  taken,        // koliko je mesta zauzeto (sva ne-otkazana)
  isClosed,     // da li je polazak ručno zatvoren
  closeDeparture,
  openDeparture,
  stats,        // KPI-jevi za admin
  upcomingDepartures,
  bookingsForDeparture,
  onChange,     // pretplata na promene (lokalne + iz drugih tabova)
  _reseed: seedIfNeeded,
  _clearAll: clearAll, // za debug
};

// ===== Storage helpers =====
function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
  notify();
}

// ===== CRUD =====
function all() { return read(KEY_BOOKINGS, []); }
function byRef(ref) { return all().find(b => b.ref === ref); }
function byPhone(phone) {
  const norm = (s) => (s || "").replace(/\D/g, "").replace(/^00/, "").replace(/^0/, "381");
  const n = norm(phone);
  return all().filter(b => norm(b.phone).endsWith(n.slice(-8)));
}

function create(payload) {
  const list = all();
  const ref = genRef();
  const booking = {
    ref,
    status: "confirmed",
    createdAt: new Date().toISOString(),
    ...payload,
  };
  list.unshift(booking);
  write(KEY_BOOKINGS, list);
  return booking;
}

function cancel(ref) {
  const list = all();
  const b = list.find(x => x.ref === ref);
  if (!b) return false;
  b.status = "cancelled";
  b.cancelledAt = new Date().toISOString();
  write(KEY_BOOKINGS, list);
  return true;
}

function taken(routeId, dateISO, time) {
  return all().filter(b =>
    b.routeId === routeId &&
    b.date === dateISO &&
    b.time === time &&
    b.status !== "cancelled"
  ).reduce((sum, b) => sum + (b.pax || 1), 0);
}

function bookingsForDeparture(routeId, dateISO, time) {
  return all().filter(b =>
    b.routeId === routeId && b.date === dateISO && b.time === time
  ).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

// ===== Closures (ručno zatvoreni polasci) =====
function closures() { return read(KEY_CLOSURES, {}); }
function depKey(routeId, dateISO, time) { return `${routeId}|${dateISO}|${time}`; }
function isClosed(routeId, dateISO, time) {
  return !!closures()[depKey(routeId, dateISO, time)];
}
function closeDeparture(routeId, dateISO, time, reason = "") {
  const c = closures();
  c[depKey(routeId, dateISO, time)] = { closedAt: new Date().toISOString(), reason };
  write(KEY_CLOSURES, c);
}
function openDeparture(routeId, dateISO, time) {
  const c = closures();
  delete c[depKey(routeId, dateISO, time)];
  write(KEY_CLOSURES, c);
}

// ===== Stats (admin KPI) =====
function stats() {
  const list = all().filter(b => b.status === "confirmed");
  const today = new Date().toISOString().slice(0, 10);
  const weekFrom = today;
  const weekTo = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const todayDeps = list.filter(b => b.date === today);
  const weekDeps = list.filter(b => b.date >= weekFrom && b.date <= weekTo);
  const revenueWeek = weekDeps.reduce((s, b) => s + (b.totalPrice || 0), 0);
  const paxWeek = weekDeps.reduce((s, b) => s + (b.pax || 0), 0);

  return {
    todayBookings: todayDeps.length,
    todayPax: todayDeps.reduce((s, b) => s + (b.pax || 0), 0),
    weekBookings: weekDeps.length,
    weekPax: paxWeek,
    revenueWeek,
    totalBookings: list.length,
  };
}

// ===== Upcoming departures (admin overview) =====
function upcomingDepartures() {
  if (!window.DTT) return [];
  const today = new Date().toISOString().slice(0, 10);
  const out = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(); d.setDate(d.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const times = window.DTT.getDeparturesFor(iso);
    for (const time of times) {
      for (const r of window.DTT.primaryRoutes()) {
        const t = taken(r.id, iso, time);
        if (t > 0 || isClosed(r.id, iso, time)) {
          out.push({
            route: r, date: iso, time,
            taken: t,
            seatsLeft: Math.max(0, 8 - t),
            closed: isClosed(r.id, iso, time),
          });
        }
      }
    }
  }
  return out.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

// ===== Notifications =====
const listeners = new Set();
function notify() { listeners.forEach(fn => { try { fn(); } catch {} }); }
function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
window.addEventListener("storage", e => {
  if (e.key === KEY_BOOKINGS || e.key === KEY_CLOSURES) notify();
});

// ===== Ref generator =====
function genRef() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "DTT-";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

// ===== Seed data (da admin/customer odmah deluje realno) =====
const SAMPLE_NAMES = [
  "Marko Petrović", "Jelena Stojanović", "Nikola Jovanović", "Ana Nikolić",
  "Stefan Đorđević", "Milica Pavlović", "Aleksandar Ilić", "Tamara Marković",
  "Vuk Radović", "Sara Antić", "Lazar Mitrović", "Iva Kovačević",
  "Bojan Lazić", "Marija Stevanović", "Dušan Veselinović", "Katarina Vasić",
  "Filip Janković", "Tijana Popović", "Petar Simić", "Jovana Tomić",
];
const SAMPLE_PICKUPS = [
  "Knez Mihailova 22, Stari grad", "Bulevar kralja Aleksandra 73, Vračar",
  "Bulevar Mihajla Pupina 165, Novi Beograd", "Cara Dušana 41, Zemun",
  "Resavska 14, Vračar", "Gandijeva 234, Novi Beograd",
  "Bulevar oslobođenja 105, Voždovac", "Hotel Moskva — Balkanska 1",
  "Aerodrom Nikola Tesla — terminal 2", "Banovo brdo, Pere Velimirovića 24",
  "Karaburma, 27. marta 88", "Dorćol, Cetinjska 15",
];
const SAMPLE_NOTES = [
  "", "", "", // većina bez napomene
  "Dete od 5 godina — molim auto-sedište.",
  "Veliki kofer + skije.",
  "Možemo li pauzu kod Slavonskog Broda?",
  "Imam psa malenog rasta u transporteru.",
  "",
];

function rndChoice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function rndPhone() {
  const prefix = rndChoice(["60", "61", "62", "63", "64", "65"]);
  let n = "+381" + prefix + " ";
  for (let i = 0; i < 7; i++) n += Math.floor(Math.random() * 10);
  return n;
}

function seedIfNeeded() {
  if (localStorage.getItem(KEY_SEEDED) === "1") return;
  if (!window.DTT) return;

  const list = [];
  const routes = window.DTT.primaryRoutes().filter(r => r.country === "Hrvatska");
  const today = new Date();

  // Seed: ~25 rezervacija raspoređenih na narednih 14 dana
  for (let i = 0; i < 28; i++) {
    const dayOffset = Math.floor(Math.random() * 14);
    const d = new Date(today); d.setDate(d.getDate() + dayOffset);
    const dateISO = d.toISOString().slice(0, 10);
    const times = window.DTT.getDeparturesFor(dateISO);
    const time = rndChoice(times);
    const route = rndChoice(routes);
    const pax = rndChoice([1, 1, 2, 2, 2, 3, 4]); // distribucija prema realnim grupama
    const tripType = Math.random() < 0.4 ? "return" : "oneWay";
    const totalPrice = (tripType === "return" ? route.return : route.oneWay) * pax;

    // Preskoči ako bi prebacili kapacitet
    const already = list.filter(b =>
      b.routeId === route.id && b.date === dateISO && b.time === time
    ).reduce((s, b) => s + b.pax, 0);
    if (already + pax > 8) continue;

    list.push({
      ref: genRef(),
      status: "confirmed",
      createdAt: new Date(Date.now() - Math.random() * 7 * 86400000).toISOString(),
      routeId: route.id,
      routeCity: route.city,
      date: dateISO,
      time,
      pax,
      tripType,
      totalPrice,
      pickup: rndChoice(SAMPLE_PICKUPS),
      dropoff: route.city + " — hotel",
      fullname: rndChoice(SAMPLE_NAMES),
      phone: rndPhone(),
      email: "",
      note: rndChoice(SAMPLE_NOTES),
      whatsappOpt: true,
      source: "seed",
    });
  }

  // sortiraj od najnovijih
  list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  localStorage.setItem(KEY_BOOKINGS, JSON.stringify(list));
  localStorage.setItem(KEY_SEEDED, "1");
}

function clearAll() {
  localStorage.removeItem(KEY_BOOKINGS);
  localStorage.removeItem(KEY_CLOSURES);
  localStorage.removeItem(KEY_SEEDED);
  notify();
}

// Auto-seed na load (samo prvi put)
if (typeof window !== "undefined") {
  window.Store = Store;
  // pokušaj odmah; ako DTT još nije učitan, biće pokrenuto iz app.js
  seedIfNeeded();
}
