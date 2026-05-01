const scriptName = 'WeTalk';
const storeKey = 'wetalk_accounts_v1';
const SECRET = '0fOiukQq7jXZV2GRi9LGlO';
const API_HOST = 'api.wetalkapp.com';

const MAX_VIDEO = 5;
const VIDEO_DELAY = 8000;
const ACCOUNT_GAP = 3500;

const IOS_VERSIONS = ['17.5.1', '17.6.1', '17.4.1', '17.2.1', '16.7.8', '17.6', '17.3.1', '18.0.1', '17.1.2', '16.6.1'];
const IOS_SCALES = ['2.00', '3.00', '3.00', '2.00', '3.00'];
const IPHONE_MODELS = ['iPhone14,3', 'iPhone13,3', 'iPhone15,3', 'iPhone16,1', 'iPhone14,7', 'iPhone13,2', 'iPhone15,2', 'iPhone12,1'];
const CFN_VERS = ['1410.0.3', '1494.0.7', '1568.100.1', '1209.1', '1474.0.4', '1568.200.2'];
const DARWIN_VERS = ['22.6.0', '23.5.0', '23.6.0', '24.0.0', '22.4.0'];

function notify(ctx, title, body = '') {
  ctx.notify({ title: scriptName, subtitle: title, body });
}

function safeDecode(value) {
  if (value == null) return '';
  try { return decodeURIComponent(String(value)); } catch { return String(value); }
}

function emailKeyOf(paramsRaw) {
  const raw = paramsRaw?.email;
  return raw ? safeDecode(raw).trim().toLowerCase() : '';
}

