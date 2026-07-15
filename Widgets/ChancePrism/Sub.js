// 机场订阅小组件（Egern 严格 DSL 版 / iOS 电量组件单圆环风格）
// 环境变量：NAME1/URL1/RESET1/ICON1 ... NAME8/URL8/RESET8/ICON8
// 图标逻辑：优先按 NAME 从 ICONS_JSON 自动匹配；未匹配时回退 ICONn；仍失败则显示名称缩写
// ICONS_JSON 可选，默认：https://velvetcodeloom.github.io/icloud/icons.json
// 设计更新时间：2026-07-08
// 作者：chance
// 分类：信息展示 / 订阅流量 Widget

const DEFAULT_ICONS_JSON = "https://velvetcodeloom.github.io/icloud/icons.json";
const MAX = 8;
const REFRESH_MS = 60 * 60 * 1000;

export default async function (ctx) {
  const family = ctx.widgetFamily || "systemMedium";
  const slots = readSlots(ctx);
  const refreshAfter = new Date(Date.now() + REFRESH_MS).toISOString();

  if (!slots.length) return buildEmptyWidget(refreshAfter);

  const visibleSlots = slots.slice(0, getDisplayLimit(family, slots.length));
  const catalog = await loadIconCatalog(ctx);

  const results = await Promise.all(
    visibleSlots.map(async (slot) => {
      const [info, icon] = await Promise.all([
        fetchInfo(ctx, slot),
        resolveSlotIcon(ctx, slot, catalog),
      ]);
      return { ...info, icon };
    })
  );

  if (family === "systemLarge" || family === "systemExtraLarge") {
    return buildLargeWidget(results, refreshAfter);
  }

  return buildRingWidget(results, family, refreshAfter);
}

function readSlots(ctx) {
  const slots = [];
  for (let i = 1; i <= MAX; i++) {
    const url = trim(ctx.env[`URL${i}`]);
    if (!url) continue;
    slots.push({
      index: i,
      name: trim(ctx.env[`NAME${i}`]) || inferName(url),
      url,
      resetDay: parseResetDay(ctx.env[`RESET${i}`]),
      manualIcon: trim(ctx.env[`ICON${i}`]),
    });
  }
  return slots;
}

function getDisplayLimit(family, count) {
  if (family === "systemSmall") return Math.min(count, 1);
  if (family === "systemMedium") return Math.min(count, 4);
  if (family === "systemLarge") return Math.min(count, 4);
  if (family === "systemExtraLarge") return Math.min(count, 6);
  return Math.min(count, 1);
}

function buildEmptyWidget(refreshAfter) {
  return {
    type: "widget",
    padding: 14,
    gap: 8,
    refreshAfter,
    backgroundColor: "#00000000",
    children: [
      {
        type: "text",
        text: "机场订阅",
        font: { size: "headline", weight: "semibold" },
        textColor: adaptive("#1C1C1E", "#F2F2F7"),
      },
      {
        type: "text",
        text: "请配置 URL1\n可选：NAME1 / RESET1 / ICON1",
        font: { size: "caption1", weight: "medium" },
        textColor: adaptive("#636366", "#AEAEB2"),
        maxLines: 3,
        minScale: 0.8,
      },
    ],
  };
}

function buildRingWidget(items, family, refreshAfter) {
  const small = family === "systemSmall";
  const count = items.length;

  const ringSize = small
    ? 104
    : count === 1
      ? 110
      : count === 2
        ? 92
        : count === 3
          ? 80
          : 68;

  const percentFont = small
    ? 30
    : count === 1
      ? 28
      : count === 2
        ? 24
        : count === 3
          ? 21
          : 18;

  const cells = items.map((item) =>
    buildBatteryCell(item, ringSize, percentFont, small)
  );

  return {
    type: "widget",
    padding: small ? [10, 8, 8, 8] : [12, 10, 9, 10],
    gap: 0,
    refreshAfter,
    backgroundColor: "#00000000",
    children: small
      ? [
          { type: "spacer" },
          {
            type: "stack",
            direction: "row",
            alignItems: "center",
            children: [
              { type: "spacer" },
              cells[0],
              { type: "spacer" },
            ],
          },
          { type: "spacer" },
        ]
      : [
          { type: "spacer" },
          {
            type: "stack",
            direction: "row",
            alignItems: "center",
            gap: count === 4 ? 4 : count === 3 ? 7 : 12,
            children: cells,
          },
          { type: "spacer" },
        ],
  };
}

