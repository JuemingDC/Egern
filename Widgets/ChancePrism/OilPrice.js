/*
 * name: 今日油价
 * author: chance
 * category: 生活信息 / 油价
 * converted: 2026-07-15
 * target: Egern
 * version: 1.3.0
 *
 * 设计说明：
 * - 删除“调价日、调价倒计时、调价窗口”等未经稳定数据源确认的信息。
 * - systemLarge 删除重复的默认油号大卡片。
 * - 四种油价采用等高纵向列表并按比例放大，底部保留本轮调整。
 * - 数据范围改为城市级，默认城市为昆明，可通过 CITY 环境变量切换。
 * - systemMedium、systemSmall 与锁屏布局保持不变。
 *
 * 环境变量：
 * CITY=昆明
 * DEFAULT_GRADE=95
 * PRICE_92=7.58
 * PRICE_95=8.12
 * PRICE_98=8.76
 * PRICE_0=7.18
 * CHANGE=0.15
 * HISTORY_92=7.50|7.52|7.55|7.58
 * HISTORY_95=8.02|8.05|8.08|8.12
 * HISTORY_98=8.64|8.68|8.72|8.76
 * HISTORY_0=7.10|7.12|7.15|7.18
 * API_URL=
 *
 * API JSON 示例：
 * {
 *   "city": "昆明",
 *   "prices": {"92": 7.58, "95": 8.12, "98": 8.76, "0": 7.18},
 *   "change": 0.15,
 *   "history": {
 *     "92": [7.50, 7.52, 7.55, 7.58],
 *     "95": [8.02, 8.05, 8.08, 8.12],
 *     "98": [8.64, 8.68, 8.72, 8.76],
 *     "0":  [7.10, 7.12, 7.15, 7.18]
 *   }
 * }
 *
 * 也支持多城市结构：
 * {
 *   "cities": {
 *     "昆明": {
 *       "prices": {"92": 7.58, "95": 8.12, "98": 8.76, "0": 7.18},
 *       "change": 0.00
 *     }
 *   }
 * }
 */