function md5(input) {
  function add32(a, b) { return (a + b) & 0xffffffff; }
  function cmn(q, a, b, x, s, t) { return add32(((add32(add32(a, q), add32(x, t)) << s) | (add32(add32(a, q), add32(x, t)) >>> (32 - s))), b); }
  function ff(a, b, c, d, x, s, t) { return cmn((b & c) | (~b & d), a, b, x, s, t); }
  function gg(a, b, c, d, x, s, t) { return cmn((b & d) | (c & ~d), a, b, x, s, t); }
  function hh(a, b, c, d, x, s, t) { return cmn(b ^ c ^ d, a, b, x, s, t); }
  function ii(a, b, c, d, x, s, t) { return cmn(c ^ (b | ~d), a, b, x, s, t); }

  const str = unescape(encodeURIComponent(String(input)));
  const words = [];
  for (let i = 0; i < str.length; i++) words[i >> 2] |= str.charCodeAt(i) << ((i % 4) * 8);
  words[str.length >> 2] |= 0x80 << ((str.length % 4) * 8);
  words[(((str.length + 8) >> 6) + 1) * 16 - 2] = str.length * 8;

  let a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;
  for (let i = 0; i < words.length; i += 16) {
    const oa = a, ob = b, oc = c, od = d;
    a = ff(a, b, c, d, words[i], 7, -680876936); d = ff(d, a, b, c, words[i + 1], 12, -389564586); c = ff(c, d, a, b, words[i + 2], 17, 606105819); b = ff(b, c, d, a, words[i + 3], 22, -1044525330);
    a = ff(a, b, c, d, words[i + 4], 7, -176418897); d = ff(d, a, b, c, words[i + 5], 12, 1200080426); c = ff(c, d, a, b, words[i + 6], 17, -1473231341); b = ff(b, c, d, a, words[i + 7], 22, -45705983);
    a = ff(a, b, c, d, words[i + 8], 7, 1770035416); d = ff(d, a, b, c, words[i + 9], 12, -1958414417); c = ff(c, d, a, b, words[i + 10], 17, -42063); b = ff(b, c, d, a, words[i + 11], 22, -1990404162);
    a = ff(a, b, c, d, words[i + 12], 7, 1804603682); d = ff(d, a, b, c, words[i + 13], 12, -40341101); c = ff(c, d, a, b, words[i + 14], 17, -1502002290); b = ff(b, c, d, a, words[i + 15], 22, 1236535329);
    a = gg(a, b, c, d, words[i + 1], 5, -165796510); d = gg(d, a, b, c, words[i + 6], 9, -1069501632); c = gg(c, d, a, b, words[i + 11], 14, 643717713); b = gg(b, c, d, a, words[i], 20, -373897302);
    a = gg(a, b, c, d, words[i + 5], 5, -701558691); d = gg(d, a, b, c, words[i + 10], 9, 38016083); c = gg(c, d, a, b, words[i + 15], 14, -660478335); b = gg(b, c, d, a, words[i + 4], 20, -405537848);
    a = gg(a, b, c, d, words[i + 9], 5, 568446438); d = gg(d, a, b, c, words[i + 14], 9, -1019803690); c = gg(c, d, a, b, words[i + 3], 14, -187363961); b = gg(b, c, d, a, words[i + 8], 20, 1163531501);
    a = gg(a, b, c, d, words[i + 13], 5, -1444681467); d = gg(d, a, b, c, words[i + 2], 9, -51403784); c = gg(c, d, a, b, words[i + 7], 14, 1735328473); b = gg(b, c, d, a, words[i + 12], 20, -1926607734);
    a = hh(a, b, c, d, words[i + 5], 4, -378558); d = hh(d, a, b, c, words[i + 8], 11, -2022574463); c = hh(c, d, a, b, words[i + 11], 16, 1839030562); b = hh(b, c, d, a, words[i + 14], 23, -35309556);
    a = hh(a, b, c, d, words[i + 1], 4, -1530992060); d = hh(d, a, b, c, words[i + 4], 11, 1272893353); c = hh(c, d, a, b, words[i + 7], 16, -155497632); b = hh(b, c, d, a, words[i + 10], 23, -1094730640);
    a = hh(a, b, c, d, words[i + 13], 4, 681279174); d = hh(d, a, b, c, words[i], 11, -358537222); c = hh(c, d, a, b, words[i + 3], 16, -722521979); b = hh(b, c, d, a, words[i + 6], 23, 76029189);
    a = hh(a, b, c, d, words[i + 9], 4, -640364487); d = hh(d, a, b, c, words[i + 12], 11, -421815835); c = hh(c, d, a, b, words[i + 15], 16, 530742520); b = hh(b, c, d, a, words[i + 2], 23, -995338651);
    a = ii(a, b, c, d, words[i], 6, -198630844); d = ii(d, a, b, c, words[i + 7], 10, 1126891415); c = ii(c, d, a, b, words[i + 14], 15, -1416354905); b = ii(b, c, d, a, words[i + 5], 21, -57434055);
    a = ii(a, b, c, d, words[i + 12], 6, 1700485571); d = ii(d, a, b, c, words[i + 3], 10, -1894986606); c = ii(c, d, a, b, words[i + 10], 15, -1051523); b = ii(b, c, d, a, words[i + 1], 21, -2054922799);
    a = ii(a, b, c, d, words[i + 8], 6, 1873313359); d = ii(d, a, b, c, words[i + 15], 10, -30611744); c = ii(c, d, a, b, words[i + 6], 15, -1560198380); b = ii(b, c, d, a, words[i + 13], 21, 1309151649);
    a = ii(a, b, c, d, words[i + 4], 6, -145523070); d = ii(d, a, b, c, words[i + 11], 10, -1120210379); c = ii(c, d, a, b, words[i + 2], 15, 718787259); b = ii(b, c, d, a, words[i + 9], 21, -343485551);
    a = add32(a, oa); b = add32(b, ob); c = add32(c, oc); d = add32(d, od);
  }
  return [a, b, c, d].map(n => {
    let s = '';
    for (let j = 0; j < 4; j++) s += ('0' + ((n >> (j * 8)) & 255).toString(16)).slice(-2);
    return s;
  }).join('');
}

