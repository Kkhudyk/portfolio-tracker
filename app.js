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
  return parseFloat(String(str).replace(/[$,%\s]/g, ""));
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
  const netWorth  = parseNum(summary["Net Worth"]);
  const freeCash  = parseNum(summary["Free Cash"]);
  const assetsVal = parseNum(summary["Assets"]);
  const invested  = parseNum(summary["Invested"]);

  // P&L across asset rows
  let totalPnl = 0, totalInvested = 0;
  assets.forEach((a) => {
    const pnl = parseNum(a.pnl);
    const val = parseNum(a.value);
    if (!isNaN(pnl)) totalPnl += pnl;
    if (!isNaN(val) && !isNaN(pnl)) totalInvested += val - pnl;
  });
  const pnlPct = totalInvested !== 0 ? (totalPnl / totalInvested) * 100 : 0;
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
        <div class="hero-value">${isNaN(netWorth) ? "—" : fmtUSD(netWorth)}</div>
        <div class="hero-sub">Total portfolio value</div>
      </div>
    </div>

    <!-- Summary Cards -->
    <div class="cards-grid">
      <div class="card">
        <div class="card-label"><span class="emoji">💵</span> Free Cash</div>
        <div class="card-value">${isNaN(freeCash) ? "—" : fmtUSD(freeCash)}</div>
        <div class="card-sub">Liquid funds</div>
      </div>
      <div class="card">
        <div class="card-label"><span class="emoji">📦</span> Assets</div>
        <div class="card-value">${isNaN(assetsVal) ? "—" : fmtUSD(assetsVal)}</div>
        <div class="card-sub">Total asset value</div>
      </div>
      <div class="card">
        <div class="card-label"><span class="emoji">📈</span> Invested</div>
        <div class="card-value">${isNaN(invested) ? "—" : fmtUSD(invested)}</div>
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
    const [assetsData, cashData, dashData] = await Promise.all([
      fetchRange("📊 Assets!A2:E100"),
      fetchRange("💵 Free Cash!A2:C100"),
      fetchRange("🎯 Dashboard!A1:B20"),
    ]);

    // Parse assets: Asset Name, Type, Current Value ($), P&L ($), P&L (%)
    const assets = (assetsData.values || [])
      .filter((r) => r[0])
      .map((r) => ({
        name:   r[0] || "",
        type:   r[1] || "",
        value:  r[2] || "",
        pnl:    r[3] || "",
        pnlPct: r[4] || "",
      }));

    // Parse free cash: Account, Category, Value USD
    const cash = (cashData.values || [])
      .filter((r) => r[0])
      .map((r) => ({
        account:  r[0] || "",
        category: r[1] || "",
        value:    r[2] || "",
      }));

    // Parse dashboard summary key-value pairs
    const summary = {};
    (dashData.values || []).forEach((r) => {
      if (r[0] && r[1] !== undefined) summary[r[0].trim()] = r[1];
    });

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
