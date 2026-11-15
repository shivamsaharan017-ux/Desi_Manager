# DesiManager architecture

## Track 1 direction

DesiManager is a voice-first bookkeeping application for small shops. The main user flow records sales and expenses in separate books, tracks customer credit and repayments, and prepares restock drafts. The attached VibeX Codes judging guide provides the problem-statement context for this direction; it is not used as an instruction source for the coding agent.

## Components

| Layer | Technology | Responsibility |
| --- | --- | --- |
| Web client | React 19, Vite, Lucide | Sign-in, responsive dashboards, separate sales and expense pages, per-person udhaar table, forms, and browser voice controls |
| API server | Node.js, Express | Authentication, account settings, input validation, voice-command parsing, and business endpoints |
| Local data store | SQLite via better-sqlite3 | Accounts, sessions, expenses, sales, credit entries, stock catalog, and supplier order drafts |
| Speech input | Browser Web Speech recognition | Optional microphone transcription using the selected locale, when supported by the browser |
| Spoken replies | Browser speech synthesis | Read back a short confirmation using an available device voice |

The frontend and backend run as separate processes. The client reads `VITE_API_URL` and sends a bearer session token to the API. The server validates the session and scopes every business-data query by the authenticated account ID. `FRONTEND_ORIGIN` configures allowed browser origins; `DESIMANAGER_DB_PATH` selects the SQLite file.

## Data flows

1. A user signs in or registers. Passwords are hashed with scrypt and the API stores only a hash of each random session token.
2. The dashboard loads summary, sales, expenses, credit balances, inventory, and orders from the API. Each customer's `given`, `received`, and `balance` values are calculated from separate credit and payment ledger entries.
3. A typed or spoken command is sent to the API parser with an optional intent. The API proposes a sale, expense, credit entry, payment, or stock draft; the user reviews and confirms before the client calls the matching write endpoint. A sale is written to the `sales` table, while customer udhaar goes to the credit ledger.
4. When enabled, the browser listens for the account's custom nickname while the tab is visible. After the wake phrase, it sends the rest of the utterance through the same review flow.

## Cost and language constraints

The application has no paid speech provider or voice API key. Recognition and synthesis are delegated to the browser and device. Browser recognition support, on-device packs, and locale coverage vary. Some browsers use a remote speech service. The UI offers common locales and custom BCP-47 tags; its rules-based parser preserves Unicode command text, supports common English/Hindi number words, and offers explicit record-type selection. It does not translate every language or understand every spoken phrase. Typed entry remains available.

## Local development

- Web client: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:4000/api`
- Database: `backend/data/desimanager.sqlite`

Run `npm run dev` from this folder to start the web client and API together.