function getUTCSignDate() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())} ${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`;
}

function loadStore(ctx) {
  const store = ctx.storage.getJSON(storeKey);
  if (!store || typeof store !== 'object') return { version: 2, accounts: {}, order: [] };
  if (!store.accounts) store.accounts = {};
  if (!Array.isArray(store.order)) store.order = Object.keys(store.accounts);
  return migrateStore(store);
}

function migrateStore(store) {
  const newAccounts = {};
  const newOrder = [];
  let changed = false;

  for (const oldId of store.order || Object.keys(store.accounts || {})) {
    const acc = store.accounts?.[oldId];
    if (!acc) continue;
    const email = emailKeyOf(acc.capture?.paramsRaw);
    const newId = email || oldId;
    if (newId !== oldId) changed = true;
    const existing = newAccounts[newId];
    if (!existing || (acc.updatedAt || 0) >= (existing.updatedAt || 0)) {
      newAccounts[newId] = { ...acc, id: newId, alias: acc.alias || email || newId };
      if (!newOrder.includes(newId)) newOrder.push(newId);
    }
  }

  if (changed) {
    store.accounts = newAccounts;
    store.order = newOrder;
  }
  return store;
}

function pick(arr, seed) {
  return arr[Math.abs(seed) % arr.length];
}

function buildUA(baseUA, seed = 0) {
  const iosVer = pick(IOS_VERSIONS, seed);
  const scale = pick(IOS_SCALES, seed + 1);
  const model = pick(IPHONE_MODELS, seed + 2);
  const cfn = pick(CFN_VERS, seed + 3);
  const darwin = pick(DARWIN_VERS, seed + 4);

  if (baseUA && typeof baseUA === 'string') {
    let ua = baseUA;
    let changed = false;
    const replacements = [
      [/iOS \d+(\.\d+){0,2}/, `iOS ${iosVer}`],
      [/Scale\/\d+(\.\d+)?/, `Scale/${scale}`],
      [/iPhone\d+,\d+/, model],
      [/CFNetwork\/[\d.]+/, `CFNetwork/${cfn}`],
      [/Darwin\/[\d.]+/, `Darwin/${darwin}`]
    ];
    for (const [pattern, value] of replacements) {
      if (pattern.test(ua)) {
        ua = ua.replace(pattern, value);
        changed = true;
      }
    }
    if (changed) return ua;
  }

  return `WeTalk/30.6.0 (com.innovationworks.wetalk; build:28; iOS ${iosVer}) Alamofire/5.4.3`;
}

function buildSignedParamsRaw(capture) {
  const params = {};
  for (const [key, value] of Object.entries(capture?.paramsRaw || {})) {
    if (key !== 'sign' && key !== 'signDate') params[key] = value;
  }

  params.signDate = getUTCSignDate();
  const signBase = Object.keys(params).sort().map(key => `${key}=${params[key]}`).join('&');
  params.sign = md5(signBase + SECRET);
  return params;
}

function buildUrl(path, capture) {
  const params = buildSignedParamsRaw(capture);
  const query = Object.keys(params)
    .map(key => `${key}=${encodeURIComponent(params[key])}`)
    .join('&');
  return `https://${API_HOST}/app/${path}?${query}`;
}

