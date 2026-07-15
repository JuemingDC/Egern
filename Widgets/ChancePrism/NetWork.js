/*
 * name: 网络与媒体落地
 * author: chance
 * category: Egern 小组件 / 网络监控
 * rewritten: 2026-07-15
 * checked: 2026-07-15
 * revised: 2026-07-15 · Large 改为弹性满幅布局：出口区固定、本地网络自动占满剩余高度、媒体解锁固定单行
 * target: Egern
 * source: JuemingDC/Egern · Widgets/网络信息.js
 *
 * 原脚本注释（保留，仅作版本记录）：
 * - 大号布局使用全宽对列表格，对比本地网络与代理出口。
 * - 中号布局保留紧凑双列结构。
 * - 底部展示流媒体 / AI 可用状态。
 *
 * 本次重构：
 * - 仅使用 Egern 官方 ctx.device / ctx.http / ctx.storage 与 Widget DSL。
 * - 完整处理七种 widgetFamily；不再使用 $network、ctx.network 或非官方属性。
 * - DIRECT 与当前路由分别探测，明确区分本地公网和实际出口。
 * - 媒体状态按尺寸截断，图标来自指定图标库并缓存；失败后才降级为 SF Symbols。
 * - 网络、媒体与图标请求彼此隔离；失败时优先回退缓存，不返回空白组件。
 *
 * 环境变量（均可选）：
 * TITLE              组件标题，默认“网络状态”。
 * REFRESH_MINUTES    建议刷新间隔，5–120 分钟，默认 15。
 * PRIVACY            是否隐藏部分公网 IP，默认 true。
 * PROBE_POLICY       当前出口探测所用策略；留空时遵循现有规则。
 * MEDIA              逗号分隔：Netflix,Disney+,YouTube,OpenAI,TikTok,Spotify,Claude,Gemini。
 * IP_API             公网信息接口，默认 https://ipwho.is/ 。
 * DEBUG              true 时在大尺寸显示简短调试状态，默认 false。
 *
 * 说明：
 * - “媒体可用性”属于网络层探测，不代表账号订阅、版权或播放能力。
 * - refreshAfter 只是刷新建议，实际调度由 iOS 决定。
 */

const VERSION = "5.0.5";
const CACHE_KEY = "chance.widget.network.v5.data";
const ICON_CACHE_PREFIX = "chance.widget.network.v5.icon.";
const ICON_CACHE_TTL = 30 * 86400000;
const DATA_CACHE_TTL = 6 * 3600000;

const C = {
  bg: { light: "#F4F2EC", dark: "#151714" },
  panel: { light: "#FFFFFFB8", dark: "#FFFFFF0A" },
  panelStrong: { light: "#E9EEE9", dark: "#222722" },
  text: { light: "#20251F", dark: "#F3F5F1" },
  sub: { light: "#6F786E", dark: "#A8B0A6" },
  line: { light: "#D7DDD5", dark: "#343A33" },
  accent: { light: "#39735F", dark: "#78C7A7" },
  blue: { light: "#426C9B", dark: "#8EB7E5" },
  ok: { light: "#238553", dark: "#62D694" },
  warn: { light: "#AD6B18", dark: "#E5B15D" },
  bad: { light: "#B74840", dark: "#F08A82" },
  unknown: { light: "#7B827A", dark: "#AEB5AD" },
};

const ICON_URLS = {
  Netflix: "https://raw.githubusercontent.com/fmz200/wool_scripts/main/icons/apps/Netflix_01.png",
  "Disney+": "https://raw.githubusercontent.com/fmz200/wool_scripts/main/icons/apps/DisneyPlus.png",
  YouTube: "https://raw.githubusercontent.com/fmz200/wool_scripts/main/icons/apps/YouTube_01.png",
  OpenAI: "https://raw.githubusercontent.com/fmz200/wool_scripts/main/icons/apps/ChatGPT.png",
  TikTok: "https://raw.githubusercontent.com/fmz200/wool_scripts/main/icons/apps/TikTok_01.png",
  Spotify: "https://raw.githubusercontent.com/fmz200/wool_scripts/main/icons/apps/Spotify_01.png",
  Claude: "https://raw.githubusercontent.com/fmz200/wool_scripts/main/icons/apps/Claude_01.png",
  Gemini: "https://raw.githubusercontent.com/fmz200/wool_scripts/main/icons/apps/Gemini_01.png",
};

const MEDIA_ALIASES = {
  netflix: "Netflix",
  nf: "Netflix",
  disney: "Disney+",
  "disney+": "Disney+",
  disneyplus: "Disney+",
  youtube: "YouTube",
  yt: "YouTube",
  openai: "OpenAI",
  chatgpt: "OpenAI",
  gpt: "OpenAI",
  tiktok: "TikTok",
  tk: "TikTok",
  spotify: "Spotify",
  sp: "Spotify",
  claude: "Claude",
  gemini: "Gemini",
};

function clampInt(value, min, max, fallback) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

