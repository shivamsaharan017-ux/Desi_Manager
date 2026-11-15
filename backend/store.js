import Database from "better-sqlite3";
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const dbPath = resolve(process.env.DESIMANAGER_DB_PATH || "data/desimanager.sqlite");
mkdirSync(dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    shop_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    assistant_name TEXT NOT NULL DEFAULT 'Jarvis',
    speech_language TEXT NOT NULL DEFAULT 'en-IN',
    wake_enabled INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    amount_paise INTEGER NOT NULL CHECK(amount_paise > 0),
    paid_on TEXT NOT NULL,
    method TEXT NOT NULL DEFAULT 'cash',
    vendor TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sales (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    label TEXT NOT NULL,
    amount_paise INTEGER NOT NULL CHECK(amount_paise >= 0),
    sold_on TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS credit_entries (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    customer TEXT NOT NULL,
    entry_type TEXT NOT NULL CHECK(entry_type IN ('credit', 'payment')),
    amount_paise INTEGER NOT NULL CHECK(amount_paise > 0),
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS inventory (
    id TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    name TEXT NOT NULL,
    unit TEXT NOT NULL,
    quantity REAL NOT NULL,
    low_at REAL NOT NULL,
    supplier TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (owner_id, id)
  );
  CREATE TABLE IF NOT EXISTS purchase_orders (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    item_name TEXT NOT NULL,
    supplier TEXT NOT NULL,
    quantity REAL NOT NULL CHECK(quantity > 0),
    unit TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'placed')),
    created_at TEXT NOT NULL
  );
`);

function ensureColumn(table, column, declaration) {
  const columns = db.pragma("table_info(" + table + ")");
  if (!columns.some((entry) => entry.name === column)) {
    db.exec("ALTER TABLE " + table + " ADD COLUMN " + column + " " + declaration);
  }
}

for (const table of ["expenses", "sales", "credit_entries", "inventory", "purchase_orders"]) {
  ensureColumn(table, "owner_id", "TEXT NOT NULL DEFAULT ''");
}
db.exec(`
  CREATE INDEX IF NOT EXISTS expenses_owner_date_idx ON expenses(owner_id, paid_on);
  CREATE INDEX IF NOT EXISTS expenses_owner_category_idx ON expenses(owner_id, category);
  CREATE INDEX IF NOT EXISTS sales_owner_date_idx ON sales(owner_id, sold_on);
  CREATE INDEX IF NOT EXISTS credit_owner_customer_idx ON credit_entries(owner_id, customer);
  CREATE INDEX IF NOT EXISTS orders_owner_date_idx ON purchase_orders(owner_id, created_at);
`);

const passwordDigest = (password, salt) => scryptSync(password, salt, 64).toString("hex");
const tokenDigest = (token) => createHash("sha256").update(token).digest("hex");
const publicUser = (row) => ({
  id: row.id,
  name: row.name,
  shopName: row.shop_name,
  email: row.email,
  assistantName: row.assistant_name,
  speechLanguage: row.speech_language,
  wakeEnabled: Boolean(row.wake_enabled),
});

export const supportedLanguages = [
  "en-IN", "hi-IN", "bn-IN", "ta-IN", "te-IN", "mr-IN",
  "gu-IN", "kn-IN", "ml-IN", "pa-IN", "ur-IN",
];

function insertAccount({ name, shopName, email, password }) {
  const id = randomUUID();
  const salt = randomBytes(16).toString("hex");
  db.prepare(`
    INSERT INTO users (id, name, shop_name, email, password_salt, password_hash, assistant_name, speech_language, wake_enabled, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'Jarvis', 'en-IN', 0, ?)
  `).run(id, name, shopName, email, salt, passwordDigest(password, salt), new Date().toISOString());
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id);
}

let demoUser = null;
if (process.env.NODE_ENV !== "production") {
  const demoEmail = String(process.env.DEMO_EMAIL || "rakesh@desimanager.demo").trim().toLowerCase();
  demoUser = db.prepare("SELECT * FROM users WHERE email = ?").get(demoEmail)
    || insertAccount({
      name: "Rakesh Kumar",
      shopName: "Rakesh’s Chai Corner",
      email: demoEmail,
      password: process.env.DEMO_PASSWORD || "chai1234",
    });
}
const defaultOwner = demoUser?.id || db.prepare("SELECT id FROM users ORDER BY created_at LIMIT 1").get()?.id || "demo-owner";
db.prepare("UPDATE expenses SET owner_id = ? WHERE owner_id = ''").run(defaultOwner);
db.prepare("UPDATE sales SET owner_id = ? WHERE owner_id = ''").run(defaultOwner);
db.prepare("UPDATE credit_entries SET owner_id = ? WHERE owner_id = ''").run(defaultOwner);
db.prepare("UPDATE inventory SET owner_id = ? WHERE owner_id = ''").run(defaultOwner);
db.prepare("UPDATE purchase_orders SET owner_id = ? WHERE owner_id = ''").run(defaultOwner);

const pad = (value) => String(value).padStart(2, "0");
const localDate = (date) => date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
const now = new Date();
const day = now.getDate();
const seededDate = (offset) => localDate(new Date(now.getFullYear(), now.getMonth(), Math.max(1, day - offset), 12));
const createdNow = now.toISOString();

function seedDemoShop(ownerId) {
  const seed = db.transaction(() => {
    if (db.prepare("SELECT COUNT(*) AS count FROM expenses WHERE owner_id = ?").get(ownerId).count === 0) {
      const insertExpense = db.prepare(`
        INSERT INTO expenses (id, owner_id, title, category, amount_paise, paid_on, method, vendor, note, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const seedExpenses = [
        ["Shop rent — " + new Intl.DateTimeFormat("en-IN", { month: "long" }).format(now), "rent", 1200000, seededDate(day - 1), "upi", "Sharma Properties", "Monthly shop rent"],
        ["Fresh milk delivery", "stock", 840000, seededDate(0), "cash", "Gopal Dairy", "Morning delivery"],
        ["Tea leaves and spices", "stock", 580000, seededDate(1), "upi", "Royal Tea Traders", "Assam blend and masala"],
        ["Snacks and bakery stock", "stock", 560000, seededDate(2), "cash", "City Bakery", "Daily counter stock"],
        ["Sugar, cups and stirrers", "stock", 370000, seededDate(3), "cash", "Metro Wholesale", "Restock"],
        ["Staff wages", "wages", 840000, seededDate(4), "cash", "Team payout", "Weekly wages"],
        ["Electricity bill", "utilities", 270000, seededDate(5), "upi", "Local electricity board", "Shop meter"],
        ["LPG and water", "utilities", 105000, seededDate(6), "cash", "Local supplier", "Kitchen gas and water"],
        ["Delivery fuel", "delivery", 190000, seededDate(7), "cash", "Petrol pump", "Supplier pickup"],
        ["Counter repair", "maintenance", 130000, seededDate(8), "cash", "Ravi Repairs", "Tap and shelf fix"],
        ["Extra paper bags", "other", 90000, seededDate(9), "cash", "Metro Wholesale", "Carry bags"],
      ];
      for (const [title, category, amount, paidOn, method, vendor, note] of seedExpenses) {
        insertExpense.run(randomUUID(), ownerId, title, category, amount, paidOn, method, vendor, note, createdNow);
      }
    }

    if (db.prepare("SELECT COUNT(*) AS count FROM sales WHERE owner_id = ?").get(ownerId).count === 0) {
      const insertSale = db.prepare("INSERT INTO sales (id, owner_id, label, amount_paise, sold_on) VALUES (?, ?, ?, ?, ?)");
      const dailySales = [540000, 610000, 570000, 680000, 620000, 590000, 650000, 700000, 620000, 750000, 670000, 710000, 710000, 510000];
      dailySales.slice(0, Math.min(day, dailySales.length)).forEach((amount, index) => {
        insertSale.run(randomUUID(), ownerId, "Daily counter sales", amount, seededDate(day - index - 1));
      });
    }

    if (db.prepare("SELECT COUNT(*) AS count FROM credit_entries WHERE owner_id = ?").get(ownerId).count === 0) {
      const insertEntry = db.prepare(`
        INSERT INTO credit_entries (id, owner_id, customer, entry_type, amount_paise, note, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const entries = [
        ["Ramesh", "credit", 125000, "Tea and snacks", seededDate(0)],
        ["Ramesh", "payment", 33000, "Paid in cash", seededDate(1)],
        ["Sunita", "credit", 74000, "Family tea", seededDate(2)],
        ["Sunita", "payment", 20000, "UPI payment", seededDate(3)],
        ["Ajay", "credit", 135000, "Office tea order", seededDate(4)],
        ["Meena", "credit", 36000, "Breakfast and tea", seededDate(5)],
      ];
      for (const [customer, type, amount, note, createdAt] of entries) {
        insertEntry.run(randomUUID(), ownerId, customer, type, amount, note, createdAt + "T10:30:00.000Z");
      }
    }

    if (db.prepare("SELECT COUNT(*) AS count FROM inventory WHERE owner_id = ?").get(ownerId).count === 0) {
      const insertItem = db.prepare("INSERT INTO inventory (id, owner_id, name, unit, quantity, low_at, supplier) VALUES (?, ?, ?, ?, ?, ?, ?)");
      [
        ["milk", "Milk packets", "packets", 12, 20, "Gopal Dairy"],
        ["tea", "Tea leaves", "kg", 4.2, 3, "Royal Tea Traders"],
        ["sugar", "Sugar", "kg", 8, 5, "Metro Wholesale"],
        ["cups", "Paper cups", "pieces", 60, 100, "Metro Wholesale"],
        ["biscuits", "Biscuits", "packs", 24, 12, "City Bakery"],
      ].forEach((item) => insertItem.run(item[0], ownerId, ...item.slice(1)));
    }
  });
  seed();
}
if (demoUser) seedDemoShop(demoUser.id);

export const categories = {
  rent: "Rent",
  stock: "Supplies",
  wages: "Team",
  utilities: "Bills",
  delivery: "Delivery",
  maintenance: "Maintenance",
  other: "Other",
};

export const toRupees = (paise) => Number((Number(paise || 0) / 100).toFixed(2));
export const todayString = () => localDate(new Date());
export const monthStart = (value = todayString()) => value.slice(0, 7) + "-01";

export function createAccount({ name, shopName, email, password }) {
  const row = insertAccount({ name, shopName, email: email.toLowerCase(), password });
  const inventoryItems = [
    ["milk", "Milk packets", "packets", 0, 20, ""],
    ["tea", "Tea leaves", "kg", 0, 3, ""],
    ["sugar", "Sugar", "kg", 0, 5, ""],
    ["cups", "Paper cups", "pieces", 0, 100, ""],
    ["biscuits", "Biscuits", "packs", 0, 12, ""],
  ];
  const insertItem = db.prepare("INSERT INTO inventory (id, owner_id, name, unit, quantity, low_at, supplier) VALUES (?, ?, ?, ?, ?, ?, ?)");
  const seedInventory = db.transaction(() => inventoryItems.forEach((item) => insertItem.run(item[0], row.id, ...item.slice(1))));
  seedInventory();
  return publicUser(row);
}

export function authenticateCredentials(email, password) {
  const row = db.prepare("SELECT * FROM users WHERE email = ?").get(String(email || "").trim().toLowerCase());
  if (!row) return null;
  const given = Buffer.from(passwordDigest(String(password || ""), row.password_salt), "hex");
  const expected = Buffer.from(row.password_hash, "hex");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return publicUser(row);
}

export function createSession(userId) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .run(tokenDigest(token), userId, expiresAt, new Date().toISOString());
  return { token, expiresAt };
}

export function userForSession(token) {
  if (!token) return null;
  const row = db.prepare(`
    SELECT users.*
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ?
  `).get(tokenDigest(token), new Date().toISOString());
  return row ? publicUser(row) : null;
}

export function revokeSession(token) {
  if (token) db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenDigest(token));
}

export function updateUserSettings(userId, { assistantName, speechLanguage, wakeEnabled }) {
  const name = String(assistantName || "Jarvis").trim().slice(0, 24) || "Jarvis";
  const requestedLanguage = String(speechLanguage || "en-IN").trim();
  const language = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(requestedLanguage) && requestedLanguage.length <= 35
    ? requestedLanguage
    : "en-IN";
  db.prepare("UPDATE users SET assistant_name = ?, speech_language = ?, wake_enabled = ? WHERE id = ?")
    .run(name, language, wakeEnabled ? 1 : 0, userId);
  return publicUser(db.prepare("SELECT * FROM users WHERE id = ?").get(userId));
}

export function getDashboard(ownerId) {
  const start = monthStart();
  const salesTotal = db.prepare("SELECT COALESCE(SUM(amount_paise), 0) AS total FROM sales WHERE owner_id = ? AND sold_on >= ?").get(ownerId, start).total;
  const expensesTotal = db.prepare("SELECT COALESCE(SUM(amount_paise), 0) AS total FROM expenses WHERE owner_id = ? AND paid_on >= ?").get(ownerId, start).total;
  const dueTotal = db.prepare(`
    SELECT COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount_paise ELSE -amount_paise END), 0) AS total
    FROM credit_entries WHERE owner_id = ?
  `).get(ownerId).total;
  const byCategory = db.prepare(`
    SELECT category, SUM(amount_paise) AS total, COUNT(*) AS count
    FROM expenses WHERE owner_id = ? AND paid_on >= ? GROUP BY category ORDER BY total DESC
  `).all(ownerId, start).map((row) => ({
    category: row.category, label: categories[row.category] || "Other", amount: toRupees(row.total), count: row.count,
  }));
  const dailySales = new Map(
    db.prepare("SELECT sold_on, SUM(amount_paise) AS total FROM sales WHERE owner_id = ? AND sold_on >= ? GROUP BY sold_on")
      .all(ownerId, start).map((row) => [row.sold_on, row.total]),
  );
  const dailyExpenses = new Map(
    db.prepare("SELECT paid_on, SUM(amount_paise) AS total FROM expenses WHERE owner_id = ? AND paid_on >= ? GROUP BY paid_on")
      .all(ownerId, start).map((row) => [row.paid_on, row.total]),
  );
  const trend = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - 6 + index);
    const key = localDate(date);
    return { date: key, day: new Intl.DateTimeFormat("en-IN", { weekday: "short" }).format(date), sales: toRupees(dailySales.get(key)), expenses: toRupees(dailyExpenses.get(key)) };
  });
  const recent = db.prepare(`
    SELECT id, title, category, amount_paise, paid_on, method, vendor
    FROM expenses WHERE owner_id = ? ORDER BY paid_on DESC, created_at DESC LIMIT 5
  `).all(ownerId).map((row) => ({
    id: row.id, title: row.title, category: row.category, categoryLabel: categories[row.category] || "Other",
    amount: toRupees(row.amount_paise), date: row.paid_on, method: row.method, vendor: row.vendor,
  }));
  return {
    period: "month",
    sales: toRupees(salesTotal),
    expenses: toRupees(expensesTotal),
    net: toRupees(salesTotal - expensesTotal),
    creditDue: toRupees(dueTotal),
    expenseCount: db.prepare("SELECT COUNT(*) AS count FROM expenses WHERE owner_id = ? AND paid_on >= ?").get(ownerId, start).count,
    categories: byCategory,
    trend,
    recent,
    month: new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(new Date()),
  };
}

export function listSales(ownerId, period = "month") {
  const start = period === "all" ? "0000-01-01" : monthStart();
  const items = db.prepare(`
    SELECT id, label, amount_paise, sold_on
    FROM sales WHERE owner_id = ? AND sold_on >= ?
    ORDER BY sold_on DESC, rowid DESC
  `).all(ownerId, start).map((row) => ({
    id: row.id, label: row.label, amount: toRupees(row.amount_paise), date: row.sold_on,
  }));
  return {
    items,
    total: Math.round(items.reduce((sum, row) => sum + row.amount, 0) * 100) / 100,
    count: items.length,
    period,
  };
}

export function listExpenses(ownerId, { category = "all", search = "", period = "month" } = {}) {
  const start = period === "all" ? "0000-01-01" : monthStart();
  const searchTerm = "%" + search.trim().toLowerCase() + "%";
  let query = `
    SELECT id, title, category, amount_paise, paid_on, method, vendor, note
    FROM expenses
    WHERE owner_id = ? AND paid_on >= ? AND (lower(title) LIKE ? OR lower(vendor) LIKE ? OR lower(note) LIKE ?)
  `;
  const params = [ownerId, start, searchTerm, searchTerm, searchTerm];
  if (category !== "all" && categories[category]) {
    query += " AND category = ?";
    params.push(category);
  }
  query += " ORDER BY paid_on DESC, created_at DESC";
  const items = db.prepare(query).all(...params).map((row) => ({
    id: row.id, title: row.title, category: row.category, categoryLabel: categories[row.category] || "Other",
    amount: toRupees(row.amount_paise), date: row.paid_on, method: row.method, vendor: row.vendor, note: row.note,
  }));
  const summary = db.prepare(`
    SELECT category, SUM(amount_paise) AS total, COUNT(*) AS count
    FROM expenses WHERE owner_id = ? AND paid_on >= ? GROUP BY category ORDER BY total DESC
  `).all(ownerId, start).map((row) => ({
    category: row.category, label: categories[row.category] || "Other", amount: toRupees(row.total), count: row.count,
  }));
  return {
    items,
    summary,
    total: toRupees(db.prepare("SELECT COALESCE(SUM(amount_paise), 0) AS total FROM expenses WHERE owner_id = ? AND paid_on >= ?").get(ownerId, start).total),
    period,
  };
}

export function listCredit(ownerId) {
  const rows = db.prepare(`
    SELECT customer,
      SUM(CASE WHEN entry_type = 'credit' THEN amount_paise ELSE -amount_paise END) AS balance,
      SUM(CASE WHEN entry_type = 'credit' THEN amount_paise ELSE 0 END) AS given,
      SUM(CASE WHEN entry_type = 'payment' THEN amount_paise ELSE 0 END) AS received,
      COUNT(*) AS entries,
      MAX(created_at) AS last_activity
    FROM credit_entries WHERE owner_id = ? GROUP BY customer ORDER BY balance DESC
  `).all(ownerId);
  const customers = rows.map((row) => ({
    name: row.customer, balance: toRupees(row.balance), given: toRupees(row.given),
    received: toRupees(row.received), entries: row.entries, lastActivity: row.last_activity,
  }));
  const recentEntries = db.prepare(`
    SELECT id, customer, entry_type AS type, amount_paise, note, created_at AS createdAt
    FROM credit_entries WHERE owner_id = ? ORDER BY created_at DESC LIMIT 100
  `).all(ownerId).map((row) => ({
    id: row.id, customer: row.customer, type: row.type,
    amount: toRupees(row.amount_paise), note: row.note, createdAt: row.createdAt,
  }));
  return {
    customers,
    recentEntries,
    total: toRupees(customers.reduce((sum, row) => sum + row.balance, 0)),
    given: toRupees(customers.reduce((sum, row) => sum + row.given, 0)),
    received: toRupees(customers.reduce((sum, row) => sum + row.received, 0)),
  };
}

export function listInventory(ownerId) {
  return db.prepare("SELECT id, name, unit, quantity, low_at AS lowAt, supplier FROM inventory WHERE owner_id = ? ORDER BY name")
    .all(ownerId).map((row) => ({ ...row, low: row.quantity <= row.lowAt }));
}

export function listOrders(ownerId) {
  return db.prepare("SELECT id, item_id AS itemId, item_name AS itemName, supplier, quantity, unit, status, created_at AS createdAt FROM purchase_orders WHERE owner_id = ? ORDER BY created_at DESC")
    .all(ownerId);
}

export function addOrder(ownerId, data) {
  const item = db.prepare("SELECT id, name, unit, supplier FROM inventory WHERE owner_id = ? AND id = ?").get(ownerId, data.itemId);
  if (!item) return null;
  const id = randomUUID();
  db.prepare("INSERT INTO purchase_orders (id, owner_id, item_id, item_name, supplier, quantity, unit, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?)")
    .run(id, ownerId, item.id, item.name, data.supplier || item.supplier, data.quantity, item.unit, new Date().toISOString());
  return id;
}

export function markOrderPlaced(ownerId, id) {
  const result = db.prepare("UPDATE purchase_orders SET status = 'placed' WHERE owner_id = ? AND id = ? AND status = 'draft'").run(ownerId, id);
  return result.changes > 0;
}

export function addExpense(ownerId, data) {
  const id = randomUUID();
  db.prepare(`
    INSERT INTO expenses (id, owner_id, title, category, amount_paise, paid_on, method, vendor, note, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, ownerId, data.title, data.category, Math.round(data.amount * 100), data.date, data.method, data.vendor, data.note, new Date().toISOString());
  return id;
}

