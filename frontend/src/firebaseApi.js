import { initializeApp, getApps } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { getFirestore } from "firebase/firestore";
import { parseVoiceCommand } from "./voiceParser.js";

let auth;
let db;
let authReady;

function initializeFirebase() {
  if (auth && db) return;
  const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };
  const missingConfig = Object.entries(firebaseConfig).filter(([, value]) => !value).map(([key]) => key);
  if (missingConfig.length) {
    throw new Error("Firebase setup is incomplete. Missing: " + missingConfig.join(", "));
  }
  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  authReady = new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}
const categories = {
  rent: "Rent", stock: "Supplies", wages: "Team", utilities: "Bills",
  delivery: "Delivery", maintenance: "Maintenance", other: "Other",
};
const inventorySeed = [
  ["milk", "Milk packets", "packets", 0, 20, ""],
  ["tea", "Tea leaves", "kg", 0, 3, ""],
  ["sugar", "Sugar", "kg", 0, 5, ""],
  ["cups", "Paper cups", "pieces", 0, 100, ""],
  ["biscuits", "Biscuits", "packs", 0, 12, ""],
];
function appError(error) {
  const code = String(error?.code || "");
  const messages = {
    "auth/email-already-in-use": "An account with that email already exists. Sign in instead.",
    "auth/invalid-credential": "Email or password didn’t match.",
    "auth/invalid-login-credentials": "Email or password didn’t match.",
    "auth/user-not-found": "Email or password didn’t match.",
    "auth/wrong-password": "Email or password didn’t match.",
    "auth/weak-password": "Choose a password with at least 8 characters.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/network-request-failed": "Check your internet connection and try again.",
    "permission-denied": "The database refused access. Please check the Firebase security rules.",
  };
  return new Error(messages[code] || error?.message || "The cloud service could not complete that request.");
}

async function run(operation) {
  try { return await operation(); }
  catch (error) { throw appError(error); }
}

async function currentUser() {
  const user = auth.currentUser || await authReady;
  if (!user) throw new Error("Please sign in to open this shop book.");
  return user;
}

const userRef = (uid) => doc(db, "users", uid);
const recordsRef = (uid, name) => collection(db, "users", uid, name);
const toRupees = (paise) => Number((Number(paise || 0) / 100).toFixed(2));
const toPaise = (amount) => Math.round(Number(amount) * 100);
const pad = (value) => String(value).padStart(2, "0");
const localDate = (date) => date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
const todayString = () => localDate(new Date());
const monthStart = (value = todayString()) => value.slice(0, 7) + "-01";
const publicUser = (user, profile = {}) => ({
  id: user.uid,
  name: profile.name || user.displayName || "Shop owner",
  shopName: profile.shopName || "My shop",
  email: user.email || profile.email || "",
  assistantName: profile.assistantName || "Jarvis",
  speechLanguage: profile.speechLanguage || "en-IN",
  wakeEnabled: Boolean(profile.wakeEnabled),
});

async function documentRows(ref) {
  const result = await getDocs(ref);
  return result.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }));
}

async function loadProfile(user) {
  const snapshot = await getDoc(userRef(user.uid));
  if (snapshot.exists()) return snapshot.data();
  const profile = {
    name: user.displayName || String(user.email || "Shop owner").split("@")[0],
    shopName: "My shop",
    email: user.email || "",
    assistantName: "Jarvis",
    speechLanguage: "en-IN",
    wakeEnabled: false,
    createdAt: new Date().toISOString(),
  };
  const batch = writeBatch(db);
  batch.set(userRef(user.uid), profile);
  inventorySeed.forEach(([id, name, unit, quantity, lowAt, supplier]) => {
    batch.set(doc(recordsRef(user.uid, "inventory"), id), { name, unit, quantity, lowAt, supplier });
  });
  await batch.commit();
  return profile;
}

async function userAndProfile() {
  const user = await currentUser();
  const profile = await loadProfile(user);
  return { user, profile };
}

