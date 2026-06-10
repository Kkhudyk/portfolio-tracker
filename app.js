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

// declared early so Refresh listener can reference it
let activeTab    = "dashboard";
let stakingLoaded = false;

document.getElementById("btn-refresh").addEventListener("click", () => {
  stakingLoaded = false;
  if (activeTab === "dashboard") loadDashboard();
  else loadStaking();
});

// ─── API ─────────────────────────────────────────────────────────────────────

async function fetchRange(range) {
  const res = await fetch(`/api/sheets?range=${encodeURIComponent(range)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const detail = err.detail ? ` — ${err.detail}` : "";
    throw new Error((err.error || `HTTP ${res.status}`) + detail);
  }
  return res.json();
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
  liquid:     { emoji: "🟢", label: "Liquid",     color: "#00C805", bg: "#E6FFE6" },
  incoming:   { emoji: "🟣", label: "Incoming",   color: "#7C3AED", bg: "#F0EBFF" },
  debt:       { emoji: "🔴", label: "Debt",       color: "#FF3B30", bg: "#FFE5E3" },
  locked:     { emoji: "🔵", label: "Investment", color: "#0066FF", bg: "#E0EDFF" },
  investment: { emoji: "🔵", label: "Investment", color: "#0066FF", bg: "#E0EDFF" },
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
  const totalPnl  = summary.pnl;

  const costBasis = invested - totalPnl;
  const pnlPct    = costBasis !== 0 ? (totalPnl / costBasis) * 100 : 0;
  const pnlPos    = totalPnl >= 0;
  const pnlArrow  = pnlPos ? "↑" : "↓";
  const pnlCls    = pnlPos ? "pnl-pos" : "pnl-neg";

  const now = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  document.getElementById("last-updated").textContent = `Updated ${now}`;

  // ── P&L breakdown cards (Crypto only) ──
  const cryptoAssets = assets.filter(a => (a.type || "").trim() === "Crypto");
  const pnlCards = cryptoAssets.map(a => {
    const val      = parseNum(a.value);
    const pnl      = parseNum(a.pnl);
    const pnlP     = parseNum(a.pnlPct);
    const cls      = pnlClass(pnl);
    const costB    = isNaN(val) || isNaN(pnl) ? 0 : val - pnl;
    const progress = costB > 0 ? Math.min(100, Math.max(2, (val / costB) * 100)) : 50;
    const barColor = pnl >= 0 ? "#00C805" : "#FF3B30";
    return `
    <div class="pnl-card">
      <div class="pnl-card-name">${a.name}</div>
      <div class="pnl-card-type">Crypto</div>
      <div class="pnl-card-value">${isNaN(val) ? "—" : fmtUSD(val)}</div>
      <div class="pnl-card-pnl ${cls}">${isNaN(pnl) ? "—" : pnlSign(pnl) + fmtUSD(pnl)}</div>
      <div class="pnl-progress-track">
        <div class="pnl-progress-bar" style="width:${progress}%;background:${barColor}"></div>
      </div>
      <div class="pnl-card-pct ${cls}">${isNaN(pnlP) ? "—" : pnlSign(pnlP) + fmt(pnlP) + "%"}</div>
    </div>`;
  }).join("");

  // ── Liquidity category totals ──
  const catTotals = {};
  cash.forEach(c => {
    const key = (c.category || "").toLowerCase().trim();
    if (!key) return;
    const v = parseNum(c.value);
    if (!isNaN(v)) catTotals[c.category] = (catTotals[c.category] || 0) + v;
  });
  const liqTotal = Object.values(catTotals).reduce((s, v) => s + v, 0);

  const liqBars = Object.entries(catTotals).map(([cat, val]) => {
    const cfg = getCatCfg(cat);
    const pct = liqTotal > 0 ? Math.max(1, (val / liqTotal) * 100) : 0;
    return `
    <div class="liq-row">
      <div class="liq-label">${cfg.emoji} ${cfg.label}</div>
      <div class="liq-track"><div class="liq-bar" style="width:${pct}%;background:${cfg.color}"></div></div>
      <div class="liq-amount">${fmtUSD(val)}</div>
    </div>`;
  }).join("");

  // ── Cash table ──
  const cashRows = cash.map(c => {
    const val = parseNum(c.value);
    const cfg = getCatCfg(c.category);
    return `<tr>
      <td class="td-name">${c.account}</td>
      <td><span class="badge" style="background:${cfg.bg};color:${cfg.color}">${cfg.emoji} ${c.category}</span></td>
      <td class="td-mono">${isNaN(val) ? "—" : fmtUSD(val)}</td>
    </tr>`;
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
      <div class="hero-pnl ${pnlCls}">
        ${pnlArrow} ${pnlSign(totalPnl)}${fmtUSD(totalPnl)} (${pnlSign(pnlPct)}${fmt(pnlPct)}%)
      </div>
      <div class="hero-mini-cards">
        <div class="mini-card">
          <div class="mini-card-label">💵 Free Cash</div>
          <div class="mini-card-value">${fmtUSD(freeCash)}</div>
        </div>
        <div class="mini-card">
          <div class="mini-card-label">🏠 Assets</div>
          <div class="mini-card-value">${fmtUSD(assetsVal)}</div>
        </div>
        <div class="mini-card">
          <div class="mini-card-label">📈 Invested</div>
          <div class="mini-card-value">${fmtUSD(invested)}</div>
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
        <div class="liquidity-bars">${liqBars || '<p style="color:var(--text-muted);font-size:.875rem">No categories found</p>'}</div>
        <div class="liq-divider"></div>
        <table>
          <thead><tr><th>Account</th><th>Category</th><th>Value (USD)</th></tr></thead>
          <tbody>${cashRows || '<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:1.5rem">No entries</td></tr>'}</tbody>
        </table>
      </div>
    </div>

    <!-- ── ASSETS TABLE ── -->
    <div class="section">
      <div class="section-header">
        <div class="section-title">📊 All Assets <span class="section-count">${assets.length}</span></div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Type</th><th>Value</th><th>P&amp;L ($)</th><th>P&amp;L (%)</th></tr></thead>
          <tbody>${assetRows || '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:2rem">No assets found</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;

  // Draw charts after DOM update
  requestAnimationFrame(() => {
    drawDonut(netWorth, freeCash, assetsVal, invested);
    drawBarChart(assets);
  });
}

// ─── Chart: Donut ─────────────────────────────────────────────────────────────

function drawDonut(netWorth, freeCash, assetsVal, invested) {
  const canvas = document.getElementById("donut-canvas");
  if (!canvas) return;

  const segments = [
    { label: "Free Cash", value: freeCash,  color: "#0066FF" },
    { label: "Assets",    value: assetsVal, color: "#00C805" },
    { label: "Invested",  value: invested,  color: "#7C3AED" },
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

  // Center label
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle    = "#9CA3AF";
  ctx.font         = `500 11px Inter, sans-serif`;
  ctx.fillText("Net Worth", cx, cy - 11);
  ctx.fillStyle = "#1A1A1A";
  ctx.font      = `bold 15px "SF Mono", monospace`;
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
    const color = item.type === "Crypto" ? "#7C3AED" : "#00C805";
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
    // Step 1: get all sheet titles from spreadsheet metadata
    const meta = await fetchRange("__sheets__");
    const sheets = meta.sheets || [];

    // Step 2: find the investment/staking sheet by gid=1013154586 first,
    // then fall back to title keyword match
    const TARGET_GID = 1013154586;
    const KEYWORDS   = ["invest", "staking", "log"];

    let sheetName =
      (sheets.find(s => s.sheetId === TARGET_GID) ||
       sheets.find(s => KEYWORDS.some(k => s.title.toLowerCase().includes(k))) ||
       null)?.title;

    if (!sheetName) {
      const allNames = sheets.map(s => `"${s.title}" (gid:${s.sheetId})`).join(", ");
      el.innerHTML = `<div class="error-state">
        <div class="err-icon">📭</div>
        <p><strong>Investment sheet not found</strong><br>
        Available sheets: ${allNames}</p>
      </div>`;
      return;
    }

    // Step 3: fetch the data
    const data = await fetchRange(`${sheetName}!A1:Z300`);
    const rows = data.values || [];

    if (rows.length < 2) {
      el.innerHTML = `<div class="error-state"><div class="err-icon">📭</div><p>Sheet "${sheetName}" is empty.</p></div>`;
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
  // ── Find the real header row ──
  // Look for a row that contains at least 2 known investment column keywords
  const COL_KEYWORDS = ["account","instrument","amount","apy","apr","date","status","income","profit","earn","entry","exit","platform","name","asset","rate","currency"];
  const SKIP_ROW_MARKERS = ["total monthly","status legend","log every","►","•"];

  let headerIdx = 0;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const row = rows[i];
    const cellText = row.map(c => (c || "").toLowerCase());
    const matches = cellText.filter(c => COL_KEYWORDS.some(k => c.includes(k))).length;
    if (matches >= 2) { headerIdx = i; break; }
  }

  const headers = rows[headerIdx].map(h => (h || "").trim());

  // ── Filter data rows ──
  // Skip: empty rows, instruction rows, total rows, legend rows
  const data = rows.slice(headerIdx + 1).filter(r => {
    if (!r.some(c => (c || "").trim())) return false; // all empty
    const first = (r[0] || r[1] || r[2] || "").toString().toLowerCase();
    return !SKIP_ROW_MARKERS.some(m => first.includes(m));
  });

  // ── Column index helpers ──
  const ci = (keywords) => {
    const kw = keywords.map(k => k.toLowerCase());
    return headers.findIndex(h => kw.some(k => h.toLowerCase().includes(k)));
  };

  const iName     = ci(["name", "asset", "token", "coin", "project"]);
  const iPlatform = ci(["platform", "protocol", "exchange", "source", "where"]);
  const iAmount   = ci(["amount", "principal", "invested", "capital", "deposit", "invested ($)", "amount ($)"]);
  const iProfit   = ci(["profit", "earn", "return", "income", "reward", "yield", "gain"]);
  const iApy      = ci(["apy", "apr", "rate", "%", "interest"]);
  const iStart    = ci(["start", "entry", "open", "date", "from"]);
  const iEnd      = ci(["end", "exit", "close", "maturity", "until", "to"]);
  const iStatus   = ci(["status", "state", "active", "open"]);
  const iTotal    = ci(["total", "current value", "value", "balance"]);
  const iDuration = ci(["duration", "days", "period", "term"]);

  // ── Compute summary ──
  let totalInvested = 0, totalProfit = 0, activeCount = 0;

  data.forEach(r => {
    if (iAmount >= 0) {
      const v = parseNum(r[iAmount]);
      if (!isNaN(v)) totalInvested += v;
    }
    if (iProfit >= 0) {
      const v = parseNum(r[iProfit]);
      if (!isNaN(v)) totalProfit += v;
    }
    if (iStatus >= 0) {
      const s = (r[iStatus] || "").toLowerCase();
      if (s.includes("active") || s.includes("open") || s.includes("✅") || s.includes("running")) activeCount++;
    } else {
      activeCount = data.length; // assume all active if no status col
    }
  });

  const roi = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;
  const profitPos = totalProfit >= 0;

  // ── Build position cards ──
  const posCards = data.map(r => {
    const name     = iName     >= 0 ? (r[iName]     || "—") : "—";
    const platform = iPlatform >= 0 ? (r[iPlatform] || "")  : "";
    const amount   = iAmount   >= 0 ? parseNum(r[iAmount])  : NaN;
    const profit   = iProfit   >= 0 ? parseNum(r[iProfit])  : NaN;
    const apy      = iApy      >= 0 ? (r[iApy]      || "")  : "";
    const startRaw = iStart    >= 0 ? (r[iStart]    || "")  : "";
    const endRaw   = iEnd      >= 0 ? (r[iEnd]      || "")  : "";
    const statusRaw= iStatus   >= 0 ? (r[iStatus]   || "")  : "Active";

    const pPos = isNaN(profit) || profit >= 0;
    const statusLo = statusRaw.toLowerCase();
    const statusClass = statusLo.includes("active") || statusLo.includes("open") || statusLo.includes("✅") || statusRaw === ""
      ? "status-active"
      : statusLo.includes("pend") ? "status-pending" : "status-closed";
    const statusLabel = statusRaw || "Active";

    // Timing progress (days elapsed / total duration)
    let timingHTML = "";
    if (startRaw && endRaw) {
      const start   = new Date(startRaw);
      const end     = new Date(endRaw);
      const now     = new Date();
      const total   = end - start;
      const elapsed = now - start;
      const pct     = total > 0 ? Math.min(100, Math.max(0, (elapsed / total) * 100)) : 0;
      const daysLeft= Math.max(0, Math.ceil((end - now) / 86400000));
      const barColor = pct >= 80 ? "#FF3B30" : pct >= 50 ? "#F59E0B" : "#00C805";
      timingHTML = `
        <div class="timing-wrap">
          <div class="timing-label">${daysLeft > 0 ? `${daysLeft}d left` : "Ended"} · ${pct.toFixed(0)}% elapsed</div>
          <div class="timing-track"><div class="timing-bar" style="width:${pct}%;background:${barColor}"></div></div>
        </div>`;
    } else if (endRaw) {
      timingHTML = `<div class="timing-label" style="font-size:.75rem;color:var(--text-muted)">Exit: ${endRaw}</div>`;
    }

    return `
    <div class="staking-pos-card">
      <div>
        <div class="staking-pos-name">${name}</div>
        ${platform ? `<div class="staking-pos-platform">${platform}</div>` : ""}
        <div style="margin-top:.5rem"><span class="status-badge ${statusClass}">${statusLabel}</span></div>
      </div>
      <div>
        <div class="staking-pos-col-label">Invested</div>
        <div class="staking-pos-col-value">${isNaN(amount) ? "—" : fmtUSD(amount)}</div>
      </div>
      <div>
        <div class="staking-pos-col-label">Profit</div>
        <div class="staking-pos-col-value ${pPos ? "pos" : "neg"}">${isNaN(profit) ? "—" : pnlSign(profit) + fmtUSD(profit)}</div>
      </div>
      <div>
        <div class="staking-pos-col-label">${iApy >= 0 ? "APY / Rate" : "Exit date"}</div>
        <div class="staking-pos-col-value">${iApy >= 0 ? (apy || "—") : (endRaw || "—")}</div>
      </div>
      <div>
        <div class="staking-pos-col-label">Timeline</div>
        ${timingHTML || `<div class="timing-label" style="font-size:.75rem;color:var(--text-muted)">${startRaw || "—"}${endRaw ? " → " + endRaw : ""}</div>`}
      </div>
    </div>`;
  }).join("");

  // ── Full raw table (all columns) ──
  const thCells  = headers.map(h => `<th>${h}</th>`).join("");
  const rawRows  = data.map(r =>
    `<tr>${headers.map((_, i) => `<td class="${/\d/.test(r[i] || "") ? "td-mono" : "td-name"}">${r[i] || "—"}</td>`).join("")}</tr>`
  ).join("");

  document.getElementById("staking-content").innerHTML = `

    <!-- Summary -->
    <div class="staking-summary">
      <div class="staking-card">
        <div class="staking-card-label">💰 Total Invested</div>
        <div class="staking-card-value">${fmtUSD(totalInvested)}</div>
        <div class="staking-card-sub">Capital deployed</div>
      </div>
      <div class="staking-card">
        <div class="staking-card-label">${profitPos ? "📈" : "📉"} Total Profit</div>
        <div class="staking-card-value ${profitPos ? "pos" : "neg"}">${pnlSign(totalProfit)}${fmtUSD(totalProfit)}</div>
        <div class="staking-card-sub">${pnlSign(roi)}${fmt(roi)}% ROI</div>
      </div>
      <div class="staking-card">
        <div class="staking-card-label">✅ Active Positions</div>
        <div class="staking-card-value">${activeCount}</div>
        <div class="staking-card-sub">of ${data.length} total</div>
      </div>
      ${iApy >= 0 ? `` : ""}
    </div>

    <!-- Position cards -->
    <div class="section">
      <div class="section-header">
        <div class="section-title">💎 Investment Positions <span class="section-count">${data.length}</span></div>
      </div>
      <div class="staking-positions">${posCards || '<p style="color:var(--text-muted)">No positions found</p>'}</div>
    </div>

    <!-- Full log table -->
    <div class="section staking-log">
      <div class="section-header">
        <div class="section-title">📋 Full Investment Log</div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>${thCells}</tr></thead>
          <tbody>${rawRows}</tbody>
        </table>
      </div>
    </div>`;
}

// ─── Load ─────────────────────────────────────────────────────────────────────

async function loadDashboard() {
  renderSkeleton();
  try {
    const [assetsData, cashData] = await Promise.all([
      // A–K: rows 4+ (rows 1-3 are headers)
      fetchRange("📊 Assets!A4:K200"),
      // B–G: rows 7+ (rows 1-6 are headers/labels)
      fetchRange("💵 Free Cash!B7:G200"),
    ]);

    // ── Assets ──
    // Cols: A=Name, B=Type, C=Account, D=Entry Date, E=Entry Price,
    //       F=Qty, G=Total Invested, H=Current Price, I=Current Value,
    //       J=P&L($), K=P&L(%)
    const SKIP_NAMES = new Set(["asset name", "total", ""]);
    const assets = (assetsData.values || [])
      .filter((r) => !SKIP_NAMES.has((r[0] || "").trim().toLowerCase()))
      .map((r) => ({
        name:   r[0] || "",
        type:   r[1] || "",
        value:  r[8] || "",   // col I = Current Value
        pnl:    r[9] || "",   // col J = P&L($)
        pnlPct: r[10] || "",  // col K = P&L(%)
      }));

    // ── Free Cash ──
    // Cols (starting at B): r[0]=Account, r[1]=Category, r[2]=Currency,
    //                        r[3]=Amount, r[4]=Rate, r[5]=Value USD
    const SKIP_MARKERS = ["🟢", "🟣", "🔴", "🔵", "total"];
    const cash = (cashData.values || [])
      .filter((r) => {
        const account = (r[0] || "").trim();
        if (!account) return false;
        const lo = account.toLowerCase();
        return !SKIP_MARKERS.some((m) => lo.includes(m) || account.includes(m));
      })
      .map((r) => ({
        account:  r[0] || "",
        category: r[1] || "",
        value:    r[5] || "",  // col G = Value USD
      }));

    // ── Compute summary from raw data ──
    let freeCashTotal = 0;
    cash.forEach((c) => {
      const v = parseNum(c.value);
      if (!isNaN(v)) freeCashTotal += v;
    });

    let assetsTotal = 0, investedTotal = 0, pnlTotal = 0;
    assets.forEach((a) => {
      const val = parseNum(a.value);
      const pnl = parseNum(a.pnl);
      const type = (a.type || "").trim();
      if (type === "Property" && !isNaN(val)) assetsTotal  += val;
      if (type === "Crypto"   && !isNaN(val)) investedTotal += val;
      if (type === "Crypto"   && !isNaN(pnl)) pnlTotal     += pnl;
    });

    const netWorth = freeCashTotal + assetsTotal + investedTotal;

    const summary = {
      netWorth:  netWorth,
      freeCash:  freeCashTotal,
      assets:    assetsTotal,
      invested:  investedTotal,
      pnl:       pnlTotal,
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
