/*
 * name: 倒计时日志
 * author: chance
 * category: 效率工具 / 多任务倒计时
 * converted: 2026-07-15
 * target: Egern
 * version: 1.1.0
 *
 * 设计：
 * - 日志本 / 手账风格：暖色纸张、日期栏、横线任务清单。
 * - 七种 widgetFamily 分别布局，不使用同比例压缩。
 * - 最近任务为一级信息，后续任务按截止时间排序。
 * - 使用 Egern 官方 date 元素显示实时 timer / relative。
 *
 * 环境变量（每个任务独立配置）：
 * name1=论文答辩
 * date1=2026-12-18
 * detail1=302会议室
 *
 * name2=提交论文
 * date2=2026-12-25
 * detail2=学院办公室
 *
 * 可继续配置 name3/date3/detail3 …… name20/date20/detail20。
 * TITLE=倒计时日志
 * NOTE=按计划推进实验与数据整理
 *
 * 规则：
 * - date1-x 决定任务是否存在，格式固定为 YYYY-MM-DD。
 * - name1-x 缺失时自动生成“任务 N”。
 * - detail1-x 缺失时不占空间。
 * - 无效日期自动忽略。
 * - systemLarge 最多显示 4 个任务。
 * - systemMedium 最多显示 2 个任务。
 * - systemSmall 只显示 1 个任务。
 */

