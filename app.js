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

document.getElementById("btn-refresh").addEventListener("click", loadDashboard);

// ─── API ─────────────────────────────────────────────────────────────────────

async function fetchRange(range) {
  const res = await fetch(`/api/sheets?range=${encodeURIComponent(range)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
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
      <div class="icon">⚠️</div>
      <p><strong>Failed to load data</strong><br>${msg}</p>
    </div>`;
}

function renderDashboard(summary, assets, cash) {
  const netWorth  = summary.netWorth;
  const freeCash  = summary.freeCash;
  const assetsVal = summary.assets;
  const invested  = summary.invested;
  const totalPnl  = summary.pnl;

  // P&L % = pnl / (invested - pnl) * 100  (invested cost basis)
  const costBasis = invested - totalPnl;
  const pnlPct = costBasis !== 0 ? (totalPnl / costBasis) * 100 : 0;
  const pnlPos = totalPnl >= 0;

  // Build last-updated
  const now = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  document.getElementById("last-updated").textContent = `Updated ${now}`;

  // Assets table rows
  const assetRows = assets
    .map((a) => {
      const pnl = parseNum(a.pnl);
      const pnlP = parseNum(a.pnlPct);
      const cls = pnlClass(pnl);
      return `<tr>
        <td class="td-name">${a.name}</td>
        <td><span class="badge ${badgeClass(a.type)}">${a.type}</span></td>
        <td class="td-mono">${isNaN(parseNum(a.value)) ? "—" : fmtUSD(parseNum(a.value))}</td>
        <td class="td-pnl ${cls}">${isNaN(pnl) ? "—" : pnlSign(pnl) + fmtUSD(pnl)}</td>
        <td class="td-pnl ${cls}">${isNaN(pnlP) ? "—" : pnlSign(pnlP) + fmt(pnlP) + "%"}</td>
      </tr>`;
    })
    .join("");

  // Cash table rows
  const cashRows = cash
    .map((c) => {
      const val = parseNum(c.value);
      return `<tr>
        <td class="td-name">${c.account}</td>
        <td><span class="badge ${badgeClass(c.category)}">${c.category}</span></td>
        <td class="td-mono">${isNaN(val) ? "—" : fmtUSD(val)}</td>
      </tr>`;
    })
    .join("");

  const pnlCardClass = pnlPos ? "card pnl-positive" : "card pnl-card";

  document.getElementById("dashboard-content").innerHTML = `
    <!-- Hero -->
    <div class="hero">
      <div>
        <div class="hero-label">Net Worth</div>
        <div class="hero-value">${!netWorth && netWorth !== 0 ? "—" : fmtUSD(netWorth)}</div>
        <div class="hero-sub">Total portfolio value</div>
      </div>
    </div>

    <!-- Summary Cards -->
    <div class="cards-grid">
      <div class="card">
        <div class="card-label"><span class="emoji">💵</span> Free Cash</div>
        <div class="card-value">${fmtUSD(freeCash)}</div>
        <div class="card-sub">Liquid funds</div>
      </div>
      <div class="card">
        <div class="card-label"><span class="emoji">📦</span> Assets</div>
        <div class="card-value">${fmtUSD(assetsVal)}</div>
        <div class="card-sub">Total asset value</div>
      </div>
      <div class="card">
        <div class="card-label"><span class="emoji">📈</span> Invested</div>
        <div class="card-value">${fmtUSD(invested)}</div>
        <div class="card-sub">Capital deployed</div>
      </div>
      <div class="${pnlCardClass}">
        <div class="card-label"><span class="emoji">${pnlPos ? "📗" : "📉"}</span> P&amp;L</div>
        <div class="card-value">${pnlSign(totalPnl)}${fmtUSD(totalPnl)}</div>
        <div class="card-sub">${pnlSign(pnlPct)}${fmt(pnlPct)}% on invested capital</div>
      </div>
    </div>

    <!-- Assets Table -->
    <div class="section">
      <div class="section-header">
        <div class="section-title">📊 Assets <span class="section-count">${assets.length}</span></div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th><th>Type</th><th>Value</th><th>P&amp;L ($)</th><th>P&amp;L (%)</th>
            </tr>
          </thead>
          <tbody>${assetRows || '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:2rem">No assets found</td></tr>'}</tbody>
        </table>
      </div>
    </div>

    <!-- Cash Table -->
    <div class="section">
      <div class="section-header">
        <div class="section-title">💵 Free Cash <span class="section-count">${cash.length}</span></div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Account</th><th>Category</th><th>Value (USD)</th>
            </tr>
          </thead>
          <tbody>${cashRows || '<tr><td colspan="3" style="text-align:center;color:var(--muted);padding:2rem">No cash entries found</td></tr>'}</tbody>
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
