/**
 * 任务倒计时 · Egern Widget
 * 重构：Chance
 *
 * 环境变量：
 * TITLE / MAX_ITEMS / REFRESH_MIN / TZ_OFFSET
 * NAME1 / DATE1 / DETAIL1 ... NAME20 / DATE20 / DETAIL20
 */

export default async function (ctx) {
  const env = ctx.env || {};
  const family = ctx.widgetFamily || "systemMedium";
  const compact = family === "systemSmall" || family === "systemMedium";
  const isLarge = family === "systemLarge" || family === "systemExtraLarge";
  const title = String(env.TITLE || "任务倒计时").trim();
  const refreshMin = clampInt(env.REFRESH_MIN, 5, 1440, 30);
  const maxItems = clampInt(env.MAX_ITEMS, 1, 20, familyLimit());
  const tzOffset = parseOffset(env.TZ_OFFSET);
  const refreshAfter = new Date(Date.now() + refreshMin * 60000).toISOString();


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
    bg: { light:"#F4F0E8", dark:"#191713" },
    text: { light:"#27231E", dark:"#F4EEE5" },
    sub: { light:"#81776B", dark:"#AEA397" },
    line: { light:"#DDD4C8", dark:"#3A342E" },
    urgent: { light:"#C14D43", dark:"#F18A80" },
    soon: { light:"#BD7B20", dark:"#E8B462" },
    near: { light:"#6E7FA5", dark:"#AAB9D8" },
    calm: { light:"#7F8791", dark:"#B5BDC7" },
    today: { light:"#21845A", dark:"#63D69A" },
  };

  function clampInt(v,min,max,fallback){
    const n = Number.parseInt(v,10);
    return Number.isFinite(n) ? Math.max(min,Math.min(max,n)) : fallback;
  }

  function parseOffset(v) {
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(-12, Math.min(14, n)) : null;
  }

  function familyLimit() {
    if (family === "systemSmall") return 2;
    if (family === "systemMedium") return 3;
    if (family === "systemLarge") return 6;
    if (family === "systemExtraLarge") return 8;
    return 3;
  }

  function parseDate(input) {
    if (!input) return null;
    const m = String(input).trim().replace(/[/.]/g,"-").match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (!m) return null;
    const y = +m[1], mo = +m[2], d = +m[3];
    const dt = new Date(y, mo - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d ? dt : null;
  }

  function dayNumber(date) {
    if (!date) return null;
    if (tzOffset == null) return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;
    const shifted = new Date(date.getTime() + tzOffset * 3600000);
    return Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) / 86400000;
  }

  function todayNumber() {
    const now = new Date();
    if (tzOffset == null) return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000;
    const shifted = new Date(now.getTime() + tzOffset * 3600000);
    return Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) / 86400000;
  }

  function daysLeft(date) {
    return date ? Math.round(dayNumber(date) - todayNumber()) : null;
  }

  const items = [];
  for (let i=1;i<=20;i++) {
    const name = env[`NAME${i}`];
    const date = parseDate(env[`DATE${i}`]);
    const detail = env[`DETAIL${i}`] || "";
    if (!name && !date && !detail) continue;
    const days = daysLeft(date);
    if (date && days < 0) continue;
    items.push({ name:String(name || `任务 ${i}`), detail:String(detail), date, days });
  }

  if (!items.length && (env.NAME || env.DATE || env.DETAIL)) {
    const date = parseDate(env.DATE);
    const days = daysLeft(date);
    if (!(date && days < 0)) items.push({ name:String(env.NAME || "任务"), detail:String(env.DETAIL || ""), date, days });
  }

  items.sort((a,b) => (a.days ?? 999999) - (b.days ?? 999999));
  const visible = items.slice(0,maxItems);

  function tone(days) {
    if (days === 0) return C.today;
    if (days == null || days > 30) return C.calm;
    if (days <= 3) return C.urgent;
    if (days <= 14) return C.soon;
    return C.near;
  }

  function display(days) {
    if (days == null) return "--";
    if (days === 0) return "TODAY";
    return `${days}d`;
  }

  const Text=(text,size,weight="regular",color=C.text,extra={})=>({
    type:"text",text:String(text),font:{size,weight},textColor:color,maxLines:1,minScale:0.42,...extra
  });
  const Icon=(name,color,size)=>({type:"image",src:`sf-symbol:${name}`,color,width:size,height:size});
  const Divider=()=>({type:"stack",height:1,backgroundColor:C.line,children:[]});

  const first = visible[0];
  if (family === "accessoryInline") {
    return { type:"widget", refreshAfter, children:[Text(first ? `${first.name} · ${display(first.days)}` : `${title} · 未配置`, "caption1", "semibold")] };
  }
  if (family === "accessoryCircular") {
    return {
      type:"widget", refreshAfter, padding:4, gap:1,
      children:[
        Icon(first?.days === 0 ? "checkmark.circle.fill" : "timer", tone(first?.days), 17),
        Text(first ? display(first.days) : "--", "headline", "bold", tone(first?.days), {textAlign:"center"}),
        Text(first ? first.name : "未配置", "caption2", "medium", C.sub, {textAlign:"center"}),
      ],
    };
  }
  if (family === "accessoryRectangular") {
    return {
      type:"widget", refreshAfter, gap:2,
      children:first ? [
        {type:"stack",direction:"row",alignItems:"center",gap:4,children:[Icon("timer",tone(first.days),11),Text(title,"caption1","semibold"),{type:"spacer"},Text(display(first.days),"headline","bold",tone(first.days))]},
        Text(first.name,"headline","bold"),
        Text(first.detail || "最近任务","caption2","medium",C.sub),
      ] : [Text(title,"caption1","semibold"),Text("未配置任务","headline","bold"),Text("使用 NAME1 / DATE1 / DETAIL1","caption2","medium",C.sub)],
    };
  }


  function orbitSvg(item, width=282, height=76) {
    const days = Number.isFinite(item?.days) ? Math.max(0,item.days) : 60;
    const ratio = Math.max(.04, Math.min(.96, 1-Math.min(days,60)/60));
    const angle = Math.PI + ratio*Math.PI;
    const cx=width/2, cy=height/2+8, rx=width*.39, ry=height*.34;
    const x=cx+rx*Math.cos(angle), y=cy+ry*Math.sin(angle);
    const color=days===0?"#3FD18C":days<=3?"#FF6E76":days<=14?"#F0B14E":days<=30?"#879AFF":"#8D95A2";
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs><filter id="g"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      <path d="M${cx-rx} ${cy} A${rx} ${ry} 0 0 1 ${cx+rx} ${cy}" fill="none" stroke="#FFFFFF" stroke-opacity=".12" stroke-width="4" stroke-linecap="round"/>
      <path d="M${cx-rx} ${cy} A${rx} ${ry} 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round"/>
      <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5" fill="${color}" filter="url(#g)"/>
      <circle cx="${cx+rx}" cy="${cy}" r="4" fill="#FFFFFF" fill-opacity=".75"/>
    </svg>`;
    return svgData(svg);
  }

  function row(item) {
    const color=tone(item.days);
    return {
      type:"stack", direction:"row", alignItems:"center", gap:isLarge?12:9, flex:1,
      children:[
        { type:"stack", direction:"column", flex:1, gap:compact?1:2, children:[
          Text(item.name, compact?13:16, "bold", C.text),
          Text(item.detail || " ", compact?9:11, "medium", C.sub),
        ]},
        Text(display(item.days), item.days===0 ? (compact?17:22) : (compact?24:31), "bold", color, {textAlign:"right"}),
      ],
    };
  }

  if (!visible.length) {
    return {
      type:"widget", refreshAfter, padding:14, gap:8, backgroundColor:C.bg,
      children:[
        {type:"stack",direction:"row",alignItems:"center",gap:6,children:[Icon("timer",C.sub,13),Text(title,12,"bold"),{type:"spacer"}]},
        {type:"spacer"},
        Text("未配置任务","headline","bold",C.text,{textAlign:"center"}),
        Text("使用 NAME1 / DATE1 / DETAIL1","caption1","medium",C.sub,{textAlign:"center",maxLines:2}),
        {type:"spacer"},
      ],
    };
  }

  const children=[
    {type:"stack",direction:"row",alignItems:"center",gap:6,children:[
      Icon("timer",C.sub,isLarge?14:12),
      Text(title,isLarge?14:12,"bold"),
      {type:"spacer"},
      Text(`${visible.length} 项`,isLarge?10:9,"medium",C.sub),
    ]},
    {
      type:"image",
      src:orbitSvg(visible[0],isLarge?282:248,isLarge?76:58),
      width:isLarge?282:248,
      height:isLarge?76:58,
      resizeMode:"contain"
    },
    Divider(),
  ];
  visible.forEach((item,index)=>{
    children.push(row(item));
    if(index!==visible.length-1) children.push(Divider());
  });

  return {
    type:"widget",
    refreshAfter,
    padding:isLarge?[13,15,13,15]:[11,13,11,13],
    gap:isLarge?7:5,
    backgroundColor:C.bg,
    children,
  };
}
