const SCRIPT_NAME = 'PingMe';
const STORE_KEY = 'pingme_capture_v3';

function notify(ctx, subtitle, body = '') {
  ctx.notify({
    title: SCRIPT_NAME,
    subtitle,
    body
  });
}

function headersToObject(headers) {
  const out = {};

  if (!headers) return out;

  if (typeof headers.forEach === 'function') {
    headers.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }

  for (const key of Object.keys(headers)) {
    const value = headers[key];
    if (typeof value !== 'function') {
      out[key] = Array.isArray(value) ? value.join(', ') : String(value);
    }
  }

  return out;
}

function parseRawQuery(url) {
  const query = String(url || '').split('?')[1]?.split('#')[0] || '';
  const rawMap = {};

  query.split('&').forEach(pair => {
    if (!pair) return;

    const idx = pair.indexOf('=');
    if (idx < 0) return;

    const key = pair.slice(0, idx);
    const value = pair.slice(idx + 1);

    rawMap[key] = value;
  });

  return rawMap;
}

export default async function(ctx) {
  const req = ctx.request;

  if (!req || !req.url) {
    notify(ctx, '获取失败❗️', '未检测到请求对象，请确认脚本类型为 http_request。');
    return;
  }

  if (!req.url.includes('/app/queryBalanceAndBonus')) {
    return;
  }

  const capture = {
    url: req.url,
    paramsRaw: parseRawQuery(req.url),
    headers: headersToObject(req.headers || {})
  };

  if (!Object.keys(capture.paramsRaw).length) {
    notify(ctx, '获取失败❗️', '未解析到 URL 参数，请重新打开 PingMe 触发请求。');
    return;
  }

  ctx.storage.set(STORE_KEY, JSON.stringify(capture));

  notify(ctx, 'PingMe 获取成功✅', '现在可以运行定时签到脚本。');
}
