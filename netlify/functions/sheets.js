exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "API key not configured" }),
    };
  }

  const SHEET_ID = "1u4cot6LmwvAEGjvwlYuhazFZfQzyshe275UvtfFwcec";
  const range = event.queryStringParameters?.range;

  if (!range) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Missing range parameter" }),
    };
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}?key=${apiKey}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      return {
        statusCode: res.status,
        headers,
        body: JSON.stringify({ error: "Google Sheets error", detail: text }),
      };
    }
    const data = await res.json();
    return { statusCode: 200, headers, body: JSON.stringify(data) };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Fetch failed", detail: err.message }),
    };
  }
};