function buildBatteryCell(item, ringSize, percentFont, small) {
  const remaining = getRemainingPercent(item);

  const cell = {
    type: "stack",
    direction: "column",
    alignItems: "center",
    gap: small ? 5 : 6,
    children: [
      {
        type: "image",
        src: buildRingSvg(item, ringSize),
        width: ringSize,
        height: ringSize,
        resizeMode: "contain",
      },
      {
        type: "text",
        text: item.error ? "—" : formatPercent(remaining),
        font: { size: percentFont, weight: "regular" },
        textColor: item.error ? tertiaryText() : primaryText(),
        textAlign: "center",
        maxLines: 1,
        minScale: 0.75,
      },
    ],
  };

  if (!small) cell.flex = 1;
  return cell;
}

function buildRingSvg(item, size) {
  const remaining = item.error ? 0 : getRemainingPercent(item);
  const progressColor = getRingColor(remaining, item.error);
  const trackColor = "#8E8E9352";
  const strokeWidth = size >= 100 ? 10 : size >= 80 ? 9 : 8;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const iconBox = Math.round(size * 0.46);
  const iconX = Math.round((size - iconBox) / 2);
  const iconY = iconX;

  let centerContent;

  if (item.icon) {
    centerContent = `<image href="${escapeXml(item.icon)}" x="${iconX}" y="${iconY}" width="${iconBox}" height="${iconBox}" preserveAspectRatio="xMidYMid meet" />`;
  } else {
    const initials = escapeXml(getInitials(item.name));
    const fontSize = Math.max(13, Math.round(size * 0.23));
    centerContent = `<text x="50%" y="52%" text-anchor="middle" dominant-baseline="middle" font-family="-apple-system,BlinkMacSystemFont,sans-serif" font-size="${fontSize}" font-weight="700" fill="${progressColor}">${initials}</text>`;
  }

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="${trackColor}" stroke-width="${strokeWidth}" />
  <circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="${progressColor}" stroke-width="${strokeWidth}" stroke-linecap="round" pathLength="100" stroke-dasharray="${remaining} ${100 - remaining}" transform="rotate(-90 ${center} ${center})" />
  ${centerContent}
</svg>`.trim();

  return `data:image/svg+xml;base64,${utf8ToBase64(svg)}`;
}

function getRingColor(remaining, error) {
  if (error) return "#8E8E93";
  if (remaining <= 10) return "#FF453A";
  if (remaining <= 20) return "#FFD60A";
  return "#30D158";
}

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildLargeWidget(items, refreshAfter) {
  return {
    type: "widget",
    padding: [12, 14, 12, 14],
    gap: items.length >= 4 ? 7 : 10,
    refreshAfter,
    backgroundColor: "#00000000",
    children: items.map((item, index) => buildLargeRow(item, index, items.length)),
  };
}

function buildLargeRow(item, index, total) {
  const remaining = getRemainingPercent(item);
  const tone = getRemainingTone(remaining);
  const meta = getMetaText(item);

  const children = [
    {
      type: "stack",
      direction: "row",
      alignItems: "center",
      gap: 10,
      children: [
        buildIdentity(item, 38, false, tone),
        {
          type: "stack",
          direction: "column",
          flex: 1,
          gap: 5,
          children: [
            {
              type: "stack",
              direction: "row",
              alignItems: "center",
              gap: 8,
              children: [
                {
                  type: "text",
                  text: item.name,
                  flex: 1,
                  font: { size: "subheadline", weight: "bold" },
                  textColor: primaryText(),
                  maxLines: 1,
                  minScale: 0.66,
                },
                {
                  type: "text",
                  text: item.error
                    ? "获取失败"
                    : `${bytesToSize(item.remainingBytes)} 剩余`,
                  font: { size: "caption1", weight: "semibold" },
                  textColor: item.error ? tertiaryText() : tone.color,
                  maxLines: 1,
                  minScale: 0.7,
                },
                {
                  type: "text",
                  text: meta.text,
                  font: { size: "caption2", weight: "medium" },
                  textColor: meta.color,
                  maxLines: 1,
                  minScale: 0.65,
                },
              ],
            },
            buildRemainingBar(item, tone),
            {
              type: "stack",
              direction: "row",
              alignItems: "center",
              children: [
                {
                  type: "text",
                  text: item.error
                    ? "—"
                    : `已用 ${bytesToSize(item.used)} / 总量 ${bytesToSize(item.totalBytes)}`,
                  flex: 1,
                  font: { size: "caption2", weight: "medium" },
                  textColor: secondaryText(),
                  maxLines: 1,
                  minScale: 0.68,
                },
                {
                  type: "text",
                  text: item.error ? "" : `剩余 ${formatPercent(remaining)}`,
                  font: { size: "caption2", weight: "bold" },
                  textColor: item.error ? tertiaryText() : tone.color,
                },
              ],
            },
          ],
        },
      ],
    },
  ];

  if (index !== total - 1) children.push(buildDivider());

  return {
    type: "stack",
    direction: "column",
    gap: 7,
    children,
  };
}

function buildRemainingBar(item, tone) {
  const remaining = item.error ? 0 : getRemainingPercent(item);
  const filled = Math.max(0.0001, remaining);
  const empty = Math.max(0.0001, 100 - remaining);

  return {
    type: "stack",
    direction: "row",
    height: 7,
    children: [
      {
        type: "stack",
        flex: filled,
        height: 7,
        borderRadius: 999,
        backgroundGradient: {
          type: "linear",
          colors: tone.barColors,
          stops: [0, 1],
          startPoint: { x: 0, y: 0 },
          endPoint: { x: 1, y: 0 },
        },
        children: [],
      },
      {
        type: "stack",
        flex: empty,
        height: 7,
        borderRadius: 999,
        backgroundColor: trackColor(),
        children: [],
      },
    ],
  };
}

function buildDivider() {
  return {
    type: "stack",
    height: 1,
    backgroundColor: adaptive("#8E8E9326", "#8E8E9338"),
    children: [],
  };
}

function buildIdentity(item, size, circular, tone) {
  if (item.icon) {
    return {
      type: "image",
      src: item.icon,
      width: size,
      height: size,
      resizeMode: "cover",
      borderRadius: circular ? 999 : Math.round(size * 0.24),
    };
  }

  const initials = getInitials(item.name);
  return {
    type: "stack",
    width: size,
    height: size,
    borderRadius: circular ? 999 : Math.round(size * 0.24),
    alignItems: "center",
    backgroundColor: tone.softColor,
    children: [
      { type: "spacer" },
      {
        type: "text",
        text: initials,
        font: { size: Math.max(11, Math.round(size * 0.38)), weight: "bold" },
        textColor: tone.color,
        maxLines: 1,
        minScale: 0.6,
      },
      { type: "spacer" },
    ],
  };
}

function centeredRow(child) {
  return {
    type: "stack",
    direction: "row",
    alignItems: "center",
    children: [{ type: "spacer" }, child, { type: "spacer" }],
  };
}

async function loadIconCatalog(ctx) {
  const url = trim(ctx.env.ICONS_JSON) || DEFAULT_ICONS_JSON;
  const cacheKey = `airport-icons-json:${url}`;

  try {
    const response = await ctx.http.get(url, {
      timeout: 15000,
      redirect: "follow",
      credentials: "omit",
    });
    const json = await response.json();
    try {
      ctx.storage.set(cacheKey, JSON.stringify(json));
    } catch (e) {}
    return normalizeIconCatalog(json, url);
  } catch (e) {
    try {
      const cached = ctx.storage.get(cacheKey);
      if (cached) return normalizeIconCatalog(JSON.parse(cached), url);
    } catch (e2) {}
    return [];
  }
}

async function resolveSlotIcon(ctx, slot, catalog) {
  const matched = findBestIcon(slot.name, catalog);
  if (matched) {
    const source = await resolveImageSource(ctx, matched.src);
    if (source) return source;
  }

  if (slot.manualIcon) {
    const source = await resolveImageSource(ctx, slot.manualIcon);
    if (source) return source;
  }

  return null;
}

function normalizeIconCatalog(raw, baseUrl) {
  const entries = [];
  collectIconEntries(raw, [], entries, 0, baseUrl);

  const unique = [];
  const seen = new Set();
  for (const entry of entries) {
    const name = trim(entry.name);
    const src = trim(entry.src);
    if (!name || !src) continue;
    const key = `${normalizeName(name)}|${src}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({ name, src });
  }
  return unique;
}

