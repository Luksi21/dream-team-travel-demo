// Dream Team Travel - podaci o linijama, cenama i terminima
// Bazirano na zvaničnom cenovniku sa dreamteamtravel.rs

const COMPANY = {
  name: "Dream Team Travel",
  tagline: "Kombi prevoz putnika — od vrata do vrata",
  phone: "+381604264265",
  phoneDisplay: "+381 60 426 4265",
  phoneAlt: "+381634263430",
  phoneAltDisplay: "+381 63 426 343",
  email: "office@dreamteamtravel.rs",
  whatsapp: "381604264265",
  viber: "381604264265",
  instagram: "https://www.instagram.com/dream.teamtravel/",
  facebook: "https://www.facebook.com/Dream.Team.Travel.Kombi.Prevoz/",
  rating: 4.9,
  reviews: 197,
  passengers: "1000+",
  years: "10+",
  maxSeatsPerVehicle: 8,
};

// Hrvatska je primarni fokus aplikacije.
// Ostale zemlje uključene da kombi može da pokrije ceo cenovnik.
const ROUTES = [
  // Hrvatska — primarni fokus
  { id: "zagreb",    country: "Hrvatska",  city: "Zagreb",    region: "Centralna Hrvatska", oneWay: 60, return: 110, durationH: 6,  primary: true },
  { id: "karlovac",  country: "Hrvatska",  city: "Karlovac",  region: "Centralna Hrvatska", oneWay: 70, return: 130, durationH: 6.5,primary: true },
  { id: "rijeka",    country: "Hrvatska",  city: "Rijeka",    region: "Kvarner",            oneWay: 75, return: 140, durationH: 8,  primary: true },
  { id: "opatija",   country: "Hrvatska",  city: "Opatija",   region: "Kvarner",            oneWay: 75, return: 140, durationH: 8,  primary: true },
  { id: "pula",      country: "Hrvatska",  city: "Pula",      region: "Istra",              oneWay: 85, return: 160, durationH: 8.5,primary: true },
  { id: "rovinj",    country: "Hrvatska",  city: "Rovinj",    region: "Istra",              oneWay: 85, return: 160, durationH: 8.5,primary: true },
  { id: "porec",     country: "Hrvatska",  city: "Poreč",     region: "Istra",              oneWay: 85, return: 160, durationH: 9,  primary: true },
  { id: "umag",      country: "Hrvatska",  city: "Umag",      region: "Istra",              oneWay: 85, return: 160, durationH: 9,  primary: true },
  { id: "novigrad",  country: "Hrvatska",  city: "Novigrad",  region: "Istra",              oneWay: 85, return: 160, durationH: 9,  primary: true },
  { id: "vrsar",     country: "Hrvatska",  city: "Vrsar",     region: "Istra",              oneWay: 85, return: 160, durationH: 9,  primary: true },
  { id: "medulin",   country: "Hrvatska",  city: "Medulin",   region: "Istra",              oneWay: 85, return: 160, durationH: 9,  primary: true },
  { id: "split",     country: "Hrvatska",  city: "Split",     region: "Dalmacija",          oneWay: 90, return: 170, durationH: 10, primary: true },
  { id: "zadar",     country: "Hrvatska",  city: "Zadar",     region: "Dalmacija",          oneWay: 90, return: 170, durationH: 9,  primary: true },
  // Druge zemlje (kompletnosti radi)
  { id: "ljubljana", country: "Slovenija", city: "Ljubljana", region: "Slovenija",          oneWay: 70, return: 130, durationH: 7 },
  { id: "maribor",   country: "Slovenija", city: "Maribor",   region: "Slovenija",          oneWay: 70, return: 130, durationH: 6 },
  { id: "bled",      country: "Slovenija", city: "Bled",      region: "Slovenija",          oneWay: 70, return: 130, durationH: 7.5},
  { id: "trst",      country: "Italija",   city: "Trst",      region: "Italija",            oneWay: 85, return: 160, durationH: 8 },
  { id: "venecija",  country: "Italija",   city: "Venecija",  region: "Italija",            oneWay: 85, return: 160, durationH: 10 },
  { id: "skoplje",   country: "S. Makedonija", city: "Skoplje", region: "S. Makedonija",    oneWay: 50, return: 100, durationH: 5 },
  { id: "ohrid",     country: "S. Makedonija", city: "Ohrid",   region: "S. Makedonija",    oneWay: 65, return: 120, durationH: 7 },
  { id: "sarajevo",  country: "BiH",       city: "Sarajevo",  region: "BiH",                oneWay: 40, return: 75,  durationH: 6 },
  { id: "kopaonik",  country: "Srbija",    city: "Kopaonik",  region: "Srbija",             oneWay: 30, return: 50,  durationH: 4 },
];

// Tipičan polazak na hrvatske linije je 23:00 (preko noći).
// Za Istru i Dalmaciju dodajemo i jutarnji polazak vikendom.
const DEPARTURE_TIMES = {
  default: ["23:00"],
  weekend: ["07:00", "23:00"],
};

// Slobodna mesta = MAX (8) − zauzeta (iz Store-a) − zatvoreno ručno (admin)
function seatsAvailable(routeId, dateISO, time) {
  if (!window.Store) return COMPANY.maxSeatsPerVehicle; // fallback
  if (window.Store.isClosed(routeId, dateISO, time)) return 0;
  return Math.max(0, COMPANY.maxSeatsPerVehicle - window.Store.taken(routeId, dateISO, time));
}

function getDeparturesFor(dateISO) {
  const day = new Date(dateISO + "T00:00:00").getDay(); // 0=Sun,6=Sat
  const isWeekend = day === 0 || day === 5 || day === 6; // pet/sub/ned
  return isWeekend ? DEPARTURE_TIMES.weekend : DEPARTURE_TIMES.default;
}

function findRoute(id) {
  return ROUTES.find(r => r.id === id);
}

function primaryRoutes() {
  return ROUTES.filter(r => r.primary);
}

function groupByRegion(routes) {
  const groups = {};
  for (const r of routes) {
    if (!groups[r.region]) groups[r.region] = [];
    groups[r.region].push(r);
  }
  return groups;
}

window.DTT = {
  COMPANY, ROUTES,
  seatsAvailable, getDeparturesFor, findRoute, primaryRoutes, groupByRegion,
};