function buildHeaders(capture, ua) {
  const headers = { ...(capture?.headers || {}) };
  for (const key of Object.keys(headers)) {
    const lower = key.toLowerCase();
    if (lower === 'content-length' || lower === 'user-agent' || key.startsWith(':')) delete headers[key];
  }
  headers.Host = API_HOST;
  headers.Accept = headers.Accept || headers.accept || 'application/json';
  headers['User-Agent'] = ua;
  return headers;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchApi(ctx, acc, path) {
  const ua = buildUA(acc.baseUA, acc.uaSeed || 0);
  const headers = buildHeaders(acc.capture, ua);
  const url = buildUrl(path, acc.capture);
  const response = await ctx.http.get(url, { headers, timeout: 10000 });
  const text = await response.text();
  return JSON.parse(text);
}

async function runAccount(ctx, acc, index, total) {
  const tag = `[账号${index + 1}/${total} ${acc.alias || acc.email || acc.id}]`;
  const msgs = [tag];

  try {
    const balance = await fetchApi(ctx, acc, 'queryBalanceAndBonus');
    if (balance.retcode === 0) msgs.push(`余额：${balance.result?.balance ?? '?'} Coins`);
    else msgs.push(`⚠️ 查询：${balance.retmsg || '失败'}`);
  } catch (err) {
    msgs.push(`❌ 查询：${err.message || String(err)}`);
  }

  try {
    const checkin = await fetchApi(ctx, acc, 'checkIn');
    if (checkin.retcode === 0) {
      const hint = String(checkin.result?.bonusHint || checkin.retmsg || '').replace(/\n/g, ' ');
      msgs.push(`✅ 签到：${hint || '成功'}`);
    } else {
      msgs.push(`⚠️ 签到：${checkin.retmsg || '失败'}`);
    }
  } catch (err) {
    msgs.push(`❌ 签到：${err.message || String(err)}`);
  }

  for (let i = 1; i <= MAX_VIDEO; i++) {
    await sleep(i === 1 ? 1500 : VIDEO_DELAY);
    try {
      const video = await fetchApi(ctx, acc, 'videoBonus');
      if (video.retcode === 0) {
        msgs.push(`视频${i}：+${video.result?.bonus ?? '?'} Coins`);
      } else {
        msgs.push(`⏸ 视频${i}：${video.retmsg || '停止'}`);
        break;
      }
    } catch (err) {
      msgs.push(`❌ 视频${i}：${err.message || String(err)}`);
      break;
    }
  }

  try {
    const latest = await fetchApi(ctx, acc, 'queryBalanceAndBonus');
    if (latest.retcode === 0) msgs.push(`最新余额：${latest.result?.balance ?? '?'} Coins`);
  } catch {}

  return msgs.join('\n');
}

export default async function(ctx) {
  const store = loadStore(ctx);
  function splitEnvList(value) {
  return String(value || '')
    .split(/[\n,@，\s]+/)
    .map(s => s.trim())
    .filter(Boolean);
}

function matchAccountIds(store, tokens) {
  const allIds = (store.order || []).filter(id => store.accounts?.[id]?.capture?.paramsRaw);

  if (!tokens.length) return allIds;

  const result = new Set();

  for (const tokenRaw of tokens) {
    const token = String(tokenRaw).trim().toLowerCase();

    if (!token) continue;

    const index = Number(token);

    // 支持按编号选择账号：1、2、3...
    if (Number.isInteger(index) && index >= 1 && index <= allIds.length) {
      result.add(allIds[index - 1]);
      continue;
    }

    // 支持按 id / email / alias 匹配
    for (const id of allIds) {
      const acc = store.accounts[id];

      const candidates = [
        id,
        acc.id,
        acc.email,
        acc.alias
      ].filter(Boolean).map(v => String(v).trim().toLowerCase());

      if (candidates.includes(token)) {
        result.add(id);
      }
    }
  }

  return [...result];
}

const runTokens = splitEnvList(ctx.env?.RUN_ACCOUNTS || '');
const ids = matchAccountIds(store, runTokens);

  if (!ids.length) {
    notify(ctx, '未抓到任何账号', '请先启用 MitM，打开 WeTalk 并触发 queryBalanceAndBonus 请求。');
    return;
  }

  const results = [];
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    results.push(await runAccount(ctx, store.accounts[id], i, ids.length));
    if (i < ids.length - 1) await sleep(ACCOUNT_GAP);
  }

  ctx.storage.setJSON(storeKey, store);
  const body = results.join('\n\n').slice(0, 4000);
  notify(ctx, `全部完成（${ids.length}个账号）`, body);
}