function collectIconEntries(value, trail, out, depth, baseUrl) {
  if (depth > 7 || value == null) return;

  if (typeof value === "string") {
    if (looksLikeImageSource(value) && trail.length) {
      out.push({ name: trail[trail.length - 1], src: resolveRelativeUrl(value, baseUrl) });
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) collectIconEntries(item, trail, out, depth + 1, baseUrl);
    return;
  }

  if (typeof value !== "object") return;

  const src = pickFirstString(value, [
    "icon", "iconUrl", "iconURL", "icon_url", "src", "image", "imageUrl", "imageURL", "url", "download_url",
  ]);

  const names = [];
  for (const key of ["name", "title", "label", "airport", "provider", "displayName", "key", "id"]) {
    if (typeof value[key] === "string" && value[key].trim()) names.push(value[key].trim());
  }
  for (const key of ["alias", "aliases", "keywords"]) {
    const v = value[key];
    if (typeof v === "string") names.push(v);
    else if (Array.isArray(v)) names.push(...v.filter((x) => typeof x === "string"));
  }

  if (src && looksLikeImageSource(src)) {
    const finalNames = names.length ? names : trail.length ? [trail[trail.length - 1]] : [];
    for (const name of finalNames) {
      out.push({ name, src: resolveRelativeUrl(src, baseUrl) });
    }
  }

  for (const [key, child] of Object.entries(value)) {
    if (typeof child === "string" && looksLikeImageSource(child)) {
      out.push({ name: key, src: resolveRelativeUrl(child, baseUrl) });
    } else if (child && typeof child === "object") {
      collectIconEntries(child, trail.concat(key), out, depth + 1, baseUrl);
    }
  }
}

