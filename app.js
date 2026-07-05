const PASSWORD = "nick2024";
const SESSION_KEY = "portfolio_auth";

// ─── Auth ───────────────────────────────────────────────────────────────────

function isLoggedIn() {
  return sessionStorage.getItem(SESSION_KEY) === "1";
}

function showLogin() {
  document.getElementById("login-screen").style.display = "flex";
  document.getElementById("app").style.display = "none";
}

function showApp() {
  document.getElementById("login-screen").style.display = "none";
  document.getElementById("app").style.display = "block";
  loadDashboard();
}

document.getElementById("login-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const val = document.getElementById("password-input").value;
  if (val === PASSWORD) {
    sessionStorage.setItem(SESSION_KEY, "1");
    document.getElementById("login-error").style.display = "none";
    showApp();
  } else {
    const err = document.getElementById("login-error");
    err.textContent = "Incorrect password. Please try again.";
    err.style.display = "block";
    document.getElementById("password-input").value = "";
  }
});

document.getElementById("btn-logout").addEventListener("click", () => {
  sessionStorage.removeItem(SESSION_KEY);
  showLogin();
});

const btnTheme = document.getElementById("btn-theme");
function applyTheme(light) {
  if (light) {
    document.documentElement.dataset.theme = "light";
    btnTheme.textContent = "🌙";
    localStorage.setItem("theme", "light");
  } else {
    delete document.documentElement.dataset.theme;
    btnTheme.textContent = "☀";
    localStorage.setItem("theme", "dark");
  }
}
// Init button label to match saved theme
applyTheme(localStorage.getItem("theme") === "light");
btnTheme.addEventListener("click", () => {
  applyTheme(document.documentElement.dataset.theme !== "light");
});

// declared early so Refresh listener can reference it
let activeTab    = "dashboard";
let stakingLoaded = false;

document.getElementById("btn-refresh").addEventListener("click", () => {
  stakingLoaded = false;
  if (activeTab === "dashboard") loadDashboard();
  else loadStaking();
});

// ─── API ─────────────────────────────────────────────────────────────────────

