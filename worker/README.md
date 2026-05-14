# DTT Notify Worker — Production deploy

Frontend trenutno radi u **DEMO MODE** (mock slanje sa preview-om).
Kada budeš spreman da pošalješ prave mailove + Telegram poruke, deploy-uj ovaj Worker.

## 1. Preduslovi

- Cloudflare nalog (besplatan): https://dash.cloudflare.com/sign-up
- Node.js 18+
- Wrangler CLI: `npm install -g wrangler`
- Resend nalog: https://resend.com (besplatan, 100 mail/dan)
- Telegram bot: napravi preko `@BotFather` na Telegramu

## 2. Setup

```bash
cd worker
wrangler login
```

Postavi 4 secret-a:

```bash
wrangler secret put RESEND_API_KEY
# Paste: re_xxxxxxxxxxxx

wrangler secret put RESEND_FROM
# Paste: Dream Team Travel <onboarding@resend.dev>
# (Ili tvoj verifikovani domen — vidi resend.com/domains)

wrangler secret put TELEGRAM_BOT_TOKEN
# Paste: 123456:ABC-DEF...

wrangler secret put TELEGRAM_CHAT_ID
# Paste: tvoj chat ID
# (Ako ne znaš ID: pošalji /start botu, pa otvori
#  https://api.telegram.org/bot<TOKEN>/getUpdates — vidi "chat":{"id":...})
```

## 3. Deploy

```bash
wrangler deploy
```

Dobićeš URL u stilu `https://dtt-notify.<tvoj-account>.workers.dev`.

## 4. Frontend switch

U `js/notify.js`:

```js
const MOCK = false; // ← bilo true
const ENDPOINT = "https://dtt-notify.<tvoj-account>.workers.dev/send";
```

Commit, push, gotovo. Sve rezervacije šalju realne email-ove i Telegram poruke.

## 5. Test

```bash
curl -X POST https://dtt-notify.<tvoj-account>.workers.dev \
  -H "Content-Type: application/json" \
  -d '{
    "email": {
      "to": "pejicpetar21@gmail.com",
      "subject": "Test",
      "html": "<p>Test</p>",
      "text": "Test"
    },
    "telegram": { "text": "*Test* poruka iz Worker-a" }
  }'
```

## Cena

- Cloudflare Worker: 100k zahteva/dan besplatno
- Resend: 100 mail/dan, 3k/mesec besplatno
- Telegram bot: bez limita

Pri trenutnom volumenu Dream Team Travel-a (~15-30 rezervacija dnevno) sve je u besplatnim
limitima čak i sa reminder-ima.

## Sigurnost

- API ključevi su Worker secrets — **NIKAD u frontend kodu**
- CORS je ograničen na `ALLOWED_ORIGIN` (trenutno `https://luksi21.github.io`).
  Promeni u `wrangler.toml` ako pređeš na drugi domen.
- Rate-limiting: Cloudflare automatski u besplatnom planu (1k req/min po IP-u).
