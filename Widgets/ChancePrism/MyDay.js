/**
 * 节日黄历 · Egern Widget
 * 重构：Chance
 *
 * 设计：
 * - 当前日期、星期、农历为视觉主轴
 * - 只展示最近的节日 / 节气倒计时
 * - 不使用徽章、胶囊和卡片套卡片
 * - 使用 Intl 中国农历历法，避免维护超长农历常量表
 */

export default async function (ctx) {
  const env = ctx.env || {};
  const family = ctx.widgetFamily || "systemMedium";
  const isLarge = family === "systemLarge" || family === "systemExtraLarge";
  const refreshMin = clampInt(env.REFRESH_MIN, 10, 1440, 60);
  const maxEvents = clampInt(env.MAX_EVENTS, 1, 8, isLarge ? 5 : 3);
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
    bg: { light:"#F4F0E8", dark:"#181714" },
    text: { light:"#29251F", dark:"#F4EFE8" },
    sub: { light:"#80766A", dark:"#AEA397" },
    line: { light:"#DDD5C9", dark:"#39342E" },
    red: { light:"#B94B44", dark:"#EE8B84" },
    gold: { light:"#A97826", dark:"#DDB86D" },
    green: { light:"#2D7B5D", dark:"#70CFA3" },
    blue: { light:"#5D739A", dark:"#A7B8D8" },
  };

  function clampInt(v,min,max,fallback){
    const n=Number.parseInt(v,10);
    return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;
  }
  function startOfDay(d){ return new Date(d.getFullYear(),d.getMonth(),d.getDate()); }
  function diffDays(a,b){ return Math.round((startOfDay(b)-startOfDay(a))/86400000); }
  function ymd(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
  function addDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }

  const now=new Date();
  const weekdays=["周日","周一","周二","周三","周四","周五","周六"];
  const week=weekdays[now.getDay()];
  const solarTitle=`${now.getMonth()+1}月${now.getDate()}日`;

  function lunarParts(date) {
    try {
      const fmt=new Intl.DateTimeFormat("zh-CN-u-ca-chinese",{
        year:"numeric",month:"long",day:"numeric"
      });
      const parts=fmt.formatToParts(date);
      const get=t=>parts.find(x=>x.type===t)?.value || "";
      const month=get("month");
      const day=Number(get("day"));
      const relatedYear=Number(get("relatedYear") || get("year"));
      return {month,day,year:relatedYear,text:fmt.format(date)};
    } catch {
      return {month:"农历",day:0,year:now.getFullYear(),text:"农历日期不可用"};
    }
  }

  function chineseDay(n) {
    const names=["初一","初二","初三","初四","初五","初六","初七","初八","初九","初十",
      "十一","十二","十三","十四","十五","十六","十七","十八","十九","二十",
      "廿一","廿二","廿三","廿四","廿五","廿六","廿七","廿八","廿九","三十"];
    return names[n-1] || "";
  }

  const lunar=lunarParts(now);
  const lunarText=lunar.month && lunar.day ? `${lunar.month}${chineseDay(lunar.day)}` : lunar.text;

  function fixedEvent(name,month,day,color=C.red) {
    let d=new Date(now.getFullYear(),month-1,day);
    if(diffDays(now,d)<0) d=new Date(now.getFullYear()+1,month-1,day);
    return {name,date:d,color,type:"节日"};
  }

  function nthWeekday(year,month,weekday,n) {
    const first=new Date(year,month-1,1);
    return new Date(year,month-1,1+((weekday-first.getDay()+7)%7)+(n-1)*7);
  }

  function weekdayEvent(name,month,weekday,n,color=C.red) {
    let d=nthWeekday(now.getFullYear(),month,weekday,n);
    if(diffDays(now,d)<0) d=nthWeekday(now.getFullYear()+1,month,weekday,n);
    return {name,date:d,color,type:"节日"};
  }

  function findLunar(monthText,day,name,color=C.gold) {
    const normalized=String(monthText).replace("月","");
    for(let i=0;i<800;i++){
      const d=addDays(now,i);
      const lp=lunarParts(d);
      const m=String(lp.month).replace("月","").replace("闰","");
      if(m===normalized && lp.day===day) return {name,date:d,color,type:"农历"};
    }
    return null;
  }

  const ST_NAMES=["小寒","大寒","立春","雨水","惊蛰","春分","清明","谷雨","立夏","小满","芒种","夏至","小暑","大暑","立秋","处暑","白露","秋分","寒露","霜降","立冬","小雪","大雪","冬至"];
  const ST_MIN=[0,21208,42467,63836,85337,107014,128867,150921,173149,195551,218072,240693,263343,285989,308563,331033,353350,375494,397447,419210,440795,462224,483532,504758];
  function solarTermDate(year,index){
    const base=Date.UTC(1900,0,6,2,5);
    return new Date(base + 31556925974.7*(year-1900) + ST_MIN[index]*60000);
  }
  function nextSolarTerms(count=3){
    const list=[];
    for(let y=now.getFullYear();y<=now.getFullYear()+1;y++){
      for(let i=0;i<24;i++){
        const d=solarTermDate(y,i);
        if(diffDays(now,d)>=0) list.push({name:ST_NAMES[i],date:d,color:C.green,type:"节气"});
      }
    }
    return list.sort((a,b)=>a.date-b.date).slice(0,count);
  }

  const events=[
    fixedEvent("元旦",1,1),
    fixedEvent("情人节",2,14),
    fixedEvent("劳动节",5,1),
    weekdayEvent("母亲节",5,0,2),
    weekdayEvent("父亲节",6,0,3),
    fixedEvent("国庆节",10,1),
    fixedEvent("圣诞节",12,25),
    findLunar("正",1,"春节"),
    findLunar("正",15,"元宵"),
    findLunar("五",5,"端午"),
    findLunar("八",15,"中秋"),
    ...nextSolarTerms(4),
  ].filter(Boolean).sort((a,b)=>a.date-b.date);

  const unique=[];
  for(const e of events){
    const key=`${e.name}-${ymd(e.date)}`;
    if(!unique.some(x=>x.key===key)) unique.push({...e,key,days:diffDays(now,e.date)});
  }
  const upcoming=unique.filter(e=>e.days>=0).slice(0,maxEvents);

  const Text=(text,size,weight="regular",color=C.text,extra={})=>({
    type:"text",text:String(text),font:{size,weight},textColor:color,maxLines:1,minScale:0.45,...extra
  });
  const Icon=(name,color,size)=>({type:"image",src:`sf-symbol:${name}`,color,width:size,height:size});
  const Divider=()=>({type:"stack",height:1,backgroundColor:C.line,children:[]});

  const first=upcoming[0];

  function lunarApertureSvg(day, termIndex=0, size=92) {
    const phase=Math.max(0,Math.min(1,(Number(day)||1)/30));
    const offset=(phase-.5)*42;
    const dash=2*Math.PI*34;
    const progress=Math.max(.04,Math.min(.98,((termIndex>=0?termIndex:0)+1)/24));
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 96 96">
      <defs><clipPath id="m"><circle cx="48" cy="48" r="24"/></clipPath>
      <radialGradient id="moon"><stop stop-color="#FFF8DE"/><stop offset="1" stop-color="#D6C68D"/></radialGradient>
      <filter id="g"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      <circle cx="48" cy="48" r="35" fill="none" stroke="#FFFFFF" stroke-opacity=".12" stroke-width="2" stroke-dasharray="2 5"/>
      <circle cx="48" cy="48" r="35" fill="none" stroke="#DDB86D" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="${dash*progress} ${dash*(1-progress)}" transform="rotate(-90 48 48)"/>
      <circle cx="48" cy="48" r="24" fill="url(#moon)" filter="url(#g)"/>
      <circle cx="${48+offset}" cy="48" r="24" fill="#17181D" clip-path="url(#m)"/>
      <circle cx="48" cy="48" r="24" fill="none" stroke="#FFFFFF" stroke-opacity=".18"/>
    </svg>`;
    return svgData(svg);
  }


  if(family==="accessoryInline"){
    return {type:"widget",refreshAfter,children:[Text(`${solarTitle} ${lunarText} · ${first?`${first.name} ${first.days}d`:"今日安好"}`,"caption1","semibold")]};
  }
  if(family==="accessoryCircular"){
    return {
      type:"widget",refreshAfter,padding:4,gap:1,
      children:[
        Text(String(now.getDate()),"title2","bold",C.text,{textAlign:"center"}),
        Text(week,"caption2","medium",C.sub,{textAlign:"center"}),
        first?Text(first.days===0?"今日":`${first.days}d`,"caption1","bold",first.color,{textAlign:"center"}):Text("安","caption1","bold",C.green,{textAlign:"center"}),
      ],
    };
  }
  if(family==="accessoryRectangular"){
    return {
      type:"widget",refreshAfter,gap:2,
      children:[
        {type:"stack",direction:"row",alignItems:"center",gap:5,children:[Text(solarTitle,"headline","bold"),Text(week,"caption1","medium",C.sub),{type:"spacer"},Text(lunarText,"caption1","semibold",C.gold)]},
        first?Text(`${first.name} · ${first.days===0?"今天":`${first.days} 天`}`,"headline","bold",first.color):Text("今日安好","headline","bold",C.green),
        first?Text(`${first.type} · ${ymd(first.date).slice(5)}`,"caption2","medium",C.sub):Text("暂无近期事件","caption2","medium",C.sub),
      ],
    };
  }

  function eventRow(e){
    return {
      type:"stack",direction:"row",alignItems:"center",gap:isLarge?10:7,flex:1,
      children:[
        Icon(e.type==="节气"?"leaf.fill":e.type==="农历"?"moon.stars.fill":"calendar",e.color,isLarge?12:10),
        Text(e.name,isLarge?13:11,"bold",C.text,{flex:1}),
        Text(e.type,isLarge?10:9,"medium",C.sub),
        Text(e.days===0?"今天":`${e.days}d`,isLarge?16:13,"bold",e.color,{textAlign:"right"}),
      ],
    };
  }

  return {
    type:"widget",
    refreshAfter,
    padding:isLarge?[14,16,14,16]:[11,13,11,13],
    gap:isLarge?8:6,
    backgroundColor:C.bg,
    children:[
      {type:"stack",direction:"row",alignItems:"end",gap:7,children:[
        Text(String(now.getDate()),isLarge?40:31,"bold",C.text),
        {type:"stack",direction:"column",gap:1,children:[
          Text(`${now.getFullYear()}年${now.getMonth()+1}月`,isLarge?11:9,"semibold",C.sub),
          Text(week,isLarge?13:11,"bold",C.text),
        ]},
        {type:"spacer"},
        {type:"image",src:lunarApertureSvg(lunar.day,ST_NAMES.indexOf(first?.name),isLarge?88:68),width:isLarge?88:68,height:isLarge?88:68,resizeMode:"contain"},
        {type:"stack",direction:"column",alignItems:"end",gap:1,children:[
          Text(lunarText,isLarge?14:12,"bold",C.gold,{textAlign:"right"}),
          Text(first?`最近 · ${first.name}`:"今日安好",isLarge?10:9,"medium",first?.color||C.green,{textAlign:"right"}),
        ]},
      ]},
      Divider(),
      ...upcoming.flatMap((e,i)=>i===upcoming.length-1?[eventRow(e)]:[eventRow(e),Divider()]),
    ],
  };
}