function parseBool(value, fallback) {
  if (value == null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function cut(value, maxLength) {
  const text = String(value ?? "").trim();
  return text.length > maxLength ? `${text.slice(0, Math.max(1, maxLength - 1))}…` : text;
}

function normalizeStatus(status) {
  return ["ok", "limited", "blocked", "unknown"].includes(status) ? status : "unknown";
}

function statusMeta(status) {
  const safe = normalizeStatus(status);
  if (safe === "ok") return { label: "可用", color: C.ok, symbol: "checkmark" };
  if (safe === "limited") return { label: "部分", color: C.warn, symbol: "exclamationmark" };
  if (safe === "blocked") return { label: "不可用", color: C.bad, symbol: "xmark" };
  return { label: "未知", color: C.unknown, symbol: "questionmark" };
}

function latencyColor(value) {
  const ms = Number(value);
  if (!Number.isFinite(ms)) return C.unknown;
  if (ms <= 100) return C.ok;
  if (ms <= 250) return C.warn;
  return C.bad;
}

function maskIP(value) {
  const ip = String(value || "—");
  if (ip.includes(".")) {
    const parts = ip.split(".");
    return parts.length === 4 ? `${parts[0]}.${parts[1]}.*.*` : ip;
  }
  if (ip.includes(":")) {
    const parts = ip.split(":").filter(Boolean);
    return parts.length >= 2 ? `${parts.slice(0, 2).join(":")}:…` : ip;
  }
  return ip;
}

function formatLatency(value) {
  return Number.isFinite(Number(value)) ? `${Math.round(Number(value))} ms` : "—";
}

function formatPlace(exit) {
  if (!exit) return "位置未知";
  return [exit.countryCode, exit.region, exit.city].filter(Boolean).join(" · ") || "位置未知";
}

function text(value, size = "body", weight = "regular", color = C.text, extra = {}) {
  return {
    type: "text",
    text: String(value ?? ""),
    font: { size, weight },
    textColor: color,
    ...extra,
  };
}

function sf(name, color = C.accent, size = 16, extra = {}) {
  return {
    type: "image",
    src: `sf-symbol:${name}`,
    width: size,
    height: size,
    color,
    ...extra,
  };
}

function stack(children, extra = {}) {
  return { type: "stack", children, ...extra };
}

function spacer(length) {
  return length == null ? { type: "spacer" } : { type: "spacer", length };
}

function divider() {
  return stack([], { height: 1, backgroundColor: C.line });
}

function panel(children, extra = {}) {
  return stack(children, {
    direction: "column",
    alignItems: "start",
    gap: 6,
    padding: 10,
    backgroundColor: C.panel,
    borderRadius: 12,
    ...extra,
  });
}

function root(children, config, extra = {}) {
  return {
    type: "widget",
    children,
    padding: extra.padding ?? 14,
    gap: extra.gap ?? 8,
    refreshAfter: config.refreshAfter,
    backgroundColor: C.bg,
    ...extra,
  };
}

function metricRow(label, value, valueColor = C.text, options = {}) {
  return stack([
    text(label, options.labelSize || "caption1", "medium", C.sub, {
      flex: options.labelFlex || 1,
      maxLines: 1,
      minScale: 0.8,
    }),
    text(value, options.valueSize || "subheadline", options.strong ? "bold" : "semibold", valueColor, {
      flex: options.valueFlex || 2,
      textAlign: "right",
      maxLines: options.maxLines || 1,
      minScale: options.minScale || 0.76,
    }),
  ], { direction: "row", alignItems: "center", gap: 8 });
}

function sectionTitle(symbol, title, trailing) {
  const children = [
    sf(symbol, C.accent, 15),
    text(title, "headline", "semibold", C.text, { maxLines: 1 }),
    spacer(),
  ];
  if (trailing) children.push(text(trailing, "caption1", "medium", C.sub, { maxLines: 1 }));
  return stack(children, { direction: "row", alignItems: "center", gap: 6 });
}

function utf8Bytes(input) {
  const encoded = encodeURIComponent(String(input));
  const bytes = [];
  for (let index = 0; index < encoded.length; index += 1) {
    if (encoded[index] === "%") {
      bytes.push(Number.parseInt(encoded.slice(index + 1, index + 3), 16));
      index += 2;
    } else {
      bytes.push(encoded.charCodeAt(index));
    }
  }
  return bytes;
}

function bytesToBase64(bytesLike) {
  const bytes = bytesLike instanceof Uint8Array ? bytesLike : new Uint8Array(bytesLike);
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index];
    const hasB = index + 1 < bytes.length;
    const hasC = index + 2 < bytes.length;
    const b = hasB ? bytes[index + 1] : 0;
    const c = hasC ? bytes[index + 2] : 0;
    const block = (a << 16) | (b << 8) | c;
    output += alphabet[(block >> 18) & 63];
    output += alphabet[(block >> 12) & 63];
    output += hasB ? alphabet[(block >> 6) & 63] : "=";
    output += hasC ? alphabet[block & 63] : "=";
  }
  return output;
}

function svgData(svg) {
  return `data:image/svg+xml;base64,${bytesToBase64(utf8Bytes(svg))}`;
}