async function fetchDB(db) {
  const res = await fetch(`/api/notion?db=${db}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.rows || [];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(num, decimals = 2) {
  if (num === null || num === undefined || isNaN(num)) return "—";
  return num.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtUSD(num) {
  if (isNaN(num)) return "—";
  const abs = Math.abs(num);
  const sign = num < 0 ? "-" : "";
  return `${sign}$${fmt(abs)}`;
}

function parseNum(str) {
  if (!str) return NaN;
  // Handle European format: space as thousands separator, comma as decimal
  // e.g. "27 692,", "$63 000,00", "1 550,00"
  let s = String(str)
    .replace(/["']/g, "")      // remove quotes
    .replace(/\$/g, "")        // remove $
    .replace(/\s/g, "")        // remove all whitespace (thousands sep)
    .replace(/,(\d*)$/, ".$1") // replace trailing comma (decimal) with dot
    .replace(/,$/, "")         // remove trailing comma with nothing after
    .replace(/%/g, "");        // remove %
  return parseFloat(s);
}

function badgeClass(type) {
  const map = { Crypto: "Crypto", Stock: "Stock", ETF: "ETF", Cash: "Cash", Bank: "Bank", Broker: "Broker" };
  return map[type] ? `badge-${map[type]}` : "badge-default";
}

function pnlClass(v) {
  return v < 0 ? "pnl-neg" : v > 0 ? "pnl-pos" : "";
}

function pnlSign(v) {
  return v > 0 ? "+" : "";
}

// ─── Category config ─────────────────────────────────────────────────────────

const CAT_CFG = {
  liquid:     { emoji: "🟢", label: "Liquid",     color: "#818CF8", bg: "rgba(129,140,248,.1)" },
  incoming:   { emoji: "🟣", label: "Incoming",   color: "#A78BFA", bg: "rgba(167,139,250,.1)" },
  debt:       { emoji: "🔴", label: "Debt",       color: "#FB923C", bg: "rgba(251,146,60,.1)"  },
  locked:     { emoji: "🔵", label: "Investment", color: "#94A3B8", bg: "rgba(148,163,184,.1)" },
  investment: { emoji: "🔵", label: "Investment", color: "#94A3B8", bg: "rgba(148,163,184,.1)" },
  staking:    { emoji: "💎", label: "Staking",    color: "#C084FC", bg: "rgba(192,132,252,.1)" },
};

function getCatCfg(cat) {
  const lo = (cat || "").toLowerCase();
  for (const [key, cfg] of Object.entries(CAT_CFG)) {
    if (lo.includes(key)) return cfg;
  }
  return { emoji: "⚪", label: cat, color: "#9CA3AF", bg: "#F3F4F6" };
}

// ─── Render ──────────────────────────────────────────────────────────────────

function renderSkeleton() {
  document.getElementById("dashboard-content").innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading portfolio data…</p>
    </div>`;
}

function renderError(msg) {
  document.getElementById("dashboard-content").innerHTML = `
    <div class="error-state">
      <div class="err-icon">⚠️</div>
      <p><strong>Failed to load data</strong><br>${msg}</p>
    </div>`;
}

function renderDashboard(summary, assets, cash) {
  const netWorth  = summary.netWorth;
  const freeCash  = summary.freeCash;
  const assetsVal = summary.assets;
  const invested  = summary.invested;
  const staking   = summary.staking;   // from Investment log
  const totalPnl  = summary.pnl;

  const costBasis = invested - totalPnl;
  const pnlPct    = costBasis !== 0 ? (totalPnl / costBasis) * 100 : 0;

  const now = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  document.getElementById("last-updated").textContent = `Updated ${now}`;

  // ── P&L breakdown cards (Crypto only, grouped by coin) ──
  const cryptoAssets = assets.filter(a => (a.type || "").trim() === "Crypto");

  // Group by base coin name: "ETH (Binance)" → "ETH"
  const coinName = n => n.replace(/\s*\(.*?\)\s*/g, "").trim() || n;
  const coinGroups = {};
  cryptoAssets.forEach(a => {
    const coin = coinName(a.name);
    if (!coinGroups[coin]) coinGroups[coin] = { coin, accounts: [] };
    coinGroups[coin].accounts.push(a);
  });

  const pnlCards = Object.values(coinGroups).map(g => {
    let totalVal = 0, totalPnl = 0, validVal = false, validPnl = false;
    g.accounts.forEach(a => {
      const v = a.value, p = a.pnl;
      if (v != null) { totalVal += v; validVal = true; }
      if (p != null) { totalPnl += p; validPnl = true; }
    });
    const costB    = totalVal - totalPnl;
    const pnlPct   = costB !== 0 ? (totalPnl / costB) * 100 : 0;
    const cls      = pnlClass(totalPnl);
    const barColor = totalPnl >= 0 ? "#00C805" : "#FF3B30";
    const progress = costB > 0 ? Math.min(100, Math.max(2, (totalVal / costB) * 100)) : 50;

    // Per-account tooltip rows
    const tooltipRows = g.accounts.map(a => {
      const v = a.value, p = a.pnl;
      const acct = a.account || a.name.match(/\((.+?)\)/)?.[1] || a.name;
      return `<div class="pnl-tooltip-row">
        <span class="pnl-tooltip-acct">${acct}</span>
        <span class="pnl-tooltip-val">${v == null ? "—" : fmtUSD(v)}</span>
        <span class="pnl-tooltip-pnl ${pnlClass(p)}">${p == null ? "—" : pnlSign(p)+fmtUSD(p)}</span>
      </div>`;
    }).join("");

    return `
    <div class="pnl-card pnl-card-grouped">
      <div class="pnl-card-name">${g.coin}${g.accounts.length > 1 ? ` <span class="pnl-acct-count">${g.accounts.length} accts</span>` : ""}</div>
      <div class="pnl-card-type">Crypto</div>
      <div class="pnl-card-value">${validVal ? fmtUSD(totalVal) : "—"}</div>
      <div class="pnl-card-pnl ${cls}">${validPnl ? pnlSign(totalPnl) + fmtUSD(totalPnl) : "—"}</div>
      <div class="pnl-progress-track">
        <div class="pnl-progress-bar" style="width:${progress}%;background:${barColor}"></div>
      </div>
      <div class="pnl-card-pct ${cls}">${validPnl ? pnlSign(pnlPct)+fmt(pnlPct)+"%" : "—"}</div>
      ${g.accounts.length > 1 ? `<div class="pnl-tooltip"><div class="pnl-tooltip-title">By account</div>${tooltipRows}</div>` : ""}
    </div>`;
  }).join("");

  // ── Liquidity category totals ──
  const catTotals = {};
  const catAccounts = {};
  cash.forEach(c => {
    const key = (c.category || "").toLowerCase().trim();
    if (!key) return;
    const v = c.value;
    if (v != null && !isNaN(v)) {
      catTotals[c.category]   = (catTotals[c.category]   || 0) + v;
      catAccounts[c.category] = (catAccounts[c.category] || []);
      catAccounts[c.category].push(c);
    }
  });
  const liqTotal = Object.values(catTotals).reduce((s, v) => s + v, 0);

  const liqBars = Object.entries(catTotals).map(([cat, val]) => {
    const cfg = getCatCfg(cat);
    const pct = liqTotal > 0 ? Math.max(1, (val / liqTotal) * 100) : 0;
    const accounts = catAccounts[cat] || [];
    const acctRows = accounts.map(c => {
      const v = c.value;
      return `<div class="liq-acct-row">
        <span class="liq-acct-name">${c.account}</span>
        <span class="liq-acct-val">${v == null || isNaN(v) ? "—" : fmtUSD(v)}</span>
      </div>`;
    }).join("");

    return `
    <div class="liq-row-wrap">
      <div class="liq-row">
        <div class="liq-label">${cfg.emoji} ${cfg.label}</div>
        <div class="liq-track"><div class="liq-bar" style="width:${pct}%;background:${cfg.color}"></div></div>
        <div class="liq-amount">${fmtUSD(val)}</div>
      </div>
      ${accounts.length ? `<div class="liq-acct-panel">${acctRows}</div>` : ""}
    </div>`;
  }).join("");

  // ── Assets table ──
  const assetRows = assets.map((a, i) => {
    const pnl  = parseNum(a.pnl);
    const pnlP = parseNum(a.pnlPct);
    const val  = parseNum(a.value);
    const cls  = pnlClass(pnl);
    return `<tr>
      <td class="td-name">${a.name}</td>
      <td><span class="badge ${badgeClass(a.type)}">${a.type}</span></td>
      <td class="td-mono">${isNaN(val) ? "—" : fmtUSD(val)}</td>
      <td><span class="pnl-badge ${cls}">${isNaN(pnl) ? "—" : pnlSign(pnl) + fmtUSD(pnl)}</span></td>
      <td class="td-pnl ${cls}">${isNaN(pnlP) ? "—" : pnlSign(pnlP) + fmt(pnlP) + "%"}</td>
    </tr>`;
  }).join("");

  document.getElementById("dashboard-content").innerHTML = `

    <!-- ── HERO ── -->
    <div class="hero">
      <div class="hero-label">Net Worth</div>
      <div class="hero-value">${fmtUSD(netWorth)}</div>
      <div class="hero-mini-cards hero-mini-cards-4">
        <div class="mini-card">
          <div class="mini-card-label">💵 Free Cash</div>
          <div class="mini-card-value">${fmtUSD(freeCash)}</div>
        </div>
        <div class="mini-card">
          <div class="mini-card-label">🏠 Assets</div>
          <div class="mini-card-value">${fmtUSD(assetsVal)}</div>
        </div>
        <div class="mini-card">
          <div class="mini-card-label">📉 Crypto Investment</div>
          <div class="mini-card-value ${totalPnl < 0 ? "mini-neg" : ""}">${fmtUSD(invested)}</div>
          <div class="mini-card-sub ${totalPnl < 0 ? "mini-neg" : "mini-pos"}">${pnlSign(totalPnl)}${fmtUSD(totalPnl)} (${pnlSign(pnlPct)}${fmt(pnlPct)}%)</div>
        </div>
        <div class="mini-card">
          <div class="mini-card-label">💎 Crypto Staking</div>
          <div class="mini-card-value">${staking > 0 ? fmtUSD(staking) : "—"}</div>
        </div>
      </div>
    </div>

    <!-- ── CHARTS ── -->
    <div class="charts-grid">
      <div class="chart-card">
        <div class="chart-card-title">Portfolio Allocation</div>
        <div class="donut-wrap">
          <canvas id="donut-canvas"></canvas>
          <div class="donut-legend" id="donut-legend"></div>
        </div>
      </div>
      <div class="chart-card">
        <div class="chart-card-title">Assets by Value</div>
        <div class="bar-canvas-wrap">
          <canvas id="bar-canvas"></canvas>
        </div>
      </div>
    </div>

    <!-- ── CRYPTO P&L BREAKDOWN ── -->
    ${cryptoAssets.length ? `
    <div class="section">
      <div class="section-header">
        <div class="section-title">📉 Crypto P&amp;L Breakdown <span class="section-count">${cryptoAssets.length}</span></div>
      </div>
      <div class="pnl-grid">${pnlCards}</div>
    </div>` : ""}

    <!-- ── LIQUIDITY ── -->
    <div class="section">
      <div class="section-header">
        <div class="section-title">💧 Liquidity</div>
      </div>
      <div class="liquidity-card">
        ${liqBars || '<p style="color:var(--text-muted);font-size:.875rem">No categories found</p>'}
      </div>
    </div>

`;

  // Draw charts after DOM update
  requestAnimationFrame(() => {
    drawDonut(netWorth, freeCash, assetsVal, invested, staking);
    drawBarChart(assets);
  });
}

// ─── Chart: Donut ─────────────────────────────────────────────────────────────

function drawDonut(netWorth, freeCash, assetsVal, invested, staking) {
  const canvas = document.getElementById("donut-canvas");
  if (!canvas) return;

  const segments = [
    { label: "Free Cash", value: freeCash,  color: "#818CF8" },
    { label: "Assets",    value: assetsVal, color: "#A3A3A3" },
    { label: "Crypto",    value: invested,  color: "#94A3B8" },
    { label: "Staking",   value: staking,   color: "#C084FC" },
  ].filter(s => s.value > 0);

  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total === 0) return;

  const dpr  = Math.min(window.devicePixelRatio || 1, 2);
  const size = 220;
  canvas.width  = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width  = size + "px";
  canvas.style.height = size + "px";

  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  const cx = size / 2, cy = size / 2;
  const outerR = size / 2 - 12;
  const innerR = outerR * 0.62;
  const gap    = 0.025;
  let angle    = -Math.PI / 2;

  segments.forEach(seg => {
    const sweep = (seg.value / total) * Math.PI * 2 - gap;
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, angle, angle + sweep);
    ctx.arc(cx, cy, innerR, angle + sweep, angle, true);
    ctx.closePath();
    ctx.fillStyle = seg.color;
    ctx.fill();
    angle += sweep + gap;
  });

  // Center label — read color from CSS variable
  const isDark = document.documentElement.dataset.theme !== "light";
  const labelColor = isDark ? "#52525B" : "#9CA3AF";
  const valueColor = isDark ? "#FAFAFA"  : "#09090B";
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle    = labelColor;
  ctx.font         = `500 10px Inter, sans-serif`;
  ctx.fillText("NET WORTH", cx, cy - 11);
  ctx.fillStyle = valueColor;
  ctx.font      = `600 14px "SF Mono", monospace`;
  ctx.fillText(fmtUSD(netWorth), cx, cy + 9);

  // Legend
  const legend = document.getElementById("donut-legend");
  if (legend) {
    legend.innerHTML = segments.map(seg => {
      const pct = ((seg.value / total) * 100).toFixed(1);
      return `<div class="legend-item">
        <div class="legend-dot" style="background:${seg.color}"></div>
        ${seg.label} <span class="legend-pct">${pct}%</span>
      </div>`;
    }).join("");
  }
}