export default async function (ctx) {
  const env = ctx.env || {};
  const family = ctx.widgetFamily || "systemMedium";

  const C = {
    paper: { light: "#F7F0DE", dark: "#211E19" },
    paperAlt: { light: "#FFF9EC", dark: "#2A261F" },
    ink: { light: "#2E2923", dark: "#F1E9DA" },
    secondary: { light: "#756C60", dark: "#BDB3A4" },
    rule: { light: "#B8C6CF88", dark: "#66768066" },
    margin: { light: "#D9867488", dark: "#B8665A77" },
    accent: { light: "#426B58", dark: "#7EB397" },
    urgent: { light: "#B55242", dark: "#E68473" },
    warning: { light: "#A46C2D", dark: "#D8A05A" },
    done: { light: "#69756D", dark: "#9DA89F" },
  };

  const title = String(env.TITLE || "倒计时日志").trim() || "倒计时日志";
  const note = String(env.NOTE || "按计划推进今天的任务").trim();

  function parseDateOnly(value) {
    const raw = String(value || "").trim();
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day, 0, 0, 0, 0);

    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }

    return date;
  }

  function parseTasks() {
    const result = [];

    for (let index = 1; index <= 20; index++) {
      const target = parseDateOnly(env[`date${index}`]);
      if (!target) continue;

      result.push({
        name: String(env[`name${index}`] || `任务 ${index}`).trim() || `任务 ${index}`,
        detail: String(env[`detail${index}`] || "").trim(),
        rawDate: target.toISOString(),
        timestamp: target.getTime(),
      });
    }

    return result.sort((a, b) => a.timestamp - b.timestamp);
  }

  const tasks = parseTasks();
  const now = Date.now();

  function statusOf(task) {
    const diff = task.timestamp - now;
    const day = 86400000;

    if (diff < 0) {
      return {
        label: "已逾期",
        color: C.urgent,
        icon: "exclamationmark.circle.fill",
      };
    }
    if (diff <= day) {
      return {
        label: "24小时内",
        color: C.urgent,
        icon: "clock.badge.exclamationmark.fill",
      };
    }
    if (diff <= day * 7) {
      return {
        label: "7天内",
        color: C.warning,
        icon: "clock.fill",
      };
    }
    return {
      label: "计划中",
      color: C.accent,
      icon: "circle",
    };
  }

  function dateParts(date) {
    const d = new Date(date);
    const months = [
      "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
      "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
    ];
    return {
      month: months[d.getMonth()],
      day: String(d.getDate()).padStart(2, "0"),
      year: String(d.getFullYear()),
    };
  }

  function daysText(task) {
    const diff = task.timestamp - now;
    const days = Math.ceil(Math.abs(diff) / 86400000);
    if (diff < 0) return `逾期 ${days} 天`;
    if (days === 0) return "今天";
    return `${days} 天`;
  }

  function makeText(value, size, weight = "regular", color = C.ink, extra = {}) {
    return {
      type: "text",
      text: String(value),
      font: {
        size,
        weight,
        ...(extra.family ? { family: extra.family } : {}),
      },
      textColor: color,
      maxLines: extra.maxLines ?? 1,
      minScale: extra.minScale ?? 0.78,
      textAlign: extra.textAlign || "left",
      ...(extra.flex != null ? { flex: extra.flex } : {}),
    };
  }

  function icon(name, size, color = C.accent) {
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

  function rule() {
    return {
      type: "stack",
      height: 1,
      backgroundColor: C.rule,
      children: [],
    };
  }

  function emptyWidget(message = "还没有记录任务") {
    return {
      type: "widget",
      padding: 16,
      gap: 10,
      backgroundColor: C.paper,
      refreshAfter: new Date(now + 6 * 60 * 60 * 1000).toISOString(),
      children: [
        {
          type: "stack",
          direction: "row",
          alignItems: "center",
          gap: 7,
          children: [
            icon("book.closed.fill", 18, C.accent),
            makeText(title, "headline", "bold"),
          ],
        },
        spacer(),
        icon("square.and.pencil", 34, C.secondary),
        makeText(message, "subheadline", "semibold", C.secondary, {
          textAlign: "center",
        }),
        spacer(),
      ],
    };
  }

  if (!tasks.length) return emptyWidget();

  const primary = tasks.find((task) => task.timestamp >= now) || tasks[tasks.length - 1];
  const primaryStatus = statusOf(primary);
  const refreshAfter = new Date(now + 30 * 60 * 1000).toISOString();

  function liveCountdown(task, size, color, align = "left") {
    if (task.timestamp < now) {
      return makeText(daysText(task), size, "bold", color, {
        textAlign: align,
        family: "Menlo",
      });
    }
    return {
      type: "date",
      date: task.rawDate,
      format: "timer",
      font: { size, weight: "bold", family: "Menlo" },
      textColor: color,
      textAlign: align,
      maxLines: 1,
      minScale: 0.72,
    };
  }

  function compactTaskRow(task, showDetail = false) {
    const status = statusOf(task);
    return {
      type: "stack",
      direction: "column",
      gap: 3,
      children: [
        {
          type: "stack",
          direction: "row",
          alignItems: "center",
          gap: 7,
          children: [
            icon(status.icon, 14, status.color),
            makeText(task.name.slice(0, 18), "subheadline", "semibold", C.ink, {
              flex: 1,
              minScale: 0.8,
            }),
            makeText(daysText(task), "caption1", "bold", status.color, {
              textAlign: "right",
              family: "Menlo",
            }),
          ],
        },
        ...(showDetail && task.detail
          ? [
              makeText(task.detail.slice(0, 28), "caption1", "regular", C.secondary, {
                maxLines: 1,
                minScale: 0.82,
              }),
            ]
          : []),
        rule(),
      ],
    };
  }

  function header(showYear = false) {
    const p = dateParts(now);
    return {
      type: "stack",
      direction: "row",
      alignItems: "end",
      children: [
        {
          type: "stack",
          direction: "column",
          gap: 0,
          children: [
            makeText(`${p.month} ${p.day}`, "headline", "bold", C.accent, {
              family: "Georgia",
            }),
            ...(showYear
              ? [makeText(p.year, "caption2", "medium", C.secondary, { family: "Menlo" })]
              : []),
          ],
        },
        spacer(),
        makeText(title.slice(0, 14), "headline", "bold", C.ink, {
          textAlign: "right",
          family: "Georgia",
        }),
      ],
    };
  }

  function renderInline() {
    return {
      type: "widget",
      refreshAfter,
      children: [
        makeText(`${primary.name} · ${daysText(primary)}`, "caption1", "semibold"),
      ],
    };
  }

  function renderCircular() {
    return {
      type: "widget",
      refreshAfter,
      padding: 4,
      gap: 1,
      children: [
        icon(primaryStatus.icon, 13, primaryStatus.color),
        makeText(daysText(primary).replace(" 天", ""), "headline", "bold", C.ink, {
          textAlign: "center",
          family: "Menlo",
        }),
        makeText(primary.timestamp < now ? "逾期" : "天", "caption2", "medium", C.secondary, {
          textAlign: "center",
        }),
      ],
    };
  }

  function renderRectangular() {
    return {
      type: "widget",
      refreshAfter,
      padding: 7,
      gap: 3,
      children: [
        {
          type: "stack",
          direction: "row",
          alignItems: "center",
          gap: 5,
          children: [
            icon(primaryStatus.icon, 13, primaryStatus.color),
            makeText(primary.name.slice(0, 12), "headline", "semibold", C.ink, {
              flex: 1,
            }),
          ],
        },
        liveCountdown(primary, "caption1", primaryStatus.color),
        makeText(primary.detail || primaryStatus.label, "caption2", "regular", C.secondary),
      ],
    };
  }

  function renderSmall() {
    return {
      type: "widget",
      refreshAfter,
      padding: 12,
      gap: 7,
      backgroundColor: C.paper,
      children: [
        header(),
        rule(),
        {
          type: "stack",
          direction: "column",
          flex: 1,
          alignItems: "center",
          gap: 6,
          children: [
            spacer(),
            makeText(primary.name.slice(0, 10), "headline", "bold", C.ink, {
              textAlign: "center",
            }),
            liveCountdown(primary, "title2", primaryStatus.color, "center"),
            makeText(daysText(primary), "caption1", "semibold", C.secondary, {
              textAlign: "center",
            }),
            ...(primary.detail
              ? [
                  makeText(primary.detail.slice(0, 14), "caption1", "regular", C.secondary, {
                    textAlign: "center",
                    maxLines: 1,
                  }),
                ]
              : []),
            spacer(),
          ],
        },
      ],
    };
  }

  function renderMedium() {
    const secondary = tasks.filter((task) => task !== primary).slice(0, 1);

    return {
      type: "widget",
      refreshAfter,
      padding: 14,
      gap: 8,
      backgroundColor: C.paper,
      children: [
        header(),
        rule(),
        {
          type: "stack",
          direction: "row",
          gap: 14,
          flex: 1,
          children: [
            {
              type: "stack",
              direction: "column",
              flex: 1,
              gap: 5,
              padding: [4, 8],
              children: [
                makeText(primary.name.slice(0, 14), "headline", "bold"),
                liveCountdown(primary, "title2", primaryStatus.color),
                makeText(primary.detail || primaryStatus.label, "caption1", "regular", C.secondary, {
                  maxLines: 2,
                }),
              ],
            },
            {
              type: "stack",
              width: 1,
              backgroundColor: C.margin,
              children: [],
            },
            {
              type: "stack",
              direction: "column",
              flex: 1,
              gap: 5,
              children: secondary.length
                ? secondary.map((task) => compactTaskRow(task, false))
                : [
                    spacer(),
                    makeText("暂无后续任务", "caption1", "medium", C.secondary, {
                      textAlign: "center",
                    }),
                    spacer(),
                  ],
            },
          ],
        },
      ],
    };
  }

  function renderLarge() {
    const secondary = tasks.filter((task) => task !== primary).slice(0, 3);

    return {
      type: "widget",
      refreshAfter,
      padding: 16,
      gap: 9,
      backgroundColor: C.paper,
      children: [
        header(true),
        rule(),

        {
          type: "stack",
          direction: "row",
          alignItems: "start",
          gap: 10,
          padding: [8, 10],
          borderRadius: 10,
          backgroundColor: C.paperAlt,
          children: [
            {
              type: "stack",
              width: 3,
              backgroundColor: C.margin,
              children: [],
            },
            {
              type: "stack",
              direction: "column",
              flex: 1,
              gap: 6,
              children: [
                {
                  type: "stack",
                  direction: "row",
                  alignItems: "center",
                  gap: 7,
                  children: [
                    icon(primaryStatus.icon, 17, primaryStatus.color),
                    makeText(primary.name.slice(0, 18), "title3", "bold", C.ink, {
                      flex: 1,
                    }),
                  ],
                },
                makeText(
                  new Date(primary.timestamp).toLocaleDateString("zh-CN", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  }),
                  "caption1",
                  "medium",
                  C.secondary
                ),
                liveCountdown(primary, "title", primaryStatus.color),
                ...(primary.detail
                  ? [
                      makeText(primary.detail.slice(0, 36), "subheadline", "regular", C.secondary, {
                        maxLines: 2,
                      }),
                    ]
                  : []),
              ],
            },
          ],
        },

        {
          type: "stack",
          direction: "column",
          flex: 1,
          gap: 6,
          children: secondary.length
            ? secondary.map((task) => compactTaskRow(task, true))
            : [
                spacer(),
                makeText("这一页没有更多任务", "subheadline", "medium", C.secondary, {
                  textAlign: "center",
                }),
                spacer(),
              ],
        },

        rule(),

        {
          type: "stack",
          direction: "column",
          gap: 3,
          children: [
            makeText("今日记录", "caption1", "bold", C.accent, {
              family: "Georgia",
            }),
            makeText(`“${note.slice(0, 38)}”`, "subheadline", "regular", C.secondary, {
              maxLines: 2,
              minScale: 0.82,
              family: "Georgia",
            }),
          ],
        },
      ],
    };
  }

  function renderExtraLarge() {
    const secondary = tasks.filter((task) => task !== primary).slice(0, 9);

    return {
      type: "widget",
      refreshAfter,
      padding: 18,
      gap: 12,
      backgroundColor: C.paper,
      children: [
        header(true),
        rule(),
        {
          type: "stack",
          direction: "row",
          gap: 18,
          flex: 1,
          children: [
            {
              type: "stack",
              direction: "column",
              flex: 1,
              gap: 8,
              padding: 14,
              borderRadius: 12,
              backgroundColor: C.paperAlt,
              children: [
                makeText(primary.name.slice(0, 22), "title2", "bold"),
                liveCountdown(primary, "largeTitle", primaryStatus.color),
                makeText(daysText(primary), "headline", "semibold", C.secondary),
                ...(primary.detail
                  ? [
                      makeText(primary.detail.slice(0, 48), "body", "regular", C.secondary, {
                        maxLines: 3,
                      }),
                    ]
                  : []),
                spacer(),
                makeText(`“${note.slice(0, 48)}”`, "subheadline", "regular", C.secondary, {
                  maxLines: 3,
                  family: "Georgia",
                }),
              ],
            },
            {
              type: "stack",
              width: 1,
              backgroundColor: C.margin,
              children: [],
            },
            {
              type: "stack",
              direction: "column",
              flex: 2,
              gap: 7,
              children: secondary.length
                ? secondary.map((task) => compactTaskRow(task, true))
                : [
                    spacer(),
                    makeText("暂无后续任务", "subheadline", "medium", C.secondary, {
                      textAlign: "center",
                    }),
                    spacer(),
                  ],
            },
          ],
        },
      ],
    };
  }

  switch (family) {
    case "accessoryInline":
      return renderInline();
    case "accessoryCircular":
      return renderCircular();
    case "accessoryRectangular":
      return renderRectangular();
    case "systemSmall":
      return renderSmall();
    case "systemMedium":
      return renderMedium();
    case "systemExtraLarge":
      return renderExtraLarge();
    case "systemLarge":
    default:
      return renderLarge();
  }
}
