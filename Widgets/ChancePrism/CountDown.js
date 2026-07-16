/*
 * name: 倒计时任务
 * author: chance
 * category: 效率工具 / 多任务倒计时
 * converted: 2026-07-16
 * target: Egern
 * version: 2.0.0
 *
 * 环境变量：
 * name1=论文总结
 * date1=2026-08-10
 * detail1=完成毕业论文总结与修改
 *
 * 可继续配置 name2/date2/detail2 … name20/date20/detail20。
 * date 格式固定为 YYYY-MM-DD。
 *
 * 显示规则：
 * - Small：1 个任务
 * - Medium：最多 2 个任务
 * - Large：最多 4 个任务
 * - ExtraLarge：最多 8 个任务
 * - 任务按截止日期排序；已逾期任务优先。
 * - 倒计时统一以“天”为单位。
 * - 每个任务按实际显示数量等比分配高度。
 */

export default async function (ctx) {
  const env = ctx.env || {};
  const family = ctx.widgetFamily || "systemLarge";
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const C = {
    bg: { light: "#F7F1E3", dark: "#201D18" },
    card: { light: "#FFFDF7D9", dark: "#2A261F" },
    text: { light: "#292620", dark: "#F5EEE3" },
    secondary: { light: "#777066", dark: "#BDB4A7" },
    green: { light: "#3E8064", dark: "#78B394" },
    amber: { light: "#B98435", dark: "#D9AA64" },
    blue: { light: "#3E78B2", dark: "#78A9D5" },
    red: { light: "#B65246", dark: "#E18579" },
    gray: { light: "#747B76", dark: "#A8AFA9" },
    greenSoft: { light: "#E4F1D5", dark: "#29372C" },
    amberSoft: { light: "#F3E6C9", dark: "#3A3122" },
    blueSoft: { light: "#DCEAF4", dark: "#25333D" },
    redSoft: { light: "#F2DEDA", dark: "#3A2926" },
    graySoft: { light: "#E8E5DE", dark: "#31302C" },
  };

  function parseDateOnly(value) {
    const raw = String(value || "").trim();
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day);

    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) return null;

    return date;
  }

  function parseTasks() {
    const result = [];

    for (let i = 1; i <= 20; i++) {
      const target = parseDateOnly(env[`date${i}`]);
      if (!target) continue;

      result.push({
        name: String(env[`name${i}`] || `任务 ${i}`).trim() || `任务 ${i}`,
        detail: String(env[`detail${i}`] || "").trim(),
        target,
        timestamp: target.getTime(),
      });
    }

    return result.sort((a, b) => {
      const aExpired = a.timestamp < today.getTime();
      const bExpired = b.timestamp < today.getTime();
      if (aExpired !== bExpired) return aExpired ? -1 : 1;
      return a.timestamp - b.timestamp;
    });
  }

  const tasks = parseTasks();

  const refreshAfter = new Date(
    now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 5
  ).toISOString();

  function remainingDays(task) {
    const diff = task.timestamp - today.getTime();
    return diff >= 0
      ? Math.ceil(diff / 86400000)
      : -Math.ceil(Math.abs(diff) / 86400000);
  }

  function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function semantic(task) {
    const value = `${task.name} ${task.detail}`.toLowerCase();

    if (/论文|答辩|毕业|学习|考试|实验|报告|作业/.test(value)) {
      return { icon: "graduationcap.fill", color: C.green, soft: C.greenSoft };
    }
    if (/旅行|旅游|出行|飞机|航班|机票|机场/.test(value)) {
      return { icon: "airplane", color: C.blue, soft: C.blueSoft };
    }
    if (/电脑|网络|代码|开发|网站|系统|项目/.test(value)) {
      return { icon: "laptopcomputer", color: C.amber, soft: C.amberSoft };
    }
    if (/生日|纪念|婚礼|家庭|聚会/.test(value)) {
      return { icon: "heart.fill", color: C.red, soft: C.redSoft };
    }
    return { icon: "calendar.badge.clock", color: C.gray, soft: C.graySoft };
  }

  function text(value, size, weight = "regular", color = C.text, extra = {}) {
    return {
      type: "text",
      text: String(value),
      font: { size, weight },
      textColor: color,
      textAlign: extra.textAlign || "left",
      maxLines: extra.maxLines ?? 1,
      minScale: extra.minScale ?? 0.78,
      ...(extra.flex != null ? { flex: extra.flex } : {}),
    };
  }

  function icon(name, size, color) {
    return {
      type: "image",
      src: `sf-symbol:${name}`,
      width: size,
      height: size,
      color,
    };
  }

  const spacer = (length) =>
    length == null ? { type: "spacer" } : { type: "spacer", length };

  function header() {
    return {
      type: "stack",
      direction: "row",
      alignItems: "center",
      gap: 8,
      children: [
        icon("calendar.badge.clock", 20, C.green),
        text("倒计时任务", "headline", "bold"),
      ],
    };
  }

  function dayMeta(task) {
    const days = remainingDays(task);
    if (days < 0) return { label: "逾期", value: Math.abs(days), color: C.red };
    if (days === 0) return { label: "今天", value: null, color: C.red };
    return {
      label: "剩余",
      value: days,
      color: days <= 7 ? C.red : days <= 30 ? C.amber : C.green,
    };
  }

  function rulesFor(size, count) {
    if (size === "large") {
      if (count === 1) return {
        name: "title2", detail: "body", date: "subheadline", day: "largeTitle",
        nameLines: 2, detailLines: 3, detailLimit: 72,
        iconBox: 54, iconSize: 28, gap: 12, padding: 14,
      };
      if (count === 2) return {
        name: "title3", detail: "subheadline", date: "caption1", day: "title",
        nameLines: 2, detailLines: 2, detailLimit: 48,
        iconBox: 46, iconSize: 24, gap: 10, padding: 12,
      };
      if (count === 3) return {
        name: "headline", detail: "caption1", date: "caption1", day: "title2",
        nameLines: 1, detailLines: 2, detailLimit: 36,
        iconBox: 40, iconSize: 22, gap: 8, padding: 10,
      };
      return {
        name: "headline", detail: "caption1", date: "caption2", day: "title2",
        nameLines: 1, detailLines: 1, detailLimit: 26,
        iconBox: 36, iconSize: 20, gap: 8, padding: 8,
      };
    }

    if (size === "medium") {
      return count === 1
        ? {
            name: "title3", detail: "subheadline", date: "caption1", day: "title",
            nameLines: 1, detailLines: 2, detailLimit: 34,
            iconBox: 42, iconSize: 22, gap: 8, padding: 10,
          }
        : {
            name: "headline", detail: "caption1", date: "caption2", day: "title2",
            nameLines: 1, detailLines: 1, detailLimit: 24,
            iconBox: 34, iconSize: 18, gap: 6, padding: 8,
          };
    }

    return {
      name: "headline", detail: "caption1", date: "caption2", day: "title2",
      nameLines: 1, detailLines: 1, detailLimit: 14,
      iconBox: 36, iconSize: 19, gap: 6, padding: 8,
    };
  }

  function taskCard(task, rules) {
    const style = semantic(task);
    const day = dayMeta(task);
    const detail = task.detail.slice(0, rules.detailLimit);

    return {
      type: "stack",
      direction: "row",
      alignItems: "center",
      flex: 1,
      gap: rules.gap,
      padding: rules.padding,
      borderRadius: 12,
      backgroundColor: C.card,
      children: [
        {
          type: "stack",
          direction: "column",
          alignItems: "center",
          width: rules.iconBox,
          height: rules.iconBox,
          borderRadius: "auto",
          backgroundColor: style.soft,
          children: [
            spacer(),
            icon(style.icon, rules.iconSize, style.color),
            spacer(),
          ],
        },
        {
          type: "stack",
          direction: "column",
          flex: 1,
          gap: 3,
          children: [
            text(task.name, rules.name, "bold", C.text, {
              maxLines: rules.nameLines,
              minScale: 0.76,
            }),
            ...(detail ? [text(detail, rules.detail, "regular", C.secondary, {
              maxLines: rules.detailLines,
              minScale: 0.8,
            })] : []),
            text(formatDate(task.target), rules.date, "medium", C.secondary),
          ],
        },
        {
          type: "stack",
          direction: "column",
          alignItems: "end",
          gap: 1,
          children: [
            text(day.label, "caption1", "medium", C.secondary, { textAlign: "right" }),
            ...(day.value == null
              ? [text("今天", rules.day, "bold", day.color, {
                  textAlign: "right", minScale: 0.78,
                })]
              : [{
                  type: "stack",
                  direction: "row",
                  alignItems: "end",
                  gap: 3,
                  children: [
                    text(day.value, rules.day, "bold", day.color, {
                      textAlign: "right", minScale: 0.78,
                    }),
                    text("天", "subheadline", "semibold", C.text, { textAlign: "right" }),
                  ],
                }]),
          ],
        },
      ],
    };
  }

  function emptyWidget() {
    return {
      type: "widget",
      refreshAfter,
      padding: 16,
      gap: 10,
      backgroundColor: C.bg,
      children: [
        header(),
        spacer(),
        icon("calendar.badge.exclamationmark", 32, C.secondary),
        text("请配置 date1", "headline", "semibold", C.secondary, { textAlign: "center" }),
        text("日期格式：YYYY-MM-DD", "caption1", "regular", C.secondary, { textAlign: "center" }),
        spacer(),
      ],
    };
  }

  if (!tasks.length) return emptyWidget();

  function renderInline() {
    const task = tasks[0];
    const day = dayMeta(task);
    const value = day.value == null ? "今天" : `${day.label}${day.value}天`;
    return {
      type: "widget",
      refreshAfter,
      children: [text(`${task.name.slice(0, 10)} · ${value}`, "caption1", "semibold")],
    };
  }

  function renderCircular() {
    const task = tasks[0];
    const day = dayMeta(task);
    return {
      type: "widget",
      refreshAfter,
      padding: 4,
      gap: 1,
      children: [
        icon(semantic(task).icon, 14, day.color),
        text(day.value == null ? "今" : day.value, "title3", "bold", day.color, {
          textAlign: "center", minScale: 0.75,
        }),
        text(day.value == null ? "天" : "天", "caption2", "medium", C.secondary, {
          textAlign: "center",
        }),
      ],
    };
  }

  function renderRectangular() {
    const task = tasks[0];
    const day = dayMeta(task);
    const value = day.value == null ? "今天" : `${day.label} ${day.value} 天`;
    return {
      type: "widget",
      refreshAfter,
      padding: 7,
      gap: 2,
      children: [
        text(task.name.slice(0, 12), "headline", "semibold"),
        text(value, "subheadline", "bold", day.color),
        text(formatDate(task.target), "caption1", "regular", C.secondary),
      ],
    };
  }

  function renderList(size, limit, padding) {
    const visible = tasks.slice(0, limit);
    const rules = rulesFor(size, visible.length);
    return {
      type: "widget",
      refreshAfter,
      padding,
      gap: 8,
      backgroundColor: C.bg,
      children: [
        header(),
        {
          type: "stack",
          direction: "column",
          flex: 1,
          gap: visible.length >= 4 ? 6 : visible.length > 1 ? 8 : 0,
          children: visible.map((task) => taskCard(task, rules)),
        },
      ],
    };
  }

  function renderExtraLarge() {
    const visible = tasks.slice(0, 8);
    const left = visible.filter((_, i) => i % 2 === 0);
    const right = visible.filter((_, i) => i % 2 === 1);
    const count = Math.max(left.length, right.length);
    const rules = rulesFor("large", Math.min(count, 4));

    return {
      type: "widget",
      refreshAfter,
      padding: 18,
      gap: 10,
      backgroundColor: C.bg,
      children: [
        header(),
        {
          type: "stack",
          direction: "row",
          flex: 1,
          gap: 10,
          children: [left, right].map((column) => ({
            type: "stack",
            direction: "column",
            flex: 1,
            gap: column.length > 1 ? 6 : 0,
            children: column.map((task) => taskCard(task, rules)),
          })),
        },
      ],
    };
  }

  switch (family) {
    case "accessoryInline": return renderInline();
    case "accessoryCircular": return renderCircular();
    case "accessoryRectangular": return renderRectangular();
    case "systemSmall": return renderList("small", 1, 12);
    case "systemMedium": return renderList("medium", 2, 14);
    case "systemExtraLarge": return renderExtraLarge();
    case "systemLarge":
    default: return renderList("large", 4, 16);
  }
}