function amountSummary(rows) {
  const totals = new Map();
  for (const row of rows) {
    const current = totals.get(row.category) || { total: 0, count: 0 };
    current.total += Number(row.amountPaise || 0);
    current.count += 1;
    totals.set(row.category, current);
  }
  return [...totals.entries()].sort((a, b) => b[1].total - a[1].total).map(([category, value]) => ({
    category,
    label: categories[category] || "Other",
    amount: toRupees(value.total),
    count: value.count,
  }));
}

async function listSales(uid, period = "month") {
  const start = period === "all" ? "0000-01-01" : monthStart();
  const rows = await documentRows(query(
    recordsRef(uid, "sales"),
    where("soldOn", ">=", start),
    orderBy("soldOn", "desc"),
    orderBy("createdAt", "desc"),
  ));
  const items = rows.map((row) => ({ id: row.id, label: row.label, amount: toRupees(row.amountPaise), date: row.soldOn }));
  return {
    items,
    total: Math.round(items.reduce((sum, row) => sum + row.amount, 0) * 100) / 100,
    count: items.length,
    period,
  };
}

async function listExpenses(uid, { category = "all", search = "", period = "month" } = {}) {
  const start = period === "all" ? "0000-01-01" : monthStart();
  const rows = await documentRows(query(
    recordsRef(uid, "expenses"),
    where("paidOn", ">=", start),
    orderBy("paidOn", "desc"),
    orderBy("createdAt", "desc"),
  ));
  const searchable = String(search || "").trim().toLocaleLowerCase();
  const visible = rows.filter((row) => {
    if (category !== "all" && categories[category] && row.category !== category) return false;
    if (!searchable) return true;
    return [row.title, row.vendor, row.note].some((value) => String(value || "").toLocaleLowerCase().includes(searchable));
  });
  return {
    items: visible.map((row) => ({
      id: row.id, title: row.title, category: row.category,
      categoryLabel: categories[row.category] || "Other", amount: toRupees(row.amountPaise),
      date: row.paidOn, method: row.method, vendor: row.vendor, note: row.note,
    })),
    summary: amountSummary(rows),
    total: toRupees(rows.reduce((sum, row) => sum + Number(row.amountPaise || 0), 0)),
    period,
  };
}

async function listCredit(uid) {
  const rows = await documentRows(query(recordsRef(uid, "creditEntries"), orderBy("createdAt", "desc")));
  const groups = new Map();
  for (const row of rows) {
    const value = groups.get(row.customer) || { name: row.customer, balancePaise: 0, givenPaise: 0, receivedPaise: 0, entries: 0, lastActivity: row.createdAt };
    if (row.type === "credit") { value.balancePaise += row.amountPaise; value.givenPaise += row.amountPaise; }
    else { value.balancePaise -= row.amountPaise; value.receivedPaise += row.amountPaise; }
    value.entries += 1;
    if (row.createdAt > value.lastActivity) value.lastActivity = row.createdAt;
    groups.set(row.customer, value);
  }
  const customers = [...groups.values()].sort((a, b) => b.balancePaise - a.balancePaise).map((row) => ({
    name: row.name,
    balance: toRupees(row.balancePaise),
    given: toRupees(row.givenPaise),
    received: toRupees(row.receivedPaise),
    entries: row.entries,
    lastActivity: row.lastActivity,
  }));
  const recentEntries = rows.slice(0, 100).map((row) => ({
    id: row.id, customer: row.customer, type: row.type,
    amount: toRupees(row.amountPaise), note: row.note, createdAt: row.createdAt,
  }));
  return {
    customers,
    recentEntries,
    total: toRupees(customers.reduce((sum, row) => sum + row.balance, 0)),
    given: toRupees(customers.reduce((sum, row) => sum + row.given, 0)),
    received: toRupees(customers.reduce((sum, row) => sum + row.received, 0)),
  };
}

async function listInventory(uid) {
  const rows = await documentRows(query(recordsRef(uid, "inventory"), orderBy("name")));
  return rows.map((row) => ({
    id: row.id, name: row.name, unit: row.unit, quantity: row.quantity,
    lowAt: row.lowAt, supplier: row.supplier, low: row.quantity <= row.lowAt,
  }));
}

