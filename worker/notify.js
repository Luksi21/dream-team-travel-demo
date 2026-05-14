// Dream Team Travel — Cloudflare Worker
// Email (Resend) + Telegram bot notifikacije za potvrde rezervacija.
// Deploy: vidi worker/README.md
//
// Secrets koje treba dodati (preko `wrangler secret put` ili Cloudflare dashboard-a):
//   RESEND_API_KEY      — Resend API ključ (počinje sa "re_...")
//   RESEND_FROM         — npr. "Dream Team Travel <onboarding@resend.dev>"
//   TELEGRAM_BOT_TOKEN  — od @BotFather
//   TELEGRAM_CHAT_ID    — kuda da idu obaveštenja
//
// Optional env vars (postavi u wrangler.toml):
//   ALLOWED_ORIGIN      — npr. "https://luksi21.github.io" (CORS)

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = env.ALLOWED_ORIGIN || "*";

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders(allowed),
      });
    }

    if (request.method !== "POST") {
      return json({ error: "Use POST" }, 405, allowed);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400, allowed);
    }

    const { email, telegram, metadata } = payload;
    const result = { email: { ok: false }, telegram: { ok: false } };

    // ===== Email (Resend) =====
    if (email && email.to) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: env.RESEND_FROM,
            to: [email.to],
            subject: email.subject,
            html: email.html,
            text: email.text,
            reply_to: "office@dreamteamtravel.rs",
          }),
        });
        const data = await res.json();
        if (res.ok) {
          result.email = { ok: true, id: data.id };
        } else {
          result.email = { ok: false, error: data.message || `Resend ${res.status}` };
        }
      } catch (e) {
        result.email = { ok: false, error: e.message };
      }
    } else {
      result.email = { ok: false, error: "No recipient" };
    }

    // ===== Telegram =====
    if (telegram && telegram.text) {
      try {
        const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: env.TELEGRAM_CHAT_ID,
            text: telegram.text,
            parse_mode: "Markdown",
            disable_web_page_preview: true,
          }),
        });
        const data = await res.json();
        if (data.ok) {
          result.telegram = { ok: true, message_id: data.result?.message_id };
        } else {
          result.telegram = { ok: false, error: data.description || "Telegram error" };
        }
      } catch (e) {
        result.telegram = { ok: false, error: e.message };
      }
    }

    return json(result, 200, allowed);
  },
};

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(origin),
    },
  });
}
