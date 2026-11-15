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

The frontend and backend are separate servers connected over the configured API URL. The local API scopes business records to the signed-in user and uses SQLite. For permanent hosting, the Firebase mode below replaces the Express API with Firebase Authentication and Firestore; each account’s records remain private under its own user ID.

## Permanent free hosting with Firebase

This project can be hosted at a stable `PROJECT_ID.web.app` URL using Firebase Hosting, Firebase Authentication, and Firestore on the no-cost Spark plan. Do not attach a billing account or upgrade to Blaze. Firebase can pause a product after its free quota is reached; this setup does not add paid functions or a separate server. The site stays online when your laptop is off.

1. Create a Firebase project in the Firebase Console and keep it on the Spark (no-cost) plan.
2. In **Authentication → Sign-in method**, enable **Email/Password**.
3. In **Firestore Database**, create the default database in a nearby region, such as `asia-south1` (Mumbai). Keep the provided `firestore.rules`; they restrict all shop data to the signed-in owner.
4. In **Project settings → Your apps**, add a Web app and copy its Firebase web config values.
5. Copy `frontend/.env.firebase.example` to `frontend/.env.production.local` and fill in the API key, auth domain, project ID, and app ID from that web config. These Firebase web config values are public identifiers; Firestore rules and Firebase Auth protect the data. Do not commit your local environment file.
6. Install the Firebase CLI if needed, sign in, and deploy from the project root:

   ```sh
   npx firebase-tools login
   npx firebase-tools use --add
   npm --prefix frontend run build
   npx firebase-tools deploy --only hosting,firestore:rules,firestore:indexes
   ```

   When `firebase use --add` asks, choose the project you created. After deployment, share `https://PROJECT_ID.web.app`.

The cloud deployment starts with a new database. Existing SQLite or demo records are not uploaded. Users create their own account on the hosted site. The free plan has product quotas; check Firebase’s current [pricing](https://firebase.google.com/pricing/) before relying on it for a high-traffic business.

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