async function listOrders(uid) {
  return documentRows(query(recordsRef(uid, "orders"), orderBy("createdAt", "desc")));
}

async function getDashboard(uid) {
  const start = monthStart();
  const [sales, expenses, creditRows, recentRows] = await Promise.all([
    documentRows(query(recordsRef(uid, "sales"), where("soldOn", ">=", start), orderBy("soldOn", "desc"), orderBy("createdAt", "desc"))),
    documentRows(query(recordsRef(uid, "expenses"), where("paidOn", ">=", start), orderBy("paidOn", "desc"), orderBy("createdAt", "desc"))),
    documentRows(recordsRef(uid, "creditEntries")),
    documentRows(query(recordsRef(uid, "expenses"), orderBy("paidOn", "desc"), orderBy("createdAt", "desc"), limit(5))),
  ]);
  const salesTotal = sales.reduce((sum, row) => sum + Number(row.amountPaise || 0), 0);
  const expensesTotal = expenses.reduce((sum, row) => sum + Number(row.amountPaise || 0), 0);
  const creditDue = creditRows.reduce((sum, row) => sum + (row.type === "credit" ? Number(row.amountPaise || 0) : -Number(row.amountPaise || 0)), 0);
  const dailySales = new Map();
  sales.forEach((row) => dailySales.set(row.soldOn, (dailySales.get(row.soldOn) || 0) + Number(row.amountPaise || 0)));
  const dailyExpenses = new Map();
  expenses.forEach((row) => dailyExpenses.set(row.paidOn, (dailyExpenses.get(row.paidOn) || 0) + Number(row.amountPaise || 0)));
  const trend = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - 6 + index);
    const key = localDate(date);
    return {
      date: key,
      day: new Intl.DateTimeFormat("en-IN", { weekday: "short" }).format(date),
      sales: toRupees(dailySales.get(key)),
      expenses: toRupees(dailyExpenses.get(key)),
    };
  });
  return {
    period: "month",
    sales: toRupees(salesTotal),
    expenses: toRupees(expensesTotal),
    net: toRupees(salesTotal - expensesTotal),
    creditDue: toRupees(creditDue),
    expenseCount: expenses.length,
    categories: amountSummary(expenses),
    trend,
    recent: recentRows.map((row) => ({
      id: row.id, title: row.title, category: row.category,
      categoryLabel: categories[row.category] || "Other", amount: toRupees(row.amountPaise),
      date: row.paidOn, method: row.method, vendor: row.vendor,
    })),
    month: new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(new Date()),
  };
}

function customerKey(value) {
  return String(value || "").normalize("NFC").trim().replace(/\s+/gu, " ").toLocaleLowerCase();
}

function phoneticCustomerKey(value) {
  const devanagariToLatin = {
    अ: "a", आ: "a", इ: "i", ई: "i", उ: "u", ऊ: "u", ऋ: "ri", ए: "e", ऐ: "ai", ओ: "o", औ: "au",
    क: "k", ख: "kh", ग: "g", घ: "gh", ङ: "ng", च: "ch", छ: "chh", ज: "j", झ: "jh", ञ: "ny",
    ट: "t", ठ: "th", ड: "d", ढ: "dh", ण: "n", त: "t", थ: "th", द: "d", ध: "dh", न: "n",
    प: "p", फ: "ph", ब: "b", भ: "bh", म: "m", य: "y", र: "r", ल: "l", व: "v", श: "sh", ष: "sh", स: "s", ह: "h",
    "ा": "a", "ि": "i", "ी": "i", "ु": "u", "ू": "u", "ृ": "ri", "े": "e", "ै": "ai", "ो": "o", "ौ": "au",
    "ं": "m", "ँ": "m", "ः": "h", "्": "", "़": "",
  };
  return [...customerKey(value)].map((character) => devanagariToLatin[character] ?? character).join("")
    .normalize("NFD").replace(/\p{M}/gu, "").replace(/[aeiou]/g, "").replace(/(.)\1+/g, "$1").replace(/[^\p{L}\p{N}]/gu, "");
}