export default async function (ctx) {
  const family = ctx.widgetFamily || "systemMedium";
  const env = ctx.env || {};

  const C = {
    bg: { light: "#F5F1E8", dark: "#181612" },
    card: { light: "#FFFFFFD8", dark: "#26231D" },
    soft: { light: "#EAE5DA", dark: "#312D26" },
    text: { light: "#26231F", dark: "#F5F2EC" },
    secondary: { light: "#7A746B", dark: "#B8B0A4" },
    accent: { light: "#2E7D5B", dark: "#66C49A" },
    up: { light: "#C34A3A", dark: "#FF8A7A" },
    down: { light: "#2E7D5B", dark: "#66C49A" },
    flat: { light: "#8A8176", dark: "#B8B0A4" },
    chartLine: "#2E7D5B",
    chartFill: "#2E7D5B22",
    chartGrid: "#8A817633",
    chartText: "#7A746B",
  };

  const number = (value, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };

  const string = (value, fallback = "") => {
    const s = String(value ?? "").trim();
    return s || fallback;
  };

  const parseSeries = (value) => {
    if (Array.isArray(value)) {
      return value.map(Number).filter(Number.isFinite).slice(-16);
    }
    return String(value || "")
      .split(/[|,，\s]+/)
      .map(Number)
      .filter(Number.isFinite)
      .slice(-16);
  };

  const defaultGrade = ["92", "95", "98", "0"].includes(String(env.DEFAULT_GRADE))
    ? String(env.DEFAULT_GRADE)
    : "95";

  const base = {
    city: string(env.CITY, "昆明"),
    defaultGrade,
    prices: {
      "92": number(env.PRICE_92, 7.58),
      "95": number(env.PRICE_95, 8.12),
      "98": number(env.PRICE_98, 8.76),
      "0": number(env.PRICE_0, 7.18),
    },
    history: {
      "92": parseSeries(env.HISTORY_92),
      "95": parseSeries(env.HISTORY_95),
      "98": parseSeries(env.HISTORY_98),
      "0": parseSeries(env.HISTORY_0),
    },
    change: number(env.CHANGE, 0),
    apiUrl: string(env.API_URL),
    timeout: Math.min(Math.max(number(env.TIMEOUT, 5000), 2000), 15000),
  };

  async function loadData() {
    if (!base.apiUrl) return base;

    try {
      const response = await ctx.http.get(base.apiUrl, {
        timeout: base.timeout,
        credentials: "omit",
      });

      if (!response || response.status < 200 || response.status >= 300) {
        throw new Error(`HTTP ${response?.status || 0}`);
      }

      const raw = typeof response.json === "function"
        ? await response.json()
        : JSON.parse(typeof response.body === "string" ? response.body : await response.text());

      const root = raw?.data || raw || {};
      const cityNode =
        root?.cities?.[base.city] ||
        root?.cityPrices?.[base.city] ||
        root?.[base.city] ||
        root;
      const prices = cityNode.prices || {};
      const history = cityNode.history || {};

      return {
        ...base,
        city: string(cityNode.city || root.city, base.city),
        prices: {
          "92": number(prices["92"] ?? prices.p92, base.prices["92"]),
          "95": number(prices["95"] ?? prices.p95, base.prices["95"]),
          "98": number(prices["98"] ?? prices.p98, base.prices["98"]),
          "0": number(prices["0"] ?? prices.p0, base.prices["0"]),
        },
        history: {
          "92": parseSeries(history["92"] ?? history.p92).length
            ? parseSeries(history["92"] ?? history.p92)
            : base.history["92"],
          "95": parseSeries(history["95"] ?? history.p95).length
            ? parseSeries(history["95"] ?? history.p95)
            : base.history["95"],
          "98": parseSeries(history["98"] ?? history.p98).length
            ? parseSeries(history["98"] ?? history.p98)
            : base.history["98"],
          "0": parseSeries(history["0"] ?? history.p0).length
            ? parseSeries(history["0"] ?? history.p0)
            : base.history["0"],
        },
        change: number(cityNode.change ?? root.change, base.change),
      };
    } catch {
      return base;
    }
  }

  const data = await loadData();
  const refreshAfter = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();

  const gradeName = (grade) => grade === "0" ? "0# 柴油" : `${grade}#`;
  const priceText = (value) => `¥${number(value, 0).toFixed(2)}`;

  const changeMeta = (value) => {
    if (value > 0) return { symbol: "↑", text: `+${Math.abs(value).toFixed(2)}`, color: C.up };
    if (value < 0) return { symbol: "↓", text: `-${Math.abs(value).toFixed(2)}`, color: C.down };
    return { symbol: "→", text: "0.00", color: C.flat };
  };

  const change = changeMeta(data.change);

  const makeText = (value, size, weight = "regular", color = C.text, extra = {}) => ({
    type: "text",
    text: String(value),
    font: { size, weight },
    textColor: color,
    maxLines: extra.maxLines ?? 1,
    minScale: extra.minScale ?? 0.78,
    textAlign: extra.textAlign || "left",
    flex: extra.flex,
  });

  const icon = (name, size, color = C.accent) => ({
    type: "image",
    src: `sf-symbol:${name}`,
    width: size,
    height: size,
    color,
  });

  const spacer = (length) =>
    length == null ? { type: "spacer" } : { type: "spacer", length };

  function encodeSvg(svg) {
    const bytes = unescape(encodeURIComponent(svg));
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes.charCodeAt(i));
    return `data:image/svg+xml;base64,${btoa(binary)}`;
  }

  function trendImage(series, width = 300, height = 132) {
    const values = parseSeries(series);
    const padX = 12;
    const padY = 14;
    const plotW = width - padX * 2;
    const plotH = height - padY * 2;

    if (values.length < 2) {
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
          <rect width="${width}" height="${height}" rx="12" fill="transparent"/>
          <path d="M${padX} ${height / 2} H${width - padX}" stroke="${C.chartGrid}" stroke-width="1" stroke-dasharray="4 4"/>
          <text x="${width / 2}" y="${height / 2 + 4}" text-anchor="middle"
                font-family="-apple-system,BlinkMacSystemFont,sans-serif"
                font-size="12" fill="${C.chartText}">暂无走势数据</text>
        </svg>`;
      return encodeSvg(svg);
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = Math.max(max - min, 0.01);

    const points = values.map((value, index) => {
      const x = padX + (plotW * index) / (values.length - 1);
      const y = padY + plotH - ((value - min) / span) * plotH;
      return [x, y];
    });

    const path = points
      .map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`)
      .join(" ");

    const area = `${path} L${points[points.length - 1][0].toFixed(2)} ${height - padY} L${points[0][0].toFixed(2)} ${height - padY} Z`;
    const last = points[points.length - 1];

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <defs>
          <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="${C.chartLine}" stop-opacity="0.24"/>
            <stop offset="1" stop-color="${C.chartLine}" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <path d="M${padX} ${padY + plotH * 0.25} H${width - padX}
                 M${padX} ${padY + plotH * 0.5} H${width - padX}
                 M${padX} ${padY + plotH * 0.75} H${width - padX}"
              stroke="${C.chartGrid}" stroke-width="1"/>
        <path d="${area}" fill="url(#fill)"/>
        <path d="${path}" fill="none" stroke="${C.chartLine}" stroke-width="3"
              stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="${last[0]}" cy="${last[1]}" r="4" fill="${C.chartLine}"/>
        <text x="${padX}" y="${height - 2}" font-family="-apple-system,BlinkMacSystemFont,sans-serif"
              font-size="10" fill="${C.chartText}">${min.toFixed(2)}</text>
        <text x="${width - padX}" y="${height - 2}" text-anchor="end"
              font-family="-apple-system,BlinkMacSystemFont,sans-serif"
              font-size="10" fill="${C.chartText}">${max.toFixed(2)}</text>
      </svg>`;

    return encodeSvg(svg);
  }

  function header() {
    return {
      type: "stack",
      direction: "row",
      alignItems: "center",
      gap: 6,
      children: [
        icon("fuelpump.fill", 18),
        makeText("今日油价", "headline", "bold"),
        spacer(),
        makeText(data.city, "caption1", "semibold", C.accent),
      ],
    };
  }

  function compactPrice(grade, emphasized = false) {
    return {
      type: "stack",
      direction: "column",
      alignItems: "start",
      gap: 3,
      padding: emphasized ? 12 : 10,
      flex: 1,
      borderRadius: 12,
      backgroundColor: emphasized ? C.card : C.soft,
      children: [
        makeText(gradeName(grade), "caption1", "semibold", C.secondary),
        makeText(priceText(data.prices[grade]), emphasized ? "title3" : "headline", "bold"),
      ],
    };
  }

  function renderInline() {
    const grade = data.defaultGrade;
    return {
      type: "widget",
      refreshAfter,
      children: [
        makeText(
          `${gradeName(grade)} ${priceText(data.prices[grade])} ${change.symbol}${Math.abs(data.change).toFixed(2)}`,
          "caption1",
          "semibold"
        ),
      ],
    };
  }

  function renderCircular() {
    const grade = data.defaultGrade;
    return {
      type: "widget",
      refreshAfter,
      padding: 4,
      children: [
        makeText(gradeName(grade), "caption2", "semibold", C.secondary, { textAlign: "center" }),
        makeText(data.prices[grade].toFixed(2), "title3", "bold", C.text, { textAlign: "center" }),
      ],
    };
  }

  function renderRectangular() {
    const grade = data.defaultGrade;
    return {
      type: "widget",
      refreshAfter,
      padding: 6,
      gap: 2,
      children: [
        makeText(`${data.city} · ${gradeName(grade)}`, "caption1", "semibold", C.secondary),
        makeText(priceText(data.prices[grade]), "headline", "bold"),
        makeText(`${change.symbol}${change.text}`, "caption1", "semibold", change.color),
      ],
    };
  }

  function renderSmall() {
    const grade = data.defaultGrade;
    return {
      type: "widget",
      refreshAfter,
      padding: 12,
      gap: 8,
      backgroundColor: C.bg,
      children: [
        header(),
        {
          type: "stack",
          direction: "column",
          alignItems: "center",
          flex: 1,
          gap: 4,
          children: [
            makeText(gradeName(grade), "headline", "semibold", C.secondary, { textAlign: "center" }),
            makeText(priceText(data.prices[grade]), "largeTitle", "bold", C.text, { textAlign: "center" }),
            makeText(`${change.symbol}${change.text}`, "subheadline", "semibold", change.color, { textAlign: "center" }),
          ],
        },
        makeText("元 / 升", "caption1", "medium", C.secondary, { textAlign: "center" }),
      ],
    };
  }

  function renderMedium() {
    return {
      type: "widget",
      refreshAfter,
      padding: 14,
      gap: 10,
      backgroundColor: C.bg,
      children: [
        header(),
        {
          type: "stack",
          direction: "row",
          gap: 8,
          flex: 1,
          children: ["92", "95", "98", "0"].map((grade) => compactPrice(grade, grade === data.defaultGrade)),
        },
        {
          type: "stack",
          direction: "row",
          alignItems: "center",
          children: [
            makeText("本轮变动", "caption1", "medium", C.secondary),
            spacer(),
            makeText(`${change.symbol}${change.text} 元/L`, "caption1", "semibold", change.color),
          ],
        },
      ],
    };
  }

  function renderLarge() {
    const grade = data.defaultGrade;

    const priceRow = (item) => ({
      type: "stack",
      direction: "row",
      alignItems: "center",
      flex: 1,
      padding: [10, 14, 10, 14],
      borderRadius: 12,
      backgroundColor: item === grade ? C.card : C.soft,
      children: [
        {
          type: "stack",
          direction: "column",
          gap: 3,
          children: [
            makeText(
              gradeName(item),
              "headline",
              item === grade ? "bold" : "semibold",
              item === grade ? C.accent : C.secondary
            ),
            makeText(
              item === grade ? "默认油号" : "元 / 升",
              "caption1",
              "medium",
              C.secondary
            ),
          ],
        },
        spacer(),
        makeText(
          priceText(data.prices[item]),
          "title2",
          "bold",
          C.text,
          { textAlign: "right", minScale: 0.84 }
        ),
      ],
    });

    return {
      type: "widget",
      refreshAfter,
      padding: 16,
      gap: 10,
      backgroundColor: C.bg,
      children: [
        header(),

        {
          type: "stack",
          direction: "column",
          flex: 1,
          gap: 8,
          children: ["92", "95", "98", "0"].map(priceRow),
        },

        {
          type: "stack",
          direction: "row",
          alignItems: "center",
          padding: [10, 14, 10, 14],
          borderRadius: 12,
          backgroundColor: C.card,
          children: [
            makeText("本轮调整", "headline", "semibold", C.secondary),
            spacer(),
            makeText(
              `${change.symbol}${change.text} 元/L`,
              "title3",
              "bold",
              change.color,
              { textAlign: "right", minScale: 0.82 }
            ),
          ],
        },
      ],
    };
  }

  function renderExtraLarge() {
    const grade = data.defaultGrade;
    const history = data.history[grade];

    return {
      type: "widget",
      refreshAfter,
      padding: 18,
      gap: 12,
      backgroundColor: C.bg,
      children: [
        header(),
        {
          type: "stack",
          direction: "row",
          gap: 14,
          flex: 1,
          children: [
            {
              type: "stack",
              direction: "column",
              gap: 8,
              flex: 2,
              padding: 12,
              borderRadius: 12,
              backgroundColor: C.card,
              children: [
                {
                  type: "stack",
                  direction: "row",
                  alignItems: "end",
                  children: [
                    makeText(`${gradeName(grade)} 价格走势`, "headline", "semibold"),
                    spacer(),
                    makeText(priceText(data.prices[grade]), "title2", "bold"),
                  ],
                },
                {
                  type: "image",
                  src: trendImage(history, 430, 220),
                  flex: 1,
                  resizeMode: "contain",
                },
              ],
            },
            {
              type: "stack",
              direction: "column",
              gap: 10,
              flex: 1,
              children: [
                ...["92", "95", "98", "0"].map((item) =>
                  compactPrice(item, item === grade)
                ),
                {
                  type: "stack",
                  direction: "row",
                  padding: 10,
                  borderRadius: 12,
                  backgroundColor: C.soft,
                  children: [
                    makeText("本轮变动", "caption1", "medium", C.secondary),
                    spacer(),
                    makeText(`${change.symbol}${change.text} 元/L`, "subheadline", "bold", change.color),
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
  }

  switch (family) {
    case "accessoryInline": return renderInline();
    case "accessoryCircular": return renderCircular();
    case "accessoryRectangular": return renderRectangular();
    case "systemSmall": return renderSmall();
    case "systemMedium": return renderMedium();
    case "systemExtraLarge": return renderExtraLarge();
    case "systemLarge":
    default: return renderLarge();
  }
}
