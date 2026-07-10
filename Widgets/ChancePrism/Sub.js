/**
 * Chance Prism · 机场订阅
 * 作者：Chance
 * 类型：Egern Generic Widget
 *
 * 支持：
 * - SUB_URL / SUB_URL1 ... SUB_URL8
 * - SUB_NAME / SUB_NAME1 ... SUB_NAME8（可选，未填写时自动推断）
 * - ICON_SLUG / ICON_SLUG1 ... ICON_SLUG8（Simple Icons slug，可选）
 * - REFRESH_MIN（默认 30）
 *
 * 环形进度表示“剩余流量百分比”，圆心显示机场图标。
 */

export default async function (ctx) {
  const env = ctx.env || {};
  const family = ctx.widgetFamily || "systemMedium";
  const refreshMin = clampInt(env.REFRESH_MIN, 5, 1440, 30);
  const refreshAfter = new Date(Date.now() + refreshMin * 60000).toISOString();
  const cacheKey = "chance_prism_subscription_v2";
  const LIGE_CATALOG_URL = "https://raw.githubusercontent.com/lige47/lige_icon/main/ligeicon.json";
  const FMZ_CATALOG_URL = String(env.FMZ_ICON_CATALOG || "").trim();
  const QURE_BASE = "https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color";

  const C = {
    bg: { light: "#F2F1EE", dark: "#181A1F" },
    panel: { light: "rgba(255,255,255,0.52)", dark: "rgba(255,255,255,0.035)" },
    text: { light: "#181A1E", dark: "#F6F7FA" },
    sub: { light: "#747881", dark: "#A8ADB7" },
    track: { light: "#D9DCE2", dark: "#343944" },
    green: "#31D158",
    cyan: "#39D5FF",
    blue: "#3B82F6",
    violet: "#9B6CFF",
    amber: "#FFB547",
    red: "#FF5D67",
  };

  function clampInt(value, min, max, fallback) {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
  }

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

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

  function getHeader(headers, name) {
    if (!headers) return "";
    try {
      if (typeof headers.get === "function") {
        return headers.get(name) || headers.get(name.toLowerCase()) || "";
      }
    } catch {}
    return headers[name] || headers[name.toLowerCase()] || "";
  }

  function parseUserInfo(raw) {
    const out = {};
    String(raw || "").split(";").forEach(part => {
      const [key, value] = part.trim().split("=");
      if (key && value != null) out[key.toLowerCase()] = Number(value);
    });
    return out;
  }

  function bytesText(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) return "--";
    const units = ["B", "KB", "MB", "GB", "TB", "PB"];
    let value = bytes;
    let index = 0;
    while (value >= 1024 && index < units.length - 1) {
      value /= 1024;
      index++;
    }
    const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
    return `${value.toFixed(digits)} ${units[index]}`;
  }

  function expiryText(expire) {
    if (!Number.isFinite(expire) || expire <= 0) return "长期有效";
    const target = new Date(expire * 1000);
    const diff = Math.ceil((target.getTime() - Date.now()) / 86400000);
    if (diff < 0) return "已到期";
    if (diff === 0) return "今天到期";
    return `${diff} 天后到期`;
  }

  function inferName(explicit, url, headers) {
    if (explicit && String(explicit).trim()) return String(explicit).trim();

    const titleHeaders = [
      "profile-title",
      "subscription-title",
      "x-subscription-name",
      "content-disposition",
    ];
    for (const key of titleHeaders) {
      const value = getHeader(headers, key);
      if (!value) continue;
      const utf = value.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
      const plain = value.match(/filename="?([^";]+)"?/i)?.[1];
      const candidate = utf || plain || value;
      try {
        const decoded = decodeURIComponent(candidate).replace(/\.(yaml|yml|conf|txt)$/i, "").trim();
        if (decoded && decoded.length <= 32) return decoded;
      } catch {}
    }

    try {
      const host = new URL(url).hostname.replace(/^www\./, "");
      const stem = host.split(".").filter(Boolean).slice(-2, -1)[0] || host.split(".")[0];
      return stem
        .replace(/[-_]+/g, " ")
        .replace(/\b\w/g, x => x.toUpperCase())
        .slice(0, 24);
    } catch {
      return "机场订阅";
    }
  }

  function inferIconSlug(name, explicit) {
    if (explicit) return String(explicit).trim().toLowerCase();
    const s = String(name || "").toLowerCase();

    const rules = [
      [/cloudflare|cf\b|云盾/, "cloudflare"],
      [/google|谷歌/, "googlecloud"],
      [/azure|微软/, "microsoftazure"],
      [/aws|amazon|亚马逊/, "amazonwebservices"],
      [/digital.?ocean/, "digitalocean"],
      [/vultr/, "vultr"],
      [/oracle|甲骨文/, "oracle"],
      [/alibaba|aliyun|阿里/, "alibabacloud"],
      [/tencent|腾讯/, "tencentqq"],
      [/telegram|tg\b|电报/, "telegram"],
      [/github|代码|仓库/, "github"],
      [/wireguard|wg\b/, "wireguard"],
      [/tailscale/, "tailscale"],
      [/sing.?box/, "singbox"],
      [/clash|mihomo/, "clash"],
      [/apple|苹果/, "apple"],
      [/youtube|油管/, "youtube"],
      [/netflix|奈飞/, "netflix"],
      [/discord/, "discord"],
      [/steam/, "steam"],
      [/spotify/, "spotify"],
    ];
    return rules.find(([re]) => re.test(s))?.[1] || "";
  }

  function fallbackLogo(name, accent) {
    const initial = Array.from(String(name || "A").trim())[0] || "A";
    return svgData(`<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 72 72">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop stop-color="${accent}"/>
          <stop offset="1" stop-color="#FFFFFF" stop-opacity=".72"/>
        </linearGradient>
      </defs>
      <circle cx="36" cy="36" r="30" fill="none" stroke="url(#g)" stroke-width="2" opacity=".45"/>
      <path d="M18 40c8-12 28-18 38-6-9-2-16 1-20 9-5-6-11-7-18-3Z" fill="url(#g)" opacity=".92"/>
      <text x="36" y="34" text-anchor="middle" dominant-baseline="middle" font-family="-apple-system,BlinkMacSystemFont,sans-serif" font-size="22" font-weight="700" fill="#FFFFFF">${esc(initial)}</text>
    </svg>`);
  }

  async function fetchJson(url, timeout=7000) {
    if (!url) return null;
    try {
      const response = await ctx.http.get(url,{timeout});
      if (response.status !== 200) return null;
      if (typeof response.json === "function") return await response.json();
      return JSON.parse(await response.text());
    } catch { return null; }
  }

  function normalizeIconName(value) {
    return String(value || "").toLowerCase().replace(/[\s._\-()\[\]{}]+/g,"");
  }

  function iconKeywords(name) {
    const source = String(name || "").trim();
    const hostLike = source.replace(/\.(com|net|org|xyz|top|me|io)$/i,"");
    return [...new Set([
      source, hostLike,
      ...source.split(/[\s._\-|/]+/),
      source.replace(/机场|加速器|网络|云|订阅/g,"")
    ].map(normalizeIconName).filter(x=>x.length>=2))];
  }

  async function resolveFromCatalog(url, name) {
    const cache = `chance_icon_catalog_${base64Utf8(url).slice(0,20)}`;
    let catalog = ctx.storage.getJSON(cache);
    if (!catalog?.icons) {
      const data = await fetchJson(url);
      const icons = Array.isArray(data) ? data : data?.icons;
      if (Array.isArray(icons)) {
        catalog = {icons,savedAt:Date.now()};
        ctx.storage.setJSON(cache,catalog);
      }
    }
    if (!Array.isArray(catalog?.icons)) return "";
    const keys = iconKeywords(name);
    let best = null;
    let bestScore = 0;
    for (const item of catalog.icons) {
      const n = normalizeIconName(item?.name);
      const u = item?.url || item?.icon || "";
      if (!n || !u) continue;
      let score = 0;
      for (const key of keys) {
        if (n === key) score = Math.max(score,100);
        else if (n.includes(key) || key.includes(n)) score = Math.max(score,60+Math.min(key.length,n.length));
      }
      if (score > bestScore) { bestScore=score; best=u; }
    }
    return bestScore >= 62 ? best : "";
  }

  function qureCandidate(name) {
    const s = String(name || "").toLowerCase();
    const rules = [
      [/flower|花|樱|桜|桃/,"Flower.png"],
      [/cat|猫|喵|meow/,"Cat.png"],
      [/panda|熊猫/,"Panda.png"],
      [/cloud|云/,"Cloud.png"],
      [/rocket|火箭|飞船|航天|太空/,"Rocket.png"],
      [/air|机场|航空|flight|airport/,"Airport.png"],
      [/speed|高速|极速|快/,"Speedtest.png"],
      [/star|星|银河/,"Star.png"],
      [/world|global|环球|世界/,"Global.png"]
    ];
    const file = rules.find(([re])=>re.test(s))?.[1];
    return file ? `${QURE_BASE}/${file}` : "";
  }

  async function iconFor(name, slug, accent) {
    const custom = String(slug || "").trim();
    if (/^https?:\/\//i.test(custom)) return custom;

    const cacheKey = `chance_prism_resolved_icon_${normalizeIconName(name)}_${normalizeIconName(custom)}`;
    const cached = ctx.storage.getJSON(cacheKey);
    if (cached?.url) return cached.url;

    let url = await resolveFromCatalog(LIGE_CATALOG_URL, custom || name);
    if (!url && FMZ_CATALOG_URL) url = await resolveFromCatalog(FMZ_CATALOG_URL, custom || name);
    if (!url) url = qureCandidate(custom || name);

    if (url) {
      ctx.storage.setJSON(cacheKey,{url,savedAt:Date.now()});
      return url;
    }
    return fallbackLogo(name,accent);
  }

  function collectConfigs() {
    const list = [];
    const firstUrl = env.SUB_URL || env.URL || "";
    if (firstUrl) {
      list.push({
        url: firstUrl,
        name: env.SUB_NAME || env.AIRPORT_NAME || env.NAME || "",
        slug: env.ICON_SLUG || "",
      });
    }

    for (let i = 1; i <= 8; i++) {
      const url = env[`SUB_URL${i}`];
      if (!url) continue;
      list.push({
        url,
        name: env[`SUB_NAME${i}`] || "",
        slug: env[`ICON_SLUG${i}`] || "",
      });
    }

    // De-duplicate exact URLs.
    const seen = new Set();
    return list.filter(item => {
      const key = String(item.url).trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      item.url = key;
      return true;
    });
  }

  async function fetchSubscription(config, index) {
    const cacheId = `${cacheKey}_${index}_${base64Utf8(config.url).slice(0, 16)}`;
    const cached = ctx.storage.getJSON(cacheId);

    try {
      const response = await ctx.http.get(config.url, {
        headers: {
          "User-Agent": env.USER_AGENT || "Quantumult X",
          "Accept": "*/*",
        },
        timeout: 15000,
      });

      const raw = getHeader(response.headers, "subscription-userinfo");
      if (!raw) throw new Error("缺少 subscription-userinfo");

      const info = parseUserInfo(raw);
      const upload = Number(info.upload || 0);
      const download = Number(info.download || 0);
      const used = upload + download;
      const total = Number(info.total || 0);
      const remaining = Math.max(0, total - used);
      const percent = total > 0 ? Math.max(0, Math.min(100, remaining / total * 100)) : 0;
      const name = inferName(config.name, config.url, response.headers);
      const slug = inferIconSlug(name, config.slug);

      const result = {
        name,
        slug,
        upload,
        download,
        used,
        total,
        remaining,
        percent,
        expire: Number(info.expire || 0),
        stale: false,
        savedAt: Date.now(),
      };
      ctx.storage.setJSON(cacheId, result);
      return result;
    } catch {
      if (cached) return { ...cached, stale: true };
      const name = inferName(config.name, config.url, null);
      return {
        name,
        slug: inferIconSlug(name, config.slug),
        upload: 0,
        download: 0,
        used: 0,
        total: 0,
        remaining: 0,
        percent: 0,
        expire: 0,
        stale: true,
        savedAt: 0,
      };
    }
  }

  function accentAt(index, percent) {
    if (percent <= 10) return C.red;
    if (percent <= 25) return C.amber;
    return [C.green, C.cyan, C.blue, C.violet][index % 4];
  }

  function ringSvg(percent, iconData, accent, size = 92) {
    const safe = Math.max(0, Math.min(100, Number(percent) || 0));
    const r = 36;
    const circumference = 2 * Math.PI * r;
    const dash = circumference * safe / 100;
    const iconHref = esc(iconData);
    return svgData(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 96 96">
      <defs>
        <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2.6" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <clipPath id="clip"><circle cx="48" cy="48" r="23"/></clipPath>
      </defs>
      <circle cx="48" cy="48" r="${r}" fill="none" stroke="#FFFFFF" stroke-opacity=".12" stroke-width="8"/>
      <circle cx="48" cy="48" r="${r}" fill="none" stroke="${accent}" stroke-width="8" stroke-linecap="round"
        stroke-dasharray="${dash} ${circumference-dash}" transform="rotate(-90 48 48)" filter="url(#glow)"/>
      <circle cx="48" cy="48" r="25" fill="#FFFFFF" fill-opacity=".055" stroke="#FFFFFF" stroke-opacity=".08"/>
      <image href="${iconHref}" x="28" y="28" width="40" height="40" preserveAspectRatio="xMidYMid meet" clip-path="url(#clip)"/>
    </svg>`);
  }

  const Text = (text, size, weight = "regular", color = C.text, extra = {}) => ({
    type: "text",
    text: String(text),
    font: { size, weight },
    textColor: color,
    maxLines: 1,
    minScale: 0.45,
    ...extra,
  });

  const Divider = () => ({
    type: "stack",
    height: 1,
    backgroundColor: { light: "#D7D9DE", dark: "#343944" },
    children: [],
  });

  const configs = collectConfigs();
  if (!configs.length) {
    return {
      type: "widget",
      refreshAfter,
      padding: 14,
      gap: 8,
      backgroundGradient: {
        type: "linear",
        colors: [
          { light: "#F5F5F2", dark: "#16181D" },
          { light: "#E9ECF2", dark: "#20242C" },
        ],
        startPoint: { x: 0, y: 0 },
        endPoint: { x: 1, y: 1 },
      },
      children: [
        Text("AIRPORT STATUS", 11, "semibold", C.sub),
        { type: "spacer" },
        Text("未配置订阅", 18, "bold", C.text, { textAlign: "center" }),
        Text("请填写 SUB_URL 或 SUB_URL1", 11, "medium", C.sub, { textAlign: "center", maxLines: 2 }),
        { type: "spacer" },
      ],
    };
  }

  const data = await Promise.all(configs.map(fetchSubscription));
  const enriched = await Promise.all(data.map(async (item, index) => {
    const accent = accentAt(index, item.percent);
    return {
      ...item,
      accent,
      icon: await iconFor(item.name, item.slug, accent),
    };
  }));

  if (family === "accessoryInline") {
    const item = enriched[0];
    return {
      type: "widget",
      refreshAfter,
      children: [
        Text(`${item.name} · 剩余 ${bytesText(item.remaining)} · ${Math.round(item.percent)}%`, "caption1", "semibold"),
      ],
    };
  }

  if (family === "accessoryCircular") {
    const item = enriched[0];
    return {
      type: "widget",
      refreshAfter,
      padding: 1,
      children: [{
        type: "image",
        src: ringSvg(item.percent, item.icon, item.accent, 90),
        width: 90,
        height: 90,
        resizeMode: "contain",
      }],
    };
  }

  if (family === "accessoryRectangular") {
    const item = enriched[0];
    return {
      type: "widget",
      refreshAfter,
      gap: 3,
      children: [
        {
          type: "stack",
          direction: "row",
          alignItems: "center",
          gap: 7,
          children: [
            { type: "image", src: ringSvg(item.percent, item.icon, item.accent, 44), width: 44, height: 44 },
            {
              type: "stack",
              direction: "column",
              flex: 1,
              gap: 1,
              children: [
                Text(item.name, "caption1", "bold"),
                Text(`剩余 ${bytesText(item.remaining)}`, "headline", "bold"),
                Text(expiryText(item.expire), "caption2", "medium", C.sub),
              ],
            },
          ],
        },
      ],
    };
  }

  function circleCell(item, index, layout) {
    const ringSize = layout.ring;
    return {
      type: "stack",
      direction: "column",
      alignItems: "center",
      flex: 1,
      gap: layout.gap,
      children: [
        {
          type: "image",
          src: ringSvg(item.percent, item.icon, item.accent, ringSize),
          width: ringSize,
          height: ringSize,
          resizeMode: "contain",
        },
        Text(`${Math.round(item.percent)}%`, layout.percent, "medium", C.text, { textAlign: "center" }),
        ...(layout.showName ? [
          Text(item.name, layout.name, "semibold", C.sub, { textAlign: "center" }),
        ] : []),
      ],
    };
  }

  if (family === "systemSmall") {
    const item = enriched[0];
    return {
      type: "widget",
      refreshAfter,
      padding: [13, 12, 12, 12],
      gap: 4,
      backgroundGradient: {
        type: "radial",
        colors: [
          { light: "#FFFFFF", dark: "#242933" },
          { light: "#ECEEF3", dark: "#17191E" },
        ],
        stops: [0, 1],
        center: { x: 0.5, y: 0.34 },
        startRadius: 2,
        endRadius: 150,
      },
      children: [
        {
          type: "stack",
          direction: "row",
          alignItems: "center",
          children: [
            Text(item.name, 12, "bold"),
            { type: "spacer" },
            item.stale ? Text("CACHE", 9, "semibold", C.sub) : Text("LIVE", 9, "semibold", item.accent),
          ],
        },
        { type: "spacer" },
        {
          type: "image",
          src: ringSvg(item.percent, item.icon, item.accent, 104),
          width: 104,
          height: 104,
          resizeMode: "contain",
        },
        Text(`${Math.round(item.percent)}%`, 25, "medium", C.text, { textAlign: "center" }),
        Text(`剩余 ${bytesText(item.remaining)}`, 10, "medium", C.sub, { textAlign: "center" }),
      ],
    };
  }

  if (family === "systemMedium") {
    const visible = enriched.slice(0, 4);
    return {
      type: "widget",
      refreshAfter,
      padding: [15, 16, 12, 16],
      gap: 7,
      backgroundGradient: {
        type: "linear",
        colors: [
          { light: "#F8F8F6", dark: "#17191E" },
          { light: "#E8EAF0", dark: "#242832" },
        ],
        startPoint: { x: 0, y: 0 },
        endPoint: { x: 1, y: 1 },
      },
      children: [
        {
          type: "stack",
          direction: "row",
          alignItems: "center",
          children: [
            Text("订阅状态", 12, "bold"),
            { type: "spacer" },
            Text(`${visible.length} 个机场`, 10, "medium", C.sub),
          ],
        },
        { type: "spacer", length: 2 },
        {
          type: "stack",
          direction: "row",
          alignItems: "center",
          gap: 6,
          flex: 1,
          children: visible.map((item, index) =>
            circleCell(item, index, { ring: 74, gap: 2, percent: 17, name: 9, showName: true })
          ),
        },
      ],
    };
  }

  const visible = enriched.slice(0, family === "systemExtraLarge" ? 8 : 6);
  const columns = family === "systemExtraLarge" ? 4 : 3;
  const rows = [];
  for (let i = 0; i < visible.length; i += columns) {
    rows.push(visible.slice(i, i + columns));
  }

  return {
    type: "widget",
    refreshAfter,
    padding: [16, 17, 15, 17],
    gap: 10,
    backgroundGradient: {
      type: "linear",
      colors: [
        { light: "#F8F8F5", dark: "#16181D" },
        { light: "#E7EAF0", dark: "#252A34" },
      ],
      startPoint: { x: 0, y: 0 },
      endPoint: { x: 1, y: 1 },
    },
    children: [
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        children: [
          Text("AIRPORT MATRIX", 12, "bold"),
          { type: "spacer" },
          Text(`${visible.length} ACTIVE`, 10, "semibold", C.sub),
        ],
      },
      Divider(),
      ...rows.flatMap((row, rowIndex) => [
        {
          type: "stack",
          direction: "row",
          alignItems: "center",
          gap: 12,
          flex: 1,
          children: row.map((item, index) =>
            circleCell(item, rowIndex * columns + index, {
              ring: family === "systemExtraLarge" ? 88 : 82,
              gap: 3,
              percent: 18,
              name: 10,
              showName: true,
            })
          ),
        },
        ...(rowIndex < rows.length - 1 ? [Divider()] : []),
      ]),
      Divider(),
      {
        type: "stack",
        direction: "row",
        gap: 12,
        children: visible.slice(0, 3).map(item => ({
          type: "stack",
          direction: "column",
          flex: 1,
          gap: 2,
          children: [
            Text(item.name, 10, "semibold", C.sub),
            Text(`剩余 ${bytesText(item.remaining)}`, 13, "bold"),
            Text(expiryText(item.expire), 9, "medium", C.sub),
          ],
        })),
      },
    ],
  };
}
