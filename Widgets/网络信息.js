/**
 * 📌 桌面小组件: 🛡️ 网络诊断雷达
 * 🎨 Egern Widget DSL 重构优化版
 *
 * 本版重点：
 * - systemMedium：保留原有结构，标题弱化
 * - systemLarge / systemExtraLarge：重新优化空间利用率
 * - 流媒体解锁 / AI 解锁：去掉外层大框
 * - 放大 IP / 落地 / 厂商 / 属性 / 纯净 等信息字号
 * - 强化对齐，减少挤占，保证可读性
 */

export default async function (ctx) {
  // ===== 时间判断：早晚主题 =====
  const nowForTheme = new Date();
  const currentHour = nowForTheme.getHours();
  const isNightTheme = currentHour >= 17 || currentHour < 5;

  const family = ctx.widgetFamily || "systemMedium";
  const isLarge = family === "systemLarge" || family === "systemExtraLarge";

  // ===== 颜色系统 =====
  const C = {
    bg: isNightTheme
      ? { light: "#211A3D", dark: "#0B132B" }
      : { light: "#FFF4CF", dark: "#6A4B16" },

    cardBg: isNightTheme
      ? { light: "#FFFFFF14", dark: "#FFFFFF10" }
      : { light: "#FFFFFF42", dark: "#FFF4CF1E" },

    cardBgSoft: isNightTheme
      ? { light: "#FFFFFF10", dark: "#FFFFFF0D" }
      : { light: "#FFFFFF30", dark: "#FFF4CF18" },

    cardBorder: isNightTheme
      ? { light: "#FFFFFF20", dark: "#FFFFFF14" }
      : { light: "#6A4B161E", dark: "#FFF4CF22" },

    divider: isNightTheme
      ? { light: "#FFFFFF1F", dark: "#FFFFFF16" }
      : { light: "#6A4B1618", dark: "#FFF4CF22" },

    text: isNightTheme
      ? { light: "#F7F2FF", dark: "#EAF0FF" }
      : { light: "#3A2808", dark: "#FFF7D6" },

    dim: isNightTheme
      ? { light: "#B9B1D8", dark: "#9EABC9" }
      : { light: "#8A6B25", dark: "#E5C981" },

    muted: isNightTheme
      ? { light: "#D2CAE8", dark: "#B7C1DA" }
      : { light: "#735817", dark: "#D8C17A" },

    cpu: isNightTheme
      ? { light: "#8FA7FF", dark: "#89B4FA" }
      : { light: "#B7791F", dark: "#F6C85F" },

    mem: isNightTheme
      ? { light: "#C4A7E7", dark: "#CBA6F7" }
      : { light: "#D69E2E", dark: "#FFE08A" },

    disk: isNightTheme
      ? { light: "#F6C177", dark: "#FAB387" }
      : { light: "#B45309", dark: "#FFB454" },

    netRx: isNightTheme
      ? { light: "#7FD6A4", dark: "#A6E3A1" }
      : { light: "#2F855A", dark: "#B7E4A8" },

    netTx: isNightTheme
      ? { light: "#7AA2F7", dark: "#89B4FA" }
      : { light: "#A16207", dark: "#FFD166" },

    yellow: isNightTheme
      ? { light: "#F6C177", dark: "#F9E2AF" }
      : { light: "#D69E2E", dark: "#FFE08A" },

    red: isNightTheme
      ? { light: "#F38BA8", dark: "#F38BA8" }
      : { light: "#C24135", dark: "#FF8A80" },
  };

  // ===== 布局配置 =====
  function getLayout(family) {
    const large = family === "systemLarge" || family === "systemExtraLarge";
    return {
      widgetPadding: large ? [10, 12, 10, 12] : 14,
      mainGap: large ? 7 : 10,

      cardGap: large ? 7 : 5,
      cardPadding: large ? [10, 11, 10, 11] : [8, 8, 8, 8],
      radius: large ? 15 : 13,

      titleSize: large ? 11 : 13,
      subtitleSize: large ? 9 : 10,
      sectionTitleSize: large ? 11 : 10,

      labelSize: large ? 10 : 10,
      valueSize: large ? 14 : 10,
      ipSize: large ? 16 : 10,
      smallSize: large ? 10 : 9,

      tileNameSize: large ? 10 : 10,
      tileMainSize: large ? 13 : 11,
      tileSubSize: large ? 10 : 9,

      headerIcon: large ? 11 : 13,
      sectionIcon: large ? 12 : 11,
      mediumRowIcon: 11,

      borderWidth: large ? 0 : 0.5,
      tileBorderWidth: large ? 0 : 0.5,
    };
  }

  const layout = getLayout(family);

  // ===== 工具函数 =====
  const fmtProxyISP = (isp) => {
    if (!isp) return "未知";
    let s = String(isp);
    if (/it7/i.test(s)) return "IT7 Network";
    if (/dmit/i.test(s)) return "DMIT Network";
    if (/cloudflare/i.test(s)) return "Cloudflare";
    if (/akamai/i.test(s)) return "Akamai";
    if (/amazon|aws/i.test(s)) return "AWS";
    if (/google/i.test(s)) return "Google Cloud";
    if (/microsoft|azure/i.test(s)) return "Azure";
    if (/alibaba|aliyun/i.test(s)) return "阿里云";
    if (/tencent/i.test(s)) return "腾讯云";
    if (/oracle/i.test(s)) return "Oracle Cloud";
    return s.length > 18 ? s.slice(0, 18) + "…" : s;
  };

  const getFlag = (code) => {
    if (!code || code.toUpperCase() === "TW") return "🇨🇳";
    if (code.toUpperCase() === "XX" || code === "OK") return "✅";
    return String.fromCodePoint(
      ...code
        .toUpperCase()
        .split("")
        .map((c) => 127397 + c.charCodeAt())
    );
  };

  const BASE_UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

  const commonHeaders = {
    "User-Agent": BASE_UA,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  };

  const readBody = async (r) => {
    if (!r) return "";
    if (typeof r.body === "string" && r.body.length) return r.body;
    if (typeof r.text === "function") {
      try {
        const t = await r.text();
        return typeof t === "string" ? t : "";
      } catch {
        return "";
      }
    }
    return "";
  };

  // ===== 设备与网络 =====
  const d = ctx.device || {};
  const isWifi = !!d.wifi?.ssid;
  let netName = "未连接";
  let netIcon = "antenna.radiowaves.left.and.right";

  const netInfo = typeof $network !== "undefined" ? $network : ctx.network || {};
  let localIp = netInfo.v4?.primaryAddress || d.ipv4?.address || "获取失败";
  let gateway = netInfo.v4?.primaryRouter || d.ipv4?.gateway || "无网关";

  if (isWifi) {
    netName = d.wifi.ssid;
    netIcon = "wifi";
  } else if (d.cellular?.radio) {
    const radioMap = {
      GPRS: "2.5G",
      EDGE: "2.75G",
      WCDMA: "3G",
      LTE: "4G",
      NR: "5G",
      NRNSA: "5G",
    };
    netName =
      radioMap[d.cellular.radio.toUpperCase().replace(/\s+/g, "")] ||
      d.cellular.radio;
    gateway = "蜂窝内网";
  }

  // ===== 请求函数 =====
  const fetchLocal = async () => {
    try {
      const res = await ctx.http.get("https://myip.ipip.net/json", {
        headers: commonHeaders,
        timeout: 4000,
      });
      const body = JSON.parse(await res.text());
      if (body?.data?.ip) {
        return {
          ip: body.data.ip,
          loc: `${body.data.location[1] || ""} ${body.data.location[2] || ""}`.trim(),
        };
      }
    } catch (e) {}
    return { ip: "获取失败", loc: "未知" };
  };

  const fetchProxy = async () => {
    try {
      const res = await ctx.http.get("http://ip-api.com/json/?lang=zh-CN", {
        timeout: 4000,
      });
      const data = JSON.parse(await res.text());
      const flag = getFlag(data.countryCode);
      return {
        ip: data.query || "获取失败",
        loc: `${flag} ${data.city || data.country || ""}`.trim(),
        isp: fmtProxyISP(data.isp || data.org),
        cc: data.countryCode || "XX",
      };
    } catch (e) {
      return { ip: "获取失败", loc: "未知", isp: "未知", cc: "XX" };
    }
  };

  const fetchPurity = async () => {
    try {
      const res = await ctx.http.get("https://my.ippure.com/v1/info", {
        timeout: 4000,
      });
      return JSON.parse(await res.text());
    } catch (e) {
      return {};
    }
  };

  const fetchLocalDelay = async () => {
    const start = Date.now();
    try {
      await ctx.http.get("http://www.baidu.com", { timeout: 2000 });
      return `${Date.now() - start} ms`;
    } catch (e) {
      return "超时";
    }
  };

  const fetchProxyDelay = async () => {
    const start = Date.now();
    try {
      await ctx.http.get("http://cp.cloudflare.com/generate_204", { timeout: 2000 });
      return `${Date.now() - start} ms`;
    } catch (e) {
      return "超时";
    }
  };

  // ===== 流媒体解锁 =====
  async function checkNetflix() {
    try {
      const checkStatus = async (id) => {
        const r = await ctx.http
          .get(`https://www.netflix.com/title/${id}`, {
            timeout: 4000,
            headers: commonHeaders,
            followRedirect: false,
          })
          .catch(() => null);
        return r ? r.status : 0;
      };
      const sFull = await checkStatus(70143836);
      const sOrig = await checkStatus(81280792);
      if (sFull === 200) return "OK";
      if (sOrig === 200) return "🍿";
      return "❌";
    } catch {
      return "❌";
    }
  }

  async function checkDisney() {
    try {
      const res = await ctx.http
        .get("https://www.disneyplus.com", {
          timeout: 4000,
          headers: commonHeaders,
          followRedirect: false,
        })
        .catch(() => null);
      if (!res || res.status === 403) return "❌";
      const loc = res.headers?.location || res.headers?.Location || "";
      if (loc.includes("unavailable")) return "❌";
      return "OK";
    } catch {
      return "❌";
    }
  }

  async function checkTikTok() {
    try {
      const r = await ctx.http
        .get("https://www.tiktok.com/explore", {
          timeout: 4000,
          headers: commonHeaders,
          followRedirect: false,
        })
        .catch(() => null);
      if (!r || r.status === 403 || r.status === 401) return "❌";
      const body = await readBody(r);
      if (body.includes("Access Denied") || body.includes("Please wait...")) return "❌";
      const m = body.match(/"region":"([A-Z]{2})"/i);
      return m?.[1] ? m[1].toUpperCase() : "OK";
    } catch {
      return "❌";
    }
  }

  // ===== AI 解锁 =====
  async function checkChatGPT() {
    try {
      const traceRes = await ctx.http
        .get("https://chatgpt.com/cdn-cgi/trace", {
          timeout: 3000,
        })
        .catch(() => null);
      const tb = await readBody(traceRes);
      const m = tb?.match(/loc=([A-Z]{2})/);
      return m?.[1] ? m[1].toUpperCase() : "OK";
    } catch {
      return "❌";
    }
  }

  async function checkClaude() {
    try {
      const res = await ctx.http
        .get("https://claude.ai/login", {
          timeout: 5000,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          },
        })
        .catch(() => null);

      if (!res) return "❌";
      const status = res.status;
      const body = await readBody(res);

      if (body.includes("App unavailable") || body.includes("certain regions")) return "❌";
      if (status === 403 && body.includes("1020")) return "❌";
      if (
        status === 403 &&
        (body.includes("cf-turnstile") ||
          body.includes("Just a moment") ||
          body.includes("Challenge"))
      ) {
        return "OK";
      }
      if (status === 200 || status === 301 || status === 302) return "OK";
      return "❌";
    } catch {
      return "❌";
    }
  }

  async function checkGemini() {
    try {
      const res = await ctx.http
        .get("https://gemini.google.com/app", {
          timeout: 4000,
          headers: commonHeaders,
          followRedirect: false,
        })
        .catch(() => null);
      if (!res) return "❌";
      const loc = res.headers?.location || res.headers?.Location || "";
      if (loc.includes("faq")) return "❌";
      return "OK";
    } catch {
      return "❌";
    }
  }

  // ===== 并发请求 =====
  const [
    localData,
    proxyData,
    purityData,
    localDelay,
    proxyDelay,
    rNF,
    rDP,
    rTK,
    rGPT,
    rCL,
    rGM,
  ] = await Promise.all([
    fetchLocal(),
    fetchProxy(),
    fetchPurity(),
    fetchLocalDelay(),
    fetchProxyDelay(),
    checkNetflix(),
    checkDisney(),
    checkTikTok(),
    checkChatGPT(),
    checkClaude(),
    checkGemini(),
  ]);

  // ===== 数据清洗 =====
  const isRes = purityData.isResidential;
  let nativeText = "未知属性";
  let nativeIc = "questionmark.circle.fill";
  let nativeCol = C.dim;

  if (isRes === true) {
    nativeText = "原生住宅";
    nativeIc = "house.fill";
    nativeCol = C.netRx;
  } else if (isRes === false) {
    nativeText = "商业机房";
    nativeIc = "building.2.fill";
    nativeCol = C.disk;
  }

  const risk = purityData.fraudScore;
  let riskTxt = "无数据";
  let riskCol = C.dim;
  let riskIc = "questionmark.circle.fill";

  if (risk !== undefined) {
    if (risk >= 70) {
      riskTxt = `高危 (${risk})`;
      riskCol = C.red;
      riskIc = "xmark.shield.fill";
    } else if (risk >= 30) {
      riskTxt = `中危 (${risk})`;
      riskCol = C.disk;
      riskIc = "exclamationmark.triangle.fill";
    } else {
      riskTxt = `纯净 (${risk})`;
      riskCol = C.netRx;
      riskIc = "checkmark.shield.fill";
    }
  }

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes()
  ).padStart(2, "0")}`;

  const TIME_COL = isNightTheme
    ? { light: "rgba(247,242,255,0.50)", dark: "rgba(234,240,255,0.46)" }
    : { light: "rgba(58,40,8,0.42)", dark: "rgba(255,247,214,0.46)" };

  // ===== UI 组件函数 =====
  const Card = (children, opt = {}) => ({
    type: "stack",
    direction: "column",
    gap: opt.gap ?? layout.cardGap,
    padding: opt.padding ?? layout.cardPadding,
    backgroundColor: opt.soft ? C.cardBgSoft : C.cardBg,
    borderRadius: opt.radius ?? layout.radius,
    borderWidth: opt.noBorder ? 0 : layout.borderWidth,
    borderColor: C.cardBorder,
    flex: opt.flex,
    height: opt.height,
    children,
  });

  const SectionTitle = (icon, title, color) => ({
    type: "stack",
    direction: "row",
    alignItems: "center",
    gap: 5,
    children: [
      {
        type: "image",
        src: `sf-symbol:${icon}`,
        color,
        width: layout.sectionIcon,
        height: layout.sectionIcon,
      },
      {
        type: "text",
        text: title,
        font: { size: layout.sectionTitleSize, weight: "semibold" },
        textColor: C.dim,
        maxLines: 1,
      },
    ],
  });

  const HeroValue = (label, value, color = C.text) => ({
    type: "stack",
    direction: "column",
    gap: 1,
    flex: 1,
    children: [
      {
        type: "text",
        text: label,
        font: { size: layout.labelSize, weight: "medium" },
        textColor: C.dim,
        maxLines: 1,
      },
      {
        type: "text",
        text: value,
        font: { size: layout.ipSize, weight: "bold" },
        textColor: color,
        maxLines: 1,
        minScale: 0.6,
      },
    ],
  });

  const PairLine = (
    leftLabel,
    leftValue,
    rightLabel,
    rightValue,
    leftColor = C.text,
    rightColor = C.text
  ) => ({
    type: "stack",
    direction: "row",
    gap: 10,
    children: [
      {
        type: "stack",
        direction: "column",
        gap: 1,
        flex: 1,
        children: [
          {
            type: "text",
            text: leftLabel,
            font: { size: layout.smallSize, weight: "regular" },
            textColor: C.dim,
            maxLines: 1,
          },
          {
            type: "text",
            text: leftValue,
            font: { size: layout.valueSize, weight: "semibold" },
            textColor: leftColor,
            maxLines: 1,
            minScale: 0.58,
          },
        ],
      },
      {
        type: "stack",
        direction: "column",
        gap: 1,
        flex: 1,
        children: [
          {
            type: "text",
            text: rightLabel,
            font: { size: layout.smallSize, weight: "regular" },
            textColor: C.dim,
            maxLines: 1,
          },
          {
            type: "text",
            text: rightValue,
            font: { size: layout.valueSize, weight: "semibold" },
            textColor: rightColor,
            maxLines: 1,
            minScale: 0.58,
          },
        ],
      },
    ],
  });

  const MediumRow = (ic, icCol, label, val, valCol) => ({
    type: "stack",
    direction: "row",
    alignItems: "center",
    gap: 5,
    children: [
      {
        type: "image",
        src: `sf-symbol:${ic}`,
        color: icCol,
        width: layout.mediumRowIcon,
        height: layout.mediumRowIcon,
      },
      {
        type: "text",
        text: label,
        font: { size: 10, weight: "regular" },
        textColor: C.dim,
        maxLines: 1,
      },
      { type: "spacer" },
      {
        type: "text",
        text: val,
        font: { size: 10, weight: "medium" },
        textColor: valCol,
        maxLines: 1,
        minScale: 0.42,
      },
    ],
  });

  const parseUnlock = (res, cc) => {
    if (res === "❌") {
      return {
        main: "不可用",
        sub: "Blocked",
        color: C.red,
        statusIcon: "xmark.circle.fill",
      };
    }
    if (res === "🍿") {
      return {
        main: "仅原创",
        sub: "Original",
        color: C.yellow,
        statusIcon: "play.circle.fill",
      };
    }
    if (res === "APP") {
      return {
        main: "App 可用",
        sub: "APP",
        color: C.netRx,
        statusIcon: "checkmark.circle.fill",
      };
    }

    const region = res === "OK" || res === "XX" ? cc : res;
    return {
      main: "可用",
      sub: `${getFlag(region)} ${region}`,
      color: C.netRx,
      statusIcon: "checkmark.circle.fill",
    };
  };

  const BrandBadge = (text, bg, fg = "#FFFFFF") => ({
    type: "stack",
    direction: "column",
    alignItems: "center",
    justifyContent: "center",
    width: 28,
    height: 28,
    backgroundColor: bg,
    borderRadius: 9,
    children: [
      {
        type: "text",
        text,
        font: { size: text.length >= 3 ? 8 : 11, weight: "black" },
        textColor: fg,
        maxLines: 1,
        minScale: 0.6,
      },
    ],
  });

  const UnlockTile = (brand, badgeText, badgeBg, res, cc) => {
    const u = parseUnlock(res, cc);
    return {
      type: "stack",
      direction: "row",
      alignItems: "center",
      gap: 8,
      padding: [7, 8, 7, 8],
      backgroundColor: C.cardBgSoft,
      borderRadius: 12,
      borderWidth: layout.tileBorderWidth,
      borderColor: C.cardBorder,
      flex: 1,
      children: [
        BrandBadge(badgeText, badgeBg),
        {
          type: "stack",
          direction: "column",
          gap: 1,
          flex: 1,
          children: [
            {
              type: "text",
              text: brand,
              font: { size: layout.tileNameSize, weight: "semibold" },
              textColor: C.text,
              maxLines: 1,
              minScale: 0.7,
            },
            {
              type: "text",
              text: u.main,
              font: { size: layout.tileMainSize, weight: "bold" },
              textColor: u.color,
              maxLines: 1,
              minScale: 0.68,
            },
            {
              type: "text",
              text: u.sub,
              font: { size: layout.tileSubSize, weight: "medium" },
              textColor: C.muted,
              maxLines: 1,
              minScale: 0.65,
            },
          ],
        },
        {
          type: "image",
          src: `sf-symbol:${u.statusIcon}`,
          color: u.color,
          width: 12,
          height: 12,
        },
      ],
    };
  };

  const UnlockSection = (title, icon, color, children) => ({
    type: "stack",
    direction: "column",
    gap: 5,
    children: [
      SectionTitle(icon, title, color),
      {
        type: "stack",
        direction: "row",
        gap: 6,
        children,
      },
    ],
  });

  // ===== 大号组件 =====
  if (isLarge) {
    return {
      type: "widget",
      padding: layout.widgetPadding,
      gap: layout.mainGap,
      backgroundColor: C.bg,
      children: [
        // Header：缩小并弱化
        {
          type: "stack",
          direction: "row",
          alignItems: "center",
          gap: 6,
          children: [
            {
              type: "image",
              src: "sf-symbol:waveform.path.ecg",
              color: C.dim,
              width: layout.headerIcon,
              height: layout.headerIcon,
            },
            {
              type: "text",
              text: "网络诊断雷达",
              font: { size: layout.titleSize, weight: "semibold" },
              textColor: C.dim,
              maxLines: 1,
            },
            {
              type: "text",
              text: "Local · Proxy · Unlock",
              font: { size: layout.subtitleSize, weight: "medium" },
              textColor: C.dim,
              maxLines: 1,
            },
            { type: "spacer" },
            {
              type: "text",
              text: timeStr,
              font: { size: 10, weight: "medium" },
              textColor: TIME_COL,
            },
          ],
        },

        // 本地网络 + 代理出口
        {
          type: "stack",
          direction: "row",
          gap: 8,
          children: [
            Card(
              [
                SectionTitle(netIcon, "本地网络", C.cpu),
                {
                  type: "stack",
                  direction: "row",
                  gap: 10,
                  children: [
                    HeroValue("内网 IP", localIp),
                    HeroValue("公网 IP", localData.ip),
                  ],
                },
                PairLine("环境", netName, "网关", gateway),
                PairLine("位置", localData.loc, "延迟", localDelay),
              ],
              {
                flex: 1,
                gap: 8,
                padding: [10, 11, 10, 11],
              }
            ),

            Card(
              [
                SectionTitle("paperplane.fill", "代理出口", C.mem),
                {
                  type: "stack",
                  direction: "row",
                  gap: 10,
                  children: [
                    HeroValue("出口 IP", proxyData.ip),
                    HeroValue("落地", proxyData.loc),
                  ],
                },
                PairLine("厂商", proxyData.isp, "属性", nativeText, C.text, nativeCol),
                PairLine("纯净", riskTxt, "延迟", proxyDelay, riskCol, C.text),
              ],
              {
                flex: 1,
                gap: 8,
                padding: [10, 11, 10, 11],
              }
            ),
          ],
        },

        // 流媒体解锁：去掉外框
        UnlockSection("流媒体解锁", "play.tv.fill", C.cpu, [
          UnlockTile("Netflix", "N", "#E50914", rNF, proxyData.cc),
          UnlockTile("Disney+", "D+", "#113CCF", rDP, proxyData.cc),
          UnlockTile("TikTok", "♪", "#111111", rTK, proxyData.cc),
        ]),

        // AI 解锁：去掉外框
        UnlockSection("AI 解锁", "sparkles", C.mem, [
          UnlockTile("ChatGPT", "GPT", "#10A37F", rGPT, proxyData.cc),
          UnlockTile("Claude", "C", "#D97742", rCL, proxyData.cc),
          UnlockTile("Gemini", "G", "#6C8CFF", rGM, proxyData.cc),
        ]),
      ],
    };
  }

  // ===== 中号组件：保留原信息结构，标题弱化 =====
  return {
    type: "widget",
    padding: 14,
    backgroundColor: C.bg,
    children: [
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        gap: 5,
        children: [
          {
            type: "image",
            src: "sf-symbol:waveform.path.ecg",
            color: C.dim,
            width: 13,
            height: 13,
          },
          {
            type: "text",
            text: "网络诊断雷达",
            font: { size: 13, weight: "semibold" },
            textColor: C.text,
          },
          { type: "spacer" },
          {
            type: "text",
            text: timeStr,
            font: { size: 10, weight: "medium" },
            textColor: TIME_COL,
          },
        ],
      },
      { type: "spacer", length: 10 },

      {
        type: "stack",
        direction: "row",
        gap: 10,
        children: [
          {
            type: "stack",
            direction: "column",
            gap: 4.5,
            flex: 1,
            children: [
              MediumRow(netIcon, C.cpu, "环境", netName, C.text),
              MediumRow("wifi.router.fill", C.cpu, "网关", gateway, C.text),
              MediumRow("iphone", C.cpu, "内网", localIp, C.text),
              MediumRow("globe.asia.australia.fill", C.cpu, "公网", localData.ip, C.text),
              MediumRow("map.fill", C.cpu, "位置", localData.loc, C.text),
              MediumRow("timer", C.cpu, "延迟", localDelay, C.text),
              MediumRow(
                "play.tv.fill",
                C.cpu,
                "影视",
                `NF ${parseUnlock(rNF, proxyData.cc).main}  DP ${parseUnlock(rDP, proxyData.cc).main}  TK ${parseUnlock(rTK, proxyData.cc).main}`,
                C.text
              ),
            ],
          },

          {
            type: "stack",
            width: 0.5,
            backgroundColor: C.divider,
          },

          {
            type: "stack",
            direction: "column",
            gap: 4.5,
            flex: 1,
            children: [
              MediumRow("paperplane.fill", C.mem, "出口", proxyData.ip, C.text),
              MediumRow("mappin.and.ellipse", C.mem, "落地", proxyData.loc, C.text),
              MediumRow("server.rack", C.mem, "厂商", proxyData.isp, C.text),
              MediumRow(nativeIc, nativeCol, "属性", nativeText, nativeCol),
              MediumRow(riskIc, riskCol, "纯净", riskTxt, riskCol),
              MediumRow("timer", C.mem, "延迟", proxyDelay, C.text),
              MediumRow(
                "cpu",
                C.mem,
                "AI",
                `GPT ${parseUnlock(rGPT, proxyData.cc).main}  CL ${parseUnlock(rCL, proxyData.cc).main}  GM ${parseUnlock(rGM, proxyData.cc).main}`,
                C.text
              ),
            ],
          },
        ],
      },
      { type: "spacer" },
    ],
  };
}
