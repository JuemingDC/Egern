/**
 * 今日油价 · Egern Widget
 * 重构：Chance
 * 数据源：http://m.qiyoujiage.com/
 */

export default async function (ctx) {
  const env = ctx.env || {};
  const family = ctx.widgetFamily || "systemMedium";
  const isLarge = family === "systemLarge" || family === "systemExtraLarge";
  const region = String(env.region || env.REGION || "hainan/haikou").trim();
  const showTrend = String(env.SHOW_TREND || "true").toLowerCase() !== "false";
  const refreshHours = clampInt(env.REFRESH_HOURS, 1, 24, 6);
  const refreshAfter = new Date(Date.now() + refreshHours * 3600000).toISOString();
  const cacheKey = `chance_oil_v3_${region}`;


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

  const C = {
    bg: { light: "#F5F1E8", dark: "#171410" },
    text: { light: "#29251F", dark: "#FFF7EB" },
    sub: { light: "#7C7469", dark: "#B9AC9D" },
    line: { light: "#DDD4C7", dark: "#3B332B" },
    p92: { light: "#B77B10", dark: "#F4C85D" },
    p95: { light: "#C5622C", dark: "#F59B67" },
    p98: { light: "#B64750", dark: "#F18A91" },
    diesel: { light: "#287A55", dark: "#69D49C" },
    up: { light: "#C4493F", dark: "#F08C82" },
    down: { light: "#27805D", dark: "#67D5A2" },
  };

  const map = {
    beijing:"北京",shanghai:"上海",tianjin:"天津",chongqing:"重庆",
    guangdong:"广东",jiangsu:"江苏",zhejiang:"浙江",shandong:"山东",henan:"河南",
    hebei:"河北",sichuan:"四川",hubei:"湖北",hunan:"湖南",anhui:"安徽",fujian:"福建",
    jiangxi:"江西",liaoning:"辽宁",hainan:"海南",jilin:"吉林",heilongjiang:"黑龙江",
    yunnan:"云南",guizhou:"贵州",guangxi:"广西",gansu:"甘肃",qinghai:"青海",
    ningxia:"宁夏",xinjiang:"新疆",xizang:"西藏",neimenggu:"内蒙古",
    guangzhou:"广州",nanjing:"南京",hangzhou:"杭州",jinan:"济南",zhengzhou:"郑州",
    shijiazhuang:"石家庄",chengdu:"成都",wuhan:"武汉",changsha:"长沙",hefei:"合肥",
    fuzhou:"福州",nanchang:"南昌",shenyang:"沈阳",haikou:"海口",changchun:"长春",
    haerbin:"哈尔滨",kunming:"昆明",guiyang:"贵阳",nanning:"南宁",lanzhou:"兰州",
    xining:"西宁",yinchuan:"银川",wulumuqi:"乌鲁木齐",lasa:"拉萨",
    huhehaote:"呼和浩特",xian:"西安",taiyuan:"太原",yancheng:"盐城",
    "shanxi-1":"山西","shanxi-3":"陕西"
  };

  function clampInt(v, min, max, fallback) {
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
  }

  function regionName() {
    const parts = region.split("/");
    const key = parts[1] || parts[0];
    return map[key] || key || "当前地区";
  }

  function parsePrices(html) {
    const rows = [];
    for (const block of html.match(/<dl>[\s\S]+?<\/dl>/gi) || []) {
      const name = block.match(/<dt[^>]*>([^<]+)<\/dt>/i)?.[1]?.trim() || "";
      const raw = block.match(/<dd[^>]*>([^<]+)<\/dd>/i)?.[1] || "";
      const value = Number.parseFloat(raw.match(/[\d.]+/)?.[0]);
      if (name.includes("油") && Number.isFinite(value)) rows.push({ name, value });
    }
    const result = { p92: null, p95: null, p98: null, diesel: null };
    for (const row of rows) {
      if (/92/.test(row.name)) result.p92 = row.value;
      else if (/95/.test(row.name)) result.p95 = row.value;
      else if (/98/.test(row.name)) result.p98 = row.value;
      else if (/柴油|0号|0 号/.test(row.name)) result.diesel = row.value;
    }
    return result;
  }

  function parseTrend(html) {
    const m = html.match(/<div class="tishi">[\s\S]*?<span>([^<]+)<\/span>[\s\S]*?<br\/>([\s\S]+?)<br\/>/i);
    if (!m) return "";
    const date = (m[1].match(/(\d{1,2}月\d{1,2}日)/) || [])[1] || "";
    const body = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const down = /下调|下跌/.test(body);
    const amount = body.match(/([\d.]+)\s*[-至~]\s*([\d.]+)\s*元\/升/i);
    const ton = body.match(/([\d.]+)\s*元\/吨/i);
    const value = amount ? `${amount[1]}–${amount[2]} 元/升` : ton ? `${ton[1]} 元/吨` : "";
    return [date, down ? "下调" : "上调", value].filter(Boolean).join(" ");
  }

  let state = ctx.storage.getJSON(cacheKey) || { prices: {}, trend: "", savedAt: 0, stale: true };
  try {
    const resp = await ctx.http.get(`http://m.qiyoujiage.com/${region}.shtml`, {
      headers: { referer: "http://m.qiyoujiage.com/", "user-agent": "Mozilla/5.0" },
      timeout: 15000,
    });
    if (resp.status !== 200) throw new Error(`HTTP ${resp.status}`);
    const html = await resp.text();
    const prices = parsePrices(html);
    if ([prices.p92, prices.p95, prices.p98, prices.diesel].filter(Number.isFinite).length < 3) {
      throw new Error("价格解析失败");
    }
    state = { prices, trend: showTrend ? parseTrend(html) : "", savedAt: Date.now(), stale: false };
    ctx.storage.setJSON(cacheKey, state);
  } catch {
    state.stale = true;
  }

  const items = [
    { key:"p92", label:"92", sub:"汽油", color:C.p92 },
    { key:"p95", label:"95", sub:"汽油", color:C.p95 },
    { key:"p98", label:"98", sub:"汽油", color:C.p98 },
    { key:"diesel", label:"0", sub:"柴油", color:C.diesel },
  ].filter(x => Number.isFinite(state.prices?.[x.key]));

  const trendDown = /下调|下跌/.test(state.trend || "");
  const trendColor = trendDown ? C.down : C.up;
  const Text = (text, size, weight="regular", color=C.text, extra={}) => ({
    type:"text", text:String(text), font:{size,weight}, textColor:color,
    maxLines:1, minScale:0.5, ...extra,
  });
  const Icon = (name,color,size) => ({
    type:"image", src:`sf-symbol:${name}`, color, width:size, height:size,
  });
  const Divider = () => ({ type:"stack", height:1, backgroundColor:C.line, children:[] });

  if (family === "accessoryInline") {
    const p = state.prices?.p92;
    return { type:"widget", refreshAfter, children:[Text(`${regionName()} 92# ${Number.isFinite(p) ? p.toFixed(2) : "--"} 元/升`, "caption1", "semibold")] };
  }

  if (family === "accessoryCircular") {
    const p = state.prices?.p95 ?? state.prices?.p92;
    return {
      type:"widget", refreshAfter, padding:4, gap:1,
      children:[
        Icon("fuelpump.fill", C.p95, 17),
        Text(Number.isFinite(p) ? p.toFixed(2) : "--", "headline", "bold", C.text, {textAlign:"center"}),
        Text("元/升", "caption2", "medium", C.sub, {textAlign:"center"}),
      ],
    };
  }

  if (family === "accessoryRectangular") {
    const p92 = Number.isFinite(state.prices?.p92) ? state.prices.p92.toFixed(2) : "--";
    const p95 = Number.isFinite(state.prices?.p95) ? state.prices.p95.toFixed(2) : "--";
    return {
      type:"widget", refreshAfter, gap:2,
      children:[
        { type:"stack", direction:"row", alignItems:"center", gap:4, children:[Icon("fuelpump.fill", C.p92, 11), Text(`${regionName()}油价`, "caption1", "semibold"), {type:"spacer"}, state.stale ? Text("缓存", "caption2", "medium", C.sub) : Text("实时", "caption2", "medium", C.down)] },
        Text(`92#  ${p92}    95#  ${p95}`, "headline", "bold"),
        showTrend && state.trend ? Text(state.trend, "caption2", "medium", trendColor) : Text("元/升", "caption2", "medium", C.sub),
      ],
    };
  }


  function spectrumSvg(items) {
    const values = items.map(x => Number(state.prices?.[x.key])).filter(Number.isFinite);
    const min = values.length ? Math.min(...values) - .12 : 0;
    const max = values.length ? Math.max(...values) + .12 : 1;
    const colors = ["#39D6A2","#F0B44C","#FF6672","#43A8FF"];
    const tubes = items.map((item,i) => {
      const v = Number(state.prices?.[item.key]);
      if (!Number.isFinite(v)) return "";
      const ratio = Math.max(.12, Math.min(1,(v-min)/Math.max(.1,max-min)));
      const h = 10 + ratio*34;
      const x = 12+i*34;
      const y = 52-h;
      return `<rect x="${x}" y="6" width="18" height="46" rx="9" fill="none" stroke="#FFFFFF" stroke-opacity=".22" stroke-width="1.4"/>
      <rect x="${x+2}" y="${y}" width="14" height="${52-y-2}" rx="7" fill="${colors[i]}" fill-opacity=".88"/>
      <ellipse cx="${x+9}" cy="${y}" rx="7" ry="2.3" fill="${colors[i]}"/>`;
    }).join("");
    return svgData(`<svg xmlns="http://www.w3.org/2000/svg" width="140" height="58" viewBox="0 0 140 58">${tubes}</svg>`);
  }

  function priceCell(item) {
    const value = state.prices[item.key];
    return {
      type:"stack", direction:"column", flex:1, gap:isLarge ? 2 : 1,
      children:[
        { type:"stack", direction:"row", alignItems:"center", gap:4, children:[
          Text(item.label, isLarge ? 15 : 12, "heavy", item.color),
          Text(item.sub, isLarge ? 10 : 9, "medium", C.sub),
        ]},
        Text(value.toFixed(2), isLarge ? 30 : 24, "bold", C.text),
        Text("元/升", isLarge ? 10 : 9, "medium", C.sub),
      ],
    };
  }

  const firstRow = items.slice(0,2);
  const secondRow = items.slice(2,4);

  return {
    type:"widget",
    refreshAfter,
    padding:isLarge ? [14,16,14,16] : [11,13,11,13],
    gap:isLarge ? 10 : 7,
    backgroundColor:C.bg,
    children:[
      { type:"stack", direction:"row", alignItems:"center", gap:6, children:[
        Icon("fuelpump.fill", C.p92, isLarge ? 15 : 13),
        Text(`${regionName()}实时油价`, isLarge ? 14 : 12, "bold"),
        state.stale ? Text("缓存数据", isLarge ? 10 : 9, "medium", C.sub) : Text("LIVE", isLarge ? 10 : 9, "bold", C.down),
        {type:"spacer"},
        {type:"image",src:spectrumSvg(items),width:isLarge?132:104,height:isLarge?54:42,resizeMode:"contain"},
        { type:"date", date:new Date().toISOString(), format:"time", font:{size:isLarge ? 10 : 9,weight:"medium"}, textColor:C.sub },
      ]},
      Divider(),
      { type:"stack", direction:"row", gap:isLarge ? 20 : 12, flex:1, children:firstRow.map(priceCell) },
      secondRow.length ? Divider() : {type:"spacer",length:0},
      secondRow.length ? { type:"stack", direction:"row", gap:isLarge ? 20 : 12, flex:1, children:secondRow.map(priceCell) } : {type:"spacer",length:0},
      ...(showTrend && state.trend ? [
        Divider(),
        { type:"stack", direction:"row", alignItems:"center", gap:5, children:[
          Icon(trendDown ? "arrow.down.right" : "arrow.up.right", trendColor, isLarge ? 12 : 10),
          Text(state.trend, isLarge ? 11 : 9, "semibold", trendColor, {flex:1}),
        ]},
      ] : []),
    ],
  };
}
