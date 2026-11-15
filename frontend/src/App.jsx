import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  Check,
  ChevronDown,
  CircleCheck,
  Clock3,
  Coffee,
  CreditCard,
  Download,
  Ellipsis,
  FileText,
  Filter,
  Headphones,
  IndianRupee,
  LayoutDashboard,
  LogOut,
  Mic,
  Mic2,
  Package,
  Plus,
  Search,
  Send,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  TrendingUp,
  Truck,
  Users,
  Volume2,
  Wallet,
  Wrench,
  X,
  Zap,
  Building2,
} from "lucide-react";
import { api } from "./api.js";

const categoryInfo = {
  rent: { label: "Rent", icon: Building2, tone: "rent" },
  stock: { label: "Supplies", icon: Package, tone: "stock" },
  wages: { label: "Team", icon: Users, tone: "team" },
  utilities: { label: "Bills", icon: Zap, tone: "bills" },
  delivery: { label: "Delivery", icon: Truck, tone: "delivery" },
  maintenance: { label: "Maintenance", icon: Wrench, tone: "maintenance" },
  other: { label: "Other", icon: Ellipsis, tone: "other" },
};

const navItems = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "sales", label: "Sales", icon: TrendingUp },
  { id: "expenses", label: "Expenses", icon: Wallet },
  { id: "credit", label: "Udhaar book", icon: BookOpen },
  { id: "stock", label: "Stock & orders", icon: Package },
  { id: "voice", label: "Voice assistant", icon: Mic2 },
];

const formatCurrency = (amount = 0) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(amount || 0));

const formatDate = (date) => {
  if (!date) return "Today";
  const value = new Date(date + "T12:00:00");
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(value);
};

const dateValue = () => new Date().toLocaleDateString("en-CA");

function App() {
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [page, setPage] = useState("overview");
  const [dashboard, setDashboard] = useState(null);
  const [salesData, setSalesData] = useState(null);
  const [expenseData, setExpenseData] = useState(null);
  const [creditData, setCreditData] = useState(null);
  const [inventoryData, setInventoryData] = useState(null);
  const [ordersData, setOrdersData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState("connecting");
  const [loadError, setLoadError] = useState("");
  const [modal, setModal] = useState("");
  const [toast, setToast] = useState("");
  const [expenseFilter, setExpenseFilter] = useState("all");
  const [expenseSearch, setExpenseSearch] = useState("");
  const [wakeCommand, setWakeCommand] = useState(null);
  const [wakePaused, setWakePaused] = useState(false);
  const [wakeStatus, setWakeStatus] = useState("");
  const [voiceStartRequest, setVoiceStartRequest] = useState(0);
  const toastTimer = useRef(null);
  const wakeCommandSequence = useRef(0);
  const wakeReadyToastShown = useRef(false);

  useEffect(() => {
    if (!api.getToken()) {
      setAuthLoading(false);
      return;
    }
    api.me()
      .then(setAuthUser)
      .catch(() => api.clearToken())
      .finally(() => setAuthLoading(false));
  }, []);

  const refresh = useCallback(async () => {
    setConnection("connecting");
    try {
      const [health, dashboardResult, salesResult, expensesResult, creditResult, inventoryResult, ordersResult] = await Promise.all([
        api.health(),
        api.dashboard(),
        api.sales(),
        api.expenses(),
        api.credit(),
        api.inventory(),
        api.orders(),
      ]);
      setConnection(health.ok ? "online" : "offline");
      setDashboard(dashboardResult);
      setSalesData(salesResult);
      setExpenseData(expensesResult);
      setCreditData(creditResult);
      setInventoryData(inventoryResult);
      setOrdersData(ordersResult);
      setLoadError("");
    } catch (error) {
      setConnection("offline");
      setLoadError(error.message || "Could not reach the API server.");
    } finally {
      setLoading(false);
    }
  }, [authUser?.id]);

  useEffect(() => {
    if (authLoading) return;
    if (authUser) {
      setLoading(true);
      refresh();
    } else {
      setLoading(false);
    }
    return () => window.clearTimeout(toastTimer.current);
  }, [authLoading, authUser, refresh]);

  const showToast = (message) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 3200);
  };

  const handleWakeStatus = (message) => {
    setWakeStatus(message);
    if (/on every page/i.test(message) && !wakeReadyToastShown.current) {
      wakeReadyToastShown.current = true;
      showToast(message);
    } else if (/blocked|lost microphone|does not support|aren.t supported|cannot access|couldn’t start|reconnecting/i.test(message)) {
      wakeReadyToastShown.current = false;
      showToast(message);
    }
  };

  const saveExpense = async (data) => {
    await api.createExpense(data);
    await refresh();
    setModal("");
    showToast("Expense saved to your shop book.");
  };

  const saveSale = async (data) => {
    await api.createSale(data);
    await refresh();
    setModal("");
    showToast("Sale saved to your sales book.");
  };

  const saveLedgerEntry = async (data) => {
    await api.createLedgerEntry(data);
    await refresh();
    setModal("");
    showToast(data.type === "payment" ? "Payment added to the udhaar book." : "Udhaar added to the customer book.");
  };

  const saveOrder = async (data) => {
    await api.createOrder(data);
    await refresh();
    setModal("");
    showToast("Restock draft saved. Place it with your supplier when ready.");
  };

  const markOrderPlaced = async (id) => {
    await api.markOrderPlaced(id);
    await refresh();
    showToast("Order marked as placed.");
  };

  const handleAuthenticated = (user) => {
    setAuthUser(user);
    setPage("overview");
    setLoading(true);
  };

  const handleLogout = async () => {
    try { await api.logout(); } catch { api.clearToken(); }
    setAuthUser(null);
    setDashboard(null);
    setSalesData(null);
    setExpenseData(null);
    setCreditData(null);
    setInventoryData(null);
    setOrdersData(null);
    setLoadError("");
    setLoading(false);
  };

  const updateSettings = async (settings) => {
    const updated = await api.updateSettings(settings);
    setAuthUser(updated);
    return updated;
  };

  const handleWakeCommand = (text) => {
    setPage("voice");
    wakeCommandSequence.current += 1;
    setWakeCommand({ text, id: wakeCommandSequence.current });
    showToast(text ? "Wake word heard. Opening Voice Assistant…" : "Wake word heard. Listening for your command…");
  };

  const consumeWakeCommand = (id) => setWakeCommand((current) => current?.id === id ? null : current);
  const consumeVoiceStartRequest = (id) => setVoiceStartRequest((current) => current === id ? 0 : current);

  const filteredExpenseData = useMemo(() => {
    const rows = expenseData?.items || [];
    const needle = expenseSearch.trim().toLowerCase();
    return rows.filter((item) => {
      const matchesCategory = expenseFilter === "all" || item.category === expenseFilter;
      const matchesText = !needle || [item.title, item.vendor, item.note, item.categoryLabel].some((value) => String(value || "").toLowerCase().includes(needle));
      return matchesCategory && matchesText;
    });
  }, [expenseData, expenseFilter, expenseSearch]);

  if (authLoading) {
    return <div className="boot-screen"><div className="boot-mark"><Coffee size={24} /></div><p>Opening DesiManager…</p></div>;
  }

  if (!authUser) return <LoginPage onAuthenticated={handleAuthenticated} />;

  if (loading) {
    return (
      <div className="boot-screen">
        <div className="boot-mark"><Coffee size={24} /></div>
        <p>Opening your shop book…</p>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <WakeWordController enabled={authUser.wakeEnabled && !wakePaused} wakeName={authUser.assistantName} language={authUser.speechLanguage} onCommand={handleWakeCommand} onStatus={handleWakeStatus} />
      <Sidebar page={page} onNavigate={setPage} connection={connection} user={authUser} onLogout={handleLogout} />
      <main className="main-area">
        <Topbar onVoice={() => { setPage("voice"); setVoiceStartRequest((current) => current + 1); }} connection={connection} assistantName={authUser.assistantName} onNotify={() => showToast("You’re all caught up. No new shop alerts.")} onLogout={handleLogout} />
        <div className="page-wrap">
          {loadError && (
            <div className="connection-banner" role="alert">
              <span><span className="status-dot status-dot--offline" /> API is offline — {loadError}</span>
              <button className="button button--small button--ghost" type="button" onClick={refresh}>Reconnect</button>
            </div>
          )}

          {page === "overview" && dashboard && (
            <OverviewPage
              dashboard={dashboard}
              onNavigate={setPage}
              onAdd={() => setModal("expense")}
              onCategory={(category) => { setExpenseFilter(category); setPage("expenses"); }}
            />
          )}
          {page === "expenses" && dashboard && expenseData && (
            <ExpensesPage
              dashboard={dashboard}
              expenseData={expenseData}
              rows={filteredExpenseData}
              category={expenseFilter}
              setCategory={setExpenseFilter}
              search={expenseSearch}
              setSearch={setExpenseSearch}
              onAdd={() => setModal("expense")}
            />
          )}
          {page === "sales" && salesData && (
            <SalesPage data={salesData} onVoice={() => setPage("voice")} />
          )}
          {page === "credit" && creditData && (
            <CreditPage data={creditData} onAdd={() => setModal("ledger")} />
          )}
          {page === "stock" && inventoryData && (
            <InventoryPage items={inventoryData.items || []} orders={ordersData?.orders || []} onVoice={() => setPage("voice")} onAdd={() => setModal("restock")} onMarkPlaced={markOrderPlaced} />
          )}
          {page === "voice" && (
            <VoiceAssistantPage
              onExpense={saveExpense}
              onSale={saveSale}
              onLedger={saveLedgerEntry}
              onOrder={saveOrder}
              user={authUser}
              onUpdateSettings={updateSettings}
              wakeCommand={wakeCommand}
              onWakeCommandConsumed={consumeWakeCommand}
              voiceStartRequest={voiceStartRequest}
              onVoiceStartConsumed={consumeVoiceStartRequest}
              wakePaused={wakePaused}
              onWakePause={setWakePaused}
              onWakeStatus={handleWakeStatus}
              wakeStatus={wakeStatus}
            />
          )}
          {page === "overview" && !dashboard && <EmptyState onRetry={refresh} />}
        </div>
      </main>
      <MobileNav page={page} onNavigate={setPage} />
      {modal === "expense" && <ExpenseModal onClose={() => setModal("")} onSave={saveExpense} />}
      {modal === "ledger" && <LedgerModal onClose={() => setModal("")} onSave={saveLedgerEntry} />}
      {modal === "restock" && <RestockModal items={inventoryData?.items || []} onClose={() => setModal("")} onSave={saveOrder} />}
      {toast && <div className="toast" role="status"><CircleCheck size={18} />{toast}</div>}
    </div>
  );
}

