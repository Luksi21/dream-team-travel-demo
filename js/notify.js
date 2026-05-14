// Dream Team Travel — Notification module (Email + Telegram)
// DEMO MODE: simulira slanje, gradi prave šablone i loguje sve.
// Kada se postavi pravi Cloudflare Worker, samo flipni MOCK = false
// i podesi ENDPOINT — frontend kod se ne menja.

(function () {
  "use strict";

  // ===== Konfiguracija =====
  const MOCK = true; // ← true: demo mode (preview); false: poziva pravi backend
  const ENDPOINT = "https://dtt-notify.workers.dev/send"; // Cloudflare Worker URL (kasnije)

  // Sender (Petar — demo testing)
  const SENDER = {
    name: "Petar Pejić",
    email: "pejicpetar21@gmail.com",
    replyTo: "office@dreamteamtravel.rs",
  };

  // Telegram (demo admin chat)
  const TELEGRAM_ADMIN = {
    chatLabel: "@DreamTeamTravelAdmin",
    botName: "DTT Notify Bot",
  };

  const KEY_LOG = "dtt:notifications:v1";

  // ===== Public API =====
  window.Notify = {
    sendBookingConfirmation,
    sendTestNotification,
    log: readLog,
    clearLog,
    SENDER, TELEGRAM_ADMIN,
  };

  // ===== Notification log (localStorage) =====
  function readLog() {
    try { return JSON.parse(localStorage.getItem(KEY_LOG) || "[]"); }
    catch { return []; }
  }
  function appendLog(entry) {
    const log = readLog();
    log.unshift({ ...entry, id: Date.now() + Math.random().toString(36).slice(2, 7) });
    // Drži poslednjih 50
    localStorage.setItem(KEY_LOG, JSON.stringify(log.slice(0, 50)));
  }
  function clearLog() {
    localStorage.removeItem(KEY_LOG);
  }

  // ===== Glavni API: pošalji potvrdu rezervacije =====
  async function sendBookingConfirmation(booking) {
    const emailContent = buildEmailContent(booking);
    const telegramContent = buildTelegramMessage(booking);
    const recipient = booking.email;

    // U demo modu — pravimo veštačko kašnjenje da deluje kao pravi poziv
    if (MOCK) {
      await sleep(700 + Math.random() * 800); // 0.7-1.5s
    }

    const result = {
      email: { ok: !!recipient, recipient, content: emailContent, error: null },
      telegram: { ok: true, recipient: TELEGRAM_ADMIN.chatLabel, content: telegramContent, error: null },
      timestamp: new Date().toISOString(),
      mock: MOCK,
    };

    if (!recipient) {
      result.email.ok = false;
      result.email.error = "Nedostaje email adresa";
    }

    // Loguj u istoriju (admin vidi)
    appendLog({
      kind: "booking_confirmation",
      bookingRef: booking.ref,
      bookingCity: booking.routeCity,
      email: { ...result.email, html: emailContent.html, text: emailContent.text, subject: emailContent.subject },
      telegram: { ...result.telegram, text: telegramContent },
      timestamp: result.timestamp,
      mock: MOCK,
    });

    // Pravi mode — pozovi backend
    if (!MOCK) {
      try {
        const res = await fetch(ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: recipient ? {
              to: recipient,
              subject: emailContent.subject,
              html: emailContent.html,
              text: emailContent.text,
            } : null,
            telegram: { text: telegramContent },
            metadata: { bookingRef: booking.ref },
          }),
        });
        if (!res.ok) throw new Error(`Backend ${res.status}`);
        const data = await res.json();
        result.email.ok = data.email?.ok ?? result.email.ok;
        result.telegram.ok = data.telegram?.ok ?? result.telegram.ok;
      } catch (e) {
        console.error("[Notify] backend call failed:", e);
        result.email.ok = false;
        result.email.error = "Backend nije dostupan";
        result.telegram.ok = false;
        result.telegram.error = "Backend nije dostupan";
      }
    }

    return result;
  }

  // ===== Test notification (za admin "Pošalji test" dugme) =====
  async function sendTestNotification() {
    const sample = {
      ref: "DTT-TEST" + Math.floor(Math.random() * 99),
      routeCity: "Pula",
      date: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
      time: "23:00",
      pax: 2,
      tripType: "return",
      totalPrice: 160,
      pickup: "Bulevar kralja Aleksandra 73, Vračar",
      dropoff: "Hotel Park Plaza, Pula",
      fullname: "Petar Pejić (test)",
      phone: "+381 60 426 4265",
      email: SENDER.email,
      note: "Ovo je test obaveštenje iz admin panela.",
    };
    return sendBookingConfirmation(sample);
  }

  // ===== Email template =====
  function buildEmailContent(booking) {
    const subject = `✓ Potvrda rezervacije ${booking.ref} · Beograd → ${booking.routeCity}`;
    const niceDate = fmtDateLong(booking.date);
    const tripLabel = booking.tripType === "return" ? "Povratna karta" : "U jednom pravcu";

    const html = `<!DOCTYPE html>
<html lang="sr">
<head><meta charset="UTF-8"><title>${subject}</title></head>
<body style="margin:0;padding:0;font-family:'Plus Jakarta Sans',Arial,sans-serif;background:#f3f7fa;color:#0a2540;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f7fa;padding:30px 12px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 14px rgba(10,37,64,.08);">
        <!-- header -->
        <tr><td style="background:linear-gradient(135deg,#0a2540,#134e72);padding:32px 28px;color:#fff;">
          <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#f5b740;font-weight:700;">Dream Team Travel</div>
          <h1 style="margin:8px 0 0;font-size:26px;font-weight:800;letter-spacing:-.01em;">Hvala na rezervaciji!</h1>
          <p style="margin:6px 0 0;color:rgba(255,255,255,.75);font-size:14px;">Tvoja rezervacija je potvrđena.</p>
        </td></tr>

        <!-- ref code -->
        <tr><td style="padding:24px 28px 0;">
          <div style="background:#fbf5e9;border:1.5px dashed #f5b740;border-radius:12px;padding:16px;text-align:center;">
            <div style="font-size:12px;color:#4a708c;font-weight:600;text-transform:uppercase;letter-spacing:.06em;">Broj rezervacije</div>
            <div style="font-size:24px;font-weight:800;color:#0a2540;letter-spacing:.12em;font-family:'SF Mono',monospace;margin-top:4px;">${booking.ref}</div>
          </div>
        </td></tr>

        <!-- details -->
        <tr><td style="padding:24px 28px;">
          <h2 style="margin:0 0 14px;font-size:18px;font-weight:700;">Detalji puta</h2>
          <table width="100%" cellpadding="8" cellspacing="0" style="font-size:14px;">
            <tr><td style="color:#4a708c;width:120px;">Linija</td><td style="color:#0a2540;font-weight:600;">🇷🇸 Beograd → 🇭🇷 ${booking.routeCity}</td></tr>
            <tr><td style="color:#4a708c;">Datum</td><td style="color:#0a2540;font-weight:600;">${niceDate}</td></tr>
            <tr><td style="color:#4a708c;">Polazak</td><td style="color:#0a2540;font-weight:600;">${booking.time}h ${booking.time === "23:00" ? "(noćni)" : "(jutarnji)"}</td></tr>
            <tr><td style="color:#4a708c;">Tip puta</td><td style="color:#0a2540;font-weight:600;">${tripLabel}</td></tr>
            <tr><td style="color:#4a708c;">Putnika</td><td style="color:#0a2540;font-weight:600;">${booking.pax}</td></tr>
            <tr><td style="color:#4a708c;">Pickup</td><td style="color:#0a2540;font-weight:600;">📍 ${booking.pickup}</td></tr>
            <tr><td style="color:#4a708c;">Dolazak</td><td style="color:#0a2540;font-weight:600;">🏁 ${booking.dropoff}</td></tr>
            ${booking.note ? `<tr><td style="color:#4a708c;vertical-align:top;">Napomena</td><td style="color:#0a2540;font-style:italic;">"${booking.note}"</td></tr>` : ""}
          </table>
        </td></tr>

        <!-- price -->
        <tr><td style="padding:0 28px 24px;">
          <div style="background:#0a2540;border-radius:12px;padding:18px;color:#fff;display:flex;justify-content:space-between;align-items:center;">
            <span style="color:rgba(255,255,255,.7);font-size:14px;">Ukupno za plaćanje</span>
            <span style="color:#f5b740;font-size:24px;font-weight:800;">€${booking.totalPrice}</span>
          </div>
          <p style="margin:8px 0 0;color:#4a708c;font-size:12px;text-align:center;">💵 Plaćanje kod vozača · gotovina EUR ili dinari po srednjem kursu</p>
        </td></tr>

        <!-- next steps -->
        <tr><td style="padding:0 28px 24px;">
          <h3 style="margin:0 0 10px;font-size:15px;font-weight:700;">Šta sledi?</h3>
          <ul style="margin:0;padding-left:20px;color:#4a708c;font-size:14px;line-height:1.7;">
            <li>Vozač će te zvati 30 minuta pre polaska da potvrdi pickup</li>
            <li>Budi spreman ispred adrese 5 minuta pre dogovorenog vremena</li>
            <li>Ako se nešto promeni, pošalji nam WhatsApp poruku</li>
          </ul>
        </td></tr>

        <!-- contact -->
        <tr><td style="background:#f3f7fa;padding:20px 28px;border-top:1px solid #e6eef3;">
          <p style="margin:0 0 6px;font-size:13px;color:#4a708c;">Imaš pitanje?</p>
          <div style="display:flex;gap:14px;flex-wrap:wrap;font-size:14px;">
            <a href="tel:+381604264265" style="color:#0a2540;text-decoration:none;font-weight:600;">📞 060 426 4265</a>
            <a href="https://wa.me/381604264265" style="color:#0a2540;text-decoration:none;font-weight:600;">💬 WhatsApp</a>
            <a href="mailto:office@dreamteamtravel.rs" style="color:#0a2540;text-decoration:none;font-weight:600;">✉ office@dreamteamtravel.rs</a>
          </div>
        </td></tr>

        <!-- footer -->
        <tr><td style="padding:18px 28px;text-align:center;font-size:12px;color:#9fb6c5;">
          Dream Team Travel · Kombi prevoz Beograd ↔ Hrvatska<br>
          Otkazivanje besplatno do 24h pre polaska
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

    // Plain text fallback
    const text = `Hvala na rezervaciji, ${booking.fullname.split(" ")[0]}!

Broj rezervacije: ${booking.ref}

🇷🇸 Beograd → 🇭🇷 ${booking.routeCity}
${niceDate} · ${booking.time}h ${booking.time === "23:00" ? "(noćni)" : "(jutarnji)"}
${tripLabel} · ${booking.pax} ${booking.pax === 1 ? "putnik" : "putnika"}

📍 Pickup: ${booking.pickup}
🏁 Dolazak: ${booking.dropoff}
${booking.note ? `📝 Napomena: ${booking.note}\n` : ""}
💰 Ukupno: €${booking.totalPrice} (plaćanje kod vozača)

Šta sledi?
· Vozač zove 30 min pre polaska
· Budi spreman ispred adrese 5 min pre

Pitanja: 060 426 4265 · WhatsApp · office@dreamteamtravel.rs

Dream Team Travel
Otkazivanje besplatno do 24h pre polaska`;

    return { subject, html, text };
  }

  // ===== Telegram template =====
  function buildTelegramMessage(booking) {
    const niceDate = fmtDateLong(booking.date);
    const tripLabel = booking.tripType === "return" ? "povratna" : "jedan pravac";
    const stamp = new Date().toLocaleString("sr-RS", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

    return `🚐 *NOVA REZERVACIJA* · \`${booking.ref}\`

👤 *${booking.fullname}*
📞 ${booking.phone}
📧 ${booking.email || "(bez email-a)"}

🇷🇸 → 🇭🇷 *Beograd → ${booking.routeCity}*
📅 ${niceDate}
🕐 ${booking.time}h ${booking.time === "23:00" ? "(noćni)" : "(jutarnji)"}
👥 ${booking.pax} ${booking.pax === 1 ? "putnik" : "putnika"} · ${tripLabel}
💰 *€${booking.totalPrice}* (plaćanje kod vozača)

📍 Pickup: ${booking.pickup}
🏁 Dolazak: ${booking.dropoff}
${booking.note ? `📝 _${booking.note}_\n` : ""}
⏰ Primljeno: ${stamp}
🔗 Izvor: ${booking.source || "web"}`;
  }

  // ===== Util =====
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
  function fmtDateLong(iso) {
    return new Date(iso + "T00:00:00").toLocaleDateString("sr-RS",
      { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }
})();
