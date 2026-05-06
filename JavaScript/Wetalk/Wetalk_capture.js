const scriptName = 'WeTalk';
const storeKey = 'wetalk_accounts_v1';

function parseRawQuery(url) {
  const query = (String(url || '').split('?')[1] || '').split('#')[0];
  const rawMap = {};
  query.split('&').forEach(pair => {
    if (!pair) return;
    const idx = pair.indexOf('=');
    if (idx < 0) return;
    const k = pair.slice(0, idx);
    const v = pair.slice(idx + 1);
    rawMap[k] = v;
  });
  return rawMap;
}

function safeDecode(v) {
  if (v == null) return '';
  try { return decodeURIComponent(String(v)); } catch { return String(v); }
}

function emailKeyOf(paramsRaw) {
  const raw = (paramsRaw || {}).email;
  if (!raw) return '';
  return safeDecode(raw).trim().toLowerCase();
}

function headersToObject(headers) {
  const out = {};
  if (!headers) return out;

  if (typeof headers.forEach === 'function') {
    headers.forEach((value, key) => {
      out[key] = Array.isArray(value) ? value.join(', ') : String(value);
    });
    return out;
  }

  Object.keys(headers).forEach(key => {
    const value = headers[key];
    if (value != null && typeof value !== 'function') {
      out[key] = Array.isArray(value) ? value.join(', ') : String(value);
    }
  });

  const common = [
    'Accept',
    'Accept-Encoding',
    'Accept-Language',
    'Authorization',
    'Connection',
    'Content-Type',
    'Cookie',
    'Host',
    'User-Agent',
    'X-Requested-With',
    'X-Client-Version',
    'X-Device-Id',
    'X-Device-Model',
    'X-Device-Type',
    'X-Forwarded-For',
    'X-Platform',
    'X-Sign',
    'X-Token'
  ];

  common.forEach(key => {
    try {
      const value = typeof headers.get === 'function' ? headers.get(key) : headers[key];
      if (value != null && out[key] == null) {
        out[key] = Array.isArray(value) ? value.join(', ') : String(value);
      }
    } catch {}
  });

  return out;
}

function loadStore(ctx) {
  const obj = ctx.storage.getJSON(storeKey);
  if (!obj || typeof obj !== 'object') {
    return { version: 2, accounts: {}, order: [] };
  }
  if (!obj.accounts) obj.accounts = {};
  if (!Array.isArray(obj.order)) obj.order = Object.keys(obj.accounts);
  return obj;
}

function saveStore(ctx, store) {
  ctx.storage.setJSON(storeKey, store);
}

function notify(ctx, subtitle, body) {
  ctx.notify({
    title: scriptName,
    subtitle,
    body
  });
}

export default async function(ctx) {
  if (!ctx.request) return;

  const paramsRaw = parseRawQuery(ctx.request.url);
  const headersMap = headersToObject(ctx.request.headers);

  let baseUA = '';
  Object.keys(headersMap).forEach(k => {
    if (k.toLowerCase() === 'user-agent') baseUA = headersMap[k];
  });

  const email = emailKeyOf(paramsRaw);
  if (!email) {
    notify(ctx, '⚠️ 抓取失败', '请求里未取到 email 参数，无法识别账号。请确认已登录后再触发抓包。');
    return;
  }

  const store = loadStore(ctx);
  const accId = email;
  const now = Date.now();
  const existed = !!store.accounts[accId];
  const uaSeed = existed ? store.accounts[accId].uaSeed : store.order.length;
  const alias = existed ? (store.accounts[accId].alias || email) : email;

  store.accounts[accId] = {
    id: accId,
    email,
    alias,
    uaSeed,
    baseUA,
    capture: {
      url: ctx.request.url,
      paramsRaw,
      headers: headersMap
    },
    createdAt: existed ? store.accounts[accId].createdAt : now,
    updatedAt: now
  };

  if (!existed) store.order.push(accId);

  saveStore(ctx, store);

  const total = store.order.length;
  notify(
    ctx,
    existed ? '账号参数已更新' : '✅ 新账号已入库',
    `${email}\n当前账号总数：${total}`
  );
}
