const PASSWORD = "nick2024";
const SESSION_KEY = "portfolio_auth";

// ── Auth ──────────────────────────────────────────────────────────

function isLoggedIn() {
  return sessionStorage.getItem(SESSION_KEY) === "1";
}

document.getElementById("login-form").addEventListener("submit", e => {
  e.preventDefault();
  const val = document.getElementById("password-input").value;
  if (val === PASSWORD) {
    sessionStorage.setItem(SESSION_KEY, "1");
    document.getElementById("login-error").textContent = "";
    showApp();
  } else {
    document.getElementById("login-error").textContent = "Невірний пароль";
    document.getElementById("password-input").value = "";
  }
});

document.getElementById("btn-logout").addEventListener("click", () => {
  sessionStorage.removeItem(SESSION_KEY);
  document.getElementById("app").style.display = "none";
  document.getElementById("login-screen").style.display = "flex";
});

document.getElementById("btn-refresh").addEventListener("click", () => loadData());

function showApp() {
  document.getElementById("login-screen").style.display = "none";
  document.getElementById("app").style.display = "block";
  loadData();
}

// ── API ───────────────────────────────────────────────────────────

async function fetchDB(db) {
  const res = await fetch(`/api/notion?db=${db}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return (await res.json()).rows || [];
}

// ── Formatters ────────────────────────────────────────────────────

function fmt(n) {
  if (n == null || isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function fmt2(n) {
  if (n == null || isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);
}

// Strip leading emoji from Notion category values like "🟢 Liquid" → "Liquid"
function normCat(cat) {
  return (cat || "").replace(/^[^\w]*\s*/, "").trim();
}

// ── Date helpers ──────────────────────────────────────────────────

function daysLeft(endStr) {
  if (!endStr) return null;
  return Math.max(0, Math.ceil((new Date(endStr) - new Date()) / 86400000));
}

function elapsedPct(startStr, endStr) {
  if (!startStr || !endStr) return 0;
  const s = new Date(startStr), e = new Date(endStr), n = new Date();
  return Math.min(100, Math.max(0, Math.round(((n - s) / (e - s)) * 100)));
}

// ── State ─────────────────────────────────────────────────────────

let cachedData = null;
let activeTab = "overview";

// ── Load & compute ────────────────────────────────────────────────

async function loadData() {
  document.getElementById("content").innerHTML =
    `<div class="loading"><div class="spinner"></div><p>Завантаження даних…</p></div>`;

  try {
    const [assetsRows, cashRows, stakingRows, propertiesRows, historyRows] = await Promise.all([
      fetchDB("assets"), fetchDB("cash"), fetchDB("staking"), fetchDB("properties"), fetchDB("history"),
    ]);

    const cash = cashRows.map(r => ({ ...r, cat: normCat(r.category) }));

    const sumCash = cat => cash
      .filter(r => r.cat.toLowerCase() === cat.toLowerCase())
      .reduce((s, r) => s + (r.value || 0), 0);

    const liquid   = sumCash("Liquid");
    const incoming = sumCash("Incoming");
    const locked   = sumCash("Locked");
    const debt     = sumCash("Debt");

    const propertiesTotal = propertiesRows.reduce((s, r) => s + (r.value || 0), 0);
    const cryptoTotal     = assetsRows.reduce((s, r) => s + (r.value || 0), 0);
    const cryptoPnL       = assetsRows.reduce((s, r) => s + (r.pnl || 0), 0);

    const stakingActive = stakingRows.filter(r => (r.status || "Active").toLowerCase() === "active");
    const stakingClosed = stakingRows.filter(r => (r.status || "Active").toLowerCase() === "closed");

    const stakingTotal         = stakingActive.reduce((s, r) => s + (r.amount || 0), 0);
    const stakingProfitActive  = stakingActive.reduce((s, r) => s + (r.profit || 0), 0);
    const stakingProfitClosed  = stakingClosed.reduce((s, r) => s + (r.profit || 0), 0);
    const stakingAllTimeProfit = stakingProfitActive + stakingProfitClosed;

    const netWorth = liquid + incoming + locked - debt + propertiesTotal + cryptoTotal + stakingTotal;

    const history = historyRows
      .filter(r => r.date)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    cachedData = {
      netWorth, liquid, incoming, locked, debt,
      propertiesTotal, cryptoTotal, cryptoPnL,
      stakingTotal, stakingProfitActive, stakingAllTimeProfit,
      assetsRows, cash, stakingActive, stakingClosed, propertiesRows, history,
    };

    const now = new Date().toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" });
    document.getElementById("last-updated").textContent = `оновлено з Notion · ${now}`;

    renderAll(cachedData);
  } catch (err) {
    document.getElementById("content").innerHTML =
      `<div class="error-state"><p>⚠️ <strong>Помилка завантаження</strong><br>${err.message}</p></div>`;
  }
}

// ── Render all ────────────────────────────────────────────────────

function renderAll(d) {
  const { netWorth, liquid, incoming, propertiesTotal, cryptoTotal, stakingTotal, cryptoPnL, stakingProfitActive, debt } = d;

  const allocation = [
    { label: "Ліквід",           value: liquid,          color: "#3b6e5e" },
    { label: "Нерухомість/авто", value: propertiesTotal, color: "#8a8578" },
    { label: "Крипта",           value: cryptoTotal,     color: "#b3593f" },
    { label: "Стейкінг",         value: stakingTotal,    color: "#c99b3f" },
    { label: "Очікується",       value: incoming,        color: "#6b7fa8" },
  ].filter(a => a.value > 0);

  const allocBars = allocation.map(a =>
    `<div class="alloc-segment" style="width:${((a.value / netWorth) * 100).toFixed(1)}%;background:${a.color}"></div>`
  ).join("");

  const allocLegend = allocation.map(a =>
    `<div class="alloc-legend-item">
      <span class="alloc-dot" style="background:${a.color}"></span>
      ${a.label} <span class="alloc-pct">${((a.value / netWorth) * 100).toFixed(0)}%</span>
    </div>`
  ).join("");

  const debtLabel = d.cash.filter(r => r.cat.toLowerCase() === "debt").map(r => r.account).join(", ") || "немає боргів";

  document.getElementById("content").innerHTML = `

    <div class="card hero-card">
      <div class="section-label">Чистий капітал</div>
      <div class="hero-value">${fmt(netWorth)}</div>
      <div class="alloc-bar">${allocBars}</div>
      <div class="alloc-legend">${allocLegend}</div>
    </div>

    <div class="stats-grid">
      <div class="card stat-card">
        <div class="section-label">Вільний капітал</div>
        <div class="stat-value">${fmt(liquid + incoming + locked - debt)}</div>
        <div class="stat-sub">без стейкінгу</div>
      </div>
      <div class="card stat-card">
        <div class="section-label">В стейкінгу</div>
        <div class="stat-value">${fmt(stakingTotal)}</div>
        <div class="stat-sub green">+${fmt2(stakingProfitActive)} поточний профіт</div>
      </div>
      <div class="card stat-card">
        <div class="section-label">Крипта (спот)</div>
        <div class="stat-value">${fmt(cryptoTotal)}</div>
        <div class="stat-sub ${cryptoPnL < 0 ? "red" : "green"}">${fmt2(cryptoPnL)} P&L</div>
      </div>
      <div class="card stat-card">
        <div class="section-label">Борги</div>
        <div class="stat-value">${fmt(debt)}</div>
        <div class="stat-sub">${debtLabel}</div>
      </div>
    </div>

    <div class="tab-bar-wrap">
      ${["overview:Огляд","staking:Стейкінг","crypto:Крипта","cash:Готівка","history:Історія"].map(s => {
        const [key, label] = s.split(":");
        return `<button class="tab-btn ${activeTab === key ? "active" : ""}" data-tab="${key}">${label}</button>`;
      }).join("")}
    </div>

    <div id="tab-content"></div>

    <div class="footer">Дані з Notion · Portfolio Tracker</div>
  `;

  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      activeTab = btn.dataset.tab;
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderTab(cachedData);
    });
  });

  renderTab(d);
}

function renderTab(d) {
  const el = document.getElementById("tab-content");
  if (!el) return;
  if      (activeTab === "overview") el.innerHTML = renderOverview(d);
  else if (activeTab === "staking")  el.innerHTML = renderStaking(d);
  else if (activeTab === "crypto")   el.innerHTML = renderCrypto(d);
  else if (activeTab === "cash")     el.innerHTML = renderCash(d);
  else if (activeTab === "history")  el.innerHTML = renderHistory(d);
}

// ── Tab: Overview ─────────────────────────────────────────────────

function renderOverview(d) {
  const propRows = d.propertiesRows.map(p => `
    <div class="list-row">
      <div>
        <div class="row-name">${p.name}</div>
        <div class="row-sub">${p.description || "Фізичний актив"}</div>
      </div>
      <div class="row-value">${fmt(p.value)}</div>
    </div>`).join("") || `<p class="empty">Немає даних</p>`;

  // Build dynamic risks
  const risks = [];

  if (d.cryptoPnL < 0) {
    const worst = [...d.assetsRows]
      .filter(a => (a.pnl || 0) < 0)
      .sort((a, b) => (a.pnl || 0) - (b.pnl || 0))
      .slice(0, 2)
      .map(a => `${a.name}${a.pnlPct != null ? " " + Math.round(a.pnlPct) + "%" : ""}`)
      .join(", ");
    risks.push({ color: "#b3593f", text: `Спотова крипта в мінусі: <b>${fmt2(d.cryptoPnL)}</b> нереалізованого збитку${worst ? ` (${worst})` : ""}` });
  }

  const soonest = [...d.stakingActive]
    .filter(r => r.endDate)
    .sort((a, b) => new Date(a.endDate) - new Date(b.endDate))[0];
  if (soonest) {
    const left = daysLeft(soonest.endDate);
    risks.push({ color: "#c99b3f", text: `Найближчий стейкінг закривається через <b>${left} дн.</b> (${soonest.platform || soonest.name}, ${fmt(soonest.amount)})` });
  }

  if (d.incoming > 0) {
    const accounts = d.cash.filter(r => r.cat.toLowerCase() === "incoming").map(r => r.account).join(", ");
    risks.push({ color: "#8a8578", text: `Очікується надходження <b>${fmt(d.incoming)}</b>${accounts ? ` (${accounts})` : ""} — ще не в ліквіді` });
  }

  const riskRows = risks.map(r => `
    <div class="risk-row">
      <span class="risk-dot" style="background:${r.color}"></span>
      <div class="risk-text">${r.text}</div>
    </div>`).join("") || `<p class="empty">Немає критичних ризиків</p>`;

  return `
    <div class="tab-space">
      <div class="card section-card">
        <div class="section-label">Активи (нерухомість/фізичні)</div>
        <div class="list">${propRows}</div>
      </div>
      <div class="card section-card">
        <div class="section-label">Ризики, на які варто дивитись</div>
        <div class="risks">${riskRows}</div>
      </div>
    </div>`;
}

// ── Tab: Staking ──────────────────────────────────────────────────

function renderStaking(d) {
  const activeRows = d.stakingActive.map((s, i) => {
    const pct  = elapsedPct(s.startDate, s.endDate);
    const left = daysLeft(s.endDate);
    return `
      <div class="staking-pos ${i > 0 ? "border-top" : ""}">
        <div class="staking-pos-head">
          <div class="row-name">${s.name || "—"}</div>
          <div class="staking-profit">${s.profit != null ? "+" + fmt2(s.profit) : "—"}</div>
        </div>
        <div class="row-sub">${[s.platform, s.apy ? "APY " + s.apy : null, fmt(s.amount)].filter(Boolean).join(" · ")}</div>
        <div class="progress-track">
          <div class="progress-bar" style="width:${pct}%;background:#c99b3f"></div>
        </div>
        <div class="row-sub">${left != null ? left + " дн. лишилось" : ""} · ${pct}% пройдено</div>
      </div>`;
  }).join("") || `<p class="empty">Немає активних позицій</p>`;

  const closedRows = d.stakingClosed.map(s => `
    <div class="list-row">
      <div class="row-sub" style="color:#57534e">${s.name}${s.platform ? " · " + s.platform : ""}</div>
      <div class="closed-profit">${s.profit != null ? "+" + fmt2(s.profit) : "—"}</div>
    </div>`).join("");

  return `
    <div class="tab-space">
      <div class="card section-card">
        <div class="section-label">Активні позиції (${d.stakingActive.length})</div>
        ${activeRows}
      </div>
      ${d.stakingClosed.length ? `
      <div class="card section-card">
        <div class="section-label">Закриті позиції (${d.stakingClosed.length})</div>
        <div class="list">${closedRows}</div>
        <div class="list-total">
          <span>Весь профіт стейкінгу</span>
          <span class="green-bold">+${fmt2(d.stakingAllTimeProfit)}</span>
        </div>
      </div>` : ""}
    </div>`;
}

// ── Tab: Crypto ───────────────────────────────────────────────────

function renderCrypto(d) {
  const rows = d.assetsRows.map(c => `
    <div class="list-row">
      <div>
        <div class="row-name">${c.name}</div>
        <div class="row-sub">${c.account || "—"}</div>
      </div>
      <div class="text-right">
        <div class="row-value">${c.value != null ? fmt2(c.value) : "—"}</div>
        <div class="row-sub ${(c.pnl || 0) < 0 ? "red" : (c.pnl || 0) > 0 ? "green" : ""}">
          ${c.pnl != null && c.pnl !== 0
            ? `${c.pnlPct != null ? Math.round(c.pnlPct) + "% · " : ""}${fmt2(c.pnl)}`
            : "без змін"}
        </div>
      </div>
    </div>`).join("") || `<p class="empty">Немає активів</p>`;

  return `
    <div class="tab-space">
      <div class="card section-card">
        <div class="section-label">Спот-гаманці</div>
        <div class="list">${rows}</div>
        <div class="list-total">
          <span>Всього</span>
          <div class="text-right">
            <div style="font-variant-numeric:tabular-nums">${fmt2(d.cryptoTotal)}</div>
            <div style="font-size:.75rem;font-weight:500;color:${d.cryptoPnL < 0 ? "#b3593f" : "#3b6e5e"};font-variant-numeric:tabular-nums">${fmt2(d.cryptoPnL)}</div>
          </div>
        </div>
      </div>
    </div>`;
}

// ── Tab: Cash ─────────────────────────────────────────────────────

function renderCash(d) {
  const colorMap = { liquid: "#3b6e5e", incoming: "#6b7fa8", locked: "#8a8578", staking: "#c99b3f", debt: "#b3593f" };
  const labelMap = { liquid: "Ліквід", incoming: "Очікується", locked: "Заблоковано", staking: "Стейкінг", debt: "Борг" };

  const rows = d.cash.map(r => {
    const key   = r.cat.toLowerCase();
    const color = colorMap[key] || "#a8a29e";
    const label = labelMap[key] || r.cat;
    return `
      <div class="list-row">
        <div class="row-with-dot">
          <span class="cat-dot" style="background:${color}"></span>
          <div>
            <div class="row-name">${r.account}</div>
            <div class="row-sub">${label}</div>
          </div>
        </div>
        <div class="row-value">${r.value != null ? fmt2(r.value) : "—"}</div>
      </div>`;
  }).join("") || `<p class="empty">Немає записів</p>`;

  return `
    <div class="tab-space">
      <div class="card section-card">
        <div class="section-label">По акаунтах</div>
        <div class="list">${rows}</div>
      </div>
    </div>`;
}

// ── Tab: History ──────────────────────────────────────────────────

function renderHistory(d) {
  if (!d.history.length) {
    return `
      <div class="tab-space">
        <div class="card section-card">
          <div class="section-label">Чекпоінти</div>
          <p class="empty" style="padding:.5rem 0">
            Ще немає жодного чекпоінту.<br>
            Додай перший рядок у базу <b>📅 Portfolio History</b> в Notion після наступного оновлення даних.
          </p>
        </div>
      </div>`;
  }

  // Find max net worth for bar scaling
  const maxNW = Math.max(...d.history.map(r => r.netWorth || 0));

  // Delta vs previous checkpoint
  const rows = d.history.map((r, i) => {
    const prev = d.history[i + 1];
    const delta = prev && r.netWorth != null && prev.netWorth != null
      ? r.netWorth - prev.netWorth : null;
    const pct = maxNW > 0 ? ((r.netWorth || 0) / maxNW) * 100 : 0;

    const dateStr = r.date
      ? new Date(r.date).toLocaleDateString("uk-UA", { day: "numeric", month: "short", year: "numeric" })
      : "—";

    const segments = [
      { label: "Ліквід",    value: r.freeCash,   color: "#3b6e5e" },
      { label: "Нерухомість", value: r.properties, color: "#8a8578" },
      { label: "Крипта",    value: r.crypto,     color: "#b3593f" },
      { label: "Стейкінг",  value: r.staking,    color: "#c99b3f" },
    ].filter(s => s.value > 0);

    const total = segments.reduce((s, x) => s + x.value, 0);
    const miniBar = total > 0
      ? segments.map(s =>
          `<div style="width:${((s.value/total)*100).toFixed(1)}%;background:${s.color};height:100%"></div>`
        ).join("")
      : "";

    return `
      <div class="history-row">
        <div class="history-row-top">
          <div>
            <div class="row-name">${r.name || dateStr}</div>
            <div class="row-sub">${r.name ? dateStr : ""}${r.note ? (r.name ? " · " : "") + r.note : ""}</div>
          </div>
          <div class="text-right">
            <div class="row-value">${r.netWorth != null ? fmt(r.netWorth) : "—"}</div>
            ${delta != null
              ? `<div class="row-sub ${delta >= 0 ? "green" : "red"}">${delta >= 0 ? "+" : ""}${fmt(delta)}</div>`
              : ""}
          </div>
        </div>
        ${r.netWorth != null ? `
        <div class="history-bar-wrap">
          <div class="history-bar-track">
            <div class="history-bar-fill" style="width:${pct.toFixed(1)}%">
              <div style="display:flex;height:100%;border-radius:999px;overflow:hidden">${miniBar}</div>
            </div>
          </div>
        </div>` : ""}
        ${segments.length ? `
        <div class="history-breakdown">
          ${segments.map(s => `
            <span class="history-seg">
              <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${s.color};vertical-align:middle;margin-right:3px"></span>
              ${s.label} ${fmt(s.value)}
            </span>`).join("")}
        </div>` : ""}
      </div>`;
  }).join("");

  return `
    <div class="tab-space">
      <div class="card section-card">
        <div class="section-label">Чекпоінти (${d.history.length})</div>
        <div class="history-list">${rows}</div>
      </div>
      <div style="font-size:.72rem;color:#a8a29e;text-align:center;padding:.5rem 0">
        Щоб додати чекпоінт — відкрий <b>📅 Portfolio History</b> в Notion і заповни новий рядок
      </div>
    </div>`;
}

// ── Init ──────────────────────────────────────────────────────────

if (isLoggedIn()) {
  showApp();
} else {
  document.getElementById("login-screen").style.display = "flex";
  document.getElementById("app").style.display = "none";
}
