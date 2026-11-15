# DesiManager

DesiManager is a voice-first shop ledger for small businesses. Track sales separately from spending, split expenses into rent, supplies, team, bills, delivery, maintenance, and other categories, and keep one udhaar account per person with credit given, payments received, and balance due. A stock and supplier-draft page and account-specific voice settings are included.

The attached VibeX Codes judging guide was used as problem-statement context for the Track 1 direction. Its content is not treated as instructions to the coding agent.

## Run locally

Requires Node.js 20+ and npm.

```sh
npm install
npm install --prefix frontend
npm install --prefix backend
npm run dev
```

The web app and API run as separate local servers:

- Web app: http://127.0.0.1:5173
- API: http://127.0.0.1:4000/api

In development, use the demo account `rakesh@desimanager.demo` with password `chai1234`, or create a separate account from the login page. The demo account contains sample shop records. New accounts start with their own empty ledger and a starter stock catalog. Demo data is created only when `NODE_ENV` is not `production`.

The API stores the data in `backend/data/desimanager.sqlite` by default. Set `DESIMANAGER_DB_PATH` to use another database file. Set `PORT` and `FRONTEND_ORIGIN` to configure the API server. Copy `frontend/.env.example` to `frontend/.env.local` and set `VITE_API_URL` to point the frontend to another API server. Keep any future private integration keys on the backend.

## Voice assistant

The app has a configurable assistant nickname (default: Jarvis) and a hands-free wake-word option. Users must turn it on and grant microphone access. While the browser tab is open, it listens for that nickname and then processes the following phrase. It stops when the tab is hidden. Speech input uses the browser's built-in Web Speech recognition where available; spoken replies use the device's speech synthesis. The app does not require a paid speech provider, subscription, or voice API key.

Speech recognition support is limited and varies by browser. Some browser implementations use an online speech service and may send audio to that service; other implementations can support on-device recognition when a language pack is available. The language list covers common Indian and international locales, and users can enter a BCP-47 locale tag supported by their browser. Typed Unicode text is accepted, with digit amounts and common English/Hindi number words. Automatic detection and the explicit sale, expense, credit, payment, and restock choices route proposals to separate books. Review every proposed entry before saving. The rules-based command parser is not a general-purpose translator or generative AI model.

## Data and accounts

The frontend and backend are separate servers connected over the configured API URL. The API scopes business records to the signed-in user. The default local development setup uses SQLite. The sample configuration is for local development; deployments need an appropriate HTTPS hosting and account-security setup.

## API routes

- `GET /api/health`
- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`
- `PATCH /api/settings`
- `GET /api/dashboard`
- `GET /api/sales`, `POST /api/sales`
- `GET /api/expenses`, `POST /api/expenses`
- `GET /api/credit`, `POST /api/credit`
- `GET /api/inventory`
- `GET /api/orders`, `POST /api/orders`, `POST /api/orders/:id/placed`
- `POST /api/voice/parse`