export function addSale(ownerId, data) {
  const id = randomUUID();
  db.prepare(`
    INSERT INTO sales (id, owner_id, label, amount_paise, sold_on)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, ownerId, data.label, Math.round(data.amount * 100), data.date);
  return id;
}

export function addCreditEntry(ownerId, data) {
  const id = randomUUID();
  const requestedName = String(data.customer || "").normalize("NFC").trim().replace(/\s+/gu, " ");
  const customerKey = (value) => String(value || "").normalize("NFC").trim().replace(/\s+/gu, " ").toLocaleLowerCase();
  const devanagariToLatin = {
    अ: "a", आ: "a", इ: "i", ई: "i", उ: "u", ऊ: "u", ऋ: "ri", ए: "e", ऐ: "ai", ओ: "o", औ: "au",
    क: "k", ख: "kh", ग: "g", घ: "gh", ङ: "ng", च: "ch", छ: "chh", ज: "j", झ: "jh", ञ: "ny",
    ट: "t", ठ: "th", ड: "d", ढ: "dh", ण: "n", त: "t", थ: "th", द: "d", ध: "dh", न: "n",
    प: "p", फ: "ph", ब: "b", भ: "bh", म: "m", य: "y", र: "r", ल: "l", व: "v", श: "sh", ष: "sh", स: "s", ह: "h",
    "ा": "a", "ि": "i", "ी": "i", "ु": "u", "ू": "u", "ृ": "ri", "े": "e", "ै": "ai", "ो": "o", "ौ": "au",
    "ं": "m", "ँ": "m", "ः": "h", "्": "", "़": "",
  };
  const phoneticCustomerKey = (value) => [...customerKey(value)]
    .map((character) => devanagariToLatin[character] ?? character)
    .join("").normalize("NFD").replace(/\p{M}/gu, "")
    .replace(/[aeiou]/g, "").replace(/(.)\1+/g, "$1").replace(/[^\p{L}\p{N}]/gu, "");
  const existingNames = db.prepare("SELECT customer FROM credit_entries WHERE owner_id = ? GROUP BY customer").all(ownerId);
  const exactMatch = existingNames.find((row) => customerKey(row.customer) === customerKey(requestedName));
  const phoneticMatches = existingNames.filter((row) => phoneticCustomerKey(row.customer) === phoneticCustomerKey(requestedName));
  const customer = exactMatch?.customer || (phoneticMatches.length === 1 ? phoneticMatches[0].customer : requestedName);
  db.prepare(`
    INSERT INTO credit_entries (id, owner_id, customer, entry_type, amount_paise, note, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, ownerId, customer, data.type, Math.round(data.amount * 100), String(data.note || "").slice(0, 240), new Date().toISOString());
  return id;
}
