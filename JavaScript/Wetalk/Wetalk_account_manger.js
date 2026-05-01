const DEFAULT_FORCE_DELETE_ACCOUNTS = "";
const DEFAULT_FORCE_DELETE_ALL = false;

const scriptName = "WeTalk账号管理";
const storeKey = "wetalk_accounts_v1";

function notify(ctx, title, body = "") {
  ctx.notify({
    title: scriptName,
    subtitle: title,
    body
  });
}

function loadStore(ctx) {
  const store = ctx.storage.getJSON(storeKey);

  if (!store || typeof store !== "object") {
    return {
      version: 3,
      accounts: {},
      order: []
    };
  }

  if (!store.accounts || typeof store.accounts !== "object") {
    store.accounts = {};
  }

  if (!Array.isArray(store.order)) {
    store.order = Object.keys(store.accounts);
  }

  store.order = store.order.filter(id => store.accounts[id]);
  store.version = 3;

  return store;
}

function saveStore(ctx, store) {
  if (!store.accounts || typeof store.accounts !== "object") {
    store.accounts = {};
  }

  if (!Array.isArray(store.order)) {
    store.order = Object.keys(store.accounts);
  }

  store.order = store.order.filter(id => store.accounts[id]);
  store.version = 3;

  ctx.storage.setJSON(storeKey, store);
}

function splitList(value) {
  return String(value || "")
    .split(/[\n,，;；\s]+/)
    .map(s => s.trim())
    .filter(Boolean);
}

function formatTime(timestamp) {
  if (!timestamp) return "未知时间";

  try {
    return new Date(timestamp).toLocaleString();
  } catch {
    return "未知时间";
  }
}

function formatAccountList(store) {
  const ids = (store.order || []).filter(id => store.accounts[id]);

  if (!ids.length) {
    return "当前未保存账号。";
  }

  return ids.map((id, index) => {
    const acc = store.accounts[id] || {};
    const label = acc.alias || acc.email || acc.id || id;

    return [
      `${index + 1}. ${label}`,
      `   id: ${id}`,
      `   email: ${acc.email || ""}`,
      `   alias: ${acc.alias || ""}`,
      `   hasCapture: ${acc.capture?.paramsRaw ? "yes" : "no"}`,
      `   updatedAt: ${formatTime(acc.updatedAt)}`
    ].join("\n");
  }).join("\n\n");
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function matchAccountIds(store, tokens) {
  const ids = (store.order || []).filter(id => store.accounts[id]);
  const result = new Set();

  for (const tokenRaw of tokens) {
    const token = normalizeText(tokenRaw);

    if (!token) continue;

    // 支持按编号删除：1、2、3...
    if (/^\d+$/.test(token)) {
      const index = Number(token);

      if (index >= 1 && index <= ids.length) {
        result.add(ids[index - 1]);
        continue;
      }
    }

    // 支持按 id / email / alias 精确匹配
    for (const id of ids) {
      const acc = store.accounts[id] || {};

      const candidates = [
        id,
        acc.id,
        acc.email,
        acc.alias
      ]
        .filter(Boolean)
        .map(v => normalizeText(v));

      if (candidates.includes(token)) {
        result.add(id);
      }
    }
  }

  return [...result];
}

function boolFromEnv(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;

  const s = String(value).trim().toLowerCase();

  return s === "true" || s === "1" || s === "yes" || s === "y";
}

export default async function(ctx) {
  const store = loadStore(ctx);

  const env = ctx.env || {};

  const envDelete = env.DELETE_ACCOUNTS || "";
  const envDeleteAll = boolFromEnv(env.DELETE_ALL, false);

  const deleteAll = DEFAULT_FORCE_DELETE_ALL || envDeleteAll;
  const deleteInput = DEFAULT_FORCE_DELETE_ACCOUNTS || envDelete;
  const deleteTokens = splitList(deleteInput);

  const beforeList = formatAccountList(store);

  if (deleteAll) {
    const count = Object.keys(store.accounts || {}).length;

    store.accounts = {};
    store.order = [];

    saveStore(ctx, store);

    notify(
      ctx,
      "已清空全部账号",
      [
        `删除前账号数：${count}`,
        "",
        "已执行清空。",
        "",
        "请立刻回到模块设置页，把 DELETE_ALL 改回 false，避免下次误删。"
      ].join("\n")
    );
    return;
  }

  if (!deleteTokens.length) {
    notify(
      ctx,
      `当前账号：${store.order.length} 个`,
      [
        `DELETE_ACCOUNTS: ${envDelete || "(空)"}`,
        `DELETE_ALL: ${String(env.DELETE_ALL ?? "(空)")}`,
        "",
        "当前账号列表：",
        beforeList,
        "",
        "删除方法：",
        "1. 回到模块设置页，在“删除账号 / DELETE_ACCOUNTS”里填写编号，例如 2",
        "2. 保存模块设置",
        "3. 手动运行 “WeTalk 账号管理”",
        "4. 删除完成后清空“删除账号 / DELETE_ACCOUNTS”"
      ].join("\n")
    );
    return;
  }

  const matchedIds = matchAccountIds(store, deleteTokens);

  if (!matchedIds.length) {
    notify(
      ctx,
      "未匹配到要删除的账号",
      [
        `删除输入：${deleteInput}`,
        "",
        "当前账号列表：",
        beforeList,
        "",
        "建议：优先使用账号编号删除，例如 1 或 2。"
      ].join("\n")
    );
    return;
  }

  const deleted = [];

  for (const id of matchedIds) {
    const acc = store.accounts[id] || {};
    deleted.push(acc.alias || acc.email || acc.id || id);
    delete store.accounts[id];
  }

  saveStore(ctx, store);

  const afterStore = loadStore(ctx);

  notify(
    ctx,
    "账号已删除",
    [
      `删除输入：${deleteInput}`,
      "",
      "已删除：",
      ...deleted.map(x => `- ${x}`),
      "",
      `删除后账号数：${afterStore.order.length}`,
      "",
      "剩余账号列表：",
      formatAccountList(afterStore),
      "",
      "请回到模块设置页，把“删除账号 / DELETE_ACCOUNTS”清空，避免下次误删。"
    ].join("\n")
  );
}