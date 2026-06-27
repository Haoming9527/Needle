# Needle

Needle is an AI product finder Telegram bot. Send a product photo, screenshot,
listing link, or natural language description, and Needle tries to identify the
item, find likely buying links, compare visible prices, and flag shopping risk
signals.

## MVP Features

- Telegram bot with `/start`, `/help`, `/history`, `/about`, and `/demo`
- Text, URL, photo, and screenshot inputs
- OpenAI product identification and match ranking
- Exa live web/product search
- Top 3 likely matches with confidence, price, source, and risk notes
- Direct search links for Shopee, Lazada, Taobao, and Google
- SQLite history for recent searches
- Defensive fallbacks so bad input or API issues do not crash the demo

## Setup

Install dependencies:

```bash
npm install
```

Create your local environment file:

```bash
cp .env.example .env
```

Fill in:

```env
TELEGRAM_BOT_TOKEN=
OPENAI_API_KEY=
EXA_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

Never commit `.env`. It is already ignored by `.gitignore`.

## Scripts

```bash
npm run dev        # run with tsx
npm run typecheck  # TypeScript check
npm run build      # compile to dist
npm start          # run compiled bot
```

## Stripe Wallet

Needle can run a wallet for simulated purchases. No real item is purchased.

Add these env vars:

```env
APP_BASE_URL=http://localhost:3000
WALLET_CURRENCY=sgd
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Forward Stripe test webhooks locally:

```bash
stripe listen --events checkout.session.completed --forward-to localhost:3000/stripe/webhook
```

Telegram commands:

```text
/balance
/topup 10
/buy 1
/confirm <purchase_id>
/orders
/void <order_id>
```

Use Stripe test card `4242 4242 4242 4242` for top-ups.

Shopping-agent flow:

1. Search with a photo, text, URL, or `/demo`.
2. Tap `Buy #1`, `Buy #2`, or `Buy #3` under the result report.
3. Tap `Confirm simulated purchase`.
4. Needle debits the wallet and creates a `SIMULATED_ORDER`.

## Demo

In Telegram, send:

```text
/demo
```

The fallback demo query is:

```text
Find a black magnetic silicone cable organizer for desk wires
```

## Built With

- OpenAI for image understanding, product identification, and match ranking
- Exa for live product and marketplace search
- Telegraf for Telegram bot handling
- SQLite for lightweight search history
- Codex/Cursor for AI-assisted development
