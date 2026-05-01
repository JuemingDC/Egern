const scriptName = 'WeTalk账号管理';
const storeKey = 'wetalk_accounts_v1';

function notify(ctx, title, body = '') {
  ctx.notify({
    title: scriptName,
    subtitle: title,
    body,
    action: body
      ? { type: 'clipboard', text: body }
      : undefined
  });
}

function loadStore(ctx) {
  const store = ctx.storage.getJSON(storeKey);

  if (!store || typeof store !== 'object') {
    return {
      version: 3,
      accounts: {},
      order: []
    };
  }

  if (!store.accounts) store.accounts = {};
  if (!Array.isArray(store.order)) store.order = Object.keys(store.accounts);

  store.version = 3;
  store.order = store.order.filter(id => store.accounts[id]);

  return store;
}

function saveStore(ctx, store) {
  store.order = (store.order || []).filter(id => store.accounts[id]);
  ctx.storage.setJSON(storeKey, store);
}

function splitEnvList(value) {
  return String(value || '')
    .split(/[\n,@，\s]+/)
    .map(s => s.trim())
    .filter(Boolean);
}

function maskAccount(text, showSensitive) {
  const s = String(text || '');

  if (showSensitive) return s;
  if (!s.includes('@')) return s.length > 12 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;

  const [name, domain] = s.split('@');
  const maskedName = name.length <= 2
    ? `${name[0] || '*'}*`
    : `${name.slice(0, 2)}***${name.slice(-1)}`;

  return `${maskedName}@${domain}`;
}

function formatAccountList(store, showSensitive) {
  const ids = (store.order || []).filter(id => store.accounts[id]);

  if (!ids.length) return '当前未保存账号。';

  return ids.map((id, index) => {
    const acc = store.accounts[id];
    const label = acc.alias || acc.email || acc.id || id;
    const updated = acc.updatedAt
      ? new Date(acc.updatedAt).toLocaleString()
      : '未知时间';

    return `${index + 1}. ${maskAccount(label, showSensitive)}\n   ID: ${maskAccount(id, showSensitive)}\n   更新时间: ${updated}`;
  }).join('\n\n');
}

function matchAccountIds(store, tokens) {
  const result = new Set();
  const ids = (store.order || []).filter(id => store.accounts[id]);

  for (const tokenRaw of tokens) {
    const token = String(tokenRaw).trim().toLowerCase();

    if (!token) continue;

    const index = Number(token);

    if (Number.isInteger(index) && index >= 1 && index <= ids.length) {
      result.add(ids[index - 1]);
      continue;
    }

    for (const id of ids) {
      const acc = store.accounts[id];
      const candidates = [
        id,
        acc.id,
        acc.email,
        acc.alias
      ].filter(Boolean).map(v => String(v).trim().toLowerCase());

      if (candidates.includes(token)) {
        result.add(id);
      }
    }
  }

  return [...result];
}

export default async function(ctx) {
  const showSensitive = String(ctx.env?.SHOW_SENSITIVE || 'false').toLowerCase() === 'true';
  const deleteAll = String(ctx.env?.DELETE_ALL || 'false').toLowerCase() === 'true';
  const deleteTokens = splitEnvList(ctx.env?.DELETE_ACCOUNTS || '');

  const store = loadStore(ctx);

  if (deleteAll) {
    const count = Object.keys(store.accounts || {}).length;

    store.accounts = {};
    store.order = [];

    saveStore(ctx, store);

    notify(
      ctx,
      '已清空全部账号',
      `已删除 ${count} 个账号。\n\n请回到模块设置页，把 DELETE_ALL 改回 false，避免下次误删。`
    );
    return;
  }

  if (deleteTokens.length) {
    const matchedIds = matchAccountIds(store, deleteTokens);

    if (!matchedIds.length) {
      notify(
        ctx,
        '未匹配到要删除的账号',
        `输入内容：${deleteTokens.join(', ')}\n\n当前账号：\n${formatAccountList(store, showSensitive)}`
      );
      return;
    }

    const deleted = [];

    for (const id of matchedIds) {
      const acc = store.accounts[id];
      deleted.push(acc?.alias || acc?.email || acc?.id || id);
      delete store.accounts[id];
    }

    store.order = store.order.filter(id => store.accounts[id]);

    saveStore(ctx, store);

    notify(
      ctx,
      '账号已删除',
      `已删除：\n${deleted.map(x => `- ${maskAccount(x, showSensitive)}`).join('\n')}\n\n剩余账号：${store.order.length}\n\n${formatAccountList(store, showSensitive)}`
    );
    return;
  }

  notify(
    ctx,
    `当前账号：${store.order.length} 个`,
    `${formatAccountList(store, showSensitive)}\n\n删除方法：在模块设置页 DELETE_ACCOUNTS 填编号/邮箱/ID，然后手动运行本脚本。`
  );
}
