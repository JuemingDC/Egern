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
    .split(/[\n,，;；\s]+/)
    .map(s => s.trim())
    .filter(Boolean);
}

function formatAccountList(store) {
  const ids = (store.order || []).filter(id => store.accounts[id]);

  if (!ids.length) return '当前未保存账号。';

  return ids.map((id, index) => {
    const acc = store.accounts[id];
    const label = acc.alias || acc.email || acc.id || id;
    const updated = acc.updatedAt
      ? new Date(acc.updatedAt).toLocaleString()
      : '未知时间';

    return [
      `${index + 1}. ${label}`,
      `   ID: ${id}`,
      `   Email: ${acc.email || ''}`,
      `   Alias: ${acc.alias || ''}`,
      `   更新时间: ${updated}`
    ].join('\n');
  }).join('\n\n');
}

function matchAccountIds(store, tokens) {
  const result = new Set();
  const ids = (store.order || []).filter(id => store.accounts[id]);

  for (const tokenRaw of tokens) {
    const token = String(tokenRaw || '').trim().toLowerCase();

    if (!token) continue;

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
        .map(v => String(v).trim().toLowerCase());

      if (candidates.includes(token)) {
        result.add(id);
      }
    }
  }

  return [...result];
}

export default async function(ctx) {
  const store = loadStore(ctx);

  const env = ctx.env || {};
  const rawDelete = env.DELETE_ACCOUNTS ?? '';
  const rawDeleteAll = env.DELETE_ALL ?? 'false';

  const deleteTokens = splitEnvList(rawDelete);
  const deleteAll = String(rawDeleteAll).toLowerCase() === 'true';

  const debugInfo = [
    `DELETE_ACCOUNTS(raw): ${rawDelete === '' ? '(空)' : rawDelete}`,
    `DELETE_ALL(raw): ${rawDeleteAll}`,
    `env keys: ${Object.keys(env).join(', ') || '(无)'}`,
    ''
  ].join('\n');

  if (deleteAll) {
    const count = Object.keys(store.accounts || {}).length;

    store.accounts = {};
    store.order = [];

    saveStore(ctx, store);

    notify(
      ctx,
      '已清空全部账号',
      `${debugInfo}已删除 ${count} 个账号。\n\n请把 DELETE_ALL 改回 false。`
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
          debugInfo,
          `解析到的删除输入：${deleteTokens.join(', ')}`,
          '',
          '当前账号列表：',
          formatAccountList(store)
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
        debugInfo,
        '已删除：',
        ...deleted.map(x => `- ${x}`),
        '',
        `剩余账号：${store.order.length}`,
        '',
        formatAccountList(store)
      ].join('\n')
    );
    return;
  }

  notify(
    ctx,
    `当前账号：${store.order.length} 个`,
    [
      debugInfo,
      '当前账号列表：',
      formatAccountList(store),
      '',
      '如果你已经在 DELETE_ACCOUNTS 填了 2，但这里仍显示 DELETE_ACCOUNTS(raw): (空)，说明环境变量没有传进这个 generic 脚本。'
    ].join('\n')
  );
}