function LoginPage({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({
    name: "",
    shopName: "",
    email: import.meta.env.DEV ? "rakesh@desimanager.demo" : "",
    password: import.meta.env.DEV ? "chai1234" : "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const user = mode === "register"
        ? await api.register(form)
        : await api.login({ email: form.email, password: form.password });
      onAuthenticated(user);
    } catch (requestError) {
      setError(requestError.message || "Couldn’t sign you in. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login-shell">
      <section className="login-story">
        <div className="login-brand"><span className="brand-mark"><Coffee size={21} /></span><strong>DesiManager</strong></div>
        <div className="login-story-copy">
          <span className="login-kicker">A CALMER WAY TO RUN YOUR SHOP</span>
          <h1>Your shop, in<br /><em>good hands.</em></h1>
          <p>Keep rent, daily spending, customer udhaar, and stock in one simple shop book. Speak when your hands are busy.</p>
          <div className="login-features">
            <div><span><Wallet size={17} /></span><p><strong>Every rupee, clear</strong><small>Expenses grouped by rent, stock, staff, and more.</small></p></div>
            <div><span><BookOpen size={17} /></span><p><strong>Every customer, remembered</strong><small>Track udhaar given, payments received, and balance due.</small></p></div>
            <div><span><Mic2 size={17} /></span><p><strong>Hands-free when you need it</strong><small>Wake your assistant by name after you enable microphone access.</small></p></div>
          </div>
        </div>
        <div className="login-story-foot"><span><ShieldCheck size={16} />Your shop book stays separate for each account</span><span>Built for busy counters</span></div>
        <div className="login-coffee-mark"><Coffee size={170} strokeWidth={.7} /></div>
      </section>
      <section className="login-panel">
        <div className="login-card">
          <div className="login-card-mark"><Store size={20} /></div>
          <span className="eyebrow">{mode === "login" ? "WELCOME BACK" : "LET’S GET STARTED"}</span>
          <h2>{mode === "login" ? "Sign in to your shop." : "Create your shop account."}</h2>
          <p className="login-intro">{mode === "login" ? "Your books are right where you left them." : "Your expense, udhaar, and voice settings will belong to your account."}</p>
          <form className="login-form" onSubmit={submit}>
            {mode === "register" && (
              <>
                <label className="form-field"><span>Your name</span><input autoComplete="name" value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="e.g. Rakesh Kumar" required /></label>
                <label className="form-field"><span>Shop name</span><input autoComplete="organization" value={form.shopName} onChange={(event) => update("shopName", event.target.value)} placeholder="e.g. Rakesh’s Chai Corner" required /></label>
              </>
            )}
            <label className="form-field"><span>Email address</span><input type="email" autoComplete="username" value={form.email} onChange={(event) => update("email", event.target.value)} placeholder="you@example.com" required /></label>
            <label className="form-field"><span>Password</span><input type="password" minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} value={form.password} onChange={(event) => update("password", event.target.value)} placeholder="At least 8 characters" required /></label>
            {error && <div className="inline-alert" role="alert">{error}</div>}
            <button className="button button--primary login-submit" type="submit" disabled={busy}><span>{busy ? "One moment…" : mode === "login" ? "Sign in" : "Create account"}</span><ArrowRight size={17} /></button>
          </form>
          {import.meta.env.DEV && mode === "login" && <div className="demo-access"><span className="demo-access-icon"><Sparkles size={15} /></span><span><strong>Demo shop</strong><small>Email: rakesh@desimanager.demo · Password: chai1234</small></span></div>}
          <div className="login-switch">{mode === "login" ? "New to DesiManager?" : "Already have an account?"}<button type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>{mode === "login" ? "Create an account" : "Sign in"}</button></div>
        </div>
        <p className="login-panel-foot">By signing in, your shop records are scoped to your account.</p>
      </section>
    </main>
  );
}

function WakeWordController({ enabled, wakeName, language, onCommand, onStatus }) {
  const commandRef = useRef(onCommand);
  const statusRef = useRef(onStatus);
  useEffect(() => { commandRef.current = onCommand; }, [onCommand]);
  useEffect(() => { statusRef.current = onStatus; }, [onStatus]);

  useEffect(() => {
    if (!enabled) return undefined;
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      statusRef.current("Hands-free wake words aren’t supported in this browser. Use the Talk button instead.");
      return undefined;
    }
    let active = true;
    let recognition = null;
    let restartTimer = null;
    let transcriptHintTimer = null;
    let resumeAfter = 0;
    let retryCount = 0;
    let retryDelay = 700;
    let wakeOnlyTimer = null;
    let pendingWakeOnly = false;
    let wakeHandoffStarted = false;
    const name = String(wakeName || "Jarvis").trim();
    const scheduleRestart = (delay = retryDelay) => {
      window.clearTimeout(restartTimer);
      if (!active) return;
      const quietPeriod = Math.max(0, resumeAfter - Date.now());
      restartTimer = window.setTimeout(start, Math.max(delay, quietPeriod));
    };
    const start = () => {
      window.clearTimeout(restartTimer);
      if (!active) return;
      if (Date.now() < resumeAfter) {
        restartTimer = window.setTimeout(start, Math.max(300, resumeAfter - Date.now()));
        return;
      }
      try {
        recognition = new Recognition();
        recognition.lang = language || navigator.language || "en-IN";
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
        recognition.onstart = () => {
          retryCount = 0;
          retryDelay = 700;
          wakeHandoffStarted = false;
          statusRef.current("Hands-free mode is listening for “" + name + "” on every page in this tab.");
        };
        const handoff = (command) => {
          if (wakeHandoffStarted) return;
          wakeHandoffStarted = true;
          pendingWakeOnly = false;
          window.clearTimeout(wakeOnlyTimer);
          resumeAfter = Date.now() + (command ? 4500 : 2200);
          statusRef.current(command
            ? "Wake word and command heard. Opening the voice assistant…"
            : "Wake word heard. Starting the command microphone…");
          commandRef.current(command);
          recognition?.stop();
        };
        recognition.onresult = (event) => {
          for (let index = event.resultIndex; index < event.results.length; index += 1) {
            const result = event.results[index];
            const transcript = result[0].transcript.trim();
            const wakeMatch = findWakeWord(transcript, name);
            if (!wakeMatch) {
              if (result.isFinal && transcript) {
                window.clearTimeout(transcriptHintTimer);
                statusRef.current("Heard “" + transcript.slice(0, 80) + "”. Say “" + name + "” to start.");
                transcriptHintTimer = window.setTimeout(() => {
                  if (active) statusRef.current("Hands-free mode is listening for “" + name + "” on every page in this tab.");
                }, 3500);
              }
              pendingWakeOnly = false;
              window.clearTimeout(wakeOnlyTimer);
              continue;
            }
            window.clearTimeout(transcriptHintTimer);
            const command = transcript.slice(wakeMatch.end).replace(/^[\s,.:;!؟،-]+/u, "").trim();
            if (result.isFinal) {
              handoff(command);
              return;
            }
            if (!command) {
              pendingWakeOnly = true;
              window.clearTimeout(wakeOnlyTimer);
              wakeOnlyTimer = window.setTimeout(() => {
                if (pendingWakeOnly) handoff("");
              }, 900);
            }
          }
        };
        recognition.onerror = (event) => {
          if (!active || event.error === "no-speech" || event.error === "aborted") return;
          const messages = {
            "not-allowed": "Hands-free listening lost microphone permission. Check browser settings and re-enable it in voice settings.",
            "service-not-allowed": "This browser blocked its speech service. Try Chrome or Edge, or turn off hands-free mode and use typed commands.",
            "audio-capture": "Hands-free listening cannot access a microphone. Check your system input device.",
            network: "Wake-word listening lost the browser speech connection. Reconnecting…",
            "language-not-supported": "This browser does not support wake-word listening in the selected language.",
          };
          const fatalErrors = ["not-allowed", "service-not-allowed", "audio-capture", "language-not-supported"];
          statusRef.current(messages[event.error] || "Wake-word listener interrupted. Reconnecting…");
          if (fatalErrors.includes(event.error)) {
            active = false;
            return;
          }
          retryCount += 1;
          retryDelay = Math.min(700 * (2 ** Math.min(retryCount, 4)), 10000);
          scheduleRestart(retryDelay);
        };
        recognition.onend = () => {
          pendingWakeOnly = false;
          window.clearTimeout(wakeOnlyTimer);
          scheduleRestart(retryDelay);
        };
        recognition.start();
      } catch {
        statusRef.current("Couldn’t start wake-word listening. Reconnecting…");
        retryCount += 1;
        retryDelay = Math.min(700 * (2 ** Math.min(retryCount, 4)), 10000);
        scheduleRestart(retryDelay);
      }
    };
    start();
    return () => {
      active = false;
      window.clearTimeout(restartTimer);
      window.clearTimeout(wakeOnlyTimer);
      window.clearTimeout(transcriptHintTimer);
      recognition?.abort();
    };
  }, [enabled, wakeName, language]);

  return null;
}

const devanagariToLatin = {
  अ: "a", आ: "aa", इ: "i", ई: "ii", उ: "u", ऊ: "uu", ऋ: "ri", ए: "e", ऐ: "ai", ओ: "o", औ: "au",
  क: "k", ख: "kh", ग: "g", घ: "gh", ङ: "ng", च: "ch", छ: "chh", ज: "j", झ: "jh", ञ: "ny",
  ट: "t", ठ: "th", ड: "d", ढ: "dh", ण: "n", त: "t", थ: "th", द: "d", ध: "dh", न: "n",
  प: "p", फ: "ph", ब: "b", भ: "bh", म: "m", य: "y", र: "r", ल: "l", व: "v", श: "sh", ष: "sh", स: "s", ह: "h",
  "ा": "aa", "ि": "i", "ी": "ii", "ु": "u", "ू": "uu", "ृ": "ri", "े": "e", "ै": "ai", "ो": "o", "ौ": "au",
  "ं": "m", "ँ": "m", "ः": "h", "्": "", "़": "",
};

function wakePhoneticKey(value) {
  const romanized = [...String(value || "").normalize("NFC").toLocaleLowerCase()]
    .map((character) => devanagariToLatin[character] ?? character)
    .join("")
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  return romanized.replace(/[aeiou]/g, "").replace(/[^a-z0-9]/g, "").replace(/(.)\1+/g, "$1");
}

function findWakeWord(transcript, wakeName) {
  const directPosition = transcript.toLocaleLowerCase().indexOf(wakeName.toLocaleLowerCase());
  if (directPosition >= 0) return { end: directPosition + wakeName.length };

  const nameParts = [...wakeName.matchAll(/[\p{L}\p{M}\p{N}]+/gu)].map((match) => wakePhoneticKey(match[0]));
  const target = nameParts.join("");
  if (target.length < 3) return null;
  const transcriptParts = [...transcript.matchAll(/[\p{L}\p{M}\p{N}]+/gu)];
  for (let start = 0; start < transcriptParts.length; start += 1) {
    let combined = "";
    for (let end = start; end < transcriptParts.length && end < start + nameParts.length + 2; end += 1) {
      combined += wakePhoneticKey(transcriptParts[end][0]);
      if (combined === target) return { end: transcriptParts[end].index + transcriptParts[end][0].length };
      if (!target.startsWith(combined)) break;
    }
  }
  return null;
}

function Sidebar({ page, onNavigate, connection, user, onLogout }) {
  return (
    <aside className="sidebar">
      <button className="brand" type="button" onClick={() => onNavigate("overview")} aria-label="DesiManager home">
        <span className="brand-mark"><Coffee size={20} strokeWidth={2.3} /></span>
        <span className="brand-copy">
          <strong>DesiManager</strong>
          <small>Your shop, in good hands</small>
        </span>
      </button>
      <div className="sidebar-shop">
        <span className="shop-avatar"><Store size={18} /></span>
        <span><strong>{user.shopName}</strong><small>{user.name} · Shop owner</small></span>
        <Store size={15} className="shop-chevron" aria-hidden="true" />
      </div>
      <p className="nav-kicker">YOUR BUSINESS</p>
      <nav className="side-nav" aria-label="Main navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={"nav-link" + (page === item.id ? " nav-link--active" : "")}
              type="button"
              onClick={() => onNavigate(item.id)}
              aria-current={page === item.id ? "page" : undefined}
            >
              <Icon size={19} strokeWidth={1.9} />
              <span>{item.label}</span>
              {item.id === "stock" && <span className="nav-count">2</span>}
            </button>
          );
        })}
      </nav>
      <div className="sidebar-spacer" />
      <div className="sidebar-help">
        <div className="help-icon"><Headphones size={19} /></div>
        <div><strong>Need a hand?</strong><span>We’re right here.</span></div>
      </div>
      <div className="sidebar-profile">
        <div className="profile-avatar">{user.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</div>
        <div className="profile-copy"><strong>{user.name}</strong><span>Owner account</span></div>
        <button className="icon-button profile-menu" type="button" onClick={onLogout} aria-label="Sign out"><LogOut size={17} /></button>
      </div>
      <div className="sidebar-sync"><span className={"status-dot status-dot--" + connection} />{connection === "online" ? "All changes saved" : connection === "connecting" ? "Connecting to your shop book" : "Waiting for API"}</div>
    </aside>
  );
}

