const FORCE_DELETE_ACCOUNTS = ""; 
// ↑ 先填 "2" 测试删除第 2 个账号；删除成功后务必改回 ""

const FORCE_DELETE_ALL = false;
// ↑ true 会清空全部账号，谨慎使用

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
  if (!Array.isArray(store.order)) {
    store.order = Object.keys(store.accounts);
  }

  store.order = store.order.filter(id => store.accounts[id]);
  store.version = 3;

  return store;
}

function saveStore(ctx, store) {
  store.order = (store.order || []).filter(id => store.accounts[id]);
  store.version = 3;
  ctx.storage.setJSON(storeKey, store);
}

function splitList(value) {
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

    return [
      `${index + 1}. ${acc.alias || acc.email || acc.id || id}`,
      `   id: ${id}`,
      `   email: ${acc.email || ''}`,
      `   alias: ${acc.alias || ''}`,
      `   hasCapture: ${acc.capture?.paramsRaw ? 'yes' : 'no'}`
    ].join('\n');
  }).join('\n\n');
}

function matchAccountIds(store, tokens) {
  const ids = (store.order || []).filter(id => store.accounts[id]);
  const result = new Set();

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

  const envDelete = ctx.env?.DELETE_ACCOUNTS || '';
  const envDeleteAll = String(ctx.env?.DELETE_ALL || 'false').toLowerCase() === 'true';

  const deleteAll = FORCE_DELETE_ALL || envDeleteAll;
  const deleteInput = FORCE_DELETE_ACCOUNTS || envDelete;
  const deleteTokens = splitList(deleteInput);

  const beforeList = formatAccountList(store);

  if (deleteAll) {
    const count = Object.keys(store.accounts || {}).length;

    store.accounts = {};
    store.order = [];

    saveStore(ctx, store);

    notify(
      ctx,
      '已清空全部账号',
      [
        `删除前账号数：${count}`,
        '',
        '已执行清空。',
        '',
        '请立刻把 FORCE_DELETE_ALL 改回 false。'
      ].join('\n')
    );
    return;
  }

  if (!deleteTokens.length) {
    notify(
      ctx,
      `当前账号：${store.order.length} 个`,
      [
        `FORCE_DELETE_ACCOUNTS: ${FORCE_DELETE_ACCOUNTS || '(空)'}`,
        `ctx.env.DELETE_ACCOUNTS: ${envDelete || '(空)'}`,
        '',
        '当前账号列表：',
        beforeList,
        '',
        '要删除第 2 个账号，请把脚本第一行改成：',
        'const FORCE_DELETE_ACCOUNTS = "2";'
      ].join('\n')
    );
    return;
  }

  const matchedIds = matchAccountIds(store, deleteTokens);

  if (!matchedIds.length) {
    notify(
      ctx,
      '未匹配到要删除的账号',
      [
        `删除输入：${deleteInput}`,
        '',
        '当前账号列表：',
        beforeList
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

  saveStore(ctx, store);

  const afterStore = loadStore(ctx);

  notify(
    ctx,
    '账号已删除',
    [
      `删除输入：${deleteInput}`,
      '',
      '已删除：',
      ...deleted.map(x => `- ${x}`),
      '',
      `删除后账号数：${afterStore.order.length}`,
      '',
      '剩余账号列表：',
      formatAccountList(afterStore),
      '',
      '删除成功后，请把脚本第一行改回：',
      'const FORCE_DELETE_ACCOUNTS = "";'
    ].join('\n')
  );
}
