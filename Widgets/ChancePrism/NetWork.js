/**
 * 网络信息 · Egern Widget
 * 重构：Chance
 * 目标：减少装饰，强化本地网络 / 代理出口 / 解锁状态的阅读路径。
 */

export default async function (ctx) {
  const env = ctx.env || {};
  const family = ctx.widgetFamily || "systemMedium";
  const isAccessory = family.startsWith("accessory");
  const isLarge = family === "systemLarge" || family === "systemExtraLarge";
  const refreshMin = clampInt(env.REFRESH_MIN, 5, 120, 10);
  const refreshAfter = new Date(Date.now() + refreshMin * 60000).toISOString();
  const cacheKey = "chance_widget_network_v3";

  const C = {
    bg: { light: "#F3F1EA", dark: "#171816" },
    text: { light: "#262822", dark: "#F2F1EA" },
    sub: { light: "#74766E", dark: "#A9ABA2" },
    line: { light: "#D9D8D0", dark: "#343630" },
    local: { light: "#357D6A", dark: "#70C5AB" },
    proxy: { light: "#6D5AA8", dark: "#B9A8EA" },
    ok: { light: "#238C55", dark: "#62D692" },
    warn: { light: "#B16A16", dark: "#E6B05D" },
    bad: { light: "#BC4A42", dark: "#F08A82" },
  };


  function base64Utf8(input) {
    const bytes = unescape(encodeURIComponent(input));
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let out = "";
    for (let i = 0; i < bytes.length; i += 3) {
      const a = bytes.charCodeAt(i);
      const hasB = i + 1 < bytes.length;
      const hasC = i + 2 < bytes.length;
      const b = hasB ? bytes.charCodeAt(i + 1) : 0;
      const c = hasC ? bytes.charCodeAt(i + 2) : 0;
      const n = (a << 16) | (b << 8) | c;
      out += chars[(n >> 18) & 63];
      out += chars[(n >> 12) & 63];
      out += hasB ? chars[(n >> 6) & 63] : "=";
      out += hasC ? chars[n & 63] : "=";
    }
    return out;
  }

  function svgData(svg) {
    return `data:image/svg+xml;base64,${base64Utf8(svg)}`;
  }

  const commonHeaders = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
    "Accept": "text/html,application/json;q=0.9,*/*;q=0.8",
  };

  function clampInt(v, min, max, fallback) {
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
  }

  function flag(code) {
    const cc = String(code || "").toUpperCase();
    if (cc === "TW") return "🇨🇳";
    if (!/^[A-Z]{2}$/.test(cc)) return "";
    return String.fromCodePoint(...cc.split("").map(c => 127397 + c.charCodeAt()));
  }

  function shortText(value, max = 24) {
    const s = String(value || "未知").trim();
    return s.length > max ? s.slice(0, max - 1) + "…" : s;
  }

  async function readText(resp) {
    try { return resp ? await resp.text() : ""; } catch { return ""; }
  }

  function header(resp, name) {
    try { return resp?.headers?.get(name) || ""; } catch { return ""; }
  }

  async function timedGet(url, options = {}) {
    const started = Date.now();
    try {
      const resp = await ctx.http.get(url, options);
      return { resp, ms: Date.now() - started };
    } catch {
      return { resp: null, ms: null };
    }
  }

  const device = ctx.device || {};
  const wifi = device.wifi?.ssid;
  const radio = device.cellular?.radio;
  const localIp = device.ipv4?.address || "获取失败";
  const gateway = device.ipv4?.gateway || (radio ? "蜂窝网络" : "无网关");
  const networkName = wifi || radio || "未连接";
  const networkIcon = wifi ? "wifi" : radio ? "antenna.radiowaves.left.and.right" : "network.slash";

  async function getLocalPublic() {
    try {
      const resp = await ctx.http.get("https://myip.ipip.net/json", { headers: commonHeaders, timeout: 4500 });
      const data = await resp.json();
      return {
        ip: data?.data?.ip || "获取失败",
        loc: [data?.data?.location?.[1], data?.data?.location?.[2]].filter(Boolean).join(" ") || "未知",
      };
    } catch {
      return { ip: "获取失败", loc: "未知" };
    }
  }

  async function getProxy() {
    try {
      const resp = await ctx.http.get("http://ip-api.com/json/?lang=zh-CN", { timeout: 4500 });
      const d = await resp.json();
      return {
        ip: d?.query || "获取失败",
        loc: `${flag(d?.countryCode)} ${d?.city || d?.country || "未知"}`.trim(),
        isp: shortText(d?.isp || d?.org || "未知", 25),
        cc: d?.countryCode || "",
      };
    } catch {
      return { ip: "获取失败", loc: "未知", isp: "未知", cc: "" };
    }
  }

  async function getPurity() {
    try {
      const resp = await ctx.http.get("https://my.ippure.com/v1/info", { timeout: 4500 });
      return await resp.json();
    } catch {
      return {};
    }
  }

  async function checkNetflix() {
    const check = async id => {
      const r = await ctx.http.get(`https://www.netflix.com/title/${id}`, {
        timeout: 4500, headers: commonHeaders, redirect: "manual",
      }).catch(() => null);
      return r?.status || 0;
    };
    try {
      if (await check(70143836) === 200) return "full";
      if (await check(81280792) === 200) return "partial";
    } catch {}
    return "fail";
  }

  async function checkDisney() {
    try {
      const r = await ctx.http.get("https://www.disneyplus.com", {
        timeout: 4500, headers: commonHeaders, redirect: "manual",
      }).catch(() => null);
      if (!r || r.status === 403 || header(r, "location").includes("unavailable")) return "fail";
      return "full";
    } catch { return "fail"; }
  }

  async function checkTikTok() {
    try {
      const r = await ctx.http.get("https://www.tiktok.com/explore", {
        timeout: 4500, headers: commonHeaders, redirect: "manual",
      }).catch(() => null);
      if (!r || [401, 403].includes(r.status)) return "fail";
      const body = await readText(r);
      if (/Access Denied|Please wait/i.test(body)) return "fail";
      return body.match(/"region":"([A-Z]{2})"/i)?.[1]?.toUpperCase() || "full";
    } catch { return "fail"; }
  }

  async function checkChatGPT() {
    try {
      const r = await ctx.http.get("https://chatgpt.com/cdn-cgi/trace", { timeout: 3500 }).catch(() => null);
      const body = await readText(r);
      return body.match(/loc=([A-Z]{2})/)?.[1]?.toUpperCase() || (r ? "full" : "fail");
    } catch { return "fail"; }
  }

  async function checkClaude() {
    try {
      const r = await ctx.http.get("https://claude.ai/login", {
        timeout: 5000, headers: commonHeaders, redirect: "manual",
      }).catch(() => null);
      if (!r) return "fail";
      const body = await readText(r);
      if (/App unavailable|certain regions/i.test(body) || (r.status === 403 && /1020/.test(body))) return "fail";
      return [200, 301, 302, 403].includes(r.status) ? "full" : "fail";
    } catch { return "fail"; }
  }

  async function checkGemini() {
    try {
      const r = await ctx.http.get("https://gemini.google.com/app", {
        timeout: 4500, headers: commonHeaders, redirect: "manual",
      }).catch(() => null);
      if (!r || header(r, "location").includes("faq")) return "fail";
      return "full";
    } catch { return "fail"; }
  }

  let data;
  try {
    const [
      localPublic, proxy, purity,
      localPing, proxyPing,
      netflix, disney, tiktok, chatgpt, claude, gemini,
    ] = await Promise.all([
      getLocalPublic(),
      getProxy(),
      getPurity(),
      timedGet("http://www.baidu.com", { timeout: 2500 }),
      timedGet("http://cp.cloudflare.com/generate_204", { timeout: 2500 }),
      checkNetflix(), checkDisney(), checkTikTok(), checkChatGPT(), checkClaude(), checkGemini(),
    ]);

    data = {
      localPublic, proxy, purity,
      localMs: localPing.ms, proxyMs: proxyPing.ms,
      unlocks: { netflix, disney, tiktok, chatgpt, claude, gemini },
      savedAt: Date.now(),
    };
    ctx.storage.setJSON(cacheKey, data);
  } catch {
    data = ctx.storage.getJSON(cacheKey) || {
      localPublic: { ip: "获取失败", loc: "未知" },
      proxy: { ip: "获取失败", loc: "未知", isp: "未知", cc: "" },
      purity: {},
      localMs: null, proxyMs: null,
      unlocks: {},
      savedAt: 0,
    };
  }


  function topologySvg(localMs, proxyMs, score) {
    const lm = Number.isFinite(localMs) ? Math.min(localMs, 999) : null;
    const pm = Number.isFinite(proxyMs) ? Math.min(proxyMs, 999) : null;
    const rs = Number.isFinite(Number(score)) ? Math.max(0, Math.min(100, Number(score))) : 0;
    const lc = lm == null ? "#8A8F98" : lm < 120 ? "#45D2AE" : lm < 300 ? "#F2B255" : "#FF6D73";
    const pc = pm == null ? "#8A8F98" : pm < 180 ? "#7F8CFF" : pm < 400 ? "#F2B255" : "#FF6D73";
    const rc = rs < 30 ? "#45D2AE" : rs < 70 ? "#F2B255" : "#FF6D73";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="292" height="64" viewBox="0 0 292 64">
      <defs>
        <linearGradient id="flow" x1="0" x2="1"><stop stop-color="${lc}"/><stop offset=".5" stop-color="#53D7FF"/><stop offset="1" stop-color="${pc}"/></linearGradient>
        <filter id="g"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <path d="M24 34 C70 4 105 58 146 32 S223 6 268 32" fill="none" stroke="url(#flow)" stroke-width="3" stroke-linecap="round" opacity=".92" filter="url(#g)"/>
      <path d="M24 34 C70 56 102 10 146 32 S224 58 268 32" fill="none" stroke="#FFFFFF" stroke-opacity=".10" stroke-width="1.2"/>
      <circle cx="24" cy="34" r="10" fill="${lc}" fill-opacity=".16"/><circle cx="24" cy="34" r="4.5" fill="${lc}"/>
      <circle cx="146" cy="32" r="7" fill="#53D7FF" fill-opacity=".18"/><circle cx="146" cy="32" r="3.2" fill="#53D7FF"/>
      <circle cx="268" cy="32" r="10" fill="${pc}" fill-opacity=".16"/><circle cx="268" cy="32" r="4.5" fill="${pc}"/>
      <rect x="106" y="56" width="80" height="4" rx="2" fill="#FFFFFF" fill-opacity=".10"/>
      <rect x="106" y="56" width="${Math.max(4,80*rs/100)}" height="4" rx="2" fill="${rc}"/>
    </svg>`;
    return svgData(svg);
  }

  function riskView() {
    const score = Number(data.purity?.fraudScore);
    if (!Number.isFinite(score)) return { text: "无数据", color: C.sub, icon: "questionmark.shield" };
    if (score >= 70) return { text: `高危 ${score}`, color: C.bad, icon: "xmark.shield.fill" };
    if (score >= 30) return { text: `中危 ${score}`, color: C.warn, icon: "exclamationmark.shield.fill" };
    return { text: `纯净 ${score}`, color: C.ok, icon: "checkmark.shield.fill" };
  }

  function propertyView() {
    if (data.purity?.isResidential === true) return { text: "原生住宅", color: C.ok };
    if (data.purity?.isResidential === false) return { text: "商业机房", color: C.warn };
    return { text: "未知属性", color: C.sub };
  }

  function unlockLabel(name, value) {
    const failed = !value || value === "fail";
    const partial = value === "partial";
    const suffix = /^[A-Z]{2}$/.test(value || "") ? ` ${flag(value)}` : "";
    return {
      name,
      text: `${name}${suffix}`,
      color: failed ? C.bad : partial ? C.warn : C.ok,
    };
  }

  const risk = riskView();
  const property = propertyView();
  const media = [
    unlockLabel("Netflix", data.unlocks.netflix),
    unlockLabel("Disney+", data.unlocks.disney),
    unlockLabel("TikTok", data.unlocks.tiktok),
  ];
  const ai = [
    unlockLabel("ChatGPT", data.unlocks.chatgpt),
    unlockLabel("Claude", data.unlocks.claude),
    unlockLabel("Gemini", data.unlocks.gemini),
  ];

  const Text = (text, size, weight = "regular", color = C.text, extra = {}) => ({
    type: "text", text: String(text), font: { size, weight }, textColor: color,
    maxLines: 1, minScale: 0.5, ...extra,
  });
  const Icon = (name, color, size) => ({
    type: "image", src: `sf-symbol:${name}`, color, width: size, height: size,
  });
  const Divider = () => ({ type: "stack", height: 1, backgroundColor: C.line, children: [] });

  if (family === "accessoryInline") {
    return {
      type: "widget", refreshAfter,
      children: [Text(`${networkName} · ${data.proxy.loc} · ${data.proxyMs ?? "--"} ms`, "caption1", "semibold")],
    };
  }

  if (family === "accessoryCircular") {
    return {
      type: "widget", refreshAfter, padding: 4, gap: 2,
      children: [
        Icon(risk.icon, risk.color, 19),
        Text(data.proxyMs == null ? "--" : `${data.proxyMs}`, "headline", "bold", C.text, { textAlign: "center" }),
        Text("ms", "caption2", "medium", C.sub, { textAlign: "center" }),
      ],
    };
  }

  if (family === "accessoryRectangular") {
    return {
      type: "widget", refreshAfter, gap: 2,
      children: [
        {
          type: "stack", direction: "row", alignItems: "center", gap: 5,
          children: [Icon(networkIcon, C.local, 12), Text(networkName, "caption1", "semibold"), { type: "spacer" }, Text(data.proxy.loc, "caption2", "medium", C.proxy)],
        },
        Text(`${data.localPublic.ip}  →  ${data.proxy.ip}`, "caption2", "medium", C.sub),
        Text(`${property.text} · ${risk.text} · ${data.proxyMs ?? "--"} ms`, "caption2", "semibold", risk.color),
      ],
    };
  }

  const side = (title, icon, color, rows) => ({
    type: "stack", direction: "column", flex: 1, gap: isLarge ? 7 : 5,
    children: [
      { type: "stack", direction: "row", alignItems: "center", gap: 5, children: [Icon(icon, color, isLarge ? 14 : 12), Text(title, isLarge ? 13 : 11, "bold", color)] },
      ...rows.map(([label, value, valueColor = C.text]) => ({
        type: "stack", direction: "row", alignItems: "center", gap: 5,
        children: [
          Text(label, isLarge ? 11 : 9, "medium", C.sub, { width: isLarge ? 36 : 30 }),
          Text(value, isLarge ? 13 : 10, "semibold", valueColor, { flex: 1 }),
        ],
      })),
    ],
  });

  const unlockRow = (label, list) => ({
    type: "stack", direction: "row", alignItems: "center", gap: 8,
    children: [
      Text(label, isLarge ? 11 : 9, "semibold", C.sub, { width: isLarge ? 48 : 39 }),
      ...list.map(x => Text(x.text, isLarge ? 12 : 9, "bold", x.color, { flex: 1 })),
    ],
  });

  return {
    type: "widget",
    refreshAfter,
    padding: isLarge ? [12, 14, 12, 14] : [11, 12, 11, 12],
    gap: isLarge ? 9 : 7,
    backgroundColor: C.bg,
    children: [
      {
        type: "stack", direction: "row", alignItems: "center", gap: 6,
        children: [
          Icon("waveform.path.ecg", C.sub, isLarge ? 14 : 12),
          Text("网络诊断", isLarge ? 13 : 11, "bold"),
          Text("LOCAL / PROXY", isLarge ? 10 : 9, "medium", C.sub),
          { type: "spacer" },
          { type: "date", date: new Date().toISOString(), format: "time", font: { size: isLarge ? 10 : 9, weight: "medium" }, textColor: C.sub },
        ],
      },
      {
        type: "image",
        src: topologySvg(data.localMs, data.proxyMs, data.purity?.fraudScore),
        width: 292,
        height: isLarge ? 64 : 46,
        resizeMode: "contain",
      },
      Divider(),
      {
        type: "stack", direction: "row", alignItems: "start", gap: isLarge ? 18 : 12, flex: 1,
        children: [
          side("本地网络", networkIcon, C.local, [
            ["环境", networkName],
            ["内网", localIp],
            ["公网", data.localPublic.ip],
            ["位置", data.localPublic.loc],
            ["延迟", data.localMs == null ? "超时" : `${data.localMs} ms`],
          ]),
          side("代理出口", "paperplane.fill", C.proxy, [
            ["落地", data.proxy.loc],
            ["出口", data.proxy.ip],
            ["厂商", data.proxy.isp],
            ["属性", property.text, property.color],
            ["风险", risk.text, risk.color],
          ]),
        ],
      },
      Divider(),
      unlockRow("流媒体", media),
      unlockRow("AI", ai),
    ],
  };
}