function MobileNav({ page, onNavigate }) {
  const mobileItems = navItems.filter((item) => ["overview", "sales", "expenses", "credit", "stock", "voice"].includes(item.id));
  return (
    <nav className="mobile-nav" aria-label="Mobile navigation">
      {mobileItems.map((item) => {
        const Icon = item.icon;
        return (
          <button key={item.id} type="button" onClick={() => onNavigate(item.id)} className={page === item.id ? "mobile-nav-item active" : "mobile-nav-item"} aria-current={page === item.id ? "page" : undefined}>
            <Icon size={20} />
            <span>{item.id === "credit" ? "Udhaar" : item.id === "voice" ? "Speak" : item.label.split(" ")[0]}</span>
          </button>
        );
      })}
    </nav>
  );
}

function Topbar({ onVoice, connection, onNotify, assistantName, onLogout }) {
  const today = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
  return (
    <header className="topbar">
      <div className="topbar-date"><span>{today}</span><span className="topbar-separator">/</span><span>Namaste</span></div>
      <div className="topbar-actions">
        <span className={"connection-chip" + (connection === "online" ? " connection-chip--online" : "")}>
          <span className={"status-dot status-dot--" + connection} />{connection === "online" ? "Synced" : connection === "connecting" ? "Connecting" : "Offline"}
        </span>
        <button className="icon-button notification-button" type="button" aria-label="Notifications" onClick={onNotify}>
          <Bell size={18} /><span className="notification-dot" />
        </button>
        <button className="button button--primary topbar-voice" type="button" onClick={onVoice}>
          <Mic size={17} /><span>Talk to {assistantName}</span>
        </button>
        <button className="icon-button logout-button" type="button" onClick={onLogout} aria-label="Sign out"><LogOut size={18} /></button>
      </div>
    </header>
  );
}

function PageHeading({ eyebrow, title, subtitle, action }) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function OverviewPage({ dashboard, onNavigate, onAdd, onCategory }) {
  const periodLabel = dashboard.month || "This month";
  return (
    <>
      <PageHeading
        eyebrow="YOUR SHOP AT A GLANCE"
        title="A little more clarity, every day."
        subtitle={periodLabel + " · Here’s how your shop is doing so far."}
        action={<button className="button button--outline" type="button" onClick={() => onNavigate("expenses")}><FileText size={17} />View shop book</button>}
      />
      <section className="metric-grid" aria-label="Business summary">
        <MetricCard title="Sales this month" amount={dashboard.sales} icon={TrendingUp} change="Daily counter sales" tone="sales" />
        <MetricCard title="Spent this month" amount={dashboard.expenses} icon={ArrowDownRight} change={dashboard.expenseCount + " expense entries"} tone="spend" />
        <MetricCard title="Net so far" amount={dashboard.net} icon={Wallet} change="Sales less expenses" tone="profit" />
        <MetricCard title="Udhaar to collect" amount={dashboard.creditDue} icon={BookOpen} change="From regular customers" tone="credit" />
      </section>
      <section className="content-grid overview-grid">
        <div className="panel trend-panel">
          <div className="panel-heading">
            <div><span className="panel-kicker">MONEY MOVING</span><h2>Sales & spending</h2><p>Last 7 days · Rupees</p></div>
            <span className="select-pill" aria-label="Showing the last seven days">This week <ChevronDown size={15} /></span>
          </div>
          <DailyTrend data={dashboard.trend || []} />
        </div>
        <div className="panel breakdown-panel">
          <div className="panel-heading">
            <div><span className="panel-kicker">WHERE IT GOES</span><h2>Spending split</h2><p>{formatCurrency(dashboard.expenses)} total this month</p></div>
            <button className="icon-button" type="button" aria-label="Open all expenses" onClick={() => onNavigate("expenses")}><ArrowRight size={18} /></button>
          </div>
          <CategoryBreakdown rows={dashboard.categories || []} total={dashboard.expenses} onSelect={onCategory} />
        </div>
        <div className="panel recent-panel">
          <div className="panel-heading">
            <div><span className="panel-kicker">RECENT ACTIVITY</span><h2>Latest expenses</h2></div>
            <button className="text-button" type="button" onClick={() => onNavigate("expenses")}>See all <ArrowRight size={15} /></button>
          </div>
          <ExpenseRows rows={dashboard.recent || []} compact />
          <button className="button button--soft add-inline" type="button" onClick={onAdd}><Plus size={16} />Add an expense</button>
        </div>
        <div className="voice-promo">
          <div className="voice-promo-top">
            <span className="voice-promo-icon"><Sparkles size={19} /></span>
            <span className="voice-promo-tag">MADE FOR BUSY HANDS</span>
          </div>
          <h2>Just say it.<br />We’ll write it down.</h2>
          <p>Log milk, rent, or customer udhaar with a quick voice note. No typing while the kettle’s on.</p>
          <button className="button button--cream" type="button" onClick={() => onNavigate("voice")}><Mic size={17} />Try voice entry</button>
          <div className="voice-promo-watermark"><Coffee size={116} strokeWidth={0.8} /></div>
        </div>
      </section>
    </>
  );
}

function MetricCard({ title, amount, icon: Icon, change, tone }) {
  return (
    <article className={"metric-card metric-card--" + tone}>
      <div className="metric-top"><span className="metric-icon"><Icon size={18} /></span><span className="metric-title">{title}</span><span className="metric-period">MTD</span></div>
      <div className="metric-amount">{formatCurrency(amount)}</div>
      <div className="metric-bottom"><span>{change}</span>{tone === "profit" && <span className="metric-trend"><ArrowUpRight size={15} /></span>}</div>
    </article>
  );
}

