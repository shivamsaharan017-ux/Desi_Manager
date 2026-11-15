import { buildApi } from "./firebaseApi.js";

const API_BASE = (import.meta.env.VITE_API_URL || "http://127.0.0.1:4000/api").replace(/\/$/, "");
const TOKEN_KEY = "desimanager.session";

function createLocalApi() {
  function getToken() {
    return window.localStorage.getItem(TOKEN_KEY) || "";
  }

  function saveToken(token) {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  }

  async function request(path, options = {}) {
    const token = getToken();
    const response = await fetch(API_BASE + path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
        ...(options.headers || {}),
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "The server could not complete that request.");
    return payload;
  }

  async function signIn(path, data) {
    const payload = await request(path, { method: "POST", body: JSON.stringify(data) });
    saveToken(payload.token);
    return payload.user;
  }

  return {
    baseUrl: API_BASE,
    getToken,
    clearToken: () => saveToken(""),
    health: () => request("/health"),
    login: (data) => signIn("/auth/login", data),
    register: (data) => signIn("/auth/register", data),
    me: async () => (await request("/auth/me")).user,
    logout: async () => {
      try { await request("/auth/logout", { method: "POST" }); }
      finally { saveToken(""); }
    },
    updateSettings: async (data) => (await request("/settings", { method: "PATCH", body: JSON.stringify(data) })).user,
    dashboard: (period = "month") => request("/dashboard?period=" + encodeURIComponent(period)),
    expenses: (filters = {}) => {
      const query = new URLSearchParams();
      if (filters.category && filters.category !== "all") query.set("category", filters.category);
      if (filters.search) query.set("search", filters.search);
      if (filters.period) query.set("period", filters.period);
      return request("/expenses?" + query.toString());
    },
    createExpense: (data) => request("/expenses", { method: "POST", body: JSON.stringify(data) }),
    sales: (period = "month") => request("/sales?period=" + encodeURIComponent(period)),
    createSale: (data) => request("/sales", { method: "POST", body: JSON.stringify(data) }),
    credit: () => request("/credit"),
    createLedgerEntry: (data) => request("/credit", { method: "POST", body: JSON.stringify(data) }),
    inventory: () => request("/inventory"),
    orders: () => request("/orders"),
    createOrder: (data) => request("/orders", { method: "POST", body: JSON.stringify(data) }),
    markOrderPlaced: (id) => request("/orders/" + encodeURIComponent(id) + "/placed", { method: "POST" }),
    parseVoice: (text, intent = "auto") => request("/voice/parse", { method: "POST", body: JSON.stringify({ text, intent }) }),
  };
}

export const api = import.meta.env.VITE_BACKEND_MODE === "firebase"
  ? buildApi()
  : createLocalApi();

