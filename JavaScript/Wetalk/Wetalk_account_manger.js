const scriptName = 'WeTalk账号管理';
const storeKey = 'wetalk_accounts_v1';

function notify(ctx, title, body = '') {
  ctx.notify({
    title: scriptName,
    subtitle: title,
    body
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
    // 注意：这里不能用 @ 分隔，否则邮箱会被拆坏
    .split(/[\n,，;；\s]+/)
    .map(s => s.trim())
    .filter(Boolean);
}

function maskAccount(text, showSensitive) {
  const s = String(text || '');

  if (showSensitive) return s;

  if (!s.includes('@')) {
    return s.length > 12 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
  }

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

    return [
      `${index + 1}. ${maskAccount(label, showSensitive)}`,
      `   ID: ${maskAccount(id, showSensitive)}`,
      `   Email: ${maskAccount(acc.email || '', showSensitive)}`,
      `   Alias: ${maskAccount(acc.alias || '', showSensitive)}`,
      `   更新时间: ${updated}`
    ].join('\n');
  }).join('\n\n');
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function matchAccountIds(store, tokens) {
  const result = new Set();
  const ids = (store.order || []).filter(id => store.accounts[id]);

  for (const tokenRaw of tokens) {
    const token = normalizeText(tokenRaw);

    if (!token) continue;

    // 支持按编号删除：1、2、3
    if (/^\d+$/.test(token)) {
      const index = Number(token);
      if (index >= 1 && index <= ids.length) {
        result.add(ids[index - 1]);
        continue;
      }
    }

    for (const id of ids) {
      const acc = store.accounts[id];

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
      `已删除 ${count} 个账号。\n\n请把 DELETE_ALL 改回 false，避免下次误删。`
    );
    return;
  }

  if (deleteTokens.length) {
    const matchedIds = matchAccountIds(store, deleteTokens);

    if (!matchedIds.length) {
      notify(
        ctx,
        '未匹配到要删除的账号',
        [
          `DELETE_ACCOUNTS 当前输入：${deleteTokens.join(', ')}`,
          '',
          '当前账号列表：',
          formatAccountList(store, showSensitive),
          '',
          '建议：优先填编号，例如 1 或 2。'
        ].join('\n')
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
      [
        '已删除：',
        ...deleted.map(x => `- ${maskAccount(x, showSensitive)}`),
        '',
        `剩余账号：${store.order.length}`,
        '',
        formatAccountList(store, showSensitive)
      ].join('\n')
    );
    return;
  }

  notify(
    ctx,
    `当前账号：${store.order.length} 个`,
    [
      formatAccountList(store, showSensitive),
      '',
      '删除方法：',
      '1. 在模块设置页 DELETE_ACCOUNTS 填编号，例如 1',
      '2. 手动运行 “WeTalk 账号管理”',
      '',
      '如果要用邮箱删除，请不要用 @ 作为多个账号分隔符；多个账号请用英文逗号或换行。'
    ].join('\n')
  );
}