function escapeXML(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function statusBadgeIcon(dataURI, status, size = 30) {
  const safeURI = escapeXML(dataURI);
  const safeStatus = normalizeStatus(status);
  const fill = safeStatus === "ok" ? "#28A765" : safeStatus === "limited" ? "#D99122" : safeStatus === "blocked" ? "#D5534C" : "#818981";
  const mark = safeStatus === "ok" ? "M24.8 30.6l3.2 3.2 6.5-7.1" : safeStatus === "limited" ? "M30 25.5v6.2M30 35.5v.2" : safeStatus === "blocked" ? "M26.5 27l7 7M33.5 27l-7 7" : "M27.5 27.2c.4-2.1 4.8-2.1 4.8.7 0 2-2.3 2.1-2.3 4M30 35.4v.2";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 40 40"><defs><clipPath id="r"><rect width="34" height="34" rx="8"/></clipPath></defs><image href="${safeURI}" xlink:href="${safeURI}" x="0" y="0" width="34" height="34" preserveAspectRatio="xMidYMid slice" clip-path="url(#r)"/><circle cx="30" cy="30" r="8" fill="#FFFFFF"/><circle cx="30" cy="30" r="6.6" fill="${fill}"/><path d="${mark}" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  return { type: "image", src: svgData(svg), width: size, height: size };
}

function fallbackMediaIcon(name, status, size = 28) {
  const meta = statusMeta(status);
  const symbol = ["OpenAI", "Claude", "Gemini"].includes(name) ? "sparkles" : "play.rectangle.fill";
  return stack([
    sf(symbol, C.sub, size - 4),
    sf(meta.symbol === "checkmark" ? "checkmark.circle.fill" : meta.symbol === "xmark" ? "xmark.circle.fill" : meta.symbol === "exclamationmark" ? "exclamationmark.circle.fill" : "questionmark.circle.fill", meta.color, 12),
  ], { direction: "row", alignItems: "end", gap: 2 });
}

function requestOptions(policy, timeout = 6000, redirect = "follow") {
  const options = {
    timeout,
    redirect,
    credentials: "omit",
    headers: {
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
      Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
    },
  };
  if (policy) options.policy = policy;
  return options;
}

async function safeText(response) {
  if (!response || typeof response.text !== "function") return "";
  try {
    return await response.text();
  } catch {
    return "";
  }
}

async function safeJSON(response) {
  if (!response || typeof response.json !== "function") return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function headerValue(response, name) {
  try {
    return response?.headers?.get(name) || "";
  } catch {
    return "";
  }
}

async function timedGet(ctx, url, policy, timeout = 6000, redirect = "follow") {
  const startedAt = Date.now();
  try {
    const response = await ctx.http.get(url, requestOptions(policy, timeout, redirect));
    return { response, latency: Date.now() - startedAt, error: "" };
  } catch (error) {
    return { response: null, latency: null, error: cut(error?.message || error, 80) };
  }
}

function normalizeExit(data, latency, source) {
  if (!data || data.success === false) return null;
  const ip = String(data.ip || data.query || "").trim();
  if (!ip) return null;
  const connection = data.connection || {};
  const timezone = data.timezone || {};
  return {
    ip,
    type: String(data.type || (ip.includes(":") ? "IPv6" : "IPv4")),
    country: String(data.country || ""),
    countryCode: String(data.country_code || data.countryCode || data.country_code2 || "").toUpperCase(),
    region: String(data.region || data.regionName || ""),
    city: String(data.city || ""),
    asn: Number(connection.asn || data.asn || 0) || null,
    org: cut(connection.org || data.org || data.organization || "未知", 36),
    isp: cut(connection.isp || data.isp || connection.org || data.org || "未知", 36),
    timezone: String(timezone.id || data.timezone || ""),
    latency: Number.isFinite(Number(latency)) ? Number(latency) : null,
    source,
  };
}

async function enrichIP(ctx, ip, latency, source) {
  if (!ip) return null;
  let lookup = null;
  try {
    lookup = ctx.lookupIP(ip);
  } catch {
    lookup = null;
  }
  return {
    ip,
    type: ip.includes(":") ? "IPv6" : "IPv4",
    country: "",
    countryCode: String(lookup?.country || "").toUpperCase(),
    region: "",
    city: "",
    asn: Number(lookup?.asn || 0) || null,
    org: cut(lookup?.organization || "未知", 36),
    isp: cut(lookup?.organization || "未知", 36),
    timezone: "",
    latency: Number.isFinite(Number(latency)) ? Number(latency) : null,
    source,
  };
}

async function loadExit(ctx, config, policy, scopeName) {
  const cacheBust = Math.floor(Date.now() / 60000);
  const separator = config.ipAPI.includes("?") ? "&" : "?";
  const primary = await timedGet(ctx, `${config.ipAPI}${separator}_=${cacheBust}`, policy, 7000);
  if (primary.response && primary.response.status >= 200 && primary.response.status < 300) {
    const data = await safeJSON(primary.response);
    const normalized = normalizeExit(data, primary.latency, "ipwho.is");
    if (normalized) return { data: normalized, error: "" };
  }

  const fallback = await timedGet(ctx, `https://api.ipify.org?format=json&_=${cacheBust}`, policy, 6000);
  if (fallback.response && fallback.response.status >= 200 && fallback.response.status < 300) {
    const data = await safeJSON(fallback.response);
    const enriched = await enrichIP(ctx, String(data?.ip || ""), fallback.latency, "ipify+lookupIP");
    if (enriched) return { data: enriched, error: "" };
  }

  return {
    data: null,
    error: `${scopeName}: ${primary.error || `HTTP ${primary.response?.status || "失败"}`}`,
  };
}

function deviceInfo(ctx) {
  const device = ctx.device || {};
  const wifiName = String(device.wifi?.ssid || "").trim();
  const radio = String(device.cellular?.radio || "").trim();
  const carrier = String(device.cellular?.carrier || "").trim();
  const connection = wifiName
    ? { type: "Wi-Fi", name: wifiName, symbol: "wifi" }
    : radio
      ? { type: radio.toUpperCase(), name: carrier || radio.toUpperCase(), symbol: "antenna.radiowaves.left.and.right" }
      : { type: "未知", name: "未识别连接", symbol: "network" };

  return {
    connection,
    ipv4: String(device.ipv4?.address || ""),
    ipv4Interface: String(device.ipv4?.interface || ""),
    gateway: String(device.ipv4?.gateway || ""),
    ipv6: String(device.ipv6?.address || ""),
    ipv6Interface: String(device.ipv6?.interface || ""),
    dns: Array.isArray(device.dnsServers) ? device.dnsServers.map(String).filter(Boolean) : [],
  };
}

async function checkNetflix(ctx, policy) {
  const [original, full] = await Promise.all([
    timedGet(ctx, "https://www.netflix.com/title/81280792", policy, 6500, "manual"),
    timedGet(ctx, "https://www.netflix.com/title/70143836", policy, 6500, "manual"),
  ]);
  if (full.response?.status === 200) return { name: "Netflix", status: "ok", region: "", detail: "完整目录探测通过" };
  if (original.response?.status === 200) return { name: "Netflix", status: "limited", region: "", detail: "仅原创内容可访问" };
  if ([403, 404, 451].includes(original.response?.status) || [403, 404, 451].includes(full.response?.status)) {
    return { name: "Netflix", status: "blocked", region: "", detail: "目录探测未通过" };
  }
  return { name: "Netflix", status: "unknown", region: "", detail: original.error || full.error || "探测失败" };
}

async function checkDisney(ctx, policy) {
  const result = await timedGet(ctx, "https://www.disneyplus.com/", policy, 6500, "manual");
  const location = headerValue(result.response, "location").toLowerCase();
  if (location.includes("unavailable") || [403, 451].includes(result.response?.status)) {
    return { name: "Disney+", status: "blocked", region: "", detail: "区域限制" };
  }
  if (result.response && result.response.status >= 200 && result.response.status < 400) {
    return { name: "Disney+", status: "ok", region: "", detail: "站点可访问" };
  }
  return { name: "Disney+", status: "unknown", region: "", detail: result.error || "探测失败" };
}

async function checkYouTube(ctx, policy) {
  const result = await timedGet(ctx, "https://www.youtube.com/premium", policy, 6500);
  const body = await safeText(result.response);
  const region = body.match(/"(?:GL|countryCode)":"([A-Z]{2})"/i)?.[1]?.toUpperCase() || "";
  if ([403, 451].includes(result.response?.status)) return { name: "YouTube", status: "blocked", region, detail: "Premium 页面受限" };
  if (result.response && result.response.status >= 200 && result.response.status < 400) return { name: "YouTube", status: "ok", region, detail: "Premium 页面可访问" };
  return { name: "YouTube", status: "unknown", region, detail: result.error || "探测失败" };
}

async function checkOpenAI(ctx, policy) {
  const trace = await timedGet(ctx, "https://chatgpt.com/cdn-cgi/trace", policy, 5500);
  const body = await safeText(trace.response);
  const region = body.match(/(?:^|\n)loc=([A-Z]{2})(?:\n|$)/)?.[1] || "";
  if (trace.response?.status === 451) return { name: "OpenAI", status: "blocked", region, detail: "区域限制" };
  if (trace.response && trace.response.status >= 200 && trace.response.status < 400 && region) {
    return { name: "OpenAI", status: "ok", region, detail: "网络入口可访问" };
  }
  if (trace.response?.status === 403) return { name: "OpenAI", status: "limited", region, detail: "入口存在访问挑战" };
  return { name: "OpenAI", status: "unknown", region, detail: trace.error || "探测失败" };
}

async function checkTikTok(ctx, policy) {
  const result = await timedGet(ctx, "https://www.tiktok.com/explore", policy, 6500, "manual");
  const body = await safeText(result.response);
  const region = body.match(/"region":"([A-Z]{2})"/i)?.[1]?.toUpperCase() || "";
  if ([401, 403, 451].includes(result.response?.status) || /Access Denied|unavailable in your region/i.test(body)) {
    return { name: "TikTok", status: "blocked", region, detail: "访问受限" };
  }
  if (result.response && result.response.status >= 200 && result.response.status < 400) return { name: "TikTok", status: "ok", region, detail: "站点可访问" };
  return { name: "TikTok", status: "unknown", region, detail: result.error || "探测失败" };
}

async function checkSpotify(ctx, policy) {
  const result = await timedGet(ctx, "https://open.spotify.com/", policy, 6500, "manual");
  const location = headerValue(result.response, "location");
  if ([403, 451].includes(result.response?.status)) return { name: "Spotify", status: "blocked", region: "", detail: "访问受限" };
  if (result.response && result.response.status >= 200 && result.response.status < 400) {
    const region = location.match(/\/([a-z]{2})(?:\/|$)/i)?.[1]?.toUpperCase() || "";
    return { name: "Spotify", status: "ok", region, detail: "Web Player 可访问" };
  }
  return { name: "Spotify", status: "unknown", region: "", detail: result.error || "探测失败" };
}

async function checkClaude(ctx, policy) {
  const result = await timedGet(ctx, "https://claude.ai/login", policy, 6500, "manual");
  const body = await safeText(result.response);
  if ([451].includes(result.response?.status) || /App unavailable|certain regions/i.test(body)) {
    return { name: "Claude", status: "blocked", region: "", detail: "区域限制" };
  }
  if (result.response?.status === 403 && /turnstile|Just a moment|Challenge/i.test(body)) {
    return { name: "Claude", status: "limited", region: "", detail: "入口存在访问挑战" };
  }
  if (result.response && result.response.status >= 200 && result.response.status < 400) return { name: "Claude", status: "ok", region: "", detail: "登录入口可访问" };
  return { name: "Claude", status: "unknown", region: "", detail: result.error || "探测失败" };
}

async function checkGemini(ctx, policy) {
  const result = await timedGet(ctx, "https://gemini.google.com/app", policy, 6500, "manual");
  const location = headerValue(result.response, "location").toLowerCase();
  if (location.includes("faq") || [451].includes(result.response?.status)) return { name: "Gemini", status: "blocked", region: "", detail: "区域限制" };
  if (result.response?.status === 403) return { name: "Gemini", status: "limited", region: "", detail: "入口存在访问挑战" };
  if (result.response && result.response.status >= 200 && result.response.status < 400) return { name: "Gemini", status: "ok", region: "", detail: "应用入口可访问" };
  return { name: "Gemini", status: "unknown", region: "", detail: result.error || "探测失败" };
}

const CHECKERS = {
  Netflix: checkNetflix,
  "Disney+": checkDisney,
  YouTube: checkYouTube,
  OpenAI: checkOpenAI,
  TikTok: checkTikTok,
  Spotify: checkSpotify,
  Claude: checkClaude,
  Gemini: checkGemini,
};

function configuredMedia(value) {
  const defaults = ["Netflix", "Disney+", "YouTube", "OpenAI", "TikTok", "Spotify"];
  const raw = String(value || defaults.join(","))
    .split(/[,，|]/)
    .map((item) => item.trim())
    .filter(Boolean);
  const result = [];
  for (const item of raw) {
    const canonical = MEDIA_ALIASES[item.toLowerCase()] || item;
    if (CHECKERS[canonical] && !result.includes(canonical)) result.push(canonical);
  }
  return result.length ? result : defaults;
}

function mediaLimit(family) {
  if (family === "systemSmall") return 4;
  if (family === "systemMedium") return 6;
  if (family === "systemLarge") return 8;
  if (family === "systemExtraLarge") return 8;
  return 0;
}

async function checkMedia(ctx, names, policy) {
  const settled = await Promise.allSettled(names.map((name) => CHECKERS[name](ctx, policy)));
  return settled.map((result, index) => {
    if (result.status === "fulfilled" && result.value) return result.value;
    return { name: names[index], status: "unknown", region: "", detail: "脚本异常" };
  });
}

async function loadIconData(ctx, name) {
  const url = ICON_URLS[name];
  if (!url) return null;
  const key = `${ICON_CACHE_PREFIX}${name}`;
  try {
    const cached = ctx.storage.getJSON(key);
    if (cached?.data && Date.now() - Number(cached.time || 0) < ICON_CACHE_TTL) return cached.data;
  } catch {}

  try {
    const response = await ctx.http.get(url, {
      timeout: 7000,
      redirect: "follow",
      credentials: "omit",
    });
    if (!response || response.status < 200 || response.status >= 300) return null;
    const buffer = await response.arrayBuffer();
    const mime = headerValue(response, "content-type")?.split(";")[0] || "image/png";
    const data = `data:${mime};base64,${bytesToBase64(buffer)}`;
    try {
      ctx.storage.setJSON(key, { time: Date.now(), data });
    } catch {}
    return data;
  } catch {
    return null;
  }
}

function readCache(ctx) {
  try {
    const cached = ctx.storage.getJSON(CACHE_KEY);
    if (!cached?.data || !cached.time) return null;
    return { ...cached.data, cachedAt: Number(cached.time), stale: Date.now() - Number(cached.time) > DATA_CACHE_TTL };
  } catch {
    return null;
  }
}

function writeCache(ctx, data) {
  try {
    ctx.storage.setJSON(CACHE_KEY, { time: Date.now(), data });
  } catch {}
}

function buildConfig(ctx) {
  const env = ctx.env || {};
  const refreshMinutes = clampInt(env.REFRESH_MINUTES, 5, 120, 15);
  return {
    title: cut(env.TITLE || "网络状态", 16),
    family: ctx.widgetFamily || "systemMedium",
    privacy: parseBool(env.PRIVACY, true),
    debug: parseBool(env.DEBUG, false),
    probePolicy: String(env.PROBE_POLICY || "").trim(),
    media: configuredMedia(env.MEDIA),
    ipAPI: /^https:\/\//i.test(String(env.IP_API || "").trim())
      ? String(env.IP_API).trim()
      : "https://ipwho.is/",
    refreshAfter: new Date(Date.now() + refreshMinutes * 60000).toISOString(),
  };
}

async function loadData(ctx, config) {
  const local = deviceInfo(ctx);
  const visibleMediaNames = config.media.slice(0, mediaLimit(config.family));

  const [directResult, routeResult, media, iconDataList] = await Promise.all([
    loadExit(ctx, config, "DIRECT", "DIRECT"),
    loadExit(ctx, config, config.probePolicy, "ROUTE"),
    visibleMediaNames.length ? checkMedia(ctx, visibleMediaNames, config.probePolicy) : Promise.resolve([]),
    visibleMediaNames.length
      ? Promise.all(visibleMediaNames.map((name) => loadIconData(ctx, name)))
      : Promise.resolve([]),
  ]);

  const iconMap = Object.fromEntries(
    visibleMediaNames.map((name, index) => [name, iconDataList[index] || null])
  );

  let data = {
    local,
    direct: directResult.data,
    route: routeResult.data,
    media,
    errors: [directResult.error, routeResult.error].filter(Boolean),
    updatedAt: new Date().toISOString(),
    cached: false,
    stale: false,
  };

  if (!data.route && !data.direct) {
    const cached = readCache(ctx);
    if (cached) {
      data = {
        ...cached,
        local,
        errors: [...(cached.errors || []), ...data.errors],
        cached: true,
        stale: true,
      };
    }
  } else {
    writeCache(ctx, data);
  }

  if (data.media?.length) {
    data.media = data.media.map((item) => ({
      ...item,
      iconData: iconMap[item.name] || null,
    }));
  }
  return data;
}

function routeMode(data) {
  if (!data.route) return { label: "出口未知", color: C.unknown, symbol: "questionmark.circle.fill" };
  if (data.direct?.ip && data.route.ip === data.direct.ip) return { label: "直连出口", color: C.blue, symbol: "arrow.right.circle.fill" };
  if (data.direct?.ip) return { label: "代理出口", color: C.accent, symbol: "shield.lefthalf.filled" };
  return { label: "当前出口", color: C.accent, symbol: "location.circle.fill" };
}

function mediaSummary(media) {
  const total = media.length;
  const ok = media.filter((item) => item.status === "ok").length;
  const limited = media.filter((item) => item.status === "limited").length;
  const blocked = media.filter((item) => item.status === "blocked").length;
  return { total, ok, limited, blocked, label: total ? `${ok}/${total} 可用` : "未检测" };
}

function mediaIcon(item, size) {
  return item.iconData ? statusBadgeIcon(item.iconData, item.status, size) : fallbackMediaIcon(item.name, item.status, size);
}

function mediaCompactStrip(media, size = 27) {
  return stack(media.map((item) => mediaIcon(item, size)), {
    direction: "row",
    alignItems: "center",
    gap: 7,
  });
}

function mediaIconGrid(media, columns = 3, size = 24) {
  return chunkRows(media, columns, (item) =>
    stack([spacer(), mediaIcon(item, size), spacer()], {
      direction: "row",
      alignItems: "center",
      flex: 1,
    })
  );
}

function mediaTile(item, compact = false) {
  const meta = statusMeta(item.status);
  return stack([
    stack([
      mediaIcon(item, compact ? 26 : 30),
      spacer(),
      text(item.region || meta.label, "caption2", "semibold", meta.color, { maxLines: 1 }),
    ], { direction: "row", alignItems: "center", gap: 5 }),
    text(item.name, compact ? "caption1" : "subheadline", "semibold", C.text, { maxLines: 1, minScale: 0.78 }),
  ], { direction: "column", alignItems: "start", flex: 1, padding: compact ? 4 : 5, gap: 3 });
}

function chunkRows(items, columns, render) {
  const rows = [];
  for (let index = 0; index < items.length; index += columns) {
    const slice = items.slice(index, index + columns);
    const children = slice.map(render);
    while (children.length < columns) children.push(stack([], { flex: 1 }));
    rows.push(stack(children, { direction: "row", alignItems: "start", gap: 7 }));
  }
  return rows;
}

function updatedLabel(data) {
  if (data.cached) return data.stale ? "缓存数据" : "缓存";
  return "刚刚更新";
}

function renderInline(data, config) {
  const exit = data.route || data.direct;
  const mode = routeMode(data);
  const place = exit?.countryCode || exit?.city || "未知";
  return root([
    text(`${config.title} · ${mode.label} · ${place} · ${formatLatency(exit?.latency)}`, "caption1", "semibold", C.text, {
      maxLines: 1,
      minScale: 0.72,
    }),
  ], config, { padding: 0, gap: 0 });
}

function renderCircular(data, config) {
  const exit = data.route || data.direct;
  return root([
    spacer(),
    sf(data.local.connection.symbol, latencyColor(exit?.latency), 16),
    text(Number.isFinite(exit?.latency) ? String(Math.round(exit.latency)) : "—", "headline", "bold", C.text, {
      textAlign: "center",
      maxLines: 1,
      minScale: 0.75,
    }),
    text("ms", "caption2", "medium", C.sub, { textAlign: "center", maxLines: 1 }),
    spacer(),
  ], config, { padding: 4, gap: 1 });
}

function renderRectangular(data, config) {
  const exit = data.route || data.direct;
  const mode = routeMode(data);
  const summary = mediaSummary(data.media || []);
  return root([
    stack([
      sf(mode.symbol, mode.color, 15),
      text(cut(formatPlace(exit), 28), "headline", "semibold", C.text, { flex: 1, maxLines: 1, minScale: 0.72 }),
    ], { direction: "row", alignItems: "center", gap: 5 }),
    stack([
      text(formatLatency(exit?.latency), "caption1", "semibold", latencyColor(exit?.latency), { maxLines: 1 }),
      spacer(),
      text(summary.total ? summary.label : mode.label, "caption1", "medium", C.sub, { maxLines: 1 }),
    ], { direction: "row", alignItems: "center", gap: 6 }),
  ], config, { padding: 7, gap: 4 });
}

function renderSmall(data, config) {
  const exit = data.route || data.direct;
  const mode = routeMode(data);
  const summary = mediaSummary(data.media || []);
  const displayIP = config.privacy ? maskIP(exit?.ip) : exit?.ip || "—";
  return root([
    stack([
      sf(data.local.connection.symbol, C.accent, 16),
      text(config.title, "headline", "semibold", C.text, { maxLines: 1 }),
      spacer(),
      sf(mode.symbol, mode.color, 14),
    ], { direction: "row", alignItems: "center", gap: 6 }),
    text(cut(formatPlace(exit), 22), "title2", "bold", C.text, { maxLines: 1, minScale: 0.72 }),
    stack([
      text(mode.label, "caption1", "semibold", mode.color, { maxLines: 1 }),
      spacer(),
      text(formatLatency(exit?.latency), "headline", "bold", latencyColor(exit?.latency), { maxLines: 1 }),
    ], { direction: "row", alignItems: "center", gap: 6 }),
    panel([
      metricRow("公网", displayIP, C.text, { valueSize: "caption1", minScale: 0.7 }),
      metricRow("运营商", cut(exit?.isp || exit?.org || "未知", 20), C.text, { valueSize: "caption1", minScale: 0.72 }),
    ], { padding: 6, gap: 3 }),
    spacer(),
    data.media?.length
      ? stack([
          mediaCompactStrip(data.media, 24),
          spacer(),
          text(summary.label, "caption2", "semibold", summary.blocked ? C.warn : C.ok, { maxLines: 1 }),
        ], { direction: "row", alignItems: "center", gap: 6 })
      : text(updatedLabel(data), "caption2", "medium", C.sub, { maxLines: 1 }),
  ], config, { padding: 10, gap: 5 });
}

function renderMedium(data, config) {
  const exit = data.route || data.direct;
  const mode = routeMode(data);
  const displayIP = config.privacy ? maskIP(exit?.ip) : exit?.ip || "—";
  const summary = mediaSummary(data.media || []);
  return root([
    stack([
      sf("network", C.accent, 17),
      text(config.title, "headline", "semibold", C.text, { maxLines: 1 }),
      spacer(),
      sf(mode.symbol, mode.color, 14),
      text(mode.label, "caption1", "semibold", mode.color, { maxLines: 1 }),
    ], { direction: "row", alignItems: "center", gap: 6 }),
    stack([
      panel([
        text(cut(formatPlace(exit), 22), "title3", "bold", C.text, { maxLines: 1, minScale: 0.72 }),
        stack([
          text(formatLatency(exit?.latency), "headline", "bold", latencyColor(exit?.latency), { maxLines: 1 }),
          spacer(),
          text(data.local.connection.name, "caption1", "medium", C.sub, { maxLines: 1, minScale: 0.75 }),
        ], { direction: "row", alignItems: "center", gap: 6 }),
        divider(),
        metricRow("公网", displayIP, C.text, { valueSize: "caption1", minScale: 0.72 }),
        metricRow("ASN", exit?.asn ? `AS${exit.asn}` : "—", C.text, { valueSize: "caption1" }),
        metricRow("运营商", cut(exit?.isp || exit?.org || "未知", 22), C.text, { valueSize: "caption1", minScale: 0.72 }),
      ], { flex: 5, padding: 8, gap: 4 }),
      panel([
        stack([
          text("媒体可用性", "subheadline", "semibold", C.text, { maxLines: 1 }),
          spacer(),
          text(summary.label, "caption2", "semibold", summary.blocked ? C.warn : C.ok, { maxLines: 1 }),
        ], { direction: "row", alignItems: "center", gap: 5 }),
        ...mediaIconGrid(data.media || [], 3, 24),
      ], { flex: 6, padding: 8, gap: 5 }),
    ], { direction: "row", alignItems: "start", gap: 8, flex: 1 }),
  ], config, { padding: 10, gap: 6 });
}

function exitPanel(title, symbol, exit, privacy, emphasis) {
  const displayIP = privacy ? maskIP(exit?.ip) : exit?.ip || "—";
  return panel([
    stack([
      sf(symbol, emphasis, 14),
      text(title, "subheadline", "semibold", C.text, { maxLines: 1, minScale: 0.82 }),
      spacer(),
      text(formatLatency(exit?.latency), "subheadline", "bold", latencyColor(exit?.latency), { maxLines: 1, minScale: 0.82 }),
    ], { direction: "row", alignItems: "center", gap: 5 }),
    text(cut(formatPlace(exit), 30), "subheadline", "bold", C.text, { maxLines: 1, minScale: 0.82 }),
    stack([
      detailField("公网", displayIP, { size: "caption1", minScale: 0.86 }),
      detailField("ASN", exit?.asn ? `AS${exit.asn}` : "—", { size: "caption1", minScale: 0.86 }),
    ], { direction: "row", alignItems: "start", gap: 10 }),
    detailField("运营商", cut(exit?.isp || exit?.org || "未知", 24), { size: "caption1", minScale: 0.84 }),
  ], { flex: 1, height: 112, padding: 9, gap: 4, backgroundColor: C.panelStrong });
}

function detailField(label, value, options = {}) {
  return stack([
    text(label, "caption2", "medium", C.sub, { maxLines: 1 }),
    text(value || "—", options.size || "caption1", "semibold", C.text, {
      maxLines: options.maxLines || 1,
      minScale: options.minScale || 0.82,
    }),
  ], { direction: "column", alignItems: "start", gap: 1, flex: options.flex || 1 });
}

function detailPanel(data) {
  const local = data.local;
  const dns = local.dns.slice(0, 2).join(" / ") || "—";
  const interfaceName = local.ipv4Interface || local.ipv6Interface || "—";

  const fullRow = (label, value) => stack([
    text(label, "caption2", "medium", C.sub, { maxLines: 1 }),
    text(value || "—", "caption1", "semibold", C.text, {
      flex: 1,
      maxLines: 1,
      minScale: 0.8,
    }),
  ], { direction: "row", alignItems: "center", gap: 10, flex: 1 });

  return panel([
    sectionTitle("wifi", "本地网络", local.connection.type),
    divider(),
    stack([
      detailField("连接", local.connection.name || "—", { size: "caption1", flex: 3, minScale: 0.82 }),
      detailField("接口", interfaceName, { size: "caption1", flex: 2, minScale: 0.82 }),
      detailField("IPv4", local.ipv4 || "—", { size: "caption1", flex: 4, minScale: 0.84 }),
      detailField("网关", local.gateway || "—", { size: "caption1", flex: 4, minScale: 0.84 }),
    ], { direction: "row", alignItems: "center", gap: 10, flex: 1 }),
    divider(),
    fullRow("IPv6", local.ipv6 || "—"),
    divider(),
    fullRow("DNS", dns),
  ], { flex: 1, padding: 10, gap: 5 });
}

function mediaPanel(data, columns) {
  const summary = mediaSummary(data.media || []);
  return panel([
    stack([
      sf("play.rectangle.on.rectangle", C.blue, 14),
      ...((data.media || []).map((item) => mediaIcon(item, 26))),
      spacer(),
      text(summary.label, "caption1", "semibold", summary.blocked ? C.warn : C.ok, { maxLines: 1 }),
    ], { direction: "row", alignItems: "center", gap: 7 }),
  ], { height: 46, padding: [7, 9, 7, 9], gap: 0 });
}

function renderLarge(data, config) {
  const mode = routeMode(data);
  const children = [
    stack([
      sf("network", C.accent, 17),
      text(config.title, "headline", "bold", C.text, { maxLines: 1 }),
      text(`v${VERSION}`, "caption2", "medium", C.sub, { maxLines: 1 }),
      spacer(),
      sf(mode.symbol, mode.color, 13),
      text(mode.label, "caption1", "semibold", mode.color, { maxLines: 1 }),
    ], { direction: "row", alignItems: "center", gap: 5, height: 24 }),
    stack([
      exitPanel("本地公网", "house.and.flag.fill", data.direct, config.privacy, C.blue),
      exitPanel("当前出口", "shield.lefthalf.filled", data.route, config.privacy, C.accent),
    ], { direction: "row", alignItems: "start", gap: 8, height: 114 }),
    detailPanel(data),
    mediaPanel(data, 6),
  ];

  if (config.debug && data.errors?.length) {
    children.push(text(`调试：${cut(data.errors.join(" | "), 100)}`, "caption2", "regular", C.warn, { maxLines: 1 }));
  }

  return root(children, config, { padding: 12, gap: 7 });
}

function renderExtraLarge(data, config) {
  const mode = routeMode(data);
  const exit = data.route || data.direct;
  return root([
    stack([
      sf("network", C.accent, 19),
      text(config.title, "title3", "bold", C.text, { maxLines: 1 }),
      spacer(),
      text(cut(formatPlace(exit), 28), "headline", "semibold", C.text, { maxLines: 1, minScale: 0.75 }),
      sf(mode.symbol, mode.color, 15),
      text(mode.label, "caption1", "semibold", mode.color, { maxLines: 1 }),
    ], { direction: "row", alignItems: "center", gap: 7 }),
    stack([
      stack([
        exitPanel("本地公网", "house.and.flag.fill", data.direct, config.privacy, C.blue),
        exitPanel("当前出口", "shield.lefthalf.filled", data.route, config.privacy, C.accent),
      ], { direction: "column", alignItems: "start", gap: 9, flex: 4 }),
      detailPanel(data),
      mediaPanel(data, 4),
    ], { direction: "row", alignItems: "start", gap: 10, flex: 1 }),
    stack([
      text(`数据源：${data.route?.source || data.direct?.source || "缓存"}`, "caption2", "regular", C.sub, { maxLines: 1 }),
      spacer(),
      text(updatedLabel(data), "caption2", "medium", data.cached ? C.warn : C.sub, { maxLines: 1 }),
    ], { direction: "row", alignItems: "center", gap: 6 }),
  ], config, { padding: 16, gap: 9 });
}

function renderError(config, message) {
  return root([
    spacer(),
    sf("exclamationmark.triangle.fill", C.bad, 24),
    text("网络数据不可用", "headline", "bold", C.text, { textAlign: "center", maxLines: 1 }),
    text(cut(message || "请检查网络、策略名称或接口配置", 80), "caption1", "regular", C.sub, {
      textAlign: "center",
      maxLines: 3,
      minScale: 0.8,
    }),
    spacer(),
  ], config, { padding: 14, gap: 7 });
}

export default async function(ctx) {
  const config = buildConfig(ctx);
  try {
    const data = await loadData(ctx, config);
    if (!data.route && !data.direct) return renderError(config, data.errors?.join(" | "));

    if (config.family === "accessoryInline") return renderInline(data, config);
    if (config.family === "accessoryCircular") return renderCircular(data, config);
    if (config.family === "accessoryRectangular") return renderRectangular(data, config);
    if (config.family === "systemSmall") return renderSmall(data, config);
    if (config.family === "systemMedium") return renderMedium(data, config);
    if (config.family === "systemExtraLarge") return renderExtraLarge(data, config);
    return renderLarge(data, config);
  } catch (error) {
    return renderError(config, error?.message || error);
  }
}
