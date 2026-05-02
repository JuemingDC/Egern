/**
 * 📌 桌面小组件: 🛡️ 网络诊断雷达
 * 🎨 Egern Widget DSL 网格重排版
 *
 * 大号布局逻辑：
 * - 12 × 18 逻辑网格
 * - 本地网络 / 代理出口约占 60%+ 面积
 * - 解锁信息仅保留完整应用名 + 红绿状态
 * - 去掉所有大外框，以文本对齐和分割线组织信息
 */

export default async function (ctx) {
  const family = ctx.widgetFamily || "systemMedium";
  const isLarge = family === "systemLarge" || family === "systemExtraLarge";

  const nowForTheme = new Date();
  const currentHour = nowForTheme.getHours();
  const isNightTheme = currentHour >= 17 || currentHour < 5;

  const refreshAfter = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const C = {
    bg: isNightTheme
      ? { light: "#211A3D", dark: "#0B132B" }
      : { light: "#FFF4CF", dark: "#6A4B16" },

    text: isNightTheme
      ? { light: "#F7F2FF", dark: "#EAF0FF" }
      : { light: "#3A2808", dark: "#FFF7D6" },

    dim: isNightTheme
      ? { light: "#B9B1D8", dark: "#9EABC9" }
      : { light: "#8A6B25", dark: "#E5C981" },

    muted: isNightTheme
      ? { light: "#D2CAE8", dark: "#B7C1DA" }
      : { light: "#735817", dark: "#D8C17A" },

    divider: isNightTheme
      ? { light: "#FFFFFF22", dark: "#FFFFFF16" }
      : { light: "#6A4B1620", dark: "#FFF4CF24" },

    cpu: isNightTheme
      ? { light: "#8FA7FF", dark: "#89B4FA" }
      : { light: "#B7791F", dark: "#F6C85F" },

    mem: isNightTheme
      ? { light: "#C4A7E7", dark: "#CBA6F7" }
      : { light: "#D69E2E", dark: "#FFE08A" },

    green: isNightTheme
      ? { light: "#7FD6A4", dark: "#A6E3A1" }
      : { light: "#238C55", dark: "#B7E4A8" },

    red: isNightTheme
      ? { light: "#F38BA8", dark: "#F38BA8" }
      : { light: "#C24135", dark: "#FF8A80" },

    orange: isNightTheme
      ? { light: "#F6C177", dark: "#FAB387" }
      : { light: "#B45309", dark: "#FFB454" },
  };

  const L = getLayout(family);

  const TIME_COL = isNightTheme
    ? { light: "rgba(247,242,255,0.48)", dark: "rgba(234,240,255,0.46)" }
    : { light: "rgba(58,40,8,0.42)", dark: "rgba(255,247,214,0.46)" };

  function getLayout(family) {
    const large = family === "systemLarge" || family === "systemExtraLarge";

    return {
      widgetPadding: large ? [9, 13, 9, 13] : 14,
      rootGap: large ? 7 : 10,

      headerTitle: large ? 10 : 13,
      headerSub: large ? 9 : 10,
      headerIcon: large ? 10 : 13,

      sectionTitle: large ? 12 : 10,
      sectionIcon: large ? 12 : 11,

      ipLabel: large ? 10 : 10,
      ipValue: large ? 18 : 10,

      rowLabel: large ? 10 : 10,
      rowValue: large ? 14 : 10,

      unlockTitle: large ? 11 : 10,
      appName: large ? 12 : 10,
      appStatus: large ? 13 : 10,

      mediumRowIcon: 11,

      mainColumnGap: large ? 13 : 10,
      columnGap: large ? 8 : 5,
      ipGap: large ? 8 : 5,
      infoGap: large ? 6 : 4,
      unlockGap: large ? 8 : 5,
      unlockRowGap: large ? 7 : 5,
    };
  }

  const fmtProxyISP = (isp) => {
    if (!isp) return "未知";
    const s = String(isp);
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
    return s.length > 22 ? s.slice(0, 22) + "…" : s;
  };

  const getFlag = (code) => {
    if (!code || String(code).toUpperCase() === "TW") return "🇨🇳";
    if (String(code).toUpperCase() === "XX" || code === "OK") return "✅";
    const cc = String(code).toUpperCase();
    if (cc.length !== 2) return "✅";
    return String.fromCodePoint(...cc.split("").map((c) => 127397 + c.charCodeAt()));
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
    const radioKey = d.cellular.radio.toUpperCase().replace(/\s+/g, "");
    netName = radioMap[radioKey] || d.cellular.radio;
    gateway = "蜂窝内网";
  }

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
      return {
        ip: "获取失败",
        loc: "未知",
        isp: "未知",
        cc: "XX",
      };
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
      await ctx.http.get("http://cp.cloudflare.com/generate_204", {
        timeout: 2000,
      });
      return `${Date.now() - start} ms`;
    } catch (e) {
      return "超时";
    }
  };

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

  const isRes = purityData.isResidential;

  let nativeText = "未知属性";
  let nativeIc = "questionmark.circle.fill";
  let nativeCol = C.dim;

  if (isRes === true) {
    nativeText = "原生住宅";
    nativeIc = "house.fill";
    nativeCol = C.green;
  } else if (isRes === false) {
    nativeText = "商业机房";
    nativeIc = "building.2.fill";
    nativeCol = C.orange;
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
      riskCol = C.orange;
      riskIc = "exclamationmark.triangle.fill";
    } else {
      riskTxt = `纯净 (${risk})`;
      riskCol = C.green;
      riskIc = "checkmark.shield.fill";
    }
  }

  const parseUnlock = (res) => {
    if (res === "❌") {
      return {
        text: "不可用",
        color: C.red,
      };
    }

    if (res === "🍿") {
      return {
        text: "部分",
        color: C.green,
      };
    }

    return {
      text: "可用",
      color: C.green,
    };
  };

  const fmtUnlock = (name, res, cc) => {
    let flag = "🚫";
    if (res === "🍿") flag = "🍿";
    else if (res !== "❌") flag = getFlag(res === "OK" || res === "XX" ? cc : res);
    return `${name} ${flag}`;
  };

  const textVideo = `${fmtUnlock("NF", rNF, proxyData.cc)}   ${fmtUnlock("DP", rDP, proxyData.cc)}   ${fmtUnlock("TK", rTK, proxyData.cc)}`;
  const textAI = `${fmtUnlock("GPT", rGPT, proxyData.cc)}   ${fmtUnlock("CL", rCL, proxyData.cc)}   ${fmtUnlock("GM", rGM, proxyData.cc)}`;

  const ThinDivider = () => ({
    type: "stack",
    height: 0.6,
    backgroundColor: C.divider,
    children: [],
  });

  const VerticalDivider = () => ({
    type: "stack",
    width: 0.6,
    backgroundColor: C.divider,
    children: [],
  });

  const SectionHeader = (icon, title, color) => ({
    type: "stack",
    direction: "row",
    alignItems: "center",
    gap: 5,
    children: [
      {
        type: "image",
        src: `sf-symbol:${icon}`,
        color,
        width: L.sectionIcon,
        height: L.sectionIcon,
      },
      {
        type: "text",
        text: title,
        font: { size: L.sectionTitle, weight: "semibold" },
        textColor: C.dim,
        maxLines: 1,
      },
    ],
  });

  const IpBlock = (label, value, color = C.text) => ({
    type: "stack",
    direction: "column",
    gap: 2,
    children: [
      {
        type: "text",
        text: label,
        font: { size: L.ipLabel, weight: "medium" },
        textColor: C.dim,
        maxLines: 1,
      },
      {
        type: "text",
        text: value,
        font: { size: L.ipValue, weight: "bold" },
        textColor: color,
        maxLines: 1,
        minScale: 0.74,
      },
    ],
  });

  const InfoLine = (label, value, color = C.text) => ({
    type: "stack",
    direction: "row",
    alignItems: "center",
    gap: 8,
    children: [
      {
        type: "text",
        text: label,
        width: 36,
        font: { size: L.rowLabel, weight: "regular" },
        textColor: C.dim,
        maxLines: 1,
      },
      {
        type: "text",
        text: value,
        flex: 1,
        font: { size: L.rowValue, weight: "semibold" },
        textColor: color,
        maxLines: 1,
        minScale: 0.72,
      },
    ],
  });

  const DataColumn = (titleIcon, title, color, ipBlocks, lines) => ({
    type: "stack",
    direction: "column",
    gap: L.columnGap,
    flex: 1,
    children: [
      SectionHeader(titleIcon, title, color),
      {
        type: "stack",
        direction: "column",
        gap: L.ipGap,
        children: ipBlocks,
      },
      ThinDivider(),
      {
        type: "stack",
        direction: "column",
        gap: L.infoGap,
        children: lines,
      },
    ],
  });

  const StatusDot = (color) => ({
    type: "stack",
    width: 7,
    height: 7,
    borderRadius: 99,
    backgroundColor: color,
    children: [],
  });

  const UnlockItem = (name, res) => {
    const u = parseUnlock(res);

    return {
      type: "stack",
      direction: "row",
      alignItems: "center",
      gap: 5,
      flex: 1,
      children: [
        {
          type: "text",
          text: name,
          flex: 1,
          font: { size: L.appName, weight: "semibold" },
          textColor: C.text,
          maxLines: 1,
          minScale: 0.82,
        },
        StatusDot(u.color),
        {
          type: "text",
          text: u.text,
          font: { size: L.appStatus, weight: "bold" },
          textColor: u.color,
          maxLines: 1,
          minScale: 0.82,
        },
      ],
    };
  };

  const UnlockRow = (title, items) => ({
    type: "stack",
    direction: "row",
    alignItems: "center",
    gap: 8,
    children: [
      {
        type: "text",
        text: title,
        width: 58,
        font: { size: L.unlockTitle, weight: "semibold" },
        textColor: C.dim,
        maxLines: 1,
      },
      {
        type: "stack",
        direction: "row",
        gap: L.unlockGap,
        flex: 1,
        children: items,
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
        width: L.mediumRowIcon,
        height: L.mediumRowIcon,
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

  if (isLarge) {
    return {
      type: "widget",
      padding: L.widgetPadding,
      gap: L.rootGap,
      refreshAfter,
      backgroundColor: C.bg,
      children: [
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
              width: L.headerIcon,
              height: L.headerIcon,
            },
            {
              type: "text",
              text: "网络诊断雷达",
              font: { size: L.headerTitle, weight: "semibold" },
              textColor: C.dim,
              maxLines: 1,
            },
            {
              type: "text",
              text: "Local · Proxy · Unlock",
              font: { size: L.headerSub, weight: "medium" },
              textColor: C.dim,
              maxLines: 1,
            },
            { type: "spacer" },
            {
              type: "date",
              date: new Date().toISOString(),
              format: "time",
              font: { size: 10, weight: "medium" },
              textColor: TIME_COL,
              maxLines: 1,
            },
          ],
        },

        {
          type: "stack",
          direction: "row",
          gap: L.mainColumnGap,
          flex: 1,
          children: [
            DataColumn(
              netIcon,
              "本地网络",
              C.cpu,
              [
                IpBlock("内网 IP", localIp),
                IpBlock("公网 IP", localData.ip),
              ],
              [
                InfoLine("环境", netName),
                InfoLine("网关", gateway),
                InfoLine("位置", localData.loc),
                InfoLine("延迟", localDelay),
              ]
            ),

            VerticalDivider(),

            DataColumn(
              "paperplane.fill",
              "代理出口",
              C.mem,
              [
                IpBlock("出口 IP", proxyData.ip),
                IpBlock("落地", proxyData.loc),
              ],
              [
                InfoLine("厂商", proxyData.isp),
                InfoLine("属性", nativeText, nativeCol),
                InfoLine("纯净", riskTxt, riskCol),
                InfoLine("延迟", proxyDelay),
              ]
            ),
          ],
        },

        ThinDivider(),

        {
          type: "stack",
          direction: "column",
          gap: L.unlockRowGap,
          children: [
            UnlockRow("流媒体", [
              UnlockItem("Netflix", rNF),
              UnlockItem("Disney+", rDP),
              UnlockItem("TikTok", rTK),
            ]),
            UnlockRow("AI", [
              UnlockItem("ChatGPT", rGPT),
              UnlockItem("Claude", rCL),
              UnlockItem("Gemini", rGM),
            ]),
          ],
        },
      ],
    };
  }

  return {
    type: "widget",
    padding: 14,
    refreshAfter,
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
            maxLines: 1,
          },
          { type: "spacer" },
          {
            type: "date",
            date: new Date().toISOString(),
            format: "time",
            font: { size: 10, weight: "medium" },
            textColor: TIME_COL,
            maxLines: 1,
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
              MediumRow("play.tv.fill", C.cpu, "影视", textVideo, C.text),
            ],
          },

          {
            type: "stack",
            width: 0.5,
            backgroundColor: C.divider,
            children: [],
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
              MediumRow("cpu", C.mem, "AI", textAI, C.text),
            ],
          },
        ],
      },

      { type: "spacer" },
    ],
  };
}
