const NOTION_VERSION = "2022-06-28";
const NOTION_API = "https://api.notion.com/v1";

const DB_IDS = {
  assets:     "3aaf88e694ca4d1e88072f1823616a16",
  cash:       "27bf5a57c00a4aeabad9c979c74dad87",
  staking:    "03ce408d1f2141cba92cba17da81513e",
  properties: "4fcbe88a82824442937a58bf9ea2722d",
};

function getProp(props, name) {
  const p = props[name];
  if (!p) return null;
  switch (p.type) {
    case "title":     return p.title.map(t => t.plain_text).join("").trim();
    case "rich_text": return p.rich_text.map(t => t.plain_text).join("").trim();
    case "number":    return p.number;
    case "select":    return p.select?.name ?? null;
    case "date":      return p.date?.start ?? null;
    default:          return null;
  }
}

async function queryAll(dbId, apiKey) {
  const pages = [];
  let cursor;
  do {
    const body = cursor ? { start_cursor: cursor } : {};
    const r = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`Notion API ${r.status}: ${await r.text()}`);
    const data = await r.json();
    pages.push(...data.results);
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);
  return pages;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "NOTION_API_KEY not set" });

  const db = req.query.db;
  if (!db || !DB_IDS[db]) return res.status(400).json({ error: "Invalid db param. Use: assets | cash | staking" });

  try {
    const pages = await queryAll(DB_IDS[db], apiKey);

    const rows = pages.map(p => {
      const props = p.properties;
      if (db === "assets") return {
        name:          getProp(props, "Name"),
        type:          getProp(props, "Type"),
        account:       getProp(props, "Account"),
        entryDate:     getProp(props, "Entry Date"),
        entryPrice:    getProp(props, "Entry Price"),
        quantity:      getProp(props, "Quantity"),
        totalInvested: getProp(props, "Total Invested"),
        currentPrice:  getProp(props, "Current Price"),
        value:         getProp(props, "Current Value"),
        pnl:           getProp(props, "PnL USD"),
        pnlPct:        getProp(props, "PnL Pct"),
      };
      if (db === "cash") return {
        account:  getProp(props, "Account"),
        category: getProp(props, "Category"),
        currency: getProp(props, "Currency"),
        amount:   getProp(props, "Amount"),
        rate:     getProp(props, "Rate USD"),
        value:    getProp(props, "Value USD"),
      };
      if (db === "properties") return {
        name:  getProp(props, "Name"),
        value: getProp(props, "Value USD"),
        description: getProp(props, "Description"),
      };
      if (db === "staking") return {
        name:      getProp(props, "Name"),
        platform:  getProp(props, "Platform"),
        amount:    getProp(props, "Amount USD"),
        profit:    getProp(props, "Profit USD"),
        apy:       getProp(props, "APY Rate"),
        startDate: getProp(props, "Start Date"),
        endDate:   getProp(props, "End Date"),
        status:    getProp(props, "Status"),
      };
    }).filter(r => r && (r.name || r.account));

    return res.status(200).json({ rows });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