function DailyTrend({ data }) {
  const max = Math.max(1, ...data.flatMap((item) => [item.sales, item.expenses]));
  return (
    <div className="trend-chart">
      <div className="chart-y-labels" aria-hidden="true"><span>{formatCompact(max)}</span><span>{formatCompact(max / 2)}</span><span>₹0</span></div>
      <div className="chart-plot" aria-hidden="true">
        <div className="chart-gridline chart-gridline--top" /><div className="chart-gridline chart-gridline--mid" /><div className="chart-gridline chart-gridline--bottom" />
        <div className="bar-groups">
          {data.map((item) => (
            <div className="bar-group" key={item.date} title={item.day + ": sales " + formatCurrency(item.sales) + ", expenses " + formatCurrency(item.expenses)}>
              <div className="bar-pair">
                <span className="trend-bar trend-bar--sales" style={{ height: Math.max(3, (item.sales / max) * 100) + "%" }} />
                <span className="trend-bar trend-bar--expense" style={{ height: Math.max(3, (item.expenses / max) * 100) + "%" }} />
              </div>
              <span className="bar-day">{item.day}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="chart-legend"><span><i className="legend-dot legend-dot--sales" />Sales</span><span><i className="legend-dot legend-dot--expense" />Expenses</span><span className="chart-note"><Clock3 size={13} />Updates as you log</span></div>
      <table className="sr-only"><caption>Sales and expenses for the last seven days</caption><thead><tr><th>Day</th><th>Sales</th><th>Expenses</th></tr></thead><tbody>{data.map((item) => <tr key={item.date}><td>{item.day}</td><td>{formatCurrency(item.sales)}</td><td>{formatCurrency(item.expenses)}</td></tr>)}</tbody></table>
    </div>
  );
}

function formatCompact(amount) {
  if (amount >= 1000) return "₹" + (amount / 1000).toFixed(amount >= 10000 ? 0 : 1) + "k";
  return "₹" + Math.round(amount);
}

function CategoryBreakdown({ rows, total, onSelect }) {
  const visible = rows.slice(0, 5);
  if (!visible.length) return <p className="empty-copy">Add your first expense to see where the money goes.</p>;
  return (
    <div className="category-list">
      {visible.map((row) => {
        const info = categoryInfo[row.category] || categoryInfo.other;
        const Icon = info.icon;
        const percent = total > 0 ? Math.min(100, (row.amount / total) * 100) : 0;
        return (
          <button className="category-row" type="button" key={row.category} onClick={() => onSelect(row.category)}>
            <span className={"category-icon category-icon--" + info.tone}><Icon size={17} /></span>
            <span className="category-main"><span className="category-label">{info.label}</span><span className="category-track"><i style={{ width: percent + "%" }} /></span></span>
            <span className="category-value">{formatCurrency(row.amount)}</span>
          </button>
        );
      })}
    </div>
  );
}

function ExpenseRows({ rows, compact = false }) {
  if (!rows.length) return <div className="empty-state-inline"><span className="empty-icon"><FileText size={19} /></span><span>No expenses yet. Add one to get started.</span></div>;
  return (
    <div className={compact ? "expense-row-list expense-row-list--compact" : "expense-row-list"}>
      {rows.map((row) => {
        const info = categoryInfo[row.category] || categoryInfo.other;
        const Icon = info.icon;
        return (
          <div className="expense-row" key={row.id}>
            <span className={"expense-row-icon category-icon--" + info.tone}><Icon size={17} /></span>
            <span className="expense-row-main"><strong>{row.title}</strong><span>{row.vendor || info.label} · {formatDate(row.date)}</span></span>
            <span className="expense-row-amount">−{formatCurrency(row.amount)}</span>
          </div>
        );
      })}
    </div>
  );
}

function ExpensesPage({ dashboard, expenseData, rows, category, setCategory, search, setSearch, onAdd }) {
  const summary = expenseData.summary || [];
  const amountFor = (key) => summary.find((item) => item.category === key)?.amount || 0;
  const tiles = Object.entries(categoryInfo).map(([key, item]) => [key, item.label, item.icon]);
  const maxAmount = Math.max(1, ...summary.map((item) => item.amount));
  return (
    <>
      <PageHeading
        eyebrow="THE FULL SHOP BOOK"
        title="Every rupee, accounted for."
        subtitle="See what you’ve spent, from rent to the last milk delivery."
        action={<button className="button button--primary" type="button" onClick={onAdd}><Plus size={18} />Add expense</button>}
      />
      <div className="expense-summary-banner">
        <div className="expense-summary-icon"><Wallet size={21} /></div>
        <div className="expense-summary-copy"><span>Total spent · {dashboard.month}</span><strong>{formatCurrency(expenseData.total)}</strong></div>
        <div className="expense-summary-meta"><span>{expenseData.items.length} entries</span><span>Sales {formatCurrency(dashboard.sales)} <b>·</b> Net {formatCurrency(dashboard.net)}</span></div>
        <div className="expense-summary-mark"><IndianRupee size={76} /></div>
      </div>
      <div className="expense-tile-grid">
        {tiles.map(([key, label, Icon]) => (
          <button type="button" key={key} onClick={() => setCategory(category === key ? "all" : key)} className={"expense-tile" + (category === key ? " expense-tile--selected" : "")}>
            <span className={"category-icon category-icon--" + (categoryInfo[key]?.tone || "other")}><Icon size={17} /></span>
            <span className="expense-tile-name">{label}</span>
            <strong>{formatCurrency(amountFor(key))}</strong>
            <span className="expense-tile-caption">{summary.find((item) => item.category === key)?.count || 0} entries this month</span>
          </button>
        ))}
      </div>
      <section className="panel expense-analysis">
        <div className="panel-heading">
          <div><span className="panel-kicker">MONTHLY BREAKDOWN</span><h2>Where your money goes</h2><p>Tap a category to filter the expense list below.</p></div>
          <span className="period-badge"><Clock3 size={14} />Month to date</span>
        </div>
        <div className="expense-bars">
          {summary.length ? summary.map((item) => {
            const info = categoryInfo[item.category] || categoryInfo.other;
            const Icon = info.icon;
            return (
              <button type="button" className={"expense-bar-row" + (category === item.category ? " selected" : "")} key={item.category} onClick={() => setCategory(category === item.category ? "all" : item.category)}>
                <span className={"category-icon category-icon--" + info.tone}><Icon size={16} /></span>
                <span className="expense-bar-label">{info.label}</span>
                <span className="expense-bar-track"><i className={"expense-bar-fill expense-bar-fill--" + info.tone} style={{ width: Math.max(2, (item.amount / maxAmount) * 100) + "%" }} /></span>
                <span className="expense-bar-value">{formatCurrency(item.amount)}</span>
                <span className="expense-bar-percent">{expenseData.total ? Math.round(item.amount / expenseData.total * 100) : 0}%</span>
              </button>
            );
          }) : <p className="empty-copy">Your expense categories will show up here.</p>}
        </div>
      </section>
      <section className="panel all-expenses-panel">
        <div className="panel-heading panel-heading--wrap">
          <div><span className="panel-kicker">YOUR RECORDS</span><h2>{category === "all" ? "All expenses" : (categoryInfo[category]?.label || "Expenses")}</h2><p>{rows.length} entries shown</p></div>
          <div className="table-tools">
            <label className="search-control"><Search size={16} /><span className="sr-only">Search expenses</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search expenses" /></label>
            <label className="filter-control"><Filter size={15} /><span className="sr-only">Filter by category</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All types</option>{Object.entries(categoryInfo).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</select></label>
            <button className="icon-button export-button" type="button" aria-label="Export expenses" onClick={() => downloadExpenses(rows)}><Download size={17} /></button>
          </div>
        </div>
        <ExpenseTable rows={rows} />
      </section>
    </>
  );
}

function SalesPage({ data, onVoice }) {
  return (
    <>
      <PageHeading
        eyebrow="DAILY COUNTER SALES"
        title="Your sales book."
        subtitle="Sales stay separate from shop spending, so your income and expenses are easy to read."
        action={<button className="button button--primary" type="button" onClick={onVoice}><Mic size={17} />Record a sale</button>}
      />
      <section className="credit-metric-grid" aria-label="Sales summary">
        <MetricCard title="Sales this month" amount={data.total} icon={TrendingUp} change={data.count + " recorded sales"} tone="sales" />
        <article className="metric-card metric-card--credit"><div className="metric-top"><span className="metric-icon"><FileText size={18} /></span><span className="metric-title">Sales entries</span><span className="metric-period">MTD</span></div><div className="metric-amount">{data.count}</div><div className="metric-bottom"><span>Separate from expenses</span></div></article>
      </section>
      <section className="panel credit-history-panel">
        <div className="panel-heading"><div><span className="panel-kicker">RECENT RECORDS</span><h2>Sales activity</h2><p>Voice sales are added here after you review and confirm them.</p></div><span className="period-badge"><Clock3 size={14} />This month</span></div>
        {data.items.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th scope="col">Sale description</th><th scope="col">Date</th><th scope="col" className="numeric">Amount</th></tr></thead>
              <tbody>{data.items.map((item) => <tr key={item.id}>
                <td><span className="table-expense"><span className="category-icon category-icon--sales"><TrendingUp size={16} /></span><strong>{item.label}</strong></span></td>
                <td>{formatDate(item.date)}</td>
                <td className="numeric received-cell">+{formatCurrency(item.amount)}</td>
              </tr>)}</tbody>
            </table>
          </div>
        ) : <div className="table-empty"><span className="empty-icon"><TrendingUp size={18} /></span><strong>No sales recorded this month</strong><span>Say “sale of tea for 250” in the voice assistant to add one.</span></div>}
      </section>
      <div className="info-note"><CircleCheck size={18} /><span>Sales, expenses, and customer udhaar are kept in their own books. A customer’s udhaar is not counted as a sale unless you separately record it as one.</span></div>
    </>
  );
}

function ExpenseTable({ rows }) {
  if (!rows.length) return <div className="table-empty"><span className="empty-icon"><Search size={18} /></span><strong>No matching expenses</strong><span>Try another category or search.</span></div>;
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead><tr><th scope="col">Expense</th><th scope="col">Category</th><th scope="col">Date</th><th scope="col">Paid by</th><th scope="col" className="numeric">Amount</th></tr></thead>
        <tbody>
          {rows.map((row) => {
            const info = categoryInfo[row.category] || categoryInfo.other;
            const Icon = info.icon;
            return (
              <tr key={row.id}>
                <td><span className="table-expense"><span className={"category-icon category-icon--" + info.tone}><Icon size={16} /></span><span><strong>{row.title}</strong><small>{row.vendor || "Shop expense"}</small></span></span></td>
                <td><span className={"table-category table-category--" + info.tone}>{info.label}</span></td>
                <td>{formatDate(row.date)}</td>
                <td><span className="method-pill">{row.method === "credit" ? "CUSTOMER CREDIT" : row.method.toUpperCase()}</span></td>
                <td className="numeric amount-cell">−{formatCurrency(row.amount)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function downloadExpenses(rows) {
  const header = ["Expense", "Category", "Date", "Vendor", "Method", "Amount"];
  const lines = rows.map((row) => [row.title, row.categoryLabel, row.date, row.vendor, row.method, row.amount]);
  const csv = [header, ...lines].map((line) => line.map((cell) => "\"" + String(cell ?? "").replaceAll("\"", "\"\"") + "\"").join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "desimanager-expenses.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

function CreditPage({ data, onAdd }) {
  return (
    <>
      <PageHeading eyebrow="CUSTOMER CREDIT" title="The udhaar book." subtitle="See what you gave each person, what they have paid back, and what is still due." action={<button className="button button--primary" type="button" onClick={onAdd}><Plus size={18} />Add entry</button>} />
      <section className="credit-metric-grid" aria-label="Udhaar summary">
        <MetricCard title="Udhaar given" amount={data.given} icon={BookOpen} change="Total customer credit" tone="credit" />
        <MetricCard title="Received back" amount={data.received} icon={TrendingUp} change="Payments recorded" tone="sales" />
        <MetricCard title="Still to collect" amount={data.total} icon={Wallet} change={data.customers.length + " customer accounts"} tone="spend" />
      </section>
      <section className="panel credit-panel">
        <div className="panel-heading"><div><span className="panel-kicker">PERSON BY PERSON</span><h2>Customer accounts</h2><p>Each customer has a separate udhaar and payment record.</p></div><span className="period-badge"><Users size={14} />{data.customers.length} people</span></div>
        {data.customers.length ? (
          <div className="table-scroll">
            <table className="data-table credit-table">
              <thead><tr><th scope="col">Person</th><th scope="col" className="numeric">Udhaar given</th><th scope="col" className="numeric">Amount received</th><th scope="col" className="numeric">Balance due</th><th scope="col">Last activity</th><th scope="col">Action</th></tr></thead>
              <tbody>{data.customers.map((customer, index) => (
                <tr key={customer.name}>
                  <td><span className="credit-person"><span className={"customer-avatar customer-avatar--" + (index % 4)}>{customer.name.slice(0, 1).toUpperCase()}</span><span><strong>{customer.name}</strong><small>{customer.entries} entries</small></span></span></td>
                  <td className="numeric amount-cell">{formatCurrency(customer.given)}</td>
                  <td className="numeric received-cell">{formatCurrency(customer.received)}</td>
                  <td className="numeric balance-cell">{formatCurrency(customer.balance)}</td>
                  <td>{formatDate(String(customer.lastActivity || "").slice(0, 10))}</td>
                  <td><button type="button" className="button button--small button--soft" onClick={onAdd}>Add entry</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <div className="table-empty"><strong>No open balances</strong><span>New customer credit will appear here.</span></div>}
      </section>
      {(data.recentEntries || []).length > 0 && <section className="panel credit-history-panel">
        <div className="panel-heading"><div><span className="panel-kicker">ITEM BY ITEM</span><h2>Recent udhaar activity</h2><p>Descriptions from each voice or manual entry.</p></div></div>
        <div className="table-scroll">
          <table className="data-table credit-history-table">
            <thead><tr><th scope="col">Person</th><th scope="col">Description</th><th scope="col">Type</th><th scope="col">Date</th><th scope="col" className="numeric">Amount</th></tr></thead>
            <tbody>{data.recentEntries.map((entry) => <tr key={entry.id}>
              <td><strong>{entry.customer}</strong></td>
              <td>{entry.note || <span className="credit-no-description">No item description</span>}</td>
              <td>{entry.type === "payment" ? "Payment received" : "Udhaar given"}</td>
              <td>{formatDate(String(entry.createdAt || "").slice(0, 10))}</td>
              <td className="numeric amount-cell">{formatCurrency(entry.amount)}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </section>}
      <div className="info-note"><CircleCheck size={18} /><span>Credit and payments are stored as separate entries. The balance is calculated per person, so you can see exactly what remains to collect.</span></div>
    </>
  );
}

function InventoryPage({ items, orders, onVoice, onAdd, onMarkPlaced }) {
  const lowCount = items.filter((item) => item.low).length;
  return (
    <>
      <PageHeading eyebrow="STOCK CHECK" title="Keep the kettle going." subtitle="A quick look at what’s in the shop and what may need restocking." action={<div className="heading-actions"><button className="button button--outline" type="button" onClick={onVoice}><Mic size={17} />Voice note</button><button className="button button--primary" type="button" onClick={onAdd}><Plus size={17} />Restock draft</button></div>} />
      <div className="stock-alert">
        <span className="stock-alert-icon"><Package size={20} /></span>
        <span><strong>{lowCount} items running low</strong><small>Plan the next supplier run before the rush.</small></span>
        <span className="stock-alert-count">{lowCount} low</span>
      </div>
      <section className="panel stock-panel">
        <div className="panel-heading"><div><span className="panel-kicker">SHOP INVENTORY</span><h2>On the shelf</h2><p>Starter catalog for tracking items and preparing restock drafts.</p></div><span className="period-badge"><ShoppingBag size={14} />{items.length} items</span></div>
        <div className="table-scroll">
          <table className="data-table stock-table">
            <thead><tr><th scope="col">Item</th><th scope="col">In stock</th><th scope="col">Low-stock mark</th><th scope="col">Usual supplier</th><th scope="col">Status</th></tr></thead>
            <tbody>{items.map((item) => <tr key={item.id}><td><span className="table-expense"><span className="stock-item-icon"><Package size={16} /></span><strong>{item.name}</strong></span></td><td className="amount-cell">{item.quantity} {item.unit}</td><td>{item.lowAt} {item.unit}</td><td>{item.supplier}</td><td><span className={item.low ? "stock-status stock-status--low" : "stock-status stock-status--good"}><i />{item.low ? "Restock soon" : "In good shape"}</span></td></tr>)}</tbody>
          </table>
        </div>
      </section>
      <section className="panel orders-panel">
        <div className="panel-heading"><div><span className="panel-kicker">SUPPLIER LIST</span><h2>Restock drafts</h2><p>Drafts are saved here. Place the order with your supplier when ready.</p></div><span className="period-badge"><ShoppingBag size={14} />{orders.length} drafts</span></div>
        {orders.length ? <div className="orders-list">{orders.map((order) => <div className="order-row" key={order.id}><span className="stock-item-icon"><Package size={16} /></span><span className="order-copy"><strong>{order.quantity} {order.unit} · {order.itemName}</strong><small>{order.supplier} · {formatDate(String(order.createdAt).slice(0, 10))}</small></span><span className={"order-status" + (order.status === "placed" ? " order-status--placed" : "")}>{order.status === "placed" ? "Placed" : "Draft"}</span>{order.status === "draft" && <button className="button button--small button--soft" type="button" onClick={() => onMarkPlaced(order.id)}>Mark placed</button>}</div>)}</div> : <div className="table-empty"><span className="empty-icon"><Package size={18} /></span><strong>No restock drafts yet</strong><span>Create one here or tell the voice assistant what to order.</span></div>}
      </section>
      <div className="stock-footnote"><span className="stock-footnote-icon"><Sparkles size={18} /></span><span><strong>Voice makes restocking quicker</strong><small>Try “order 20 milk packets”. Confirm the item and quantity before saving the draft.</small></span><ArrowRight size={17} /></div>
    </>
  );
}

const languageChoices = [
  ["en-IN", "English (India)"], ["hi-IN", "हिन्दी · Hindi"], ["bn-IN", "বাংলা · Bengali"],
  ["ta-IN", "தமிழ் · Tamil"], ["te-IN", "తెలుగు · Telugu"], ["mr-IN", "मराठी · Marathi"],
  ["gu-IN", "ગુજરાતી · Gujarati"], ["kn-IN", "ಕನ್ನಡ · Kannada"], ["ml-IN", "മലയാളം · Malayalam"],
  ["pa-IN", "ਪੰਜਾਬੀ · Punjabi"], ["ur-IN", "اردو · Urdu"], ["ne-NP", "नेपाली · Nepali"],
  ["es-ES", "Español · Spanish"], ["fr-FR", "Français · French"], ["ar-SA", "العربية · Arabic"],
  ["pt-BR", "Português · Portuguese"], ["id-ID", "Bahasa Indonesia"], ["zh-CN", "中文 · Chinese"],
  ["ja-JP", "日本語 · Japanese"], ["de-DE", "Deutsch · German"], ["other", "Enter another language tag…"],
];

function VoiceAssistantPage({ onExpense, onSale, onLedger, onOrder, user, onUpdateSettings, wakeCommand, onWakeCommandConsumed, voiceStartRequest, onVoiceStartConsumed, wakePaused, onWakePause, onWakeStatus, wakeStatus }) {
  const [language, setLanguage] = useState(user.speechLanguage || "en-IN");
  const [assistantName, setAssistantName] = useState(user.assistantName || "Jarvis");
  const [customLanguage, setCustomLanguage] = useState(languageChoices.some(([tag]) => tag === (user.speechLanguage || "en-IN")) ? "" : (user.speechLanguage || ""));
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState("");
  const [intent, setIntent] = useState("auto");
  const [command, setCommand] = useState("");
  const [recognizedText, setRecognizedText] = useState("");
  const [listening, setListening] = useState(false);
  const [preparingRecognition, setPreparingRecognition] = useState(false);
  const [recognitionNote, setRecognitionNote] = useState("");
  const [working, setWorking] = useState(false);
  const [draft, setDraft] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const recognitionRef = useRef(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const processCommandRef = useRef(null);
  const startListeningRef = useRef(null);
  const recognizedTextRef = useRef("");
  const wakeCommandHandlerRef = useRef(null);
  const commandProcessedRef = useRef(false);
  const recognitionFailedRef = useRef(false);
  const wakeResumeTimerRef = useRef(null);
  const currentLanguage = language === "other" ? (customLanguage.trim() || "en-IN") : language;
  const wakeStatusIsReady = /on every page/i.test(wakeStatus);
  const wakeStatusHasError = /(blocked|lost microphone|does not support|aren.t supported|cannot access|couldn.t start|reconnecting|interrupted)/iu.test(wakeStatus);
  const idleVoicePrompt = !user.wakeEnabled
    ? "Tap the mic and speak"
    : wakeStatusIsReady
      ? "Listening for “" + user.assistantName + "” — say it now"
      : wakeStatusHasError
        ? wakeStatus
        : wakeStatus || "Starting wake-word listening…";

  useEffect(() => () => {
    recognitionFailedRef.current = true;
    window.clearTimeout(wakeResumeTimerRef.current);
    onWakePause(false);
    recognitionRef.current?.abort();
  }, [onWakePause]);

  const pauseWakeForManualSpeech = () => {
    window.clearTimeout(wakeResumeTimerRef.current);
    onWakePause(true);
    onWakeStatus("Wake listener paused while the voice assistant uses the microphone.");
  };

  const resumeWakeAfterManualSpeech = () => {
    window.clearTimeout(wakeResumeTimerRef.current);
    wakeResumeTimerRef.current = window.setTimeout(() => {
      onWakeStatus("Restarting the hands-free listener…");
      onWakePause(false);
    }, 1800);
  };

  useEffect(() => {
    if (draft) document.getElementById("voice-review-card")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [draft]);

  useEffect(() => {
    if (error) document.getElementById("voice-error-message")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [error]);

  const updateSettings = async (wakeEnabled = user.wakeEnabled) => {
    const languageTag = language === "other" ? customLanguage.trim() : language;
    if (language === "other" && !languageTag) {
      setError("Enter the language tag your browser supports, such as fr-FR.");
      return false;
    }
    if (languageTag && !/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(languageTag)) {
      setError("Enter a language tag like fr-FR or ar-SA.");
      return false;
    }
    if (assistantName.trim().length < 2 || assistantName.trim().length > 24) {
      setError("Your assistant name must be between 2 and 24 characters.");
      return false;
    }
    setSettingsBusy(true);
    setError("");
    try {
      await onUpdateSettings({ assistantName: assistantName.trim(), speechLanguage: languageTag || "en-IN", wakeEnabled });
      setSettingsMessage(wakeEnabled ? "Hands-free mode is on for this account." : "Voice preferences saved.");
      return true;
    } catch (requestError) {
      setError(requestError.message || "Could not save voice preferences.");
      return false;
    } finally {
      setSettingsBusy(false);
    }
  };

  const toggleWakeWord = async () => {
    setSettingsMessage("");
    if (user.wakeEnabled) {
      await updateSettings(false);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser cannot request microphone access. You can still use the Talk button.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      await updateSettings(true);
    } catch {
      setError("Allow microphone access to turn on hands-free wake words. You can still use the Talk button.");
    }
  };

  const processCommand = async (text) => {
    if (!text.trim()) return;
    pauseWakeForManualSpeech();
    const confirmation = text.trim().toLocaleLowerCase().replace(/[.!?,،؛]/gu, "").trim();
    const pendingDraft = draftRef.current;
    if (pendingDraft && /^(?:no|nope|cancel|cancel it|cancel karo|nahi|nahin|nahi karo|stop|नहीं|ना|रुको|रद्द करो|मत करो|बदलना है)$/iu.test(confirmation)) {
      draftRef.current = null;
      setDraft(null);
      setMessage("Okay, I cancelled that entry. Nothing was saved.");
      speak("Okay, cancelled. Nothing was saved.", currentLanguage, resumeWakeAfterManualSpeech);
      return;
    }
    const wantsExpenseCopy = /(?:copy|expense|expenses|एक्सपेंस(?:ेज)?|खर्च(?:ों)?|व्यय)/iu.test(confirmation);
    const wantsLedgerSave = /(?:udhaar|udhar|khata|credit|ledger|book|उधार|खाता|बही|लेजर|बुक)/iu.test(confirmation);
    if (pendingDraft?.type === "credit" && wantsExpenseCopy) {
      await confirmDraft("expense");
      return;
    }
    if (pendingDraft?.type === "credit" && wantsLedgerSave) {
      await confirmDraft("ledger");
      return;
    }
    if (pendingDraft && /^(?:yes|yeah|yep|confirm|save|confirm it|save it|yes confirm|haan(?: ji)?|han|ha|haan save|confirm karo|save kar do|kar do|हाँ|हां|ठीक है|सही है|कर दो|सेव करो|पुष्टि करो)$/iu.test(confirmation)) {
      await confirmDraft();
      return;
    }
    setWorking(true);
    setError("");
    draftRef.current = null;
    setDraft(null);
    setMessage("");
    try {
      const result = await api.parseVoice(text, intent);
      draftRef.current = result;
      setDraft(result);
      setMessage("Please check the details before they go into your shop book.");
      const isHindi = currentLanguage.toLocaleLowerCase().startsWith("hi");
      const confirmationPrompt = result.type === "credit"
        ? isHindi
          ? "उधार बुक में जोड़ने के लिए बोलें: उधार बुक में जोड़ो। खर्चों में कॉपी करने के लिए बोलें: खर्चों में कॉपी करो। रद्द करने के लिए बोलें: रद्द करो।"
          : "Say ‘add to udhaar book’ to record the customer balance, or ‘copy to expenses’ to copy this entry there. Say cancel to discard."
        : isHindi ? "सेव करने के लिए कन्फर्म बोलें, या रद्द करने के लिए कैंसल बोलें." : "Say confirm to save, or cancel to discard.";
      const spokenSummary = result.type === "credit"
        ? isHindi
          ? "मैंने सुना, " + (result.customer || "ग्राहक") + " ने " + (result.note || "सामान") + " " + result.amount + " रुपये उधार लिए। " + confirmationPrompt
          : "I heard " + (result.customer || "a customer") + " took " + (result.note || "items not specified") + " worth " + result.amount + " rupees on credit. " + confirmationPrompt
        : result.type === "sale"
        ? (isHindi ? "मैंने सुना, " : "I heard ") + (result.label || "shop sale") + (isHindi ? " की बिक्री " : " sale for ") + result.amount + (isHindi ? " रुपये। " : " rupees. ") + confirmationPrompt
        : result.type === "expense"
        ? "I heard " + result.title + ", " + result.amount + " rupees. " + confirmationPrompt
        : result.type === "restock"
          ? "I heard " + result.quantity + " " + result.unit + " of " + result.itemName + ". " + confirmationPrompt
          : "I heard " + result.type + " for " + (result.customer || "a customer") + ", " + result.amount + " rupees. " + confirmationPrompt;
      speak(spokenSummary, currentLanguage, () => startListeningRef.current?.());
    } catch (requestError) {
      const errorMessage = requestError.message || "I couldn’t understand that. Try typing a short command.";
      setError(errorMessage);
      speak(errorMessage, currentLanguage, resumeWakeAfterManualSpeech);
    } finally {
      setWorking(false);
    }
  };

  const startListening = async () => {
    if (preparingRecognition || listening || (working && !draftRef.current)) return;
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setError("Voice recognition isn’t available in this browser. You can still type the same command below.");
      return;
    }
    pauseWakeForManualSpeech();
    setError("");
    setCommand("");
    setRecognizedText("");
    recognizedTextRef.current = "";
    commandProcessedRef.current = false;
    recognitionFailedRef.current = false;
    setPreparingRecognition(true);
    setRecognitionNote("Starting the microphone…");
    const recognition = new Recognition();
    recognition.lang = currentLanguage;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      setPreparingRecognition(false);
      setRecognitionNote("");
      setMessage("");
      setListening(true);
    };
    recognition.onresult = (event) => {
      const allText = [];
      const finalText = [];
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = result[0]?.transcript?.trim();
        if (!text) continue;
        allText.push(text);
        if (result.isFinal) finalText.push(text);
      }
      const transcript = allText.join(" ").trim();
      recognizedTextRef.current = transcript;
      setRecognizedText(transcript);
      setCommand(transcript);
      if (finalText.length && !commandProcessedRef.current) {
        commandProcessedRef.current = true;
        processCommandRef.current?.(finalText.join(" ").trim());
      }
    };
    recognition.onerror = (event) => {
      recognitionFailedRef.current = true;
      setPreparingRecognition(false);
      setRecognitionNote("");
      setListening(false);
      if (!commandProcessedRef.current) resumeWakeAfterManualSpeech();
      const messages = {
        "no-speech": "No speech was detected. Tap the mic, wait for “Listening…”, then speak close to your microphone.",
        "not-allowed": "Microphone permission is blocked. Allow microphone access for this site in your browser settings, then try again.",
        "service-not-allowed": "This browser blocked its speech recognition service. Try opening DesiManager in Chrome or Edge, or type your command.",
        "audio-capture": "The browser cannot access a microphone. Check that a microphone is connected and enabled in your system settings.",
        network: "The browser’s speech service could not connect. Check your internet connection, try an installed on-device language pack, or type your command.",
        "language-not-supported": "This browser cannot recognize " + currentLanguage + ". Choose another supported language or type your command.",
      };
      if (event.error === "no-speech" && draftRef.current) {
        setMessage("I didn’t hear a save choice. Nothing was saved; the entry is still waiting for you.");
      } else {
        setError(messages[event.error] || (event.error === "aborted"
          ? "Speech recognition stopped before it heard a command. Tap the mic and try again."
          : "Speech recognition failed (" + (event.error || "unknown error") + "). Try again or type your command."));
      }
    };
    recognition.onend = () => {
      setPreparingRecognition(false);
      setRecognitionNote("");
      setListening(false);
      const transcript = recognizedTextRef.current.trim();
      if (!commandProcessedRef.current && transcript) {
        commandProcessedRef.current = true;
        processCommandRef.current?.(transcript);
      } else if (!commandProcessedRef.current && !transcript && draftRef.current && !recognitionFailedRef.current) {
        resumeWakeAfterManualSpeech();
        setMessage("I didn’t hear a save choice. Nothing was saved; the entry is still waiting for you.");
      } else if (!commandProcessedRef.current && !recognitionFailedRef.current) {
        resumeWakeAfterManualSpeech();
        setError("Listening ended, but the browser returned no transcript. Check the selected language and microphone, or try Chrome or Edge.");
      }
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setPreparingRecognition(false);
      setRecognitionNote("");
      setListening(false);
      resumeWakeAfterManualSpeech();
      setError("Could not start speech recognition. Check this site’s microphone permission, or type your command.");
    }
  };

  processCommandRef.current = processCommand;
  startListeningRef.current = startListening;

  useEffect(() => {
    if (voiceStartRequest) {
      startListeningRef.current?.();
      onVoiceStartConsumed(voiceStartRequest);
    }
  }, [voiceStartRequest]);

  wakeCommandHandlerRef.current = (incomingCommand) => {
    pauseWakeForManualSpeech();
    setError("");
    if (incomingCommand.text.trim()) {
      setCommand(incomingCommand.text);
      processCommand(incomingCommand.text);
    } else {
      setMessage("Wake word heard. Listening for your command now.");
      speak(currentLanguage.toLocaleLowerCase().startsWith("hi") ? "मैं सुन रहा हूँ।" : "I am listening.", currentLanguage, startListening);
    }
  };

  useEffect(() => {
    if (wakeCommand) {
      wakeCommandHandlerRef.current?.(wakeCommand);
      onWakeCommandConsumed(wakeCommand.id);
    }
    // The wake command ID marks a new request; process each activation only once.
  }, [wakeCommand?.id]);

  const confirmDraft = async (target = "default") => {
    const pendingDraft = draftRef.current;
    if (!pendingDraft) return;
    setWorking(true);
    try {
      if ((pendingDraft.type === "credit" || pendingDraft.type === "payment") && !pendingDraft.customer) {
        setError("Add the customer’s name before saving this entry.");
        speak("Please say or enter the customer’s name before saving.", currentLanguage, resumeWakeAfterManualSpeech);
        setWorking(false);
        return;
      }
      if (pendingDraft.type === "credit" && target === "expense") {
        const description = String(pendingDraft.note || "").trim();
        await onExpense({
          title: (description || "Customer udhaar for " + pendingDraft.customer).slice(0, 100),
          category: "stock",
          amount: Number(pendingDraft.amount),
          date: dateValue(),
          method: "credit",
          vendor: pendingDraft.customer,
          note: "Copied from customer udhaar" + (description ? ": " + description : ""),
        });
      } else if (pendingDraft.type === "sale") {
        await onSale({ label: pendingDraft.label, amount: Number(pendingDraft.amount), date: pendingDraft.date || dateValue() });
      } else if (pendingDraft.type === "expense") {
        await onExpense({
          title: pendingDraft.title,
          category: pendingDraft.category,
          amount: pendingDraft.amount,
          date: pendingDraft.date,
          method: pendingDraft.method,
          vendor: pendingDraft.vendor,
          note: pendingDraft.note,
        });
      } else if (pendingDraft.type === "restock") {
        await onOrder({ itemId: pendingDraft.itemId, quantity: Number(pendingDraft.quantity), supplier: pendingDraft.supplier });
      } else {
        await onLedger({
          customer: pendingDraft.customer,
          type: pendingDraft.type,
          amount: pendingDraft.amount,
          note: pendingDraft.note,
        });
      }
      const successMessage = pendingDraft.type === "credit" && target === "expense"
        ? "Copied " + (pendingDraft.note || "the customer udhaar entry") + " to Expenses for " + pendingDraft.customer + "."
        : pendingDraft.type === "sale"
        ? "Sale saved to your sales book."
        : pendingDraft.type === "expense"
        ? "Expense saved to your shop book."
        : pendingDraft.type === "restock" ? "Restock draft saved for " + pendingDraft.itemName + "."
        : pendingDraft.type === "payment" ? "Customer payment recorded." : "Customer credit recorded.";
      setMessage(successMessage);
      speak(successMessage, currentLanguage, resumeWakeAfterManualSpeech);
      draftRef.current = null;
      setDraft(null);
      setCommand("");
    } catch (saveError) {
      const errorMessage = saveError.message || "Could not save that entry. Please try again.";
      setError(errorMessage);
      speak(errorMessage, currentLanguage, resumeWakeAfterManualSpeech);
    } finally {
      setWorking(false);
    }
  };

  return (
    <>
      <PageHeading eyebrow="VOICE-FIRST SHOP BOOK" title="Say it. Check it. Done." subtitle="Say your nickname once, give a command, then speak your save choice after I read it back." />
      <div className="voice-layout">
        <section className="voice-workspace">
          <div className="voice-mic-stage">
            <span className="voice-orbit voice-orbit--one" /><span className="voice-orbit voice-orbit--two" />
            <button className={"voice-mic-button" + (listening ? " voice-mic-button--listening" : "")} type="button" disabled={preparingRecognition || working} onClick={listening ? () => recognitionRef.current?.stop() : startListening} aria-label={listening ? "Stop listening" : "Start voice entry"}>
              {listening ? <span className="listening-bars"><i /><i /><i /><i /><i /></span> : <Mic size={32} />}
            </button>
            <div className="voice-status">{preparingRecognition ? recognitionNote || "Preparing speech recognition…" : listening ? draft ? "Listening for your save choice…" : "Listening…" : working ? "One moment…" : error || (wakePaused ? "Wake listener paused during voice input; it will restart after this command." : idleVoicePrompt)}</div>
            <p>Try: “Sold tea for 250”, “Spent 450 on milk”, or “Ramesh ko biscuits aur chai patti 40 udhaar”. After readback, say “confirm”, “udhaar book mein add karo”, or “expenses mein copy karo”.</p>
          </div>
          {recognizedText && <div className="voice-transcript" role="status"><span>HEARD</span><strong>{recognizedText}</strong></div>}
          <div className="voice-language-row">
            <label htmlFor="voice-language">Speak in</label>
            <select id="voice-language" value={languageChoices.some(([tag]) => tag === language) ? language : "other"} onChange={(event) => setLanguage(event.target.value)}>
              {languageChoices.map(([tag, label]) => <option value={tag} key={tag}>{label}</option>)}
            </select>
            {language === "other" && <input className="language-tag-input" aria-label="Language locale tag" value={customLanguage} onChange={(event) => setCustomLanguage(event.target.value)} placeholder="e.g. fr-FR" />}
            <span className="voice-language-note"><Volume2 size={14} />Device voice</span>
          </div>
          <form className="command-form" onSubmit={(event) => { event.preventDefault(); processCommand(command); }}>
            <label htmlFor="voice-intent">What are you recording?</label>
            <select className="intent-select" id="voice-intent" value={intent} onChange={(event) => setIntent(event.target.value)}>
              <option value="auto">Try to detect automatically</option><option value="sale">Shop sale</option><option value="expense">Shop expense</option><option value="credit">Udhaar given</option><option value="payment">Payment received</option><option value="restock">Restock order</option>
            </select>
            <label htmlFor="voice-command">Or type what happened</label>
            <div className="command-input-wrap">
              <input id="voice-command" value={command} onChange={(event) => setCommand(event.target.value)} placeholder="e.g. Paid ₹1,200 for electricity" />
              <button className="button button--primary" type="submit" disabled={working || !command.trim()}><Send size={16} /><span>Review</span></button>
            </div>
            <span className="field-hint">Type in your language and use digits for the amount. If needed, choose the record type above. Check the details before saving.</span>
          </form>
          {error && <div id="voice-error-message" className="inline-alert" role="alert"><span>{error}</span><button type="button" aria-label="Dismiss message" onClick={() => setError("")}><X size={16} /></button></div>}
          {message && !draft && <div className="inline-success" role="status"><CircleCheck size={17} />{message}</div>}
          {draft && <VoiceReview draft={draft} setDraft={setDraft} onConfirm={confirmDraft} working={working} />}
          <p className="privacy-note"><span className="privacy-dot" />Your spoken words are reviewed before saving. DesiManager does not use a paid voice API or API key.</p>
          <section className="wake-settings" aria-labelledby="wake-settings-title">
            <div className="wake-settings-heading"><span className="wake-settings-icon"><Mic2 size={17} /></span><div><strong id="wake-settings-title">Hands-free wake word</strong><small>Say your assistant’s name to start a voice command.</small></div><span className={user.wakeEnabled ? "wake-state wake-state--on" : "wake-state"}>{user.wakeEnabled ? "On" : "Off"}</span></div>
            <div className="wake-settings-fields">
              <label>Assistant nickname<input value={assistantName} maxLength={24} onChange={(event) => setAssistantName(event.target.value)} placeholder="Jarvis" /></label>
              <button type="button" className="button button--outline" onClick={() => updateSettings(user.wakeEnabled)} disabled={settingsBusy}>{settingsBusy ? "Saving…" : "Save preferences"}</button>
              <button type="button" className={user.wakeEnabled ? "button button--soft wake-toggle" : "button button--primary wake-toggle"} onClick={toggleWakeWord} disabled={settingsBusy}>{user.wakeEnabled ? "Turn off wake word" : "Enable hands-free"}</button>
            </div>
            {settingsMessage && <p className="wake-settings-message" role="status"><CircleCheck size={14} />{settingsMessage}</p>}
            <p className="wake-settings-note">After enabling and allowing the microphone, this tab listens for “{user.assistantName}” while open. Recognition support and language availability depend on your browser. Some browsers send audio to their speech service.</p>
            {user.wakeEnabled && <p className="wake-runtime-status" role="status"><span className={wakeStatus.includes("blocked") || wakeStatus.includes("lost microphone") ? "status-dot status-dot--offline" : "status-dot status-dot--online"} />{wakeStatus || "Starting hands-free listening…"}</p>}
          </section>
        </section>
        <aside className="voice-side">
          <div className="voice-side-card voice-side-card--examples">
            <span className="panel-kicker">A FEW THINGS YOU CAN SAY</span>
            <h2>Talk like you normally do.</h2>
            <div className="example-list">
              <button type="button" onClick={() => { setCommand("Spent 450 on milk"); setDraft(null); }}><span className="example-icon example-icon--orange"><Package size={16} /></span><span><strong>“Spent 450 on milk”</strong><small>Add a shop expense</small></span><ArrowRight size={15} /></button>
              <button type="button" onClick={() => { setIntent("auto"); setCommand("Sold tea for 250"); setDraft(null); }}><span className="example-icon example-icon--green"><TrendingUp size={16} /></span><span><strong>“Sold tea for 250”</strong><small>Add a separate sales entry</small></span><ArrowRight size={15} /></button>
              <button type="button" onClick={() => { setCommand("Ramesh ko biscuits aur chai patti 40 udhaar"); setDraft(null); }}><span className="example-icon example-icon--green"><BookOpen size={16} /></span><span><strong>“Ramesh ko biscuits aur chai patti 40 udhaar”</strong><small>Add customer credit with item details</small></span><ArrowRight size={15} /></button>
              <button type="button" onClick={() => { setCommand("Ramesh paid 100"); setDraft(null); }}><span className="example-icon example-icon--blue"><CreditCard size={16} /></span><span><strong>“Ramesh paid 100”</strong><small>Record a payment</small></span><ArrowRight size={15} /></button>
              <button type="button" onClick={() => { setCommand("Order 20 milk packets"); setDraft(null); }}><span className="example-icon example-icon--green"><ShoppingBag size={16} /></span><span><strong>“Order 20 milk packets”</strong><small>Save a supplier draft</small></span><ArrowRight size={15} /></button>
            </div>
          </div>
          <div className="browser-voice-card">
            <div className="browser-voice-icon"><Volume2 size={18} /></div>
            <div><strong>Free browser voice</strong><p>Uses speech features built into your browser and device. No paid speech key or account needed. Browser language support varies; typing works as a fallback.</p></div>
          </div>
        </aside>
      </div>
    </>
  );
}

function VoiceReview({ draft, setDraft, onConfirm, working }) {
  const isExpense = draft.type === "expense";
  const isSale = draft.type === "sale";
  const setField = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  return (
    <div className="voice-review" id="voice-review-card" aria-labelledby="review-title">
      <div className="review-heading"><span className="review-check"><Check size={17} /></span><span><strong id="review-title">Here’s what I heard</strong><small>{draft.type === "credit" ? "I’ll listen after reading this back. Say “udhaar book mein add karo” or “expenses mein copy karo”." : "I’ll listen after reading this back. Say “confirm” to save or “cancel” to discard."}</small></span></div>
      <div className="review-fields">
        {isSale ? (
          <>
            <label>Sale description<input value={draft.label} onChange={(event) => setField("label", event.target.value)} placeholder="e.g. Tea and biscuits" /></label>
            <label>Amount (₹)<input type="number" min="0.01" step="0.01" value={draft.amount} onChange={(event) => setField("amount", Number(event.target.value))} /></label>
          </>
        ) : isExpense ? (
          <>
            <label>Expense name<input value={draft.title} onChange={(event) => setField("title", event.target.value)} /></label>
            <label>Amount (₹)<input type="number" min="0.01" step="0.01" value={draft.amount} onChange={(event) => setField("amount", Number(event.target.value))} /></label>
            <label>Category<select value={draft.category} onChange={(event) => setField("category", event.target.value)}>{Object.entries(categoryInfo).map(([key, item]) => <option value={key} key={key}>{item.label}</option>)}</select></label>
          </>
        ) : draft.type === "restock" ? (
          <>
            <div className="review-type"><span>Stock item</span><strong>{draft.itemName}</strong></div>
            <label>Quantity<input type="number" min="0.1" step="0.1" value={draft.quantity} onChange={(event) => setField("quantity", Number(event.target.value))} /></label>
            <div className="review-type"><span>Usual supplier</span><strong>{draft.supplier || "Add supplier later"}</strong></div>
          </>
        ) : (
          <>
            <label>Customer name<input value={draft.customer} onChange={(event) => setField("customer", event.target.value)} placeholder="Add a customer name" /></label>
            <label>Amount (₹)<input type="number" min="0.01" step="0.01" value={draft.amount} onChange={(event) => setField("amount", Number(event.target.value))} /></label>
            <label>Description<input value={draft.note || ""} onChange={(event) => setField("note", event.target.value)} placeholder="e.g. Biscuits and tea leaves" /></label>
            <div className="review-type"><span>Entry type</span><strong>{draft.type === "payment" ? "Payment received" : "Udhaar added"}</strong></div>
          </>
        )}
      </div>
      <div className="review-actions"><button className="button button--outline" type="button" onClick={() => setDraft(null)}>Change command</button><button className="button button--primary" type="button" onClick={onConfirm} disabled={working || (draft.type === "restock" ? !draft.quantity : !draft.amount) || (isExpense && !draft.title.trim()) || (isSale && !draft.label.trim())}><Check size={16} />{working ? "Saving…" : draft.type === "credit" ? "Add to udhaar book" : isSale ? "Save sale" : "Confirm & save"}</button></div>
    </div>
  );
}

function speak(text, language = "en-IN", onEnd) {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
    onEnd?.();
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  let finished = false;
  let fallbackTimer;
  const finish = () => {
    if (finished) return;
    finished = true;
    window.clearTimeout(fallbackTimer);
    onEnd?.();
  };
  utterance.lang = language;
  utterance.rate = 0.94;
  utterance.onend = finish;
  utterance.onerror = finish;
  const voices = window.speechSynthesis.getVoices();
  const voice = voices.find((item) => item.lang.toLowerCase() === language.toLowerCase())
    || voices.find((item) => item.lang.toLowerCase().startsWith(language.slice(0, 2).toLowerCase()));
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
  if (onEnd) fallbackTimer = window.setTimeout(finish, Math.max(3000, text.trim().split(/\s+/u).length * 460));
}

function ExpenseModal({ onClose, onSave }) {
  const [form, setForm] = useState({ title: "", category: "stock", amount: "", date: dateValue(), method: "cash", vendor: "", note: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave({ ...form, amount: Number(form.amount) });
    } catch (saveError) {
      setError(saveError.message || "Couldn’t save this expense.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal title="Add a shop expense" subtitle="Every rupee gets its own clear record." onClose={onClose}>
      <form className="modal-form" onSubmit={submit}>
        <div className="form-field"><label htmlFor="expense-title">What was it for?</label><input id="expense-title" autoFocus maxLength={100} value={form.title} onChange={(event) => update("title", event.target.value)} placeholder="e.g. Fresh milk delivery" required /></div>
        <div className="form-grid-two">
          <div className="form-field"><label htmlFor="expense-amount">Amount (₹)</label><input id="expense-amount" type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => update("amount", event.target.value)} placeholder="0" required /></div>
          <div className="form-field"><label htmlFor="expense-category">Category</label><select id="expense-category" value={form.category} onChange={(event) => update("category", event.target.value)}>{Object.entries(categoryInfo).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</select></div>
        </div>
        <div className="form-grid-two">
          <div className="form-field"><label htmlFor="expense-date">Date</label><input id="expense-date" type="date" value={form.date} onChange={(event) => update("date", event.target.value)} required /></div>
          <div className="form-field"><label htmlFor="expense-method">Paid by</label><select id="expense-method" value={form.method} onChange={(event) => update("method", event.target.value)}><option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option><option value="bank">Bank transfer</option><option value="credit">Customer credit</option></select></div>
        </div>
        <div className="form-field"><label htmlFor="expense-vendor">Supplier or person <span className="optional">(optional)</span></label><input id="expense-vendor" value={form.vendor} onChange={(event) => update("vendor", event.target.value)} placeholder="e.g. Gopal Dairy" /></div>
        {error && <div className="inline-alert" role="alert">{error}</div>}
        <div className="modal-actions"><button type="button" className="button button--outline" onClick={onClose}>Cancel</button><button type="submit" className="button button--primary" disabled={saving}><Check size={16} />{saving ? "Saving…" : "Save expense"}</button></div>
      </form>
    </Modal>
  );
}

function LedgerModal({ onClose, onSave }) {
  const [form, setForm] = useState({ customer: "", type: "credit", amount: "", note: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave({ ...form, amount: Number(form.amount) });
    } catch (saveError) {
      setError(saveError.message || "Couldn’t save this entry.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal title="Add to the udhaar book" subtitle="Record credit given or payment received." onClose={onClose}>
      <form className="modal-form" onSubmit={submit}>
        <div className="form-field"><label htmlFor="ledger-customer">Customer name</label><input id="ledger-customer" autoFocus value={form.customer} onChange={(event) => update("customer", event.target.value)} placeholder="e.g. Ramesh" required /></div>
        <div className="form-grid-two">
          <div className="form-field"><label htmlFor="ledger-type">Entry</label><select id="ledger-type" value={form.type} onChange={(event) => update("type", event.target.value)}><option value="credit">Udhaar given</option><option value="payment">Payment received</option></select></div>
          <div className="form-field"><label htmlFor="ledger-amount">Amount (₹)</label><input id="ledger-amount" type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => update("amount", event.target.value)} placeholder="0" required /></div>
        </div>
        <div className="form-field"><label htmlFor="ledger-note">Note <span className="optional">(optional)</span></label><input id="ledger-note" value={form.note} onChange={(event) => update("note", event.target.value)} placeholder="Tea and snacks" /></div>
        {error && <div className="inline-alert" role="alert">{error}</div>}
        <div className="modal-actions"><button type="button" className="button button--outline" onClick={onClose}>Cancel</button><button type="submit" className="button button--primary" disabled={saving}><Check size={16} />{saving ? "Saving…" : "Save entry"}</button></div>
      </form>
    </Modal>
  );
}

function RestockModal({ items, onClose, onSave }) {
  const first = items.find((item) => item.low) || items[0];
  const [form, setForm] = useState({ itemId: first?.id || "", quantity: "", supplier: first?.supplier || "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const selectedItem = items.find((item) => item.id === form.itemId);
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave({ itemId: form.itemId, quantity: Number(form.quantity), supplier: form.supplier });
    } catch (saveError) {
      setError(saveError.message || "Couldn’t save this restock draft.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal title="Create a restock draft" subtitle="Keep the item and quantity ready for your supplier." onClose={onClose}>
      <form className="modal-form" onSubmit={submit}>
        <div className="form-field"><label htmlFor="restock-item">Stock item</label><select id="restock-item" value={form.itemId} onChange={(event) => { const item = items.find((entry) => entry.id === event.target.value); setForm((current) => ({ ...current, itemId: event.target.value, supplier: item?.supplier || "" })); }} required>{items.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.quantity} {item.unit} left</option>)}</select></div>
        <div className="form-grid-two">
          <div className="form-field"><label htmlFor="restock-quantity">Quantity ({selectedItem?.unit || "units"})</label><input id="restock-quantity" type="number" min="0.1" step="0.1" autoFocus value={form.quantity} onChange={(event) => update("quantity", event.target.value)} placeholder="0" required /></div>
          <div className="form-field"><label htmlFor="restock-supplier">Supplier</label><input id="restock-supplier" value={form.supplier} onChange={(event) => update("supplier", event.target.value)} placeholder="Supplier name" /></div>
        </div>
        <div className="order-draft-note"><ShoppingBag size={15} /><span>This saves a local draft only. Contact the supplier to place the order.</span></div>
        {error && <div className="inline-alert" role="alert">{error}</div>}
        <div className="modal-actions"><button type="button" className="button button--outline" onClick={onClose}>Cancel</button><button type="submit" className="button button--primary" disabled={saving || !items.length}><Check size={16} />{saving ? "Saving…" : "Save draft"}</button></div>
      </form>
    </Modal>
  );
}

function Modal({ title, subtitle, onClose, children }) {
  useEffect(() => {
    const onKeyDown = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title" aria-describedby="modal-subtitle">
        <div className="modal-head"><div><span className="modal-mark"><Coffee size={18} /></span><div><h2 id="modal-title">{title}</h2><p id="modal-subtitle">{subtitle}</p></div></div><button className="icon-button" type="button" aria-label="Close dialog" onClick={onClose}><X size={19} /></button></div>
        {children}
      </section>
    </div>
  );
}

function EmptyState({ onRetry }) {
  return <div className="empty-page"><span className="empty-icon"><Store size={22} /></span><h2>Your shop book is waiting</h2><p>Start the API server to connect your dashboard and saved records.</p><button className="button button--primary" type="button" onClick={onRetry}>Try again</button></div>;
}

export default App;
