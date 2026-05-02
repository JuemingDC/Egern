/**
 * 📌 桌面小组件: 🛡️ 网络诊断雷达
 * 🎨 Egern Widget DSL 版
 *
 * 本版调整：
 * - systemMedium：显示内容保持原版不变
 * - systemLarge / systemExtraLarge：重新设计字号、排列与信息密度
 * - 大号增加更详细的流媒体 / AI 解锁状态
 * - 图标统一使用 Egern 官方 DSL 支持的 sf-symbol
 */

export default async function(ctx) {
  // ===== 时间判断：早晚主题 =====
  const nowForTheme = new Date();
  const currentHour = nowForTheme.getHours();
  const isNightTheme = currentHour >= 17 || currentHour < 5;

  // 1. 统一 UI 规范颜色
  const C = {
    bg: isNightTheme
      ? { light: '#211A3D', dark: '#0B132B' }
      : { light: '#FFF4CF', dark: '#6A4B16' },

    cardBg: isNightTheme
      ? { light: '#FFFFFF18', dark: '#FFFFFF12' }
      : { light: '#FFFFFF4A', dark: '#FFF4CF20' },

    cardBgStrong: isNightTheme
      ? { light: '#FFFFFF20', dark: '#FFFFFF18' }
      : { light: '#FFFFFF66', dark: '#FFF4CF2A' },

    cardBorder: isNightTheme
      ? { light: '#FFFFFF24', dark: '#FFFFFF18' }
      : { light: '#6A4B1620', dark: '#FFF4CF24' },

    barBg: isNightTheme
      ? { light: '#FFFFFF22', dark: '#FFFFFF1F' }
      : { light: '#6A4B1626', dark: '#FFF4CF33' },

    text: isNightTheme
      ? { light: '#F7F2FF', dark: '#EAF0FF' }
      : { light: '#3A2808', dark: '#FFF7D6' },

    dim: isNightTheme
      ? { light: '#B9B1D8', dark: '#9EABC9' }
      : { light: '#8A6B25', dark: '#E5C981' },

    muted: isNightTheme
      ? { light: '#D7D0EF', dark: '#B8C3DD' }
      : { light: '#6F5318', dark: '#EBD48C' },

    cpu: isNightTheme
      ? { light: '#8FA7FF', dark: '#89B4FA' }
      : { light: '#B7791F', dark: '#F6C85F' },

    mem: isNightTheme
      ? { light: '#C4A7E7', dark: '#CBA6F7' }
      : { light: '#D69E2E', dark: '#FFE08A' },

    disk: isNightTheme
      ? { light: '#F6C177', dark: '#FAB387' }
      : { light: '#B45309', dark: '#FFB454' },

    netRx: isNightTheme
      ? { light: '#7FD6A4', dark: '#A6E3A1' }
      : { light: '#2F855A', dark: '#B7E4A8' },

    netTx: isNightTheme
      ? { light: '#7AA2F7', dark: '#89B4FA' }
      : { light: '#A16207', dark: '#FFD166' },

    yellow: isNightTheme
      ? { light: '#F6C177', dark: '#F9E2AF' }
      : { light: '#D69E2E', dark: '#FFE08A' },

    red: isNightTheme
      ? { light: '#F38BA8', dark: '#F38BA8' }
      : { light: '#C24135', dark: '#FF8A80' }
  };

  // --- 辅助与解析函数 ---
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
    return s.length > 11 ? s.substring(0, 11) + "..." : s;
  };

  const getFlag = (code) => {
    if (!code || code.toUpperCase() === 'TW') return '🇨🇳';
    if (code.toUpperCase() === 'XX' || code === 'OK') return '✅';
    return String.fromCodePoint(...code.toUpperCase().split('').map(c => 127397 + c.charCodeAt()));
  };

  const BASE_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";
  const commonHeaders = {
    "User-Agent": BASE_UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
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

  // 2. 获取本地网络数据
  const d = ctx.device || {};
  const isWifi = !!d.wifi?.ssid;
  let netName = "未连接";
  let netIcon = "antenna.radiowaves.left.and.right";

  const netInfo = (typeof $network !== 'undefined') ? $network : (ctx.network || {});
  let localIp = netInfo.v4?.primaryAddress || d.ipv4?.address || "获取失败";
  let gateway = netInfo.v4?.primaryRouter || d.ipv4?.gateway || "无网关";

  if (isWifi) {
    netName = d.wifi.ssid;
    netIcon = "wifi";
  } else if (d.cellular?.radio) {
    const radioMap = {
      "GPRS": "2.5G",
      "EDGE": "2.75G",
      "WCDMA": "3G",
      "LTE": "4G",
      "NR": "5G",
      "NRNSA": "5G"
    };
    netName = `${radioMap[d.cellular.radio.toUpperCase().replace(/\s+/g, "")] || d.cellular.radio}`;
    gateway = "蜂窝内网";
  }

  // 3. 基础网络请求
  const fetchLocal = async () => {
    try {
      const res = await ctx.http.get('https://myip.ipip.net/json', {
        headers: commonHeaders,
        timeout: 4000
      });
      const body = JSON.parse(await res.text());
      if (body?.data?.ip) {
        return {
          ip: body.data.ip,
          loc: `${body.data.location[1] || ""} ${body.data.location[2] || ""}`.trim()
        };
      }
    } catch (e) {}
    return { ip: "获取失败", loc: "未知" };
  };

  const fetchProxy = async () => {
    try {
      const res = await ctx.http.get('http://ip-api.com/json/?lang=zh-CN', {
        timeout: 4000
      });
      const data = JSON.parse(await res.text());
      const flag = getFlag(data.countryCode);
      return {
        ip: data.query || "获取失败",
        loc: `${flag} ${data.city || data.country || ""}`.trim(),
        isp: fmtProxyISP(data.isp || data.org),
        cc: data.countryCode || "XX"
      };
    } catch (e) {
      return {
        ip: "获取失败",
        loc: "未知",
        isp: "未知",
        cc: "XX"
      };
    }
  };

  const fetchPurity = async () => {
    try {
      const res = await ctx.http.get('https://my.ippure.com/v1/info', {
        timeout: 4000
      });
      return JSON.parse(await res.text());
    } catch (e) {
      return {};
    }
  };

  const fetchLocalDelay = async () => {
    const start = Date.now();
    try {
      await ctx.http.get('http://www.baidu.com', { timeout: 2000 });
      return `${Date.now() - start} ms`;
    } catch (e) {
      return "超时";
    }
  };

  const fetchProxyDelay = async () => {
    const start = Date.now();
    try {
      await ctx.http.get('http://cp.cloudflare.com/generate_204', {
        timeout: 2000
      });
      return `${Date.now() - start} ms`;
    } catch (e) {
      return "超时";
    }
  };

  // 4. 流媒体解锁测试
  async function checkNetflix() {
    try {
      const checkStatus = async (id) => {
        const r = await ctx.http.get(`https://www.netflix.com/title/${id}`, {
          timeout: 4000,
          headers: commonHeaders,
          followRedirect: false
        }).catch(() => null);
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
      const res = await ctx.http.get("https://www.disneyplus.com", {
        timeout: 4000,
        headers: commonHeaders,
        followRedirect: false
      }).catch(() => null);
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
      const r = await ctx.http.get("https://www.tiktok.com/explore", {
        timeout: 4000,
        headers: commonHeaders,
        followRedirect: false
      }).catch(() => null);
      if (!r || r.status === 403 || r.status === 401) return "❌";
      const body = await readBody(r);
      if (body.includes("Access Denied") || body.includes("Please wait...")) return "❌";
      const m = body.match(/"region":"([A-Z]{2})"/i);
      return m?.[1] ? m[1].toUpperCase() : "OK";
    } catch {
      return "❌";
    }
  }

  // 5. AI 解锁测试
  async function checkChatGPT() {
    try {
      const traceRes = await ctx.http.get("https://chatgpt.com/cdn-cgi/trace", {
        timeout: 3000
      }).catch(() => null);
      const tb = await readBody(traceRes);
      const m = tb?.match(/loc=([A-Z]{2})/);
      return m?.[1] ? m[1].toUpperCase() : "OK";
    } catch {
      return "❌";
    }
  }

  async function checkClaude() {
    try {
      const res = await ctx.http.get("https://claude.ai/login", {
        timeout: 5000,
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        }
      }).catch(() => null);
      if (!res) return "❌";
      const status = res.status;
      const body = await readBody(res);
      if (body.includes("App unavailable") || body.includes("certain regions")) return "❌";
      if (status === 403 && body.includes("1020")) return "❌";
      if (status === 403 && (body.includes("cf-turnstile") || body.includes("Just a moment") || body.includes("Challenge"))) return "OK";
      if (status === 200 || status === 301 || status === 302) return "OK";
      return "❌";
    } catch {
      return "❌";
    }
  }

  async function checkGemini() {
    try {
      const res = await ctx.http.get("https://gemini.google.com/app", {
        timeout: 4000,
        headers: commonHeaders,
        followRedirect: false
      }).catch(() => null);
      if (!res) return "❌";
      const loc = res.headers?.location || res.headers?.Location || "";
      if (loc.includes("faq")) return "❌";
      return "OK";
    } catch {
      return "❌";
    }
  }

  // 6. 并发执行核心网络请求
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
    rGM
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
    checkGemini()
  ]);

  // 7. 数据清洗
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

  const fmtUnlock = (name, res, cc) => {
    let flag = "🚫";
    if (res === "🍿" || res === "APP") flag = res;
    else if (res !== "❌") flag = getFlag(res === "OK" || res === "XX" ? cc : res);
    return `${name} ${flag}`;
  };

  const textVideo = `${fmtUnlock('NF', rNF, proxyData.cc)}   ${fmtUnlock('DP', rDP, proxyData.cc)}   ${fmtUnlock('TK', rTK, proxyData.cc)}`;
  const textAI = `${fmtUnlock('GPT', rGPT, proxyData.cc)}   ${fmtUnlock('CL', rCL, proxyData.cc)}   ${fmtUnlock('GM', rGM, proxyData.cc)}`;

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const TIME_COL = isNightTheme
    ? { light: 'rgba(247,242,255,0.55)', dark: 'rgba(234,240,255,0.50)' }
    : { light: 'rgba(58,40,8,0.45)', dark: 'rgba(255,247,214,0.50)' };

  const family = ctx.widgetFamily || "systemMedium";
  const isLargeWidget = family === "systemLarge" || family === "systemExtraLarge";

  // 8. 中号原版行组件：保持显示内容不变
  const Row = (ic, icCol, label, val, valCol) => ({
    type: 'stack',
    direction: 'row',
    alignItems: 'center',
    gap: 5,
    children: [
      {
        type: 'image',
        src: `sf-symbol:${ic}`,
        color: icCol,
        width: 11,
        height: 11
      },
      {
        type: 'text',
        text: label,
        font: { size: 10, weight: 'regular' },
        textColor: C.dim,
        maxLines: 1
      },
      { type: 'spacer' },
      {
        type: 'text',
        text: val,
        font: { size: 10, weight: 'medium' },
        textColor: valCol,
        maxLines: 1,
        minScale: 0.4
      }
    ]
  });

  // 9. 大号布局组件
  const Card = (children, opt = {}) => ({
    type: 'stack',
    direction: 'column',
    gap: opt.gap ?? 7,
    padding: opt.padding ?? [10, 10, 10, 10],
    backgroundColor: opt.strong ? C.cardBgStrong : C.cardBg,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: C.cardBorder,
    flex: opt.flex,
    children
  });

  const SectionTitle = (icon, title, color) => ({
    type: 'stack',
    direction: 'row',
    alignItems: 'center',
    gap: 6,
    children: [
      {
        type: 'image',
        src: `sf-symbol:${icon}`,
        color,
        width: 14,
        height: 14
      },
      {
        type: 'text',
        text: title,
        font: { size: 13, weight: 'bold' },
        textColor: C.text,
        maxLines: 1
      }
    ]
  });

  const BigRow = (ic, icCol, label, val, valCol = C.text) => ({
    type: 'stack',
    direction: 'row',
    alignItems: 'center',
    gap: 6,
    children: [
      {
        type: 'image',
        src: `sf-symbol:${ic}`,
        color: icCol,
        width: 13,
        height: 13
      },
      {
        type: 'text',
        text: label,
        font: { size: 11, weight: 'regular' },
        textColor: C.dim,
        maxLines: 1
      },
      { type: 'spacer' },
      {
        type: 'text',
        text: val,
        font: { size: 12, weight: 'semibold' },
        textColor: valCol,
        maxLines: 1,
        minScale: 0.55,
        textAlign: 'right'
      }
    ]
  });

  const SummaryCard = (icon, iconCol, title, main, sub) => ({
    type: 'stack',
    direction: 'column',
    gap: 5,
    padding: [10, 10, 9, 10],
    backgroundColor: C.cardBgStrong,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: C.cardBorder,
    flex: 1,
    children: [
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 6,
        children: [
          {
            type: 'image',
            src: `sf-symbol:${icon}`,
            color: iconCol,
            width: 15,
            height: 15
          },
          {
            type: 'text',
            text: title,
            font: { size: 11, weight: 'medium' },
            textColor: C.dim,
            maxLines: 1
          }
        ]
      },
      {
        type: 'text',
        text: main,
        font: { size: 14, weight: 'bold' },
        textColor: C.text,
        maxLines: 1,
        minScale: 0.55
      },
      {
        type: 'text',
        text: sub,
        font: { size: 10, weight: 'medium' },
        textColor: C.muted,
        maxLines: 1,
        minScale: 0.5
      }
    ]
  });

  const getUnlockInfo = (res, cc) => {
    if (res === "❌") {
      return {
        main: "不可用",
        detail: "Blocked",
        icon: "xmark.circle.fill",
        color: C.red
      };
    }

    if (res === "🍿") {
      return {
        main: "仅原创",
        detail: "Original",
        icon: "play.circle.fill",
        color: C.yellow
      };
    }

    if (res === "APP") {
      return {
        main: "App 可用",
        detail: "APP",
        icon: "checkmark.circle.fill",
        color: C.netRx
      };
    }

    const region = res === "OK" || res === "XX" ? cc : res;
    return {
      main: "可用",
      detail: `${getFlag(region)} ${region}`,
      icon: "checkmark.circle.fill",
      color: C.netRx
    };
  };

  const UnlockTile = (name, icon, res, cc, iconColor) => {
    const info = getUnlockInfo(res, cc);
    return {
      type: 'stack',
      direction: 'column',
      gap: 5,
      padding: [8, 9, 8, 9],
      backgroundColor: C.cardBg,
      borderRadius: 13,
      borderWidth: 0.5,
      borderColor: C.cardBorder,
      flex: 1,
      children: [
        {
          type: 'stack',
          direction: 'row',
          alignItems: 'center',
          gap: 5,
          children: [
            {
              type: 'image',
              src: `sf-symbol:${icon}`,
              color: iconColor,
              width: 13,
              height: 13
            },
            {
              type: 'text',
              text: name,
              font: { size: 11, weight: 'bold' },
              textColor: C.text,
              maxLines: 1,
              minScale: 0.55
            },
            { type: 'spacer' },
            {
              type: 'image',
              src: `sf-symbol:${info.icon}`,
              color: info.color,
              width: 12,
              height: 12
            }
          ]
        },
        {
          type: 'text',
          text: info.main,
          font: { size: 11, weight: 'semibold' },
          textColor: info.color,
          maxLines: 1
        },
        {
          type: 'text',
          text: info.detail,
          font: { size: 10, weight: 'medium' },
          textColor: C.dim,
          maxLines: 1,
          minScale: 0.55
        }
      ]
    };
  };

  // 10. 大号小组件：重新设计
  if (isLargeWidget) {
    return {
      type: 'widget',
      padding: [16, 15, 15, 15],
      gap: 10,
      backgroundColor: C.bg,
      children: [
        // Header
        {
          type: 'stack',
          direction: 'row',
          alignItems: 'center',
          gap: 8,
          children: [
            {
              type: 'image',
              src: 'sf-symbol:waveform.path.ecg',
              color: C.text,
              width: 20,
              height: 20
            },
            {
              type: 'stack',
              direction: 'column',
              gap: 1,
              flex: 1,
              children: [
                {
                  type: 'text',
                  text: '网络诊断雷达',
                  font: { size: 17, weight: 'bold' },
                  textColor: C.text,
                  maxLines: 1
                },
                {
                  type: 'text',
                  text: 'Local · Proxy · Unlock',
                  font: { size: 10, weight: 'medium' },
                  textColor: C.dim,
                  maxLines: 1
                }
              ]
            },
            {
              type: 'date',
              date: new Date().toISOString(),
              format: 'time',
              font: { size: 11, weight: 'semibold' },
              textColor: TIME_COL,
              maxLines: 1
            }
          ]
        },

        // 顶部状态摘要
        {
          type: 'stack',
          direction: 'row',
          gap: 8,
          children: [
            SummaryCard(netIcon, C.cpu, "本地网络", netName, `内网 ${localIp}`),
            SummaryCard("paperplane.fill", C.mem, "代理出口", proxyData.loc || "未知", proxyData.isp || "未知"),
            SummaryCard(riskIc, riskCol, "出口纯净", riskTxt, nativeText)
          ]
        },

        // 本地链路 + 代理出口
        {
          type: 'stack',
          direction: 'row',
          gap: 9,
          children: [
            Card([
              SectionTitle("network", "本地链路", C.cpu),
              BigRow(netIcon, C.cpu, "环境", netName, C.text),
              BigRow("wifi.router.fill", C.cpu, "网关", gateway, C.text),
              BigRow("iphone", C.cpu, "内网", localIp, C.text),
              BigRow("globe.asia.australia.fill", C.cpu, "公网", localData.ip, C.text),
              BigRow("map.fill", C.cpu, "位置", localData.loc, C.text),
              BigRow("timer", C.cpu, "延迟", localDelay, C.text)
            ], { flex: 1 }),

            Card([
              SectionTitle("server.rack", "代理出口", C.mem),
              BigRow("paperplane.fill", C.mem, "出口", proxyData.ip, C.text),
              BigRow("mappin.and.ellipse", C.mem, "落地", proxyData.loc, C.text),
              BigRow("server.rack", C.mem, "厂商", proxyData.isp, C.text),
              BigRow(nativeIc, nativeCol, "属性", nativeText, nativeCol),
              BigRow(riskIc, riskCol, "纯净", riskTxt, riskCol),
              BigRow("timer", C.mem, "延迟", proxyDelay, C.text)
            ], { flex: 1 })
          ]
        },

        // 流媒体解锁详情
        Card([
          SectionTitle("play.tv.fill", "流媒体解锁", C.cpu),
          {
            type: 'stack',
            direction: 'row',
            gap: 7,
            children: [
              UnlockTile("Netflix", "play.rectangle.fill", rNF, proxyData.cc, C.cpu),
              UnlockTile("Disney+", "star.fill", rDP, proxyData.cc, C.yellow),
              UnlockTile("TikTok", "music.note", rTK, proxyData.cc, C.netTx)
            ]
          }
        ], { gap: 7, padding: [10, 10, 10, 10] }),

        // AI 解锁详情
        Card([
          SectionTitle("sparkles", "AI 解锁", C.mem),
          {
            type: 'stack',
            direction: 'row',
            gap: 7,
            children: [
              UnlockTile("ChatGPT", "message.fill", rGPT, proxyData.cc, C.mem),
              UnlockTile("Claude", "text.bubble.fill", rCL, proxyData.cc, C.cpu),
              UnlockTile("Gemini", "circle.grid.2x2.fill", rGM, proxyData.cc, C.netTx)
            ]
          }
        ], { gap: 7, padding: [10, 10, 10, 10] })
      ]
    };
  }

  // 11. 中号小组件：显示内容保持原版不变
  return {
    type: 'widget',
    padding: 14,
    backgroundColor: C.bg,
    children: [
      // 顶部 Header
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 6,
        children: [
          {
            type: 'image',
            src: 'sf-symbol:waveform.path.ecg',
            color: C.text,
            width: 16,
            height: 16
          },
          {
            type: 'text',
            text: '网络诊断雷达',
            font: { size: 14, weight: 'bold' },
            textColor: C.text
          },
          { type: 'spacer' },
          {
            type: 'text',
            text: timeStr,
            font: { size: 10, weight: 'medium' },
            textColor: TIME_COL
          }
        ]
      },
      { type: 'spacer', length: 12 },

      // 双列网格
      {
        type: 'stack',
        direction: 'row',
        gap: 10,
        children: [
          // 左列：本地与影视
          {
            type: 'stack',
            direction: 'column',
            gap: 4.5,
            flex: 1,
            children: [
              Row(netIcon, C.cpu, "环境", netName, C.text),
              Row("wifi.router.fill", C.cpu, "网关", gateway, C.text),
              Row("iphone", C.cpu, "内网", localIp, C.text),
              Row("globe.asia.australia.fill", C.cpu, "公网", localData.ip, C.text),
              Row("map.fill", C.cpu, "位置", localData.loc, C.text),
              Row("timer", C.cpu, "延迟", localDelay, C.text),
              Row("play.tv.fill", C.cpu, "影视", textVideo, C.text)
            ]
          },

          // 中轴线
          {
            type: 'stack',
            width: 0.5,
            backgroundColor: C.barBg
          },

          // 右列：代理与 AI
          {
            type: 'stack',
            direction: 'column',
            gap: 4.5,
            flex: 1,
            children: [
              Row("paperplane.fill", C.mem, "出口", proxyData.ip, C.text),
              Row("mappin.and.ellipse", C.mem, "落地", proxyData.loc, C.text),
              Row("server.rack", C.mem, "厂商", proxyData.isp, C.text),
              Row(nativeIc, nativeCol, "属性", nativeText, C.text),
              Row(riskIc, riskCol, "纯净", riskTxt, riskCol),
              Row("timer", C.mem, "延迟", proxyDelay, C.text),
              Row("cpu", C.mem, "AI", textAI, C.text)
            ]
          }
        ]
      },
      { type: 'spacer' }
    ]
  };
}