// ─── Chart: Horizontal Bar ────────────────────────────────────────────────────

function drawBarChart(assets) {
  const canvas = document.getElementById("bar-canvas");
  if (!canvas) return;

  const items = assets
    .map(a => ({ name: a.name, value: parseNum(a.value), type: a.type }))
    .filter(a => !isNaN(a.value) && a.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  if (!items.length) return;

  const dpr        = Math.min(window.devicePixelRatio || 1, 2);
  const padL       = 110;
  const padR       = 85;
  const padTop     = 8;
  const rowH       = 34;
  const barH       = 18;
  const width      = canvas.parentElement.offsetWidth || 400;
  const height     = padTop + items.length * rowH + 12;
  const barMaxW    = width - padL - padR;
  const maxVal     = items[0].value;

  canvas.width  = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width  = width + "px";
  canvas.style.height = height + "px";

  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  items.forEach((item, i) => {
    const y    = padTop + i * rowH;
    const barW = Math.max(4, (item.value / maxVal) * barMaxW);
    const color = item.type === "Crypto" ? "#818CF8" : "#71717A";
    const barY  = y + (rowH - barH) / 2;

    // Bar background
    ctx.fillStyle = color + "18";
    roundRect(ctx, padL, barY, barMaxW, barH, 5);
    ctx.fill();

    // Bar fill
    ctx.fillStyle = color;
    roundRect(ctx, padL, barY, barW, barH, 5);
    ctx.fill();

    // Name
    ctx.fillStyle    = "#1A1A1A";
    ctx.font         = `600 12px Inter, sans-serif`;
    ctx.textAlign    = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(truncate(item.name, 13), padL - 8, y + rowH / 2);

    // Value
    ctx.fillStyle  = "#6B7280";
    ctx.font       = `600 11px "SF Mono", monospace`;
    ctx.textAlign  = "left";
    ctx.fillText(fmtUSD(item.value), padL + barW + 7, y + rowH / 2);
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function truncate(str, max) {
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}

// Parse dates in DD.MM.YYYY, DD/MM/YYYY, YYYY-MM-DD, or MM/DD/YYYY
function parseDate(str) {
  if (!str) return null;
  str = str.trim();
  // DD.MM.YYYY or DD/MM/YYYY
  let m = str.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  // YYYY-MM-DD
  m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  // fallback
  const d = new Date(str);
  return isNaN(d) ? null : d;
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;
    if (tab === activeTab) return;
    activeTab = tab;
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("dashboard-content").style.display = tab === "dashboard" ? "" : "none";
    document.getElementById("staking-content").style.display   = tab === "staking"   ? "" : "none";
    if (tab === "staking") loadStaking();
  });
});

// ─── Staking: Load ────────────────────────────────────────────────────────────

async function loadStaking() {
  if (stakingLoaded) return;
  const el = document.getElementById("staking-content");
  el.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading investment log…</p></div>`;
  try {
    const rows = await fetchDB("staking");
    if (!rows.length) {
      el.innerHTML = `<div class="error-state"><div class="err-icon">📭</div><p>No staking positions found.</p></div>`;
      return;
    }
    renderStaking(rows);
    stakingLoaded = true;
  } catch (err) {
    el.innerHTML = `<div class="error-state"><div class="err-icon">⚠️</div><p><strong>Failed to load</strong><br>${err.message}</p></div>`;
  }
}

// ─── Staking: Render ──────────────────────────────────────────────────────────

function renderStaking(rows) {
  const active  = rows.filter(r => (r.status || "Active").toLowerCase() === "active");
  const history = rows.filter(r => (r.status || "Active").toLowerCase() !== "active");

  // ── Summary from active only ──
  let totalInvested = 0, totalProfit = 0;
  active.forEach(r => {
    if (r.amount != null) totalInvested += r.amount;
    if (r.profit != null) totalProfit   += r.profit;
  });
  const historyProfit = history.reduce((s, r) => s + (r.profit || 0), 0);
  const allTimeProfit = totalProfit + historyProfit;

  const roi = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;
  const profitPos = totalProfit >= 0;

  // ── Build position cards ──
  const posCards = active.map(r => {
    const { name, platform, amount, profit, apy, startDate, endDate, status } = r;
    const pPos = profit == null || profit >= 0;
    const statusLo = (status || "Active").toLowerCase();
    const statusClass = statusLo.includes("active") ? "status-active"
      : statusLo.includes("pend") ? "status-pending" : "status-closed";
    const statusLabel = status || "Active";

    let timingHTML = "";
    if (startDate && endDate) {
      const start    = new Date(startDate);
      const end      = new Date(endDate);
      const now      = new Date();
      const total    = end - start;
      const elapsed  = now - start;
      const pct      = total > 0 ? Math.min(100, Math.max(0, (elapsed / total) * 100)) : 0;
      const daysLeft = Math.max(0, Math.ceil((end - now) / 86400000));
      const barColor = pct >= 80 ? "#FF3B30" : pct >= 50 ? "#F59E0B" : "#00C805";
      timingHTML = `
        <div class="timing-wrap">
          <div class="timing-label">${daysLeft > 0 ? `${daysLeft}d left` : "Ended"} · ${pct.toFixed(0)}% elapsed</div>
          <div class="timing-track"><div class="timing-bar" style="width:${pct}%;background:${barColor}"></div></div>
        </div>`;
    } else if (endDate) {
      timingHTML = `<div class="timing-label" style="font-size:.75rem;color:var(--text-muted)">Exit: ${endDate}</div>`;
    }

    return `
    <div class="staking-pos-card">
      <div>
        <div class="staking-pos-name">${name || "—"}</div>
        ${platform ? `<div class="staking-pos-platform">${platform}</div>` : ""}
        <div style="margin-top:.5rem"><span class="status-badge ${statusClass}">${statusLabel}</span></div>
      </div>
      <div>
        <div class="staking-pos-col-label">Invested</div>
        <div class="staking-pos-col-value">${amount != null ? fmtUSD(amount) : "—"}</div>
      </div>
      <div>
        <div class="staking-pos-col-label">Profit</div>
        <div class="staking-pos-col-value ${pPos ? "pos" : "neg"}">${profit != null ? pnlSign(profit) + fmtUSD(profit) : "—"}</div>
      </div>
      <div>
        <div class="staking-pos-col-label">APY / Rate</div>
        <div class="staking-pos-col-value">${apy || "—"}</div>
      </div>
      <div>
        <div class="staking-pos-col-label">Timeline</div>
        ${timingHTML || `<div class="timing-label" style="font-size:.75rem;color:var(--text-muted)">${startDate || "—"}${endDate ? " → " + endDate : ""}</div>`}
      </div>
    </div>`;
  }).join("");

  // ── History rows ──
  const historyRows = history.map(r => {
    const pPos = r.profit == null || r.profit >= 0;
    return `<tr>
      <td class="td-name">${r.name || "—"}</td>
      <td class="td-name" style="color:var(--text-muted)">${r.platform || "—"}</td>
      <td class="td-mono">${r.startDate || "—"}</td>
      <td class="td-mono">${r.endDate || "—"}</td>
      <td class="td-mono">${r.amount != null ? fmtUSD(r.amount) : "—"}</td>
      <td class="td-mono">${r.apy || "—"}</td>
      <td class="td-mono ${pPos ? "pnl-pos" : "pnl-neg"}">${r.profit != null ? pnlSign(r.profit) + fmtUSD(r.profit) : "—"}</td>
    </tr>`;
  }).join("");

  document.getElementById("staking-content").innerHTML = `

    <!-- Summary -->
    <div class="staking-summary">
      <div class="staking-card">
        <div class="staking-card-label">💰 In Staking Now</div>
        <div class="staking-card-value">${fmtUSD(totalInvested)}</div>
        <div class="staking-card-sub">${active.length} active position${active.length !== 1 ? "s" : ""}</div>
      </div>
      <div class="staking-card">
        <div class="staking-card-label">${profitPos ? "📈" : "📉"} Current Profit</div>
        <div class="staking-card-value ${profitPos ? "pos" : "neg"}">${pnlSign(totalProfit)}${fmtUSD(totalProfit)}</div>
        <div class="staking-card-sub">${pnlSign(roi)}${fmt(roi)}% ROI</div>
      </div>
      <div class="staking-card">
        <div class="staking-card-label">📊 All-time Earned</div>
        <div class="staking-card-value pos">${pnlSign(allTimeProfit)}${fmtUSD(allTimeProfit)}</div>
        <div class="staking-card-sub">${rows.length} total deals</div>
      </div>
    </div>

    <!-- Active positions -->
    <div class="section">
      <div class="section-header">
        <div class="section-title">✅ Active <span class="section-count">${active.length}</span></div>
      </div>
      <div class="staking-positions">${posCards || '<p style="color:var(--text-muted);font-size:.85rem">No active positions</p>'}</div>
    </div>

    <!-- History -->
    ${history.length ? `
    <div class="section">
      <div class="section-header">
        <div class="section-title">📋 History <span class="section-count">${history.length}</span></div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Instrument</th><th>Account</th><th>Start</th><th>End</th><th>Amount</th><th>APY</th><th>Profit</th></tr></thead>
          <tbody>${historyRows}</tbody>
        </table>
      </div>
    </div>` : ""}`;
}

// ─── Load ─────────────────────────────────────────────────────────────────────

async function loadDashboard() {
  renderSkeleton();
  try {
    const [assets, cash, stakingRows] = await Promise.all([
      fetchDB("assets"),
      fetchDB("cash"),
      fetchDB("staking"),
    ]);

    // ── Compute summary ──
    const isFreeCashCat = (cat) => {
      const lo = (cat || "").toLowerCase();
      return lo.includes("liquid") || lo.includes("incoming") ||
             lo.includes("debt")   || lo.includes("locked");
    };

    let freeCashTotal = 0;
    cash.forEach((c) => {
      const v = c.value;
      if (v == null || isNaN(v) || v === 0) return;
      if (isFreeCashCat(c.category)) freeCashTotal += v;
    });

    // Staking total = only Active rows from Investment Log
    const stakingCashTotal = stakingRows
      .filter(r => (r.status || "Active").toLowerCase() === "active")
      .reduce((sum, r) => sum + (r.amount || 0), 0);

    let assetsTotal = 0, investedTotal = 0, pnlTotal = 0;
    assets.forEach((a) => {
      const val = a.value, pnl = a.pnl, type = (a.type || "").trim();
      if (type === "Property" && val != null) assetsTotal   += val;
      if (type === "Crypto"   && val != null) investedTotal += val;
      if (type === "Crypto"   && pnl != null) pnlTotal      += pnl;
    });

    const netWorth = freeCashTotal + stakingCashTotal + assetsTotal + investedTotal;
    const summary  = {
      netWorth, freeCash: freeCashTotal, assets: assetsTotal,
      invested: investedTotal, pnl: pnlTotal, staking: stakingCashTotal,
    };

    renderDashboard(summary, assets, cash);
  } catch (err) {
    renderError(err.message);
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────

if (isLoggedIn()) {
  showApp();
} else {
  showLogin();
}