function findBestIcon(name, catalog) {
  const target = normalizeName(name);
  if (!target || !catalog.length) return null;

  let best = null;
  let bestScore = 0;

  for (const entry of catalog) {
    const candidate = normalizeName(entry.name);
    if (!candidate) continue;

    let score = 0;
    if (candidate === target) {
      score = 1000;
    } else if (candidate.length >= 3 && target.includes(candidate)) {
      score = 700 + candidate.length;
    } else if (target.length >= 3 && candidate.includes(target)) {
      score = 650 + target.length;
    } else {
      const a = stripGenericWords(target);
      const b = stripGenericWords(candidate);
      if (a && b && a === b) score = 900;
      else if (a.length >= 3 && b.length >= 3 && (a.includes(b) || b.includes(a))) {
        score = 500 + Math.min(a.length, b.length);
      }
    }

    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }

  return bestScore >= 500 ? best : null;
}

async function resolveImageSource(ctx, source) {
  const value = trim(source);
  if (!value) return null;
  if (value.startsWith("data:") || value.startsWith("sf-symbol:")) return value;
  if (!/^https?:\/\//i.test(value)) return null;

  const cacheKey = `airport-icon-data:${value}`;
  try {
    const cached = ctx.storage.get(cacheKey);
    if (cached && cached.startsWith("data:")) return cached;
  } catch (e) {}

  try {
    const response = await ctx.http.get(value, {
      timeout: 15000,
      redirect: "follow",
      credentials: "omit",
    });
    const buffer = await response.arrayBuffer();
    const mime = normalizeMime(response.headers.get("content-type"), value);
    const dataUri = `data:${mime};base64,${arrayBufferToBase64(buffer)}`;
    try {
      ctx.storage.set(cacheKey, dataUri);
    } catch (e) {}
    return dataUri;
  } catch (e) {
    return null;
  }
}

function utf8ToBase64(value) {
  const bytes = [];
  const text = unescape(encodeURIComponent(String(value)));

  for (let i = 0; i < text.length; i++) {
    bytes.push(text.charCodeAt(i));
  }

  return bytesToBase64(bytes);
}

function bytesToBase64(bytes) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
    "abcdefghijklmnopqrstuvwxyz" +
    "0123456789+/";

  let output = "";

  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triple = (a << 16) | (b << 8) | c;

    output += chars[(triple >> 18) & 63];
    output += chars[(triple >> 12) & 63];
    output += i + 1 < bytes.length ? chars[(triple >> 6) & 63] : "=";
    output += i + 2 < bytes.length ? chars[triple & 63] : "=";
  }

  return output;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";

  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triple = (a << 16) | (b << 8) | c;

    output += chars[(triple >> 18) & 63];
    output += chars[(triple >> 12) & 63];
    output += i + 1 < bytes.length ? chars[(triple >> 6) & 63] : "=";
    output += i + 2 < bytes.length ? chars[triple & 63] : "=";
  }

  return output;
}

