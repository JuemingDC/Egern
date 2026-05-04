const scriptName = "WeTalk";
const storeKey = "wetalk_accounts_v1";

function boolEnv(value, fallback = true) {
  if (value === undefined || value === null || value === "") return fallback;
  const s = String(value).trim().toLowerCase();
  return s === "true" || s === "1" || s === "yes" || s === "y";
}

function notify(ctx, subtitle, body = "") {
  ctx.notify({
    title: scriptName,
    subtitle,
    body
  });
}

function safeDecode(value) {
  if (value == null) return "";
  try {
    return decodeURIComponent(String(value));
  } catch {
    return String(value);
  }
}

function parseRawQuery(url) {
  const query = String(url || "").split("?")[1]?.split("#")[0] || "";
  const out = {};

  for (const pair of query.split("&")) {
    if (!pair) continue;

    const idx = pair.indexOf("=");
    if (idx < 0) {
      out[pair] = "";
    } else {
      out[pair.slice(0, idx)] = pair.slice(idx + 1);
    }
  }

  return out;
}

function headersToObject(headers) {
  const out = {};
  if (!headers) return out;

  if (typeof headers.forEach === "function") {
    headers.forEach((value, key) => {
      out[key] = String(value);
    });
    return out;
  }

  for (const key of Object.keys(headers)) {
    const value = headers[key];
    if (typeof value !== "function") {
      out[key] = Array.isArray(value) ? value.join(", ") : String(value);
    }
  }

  return out;
}

function getHeader(headers, name) {
  const target = name.toLowerCase();

  for (const [key, value] of Object.entries(headers || {})) {
    if (key.toLowerCase() === target) {
      return String(value || "");
    }
  }

  return "";
}

function emailKeyOf(paramsRaw) {
  const raw = paramsRaw?.email;
  return raw ? safeDecode(raw).trim().toLowerCase() : "";
}

function simpleHash(input) {
  let h = 2166136261;

  for (let i = 0; i < String(input).length; i++) {
    h ^= String(input).charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }

  return (h >>> 0).toString(16).padStart(8, "0");
}

function fingerprintOf(paramsRaw) {
  const email = emailKeyOf(paramsRaw);
  if (email) return email;

  const volatileKeys = new Set([
    "sign",
    "signDate",
    "timestamp",
    "ts",
    "nonce",
    "random",
    "reqTime",
    "reqId",
    "requestId"
  ]);

  const base = Object.keys(paramsRaw || {})
    .filter(key => !volatileKeys.has(key))
    .sort()
    .map(key => `${key}=${paramsRaw[key]}`)
    .join("&");

  return `fp_${simpleHash(base)}`;
}

function loadStore(ctx) {
  const store = ctx.storage.getJSON(storeKey);

  if (!store || typeof store !== "object") {
    return {
      version: 3,
      accounts: {},
      order: []
    };
  }

  if (!store.accounts || typeof store.accounts !== "object") {
    store.accounts = {};
  }

  if (!Array.isArray(store.order)) {
    store.order = Object.keys(store.accounts);
  }

  store.order = store.order.filter(id => store.accounts[id]);
  store.version = 3;

  return store;
}

function saveStore(ctx, store) {
  if (!store.accounts || typeof store.accounts !== "object") {
    store.accounts = {};
  }

  if (!Array.isArray(store.order)) {
    store.order = Object.keys(store.accounts);
  }

  store.order = store.order.filter(id => store.accounts[id]);
  store.version = 3;

  ctx.storage.setJSON(storeKey, store);
}

function maskAccount(text, showSensitive) {
  const s = String(text || "");

  if (showSensitive) return s;

  if (!s.includes("@")) {
    return s.length > 12 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
  }

  const [name, domain] = s.split("@");
  const maskedName =
    name.length <= 2
      ? `${name[0] || "*"}*`
      : `${name.slice(0, 2)}***${name.slice(-1)}`;

  return `${maskedName}@${domain}`;
}

function formatAccountList(store, showSensitive) {
  const ids = (store.order || []).filter(id => store.accounts[id]);

  if (!ids.length) {
    return "当前未保存账号。";
  }

  return ids
    .map((id, index) => {
      const acc = store.accounts[id];
      const label = acc.alias || acc.email || acc.id || id;
      const display = maskAccount(label, showSensitive);
      const updated = acc.updatedAt
        ? new Date(acc.updatedAt).toLocaleString()
        : "未知时间";

      return [
        `${index + 1}. ${display}`,
        `ID: ${maskAccount(id, showSensitive)}`,
        `更新时间: ${updated}`
      ].join("\n");
    })
    .join("\n\n");
}

export default async function (ctx) {
  const env = ctx.env || {};

  if (!boolEnv(env.CAPTURE_ENABLED, true)) {
    return;
  }

  const req = ctx.request;

  if (!req?.url) {
    notify(ctx, "抓取失败", "未检测到请求对象，请确认脚本类型为 http_request。");
    return;
  }

  const paramsRaw = parseRawQuery(req.url);

  if (!Object.keys(paramsRaw).length) {
    notify(ctx, "抓取失败", "当前请求未解析到 URL 参数。");
    return;
  }

  const headers = headersToObject(req.headers);
  const email = emailKeyOf(paramsRaw);
  const accountId = email || fingerprintOf(paramsRaw);
  const now = Date.now();

  const store = loadStore(ctx);
  const existed = Boolean(store.accounts[accountId]);
  const previous = store.accounts[accountId] || {};

  store.accounts[accountId] = {
    id: accountId,
    email,
    alias: previous.alias || email || accountId,
    uaSeed: Number.isInteger(previous.uaSeed) ? previous.uaSeed : store.order.length,
    baseUA: getHeader(headers, "User-Agent"),
    capture: {
      url: req.url,
      paramsRaw,
      headers
    },
    createdAt: previous.createdAt || now,
    updatedAt: now
  };

  if (!existed && !store.order.includes(accountId)) {
    store.order.push(accountId);
  }

  saveStore(ctx, store);

  const showSensitive = boolEnv(env.SHOW_SENSITIVE, false);
  const list = formatAccountList(store, showSensitive);

  notify(
    ctx,
    existed ? "账号参数已更新" : "新账号已入库",
    `当前账号总数：${store.order.length}\n\n${list}`
  );
}