async function addCreditEntry(uid, data) {
  const requestedName = String(data.customer || "").normalize("NFC").trim().replace(/\s+/gu, " ");
  const existing = await documentRows(recordsRef(uid, "creditEntries"));
  const names = [...new Set(existing.map((row) => row.customer))];
  const exact = names.find((name) => customerKey(name) === customerKey(requestedName));
  const phonetic = names.filter((name) => phoneticCustomerKey(name) === phoneticCustomerKey(requestedName));
  const customer = exact || (phonetic.length === 1 ? phonetic[0] : requestedName);
  const createdAt = new Date().toISOString();
  const ref = await addDoc(recordsRef(uid, "creditEntries"), {
    customer,
    type: data.type,
    amountPaise: toPaise(data.amount),
    note: String(data.note || "").slice(0, 240),
    createdAt,
  });
  return ref.id;
}

function buildApi() {
  initializeFirebase();
  return {
    baseUrl: "firebase",
    getToken: () => "firebase-session",
    clearToken: () => signOut(auth).catch(() => {}),
    health: async () => ({ ok: true, service: "firebase", time: new Date().toISOString() }),
    me: () => run(async () => {
      const { user, profile } = await userAndProfile();
      return publicUser(user, profile);
    }),
    register: (data) => run(async () => {
      const name = String(data.name || "").trim();
      const shopName = String(data.shopName || "").trim();
      const email = String(data.email || "").trim().toLowerCase();
      const password = String(data.password || "");
      if (name.length < 2 || name.length > 80) throw new Error("Enter your name.");
      if (shopName.length < 2 || shopName.length > 100) throw new Error("Enter your shop name.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
      if (password.length < 8 || password.length > 100) throw new Error("Choose a password with at least 8 characters.");
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      try {
        await updateProfile(credential.user, { displayName: name });
        const batch = writeBatch(db);
        batch.set(userRef(credential.user.uid), {
          name, shopName, email, assistantName: "Jarvis", speechLanguage: "en-IN",
          wakeEnabled: false, createdAt: new Date().toISOString(),
        });
        inventorySeed.forEach(([id, itemName, unit, quantity, lowAt, supplier]) => {
          batch.set(doc(recordsRef(credential.user.uid, "inventory"), id), { name: itemName, unit, quantity, lowAt, supplier });
        });
        await batch.commit();
        return publicUser(credential.user, { name, shopName, email });
      } catch (error) {
        await deleteUser(credential.user).catch(() => {});
        throw error;
      }
    }),
    login: (data) => run(async () => {
      const credential = await signInWithEmailAndPassword(auth, String(data.email || "").trim().toLowerCase(), String(data.password || ""));
      const profile = await loadProfile(credential.user);
      return publicUser(credential.user, profile);
    }),
    resetPassword: async (email) => {
      const normalizedEmail = String(email || "").trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw new Error("Enter a valid email address.");
      try {
        await sendPasswordResetEmail(auth, normalizedEmail);
      } catch (error) {
        // Keep the message consistent for unknown addresses to avoid exposing account existence.
        if (error?.code !== "auth/user-not-found") throw appError(error);
      }
      return true;
    },
    logout: () => run(() => signOut(auth)),
    updateSettings: (settings) => run(async () => {
      const user = await currentUser();
      const assistantName = String(settings.assistantName || "Jarvis").trim();
      const speechLanguage = String(settings.speechLanguage || "en-IN");
      if (assistantName.length < 2 || assistantName.length > 24) throw new Error("Use an assistant name from 2 to 24 characters.");
      if (!/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(speechLanguage) || speechLanguage.length > 35) throw new Error("Enter a valid language tag, such as hi-IN or fr-FR.");
      const update = { assistantName, speechLanguage, wakeEnabled: Boolean(settings.wakeEnabled) };
      await updateDoc(userRef(user.uid), update);
      const profile = await loadProfile(user);
      return publicUser(user, { ...profile, ...update });
    }),
    dashboard: () => run(async () => getDashboard((await currentUser()).uid)),
    sales: (period = "month") => run(async () => listSales((await currentUser()).uid, period)),
    expenses: (filters = {}) => run(async () => listExpenses((await currentUser()).uid, filters)),
    credit: () => run(async () => listCredit((await currentUser()).uid)),
    inventory: () => run(async () => ({ items: await listInventory((await currentUser()).uid) })),
    orders: () => run(async () => ({ orders: await listOrders((await currentUser()).uid) })),
    createExpense: (data) => run(async () => {
      const uid = (await currentUser()).uid;
      const title = String(data.title || "").trim();
      if (!title || title.length > 100) throw new Error("Add a short expense name (up to 100 characters).");
      if (!categories[data.category]) throw new Error("Choose an expense category.");
      const amount = Number(data.amount);
      if (!Number.isFinite(amount) || amount <= 0 || amount > 10000000) throw new Error("Enter an amount greater than zero.");
      const method = String(data.method || "cash").toLowerCase();
      if (!["cash", "upi", "card", "bank", "credit"].includes(method)) throw new Error("Choose a valid payment method.");
      const date = String(data.date || todayString());
      const ref = await addDoc(recordsRef(uid, "expenses"), {
        title, category: data.category, amountPaise: toPaise(amount), paidOn: date, method,
        vendor: String(data.vendor || "").trim(), note: String(data.note || "").trim(), createdAt: new Date().toISOString(),
      });
      return { id: ref.id, message: "Expense saved." };
    }),
    createSale: (data) => run(async () => {
      const uid = (await currentUser()).uid;
      const amount = Number(data.amount);
      const label = String(data.label || "Shop sale").trim();
      if (!label || label.length > 100) throw new Error("Add a short sale description (up to 100 characters).");
      if (!Number.isFinite(amount) || amount <= 0 || amount > 10000000) throw new Error("Enter a sale amount greater than zero.");
      const ref = await addDoc(recordsRef(uid, "sales"), {
        label, amountPaise: toPaise(amount), soldOn: String(data.date || todayString()), createdAt: new Date().toISOString(),
      });
      return { id: ref.id, message: "Sale saved." };
    }),
    createLedgerEntry: (data) => run(async () => {
      const uid = (await currentUser()).uid;
      const customer = String(data.customer || "").trim();
      const amount = Number(data.amount);
      if (!customer || customer.length > 80) throw new Error("Enter the customer’s name.");
      if (!["credit", "payment"].includes(data.type)) throw new Error("Choose credit added or payment received.");
      if (!Number.isFinite(amount) || amount <= 0 || amount > 10000000) throw new Error("Enter an amount greater than zero.");
      const id = await addCreditEntry(uid, { ...data, customer, amount });
      return { id, message: data.type === "payment" ? "Payment recorded." : "Udhaar recorded." };
    }),
    createOrder: (data) => run(async () => {
      const uid = (await currentUser()).uid;
      const itemSnap = await getDoc(doc(recordsRef(uid, "inventory"), String(data.itemId || "")));
      if (!itemSnap.exists()) throw new Error("Choose an item from your stock list.");
      const item = itemSnap.data();
      const quantity = Number(data.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100000) throw new Error("Enter a quantity greater than zero.");
      const ref = await addDoc(recordsRef(uid, "orders"), {
        itemId: itemSnap.id, itemName: item.name, supplier: String(data.supplier || item.supplier || "").trim(),
        quantity, unit: item.unit, status: "draft", createdAt: new Date().toISOString(),
      });
      return { id: ref.id, message: "Restock draft saved." };
    }),
    markOrderPlaced: (id) => run(async () => {
      const uid = (await currentUser()).uid;
      const ref = doc(recordsRef(uid, "orders"), String(id));
      const snapshot = await getDoc(ref);
      if (!snapshot.exists() || snapshot.data().status !== "draft") throw new Error("That restock draft was not found.");
      await updateDoc(ref, { status: "placed" });
      return { message: "Order marked as placed." };
    }),
    parseVoice: (text, intent = "auto") => run(async () => {
      const uid = (await currentUser()).uid;
      return parseVoiceCommand(text, intent, await listInventory(uid));
    }),
  };
}

export { buildApi };