function normalizeMime(contentType, url) {
  const mime = trim(contentType).split(";")[0].toLowerCase();
  if (mime.startsWith("image/")) return mime;
  if (/\.svg(?:\?|#|$)/i.test(url)) return "image/svg+xml";
  if (/\.webp(?:\?|#|$)/i.test(url)) return "image/webp";
  if (/\.jpe?g(?:\?|#|$)/i.test(url)) return "image/jpeg";
  if (/\.gif(?:\?|#|$)/i.test(url)) return "image/gif";
  return "image/png";
}

function looksLikeImageSource(value) {
  const v = trim(value);
  return /^(?:https?:\/\/|data:image\/|sf-symbol:)/i.test(v) || /\.(?:png|jpe?g|webp|gif|svg)(?:\?|#|$)/i.test(v);
}

function resolveRelativeUrl(value, baseUrl) {
  const v = trim(value);
  if (!v || /^(?:https?:\/\/|data:|sf-symbol:)/i.test(v)) return v;

  const originMatch = String(baseUrl).match(/^(https?:\/\/[^/]+)/i);
  if (v.startsWith("/") && originMatch) return originMatch[1] + v;

  const base = String(baseUrl).replace(/[^/]*(?:\?.*)?$/, "");
  return base + v.replace(/^\.\//, "");
}

function pickFirstString(object, keys) {
  for (const key of keys) {
    if (typeof object[key] === "string" && object[key].trim()) return object[key].trim();
  }
  return "";
}

async function fetchInfo(ctx, slot) {
  const urls = buildVariants(slot.url);
  const methods = ["head", "get"];

  for (const method of methods) {
    for (const url of urls) {
      for (const headers of UA_LIST) {
        try {
          const response = await ctx.http[method](url, {
            headers,
            timeout: 12000,
            redirect: "follow",
            credentials: "omit",
          });

          const raw = response.headers.get("subscription-userinfo") || "";
          const info = parseUserInfo(raw);
          if (!info) continue;

          const used = (info.upload || 0) + (info.download || 0);
          const totalBytes = info.total || 0;
          const remainingBytes = Math.max(0, totalBytes - used);

          return {
            name: slot.name,
            error: false,
            used,
            totalBytes,
            remainingBytes,
            expire: info.expire || null,
            remainDays: slot.resetDay ? getRemainingDays(slot.resetDay) : null,
          };
        } catch (e) {}
      }
    }
  }

  return {
    name: slot.name,
    error: true,
    used: 0,
    totalBytes: 0,
    remainingBytes: 0,
    expire: null,
    remainDays: slot.resetDay ? getRemainingDays(slot.resetDay) : null,
  };
}

const UA_LIST = [
  { "User-Agent": "Quantumult X" },
  { "User-Agent": "clash-verge-rev/2.3.1", Accept: "application/x-yaml,text/plain,*/*" },
  { "User-Agent": "mihomo/1.19.3", Accept: "application/x-yaml,text/plain,*/*" },
];

function buildVariants(url) {
  const list = [];
  const seen = new Set();

  function add(value) {
    if (!value || seen.has(value)) return;
    seen.add(value);
    list.push(value);
  }

  add(url);
  add(withParam(url, "flag", "clash"));
  add(withParam(url, "flag", "meta"));
  add(withParam(url, "target", "clash"));
  return list;
}

function withParam(url, key, value) {
  return `${url}${url.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(value)}`;
}

function parseUserInfo(header) {
  if (!header) return null;
  const pairs = header.match(/\w+=[\d.eE+-]+/g) || [];
  if (!pairs.length) return null;

  const result = {};
  for (const pair of pairs) {
    const parts = pair.split("=");
    result[parts[0]] = Number(parts[1]);
  }
  return result;
}

function getRemainingPercent(item) {
  if (!item || item.error || item.totalBytes <= 0) return 0;
  return clamp((item.remainingBytes / item.totalBytes) * 100, 0, 100);
}

function getRemainingTone(remaining) {
  if (remaining <= 10) {
    return {
      color: adaptive("#FF3B30", "#FF453A"),
      softColor: adaptive("#FF3B3020", "#FF453A30"),
      barColors: [adaptive("#FF6961", "#FF6961"), adaptive("#FF3B30", "#FF453A")],
    };
  }

  if (remaining <= 20) {
    return {
      color: adaptive("#FF9F0A", "#FFD60A"),
      softColor: adaptive("#FF9F0A20", "#FFD60A28"),
      barColors: [adaptive("#FFC34D", "#FFE06B"), adaptive("#FF9F0A", "#FFD60A")],
    };
  }

  return {
    color: adaptive("#34C759", "#30D158"),
    softColor: adaptive("#34C75920", "#30D15828"),
    barColors: [adaptive("#63D879", "#5DE06F"), adaptive("#34C759", "#30D158")],
  };
}

function getMetaText(item) {
  if (item.expire) {
    const daysLeft = Math.ceil((normalizeExpire(item.expire) - Date.now()) / 86400000);
    if (daysLeft < 0) return { text: "已到期", color: tertiaryText() };
    if (daysLeft <= 7) {
      return { text: `${daysLeft}天到期`, color: adaptive("#FF9F0A", "#FFD60A") };
    }
    return { text: formatDate(item.expire), color: tertiaryText() };
  }

  if (item.remainDays !== null) {
    return {
      text: `${item.remainDays}天重置`,
      color: item.remainDays <= 3 ? adaptive("#FF9F0A", "#FFD60A") : tertiaryText(),
    };
  }

  return { text: "", color: tertiaryText() };
}

function getInitials(name) {
  const clean = String(name || "").trim();
  if (!clean) return "?";

  const latin = clean.match(/[A-Za-z0-9]+/g);
  if (latin && latin.length >= 2) return (latin[0][0] + latin[1][0]).toUpperCase();
  if (latin && latin.length === 1) return latin[0].slice(0, 2).toUpperCase();

  const chars = Array.from(clean.replace(/[\s\p{P}\p{S}]/gu, ""));
  return chars.slice(0, 2).join("") || "?";
}

function normalizeName(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function stripGenericWords(value) {
  return String(value || "")
    .replace(/(?:机场|订阅|加速器|网络|vpn|proxy|network|cloud|service|services)/gi, "")
    .trim();
}

function adaptive(light, dark) {
  return { light, dark };
}

function primaryText() {
  return adaptive("#1C1C1E", "#F2F2F7");
}

function secondaryText() {
  return adaptive("#636366", "#AEAEB2");
}

function tertiaryText() {
  return adaptive("#8E8E93", "#8E8E93");
}

function trackColor() {
  return adaptive("#78788029", "#EBEBF52E");
}

function bytesToSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const power = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, power);
  const digits = power === 0 ? 0 : value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${units[power]}`;
}

function formatPercent(value) {
  return `${value >= 99.95 ? "100" : value.toFixed(value >= 10 ? 0 : 1)}%`;
}

function formatDate(ts) {
  const date = new Date(normalizeExpire(ts));
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function normalizeExpire(ts) {
  return ts > 1e12 ? ts : ts * 1000;
}

function getRemainingDays(resetDay) {
  const now = new Date();
  let next = new Date(now.getFullYear(), now.getMonth(), resetDay);
  if (now.getDate() >= resetDay) {
    next = new Date(now.getFullYear(), now.getMonth() + 1, resetDay);
  }
  return Math.max(0, Math.ceil((next - now) / 86400000));
}

function parseResetDay(value) {
  const n = parseInt(value || "", 10);
  if (!Number.isFinite(n) || n < 1 || n > 31) return null;
  return n;
}

function inferName(url) {
  const matched = String(url).match(/^https?:\/\/([^/?#]+)/i);
  return matched ? matched[1] : "未命名机场";
}

function trim(value) {
  return String(value || "").trim();
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function pad2(value) {
  return String(value).padStart(2, "0");
}