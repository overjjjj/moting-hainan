(function (global) {
  'use strict';
  const fields = ['view', 'control', 'frequency', 'reset'];
  const profileFields = ['name', 'phone', 'registeredAt'];
  const leaseFields = ['owner', 'start', 'end'];
  const copy = value => JSON.parse(JSON.stringify(value));
  const pick = (value, keys) => Object.fromEntries(keys.map(key => [key, value[key] == null ? null : value[key]]));
  const rights = value => Object.fromEntries(fields.map(key => [key, Boolean(value && value[key])]));
  const sorted = list => list.sort((a, b) => a.id.localeCompare(b.id));

  // Explicit allowlist: motor state, history, alarms, commands and receipts never enter the archive.
  function snapshot(store, createdAt) {
    const users = sorted(store.users.filter(u => u.role !== 'admin').map(u => pick(u, ['id', ...profileFields])));
    const userIds = new Set(users.map(u => u.id));
    const leases = sorted(store.contracts.filter(c => userIds.has(c.owner)).map(c => pick(c, ['id', 'number', 'device', ...leaseFields])));
    const access = store.joins.filter(j => userIds.has(j.user)).map(j => ({ user: j.user, device: j.device, rights: rights(j.rights) })).sort((a, b) => (a.user + '/' + a.device).localeCompare(b.user + '/' + b.device));
    const deviceIds = new Set([...leases.map(c => c.device), ...access.map(j => j.device)]);
    const devices = sorted(store.devices.filter(d => deviceIds.has(d.id)).map(d => pick(d, ['id', 'name', 'vendor', 'model', 'module'])));
    return { schema: 'rental-user-archive-v1', scope: 'users-only', createdAt, users, devices, leases, access };
  }

  function userRows(store) {
    const data = snapshot(store, null);
    return data.users.map(u => ({ ...u, devices: data.devices.filter(d => data.leases.some(c => c.device === d.id && c.owner === u.id) || data.access.some(j => j.device === d.id && j.user === u.id)).map(d => {
      const c = data.leases.find(c => c.device === d.id), j = data.access.find(j => j.device === d.id && j.user === u.id);
      return { ...d, owner: Boolean(c && c.owner === u.id), end: c ? c.end : null, rights: rights(j && j.rights) };
    }) }));
  }

  function preview(store, archive) {
    const changes = [], conflicts = [];
    if (!archive || archive.schema !== 'rental-user-archive-v1' || archive.scope !== 'users-only' || !['users', 'devices', 'leases', 'access'].every(k => Array.isArray(archive[k]))) return { changes, conflicts: ['备份格式或数据范围不匹配。'] };
    const push = (label, field, before, after) => { if (JSON.stringify(before) !== JSON.stringify(after)) changes.push({ label, field, before, after }); };
    const userIds = new Set(archive.users.map(u => u.id));
    const leaseIds = new Set(archive.leases.map(c => c.id));
    archive.devices.forEach(d => {
      const current = store.devices.find(x => x.id === d.id);
      if (!current || ['vendor', 'model', 'module'].some(key => current[key] !== d[key])) conflicts.push('设备 INV-' + d.id + ' 缺失或身份不一致，请先核对设备档案。');
    });
    archive.users.forEach(u => {
      const current = store.users.find(x => x.id === u.id && x.role !== 'admin');
      if (!current) { conflicts.push('用户 ' + u.name + ' 不在当前档案中，请先核对身份。'); return; }
      if (store.users.some(x => x.id !== u.id && x.phone === u.phone)) conflicts.push('用户 ' + u.name + ' 的备份手机号与当前其他用户冲突。');
      profileFields.forEach(key => push(u.name, key, current[key] == null ? null : current[key], u[key]));
    });
    archive.leases.forEach(c => {
      const current = store.contracts.find(x => x.id === c.id && x.device === c.device && x.number === c.number);
      if (!current || !userIds.has(c.owner)) { conflicts.push('合同 ' + c.number + ' 无法与当前档案匹配。'); return; }
      leaseFields.forEach(key => push(c.number, key, current[key], c[key]));
    });
    store.contracts.filter(c => userIds.has(c.owner) && !leaseIds.has(c.id)).forEach(c => conflicts.push('合同 ' + c.number + ' 不在此备份中，请核对新增合同后再恢复。'));
    const previous = store.joins.filter(j => userIds.has(j.user));
    const keys = new Set([...previous, ...archive.access].map(j => j.user + '/' + j.device));
    keys.forEach(key => {
      const before = previous.find(j => j.user + '/' + j.device === key);
      const after = archive.access.find(j => j.user + '/' + j.device === key);
      const entry = after || before;
      if (after && (!userIds.has(after.user) || !archive.devices.some(d => d.id === after.device))) conflicts.push('关联记录 ' + key + ' 缺少用户或设备引用。');
      const u = archive.users.find(u => u.id === entry.user);
      push((u ? u.name : entry.user) + ' / INV-' + entry.device, 'access', before ? rights(before.rights) : null, after ? rights(after.rights) : null);
    });
    return { changes, conflicts };
  }

  // Used only for the clickable simulation. Never replays device commands or writes to physical media.
  function restoreDemo(store, archive, confirmed) {
    if (confirmed !== true) throw new Error('请先核对恢复范围并勾选确认。');
    const result = preview(store, archive);
    if (result.conflicts.length) throw new Error(result.conflicts.join(' '));
    archive.users.forEach(u => Object.assign(store.users.find(x => x.id === u.id), pick(u, profileFields)));
    archive.leases.forEach(c => Object.assign(store.contracts.find(x => x.id === c.id), pick(c, leaseFields)));
    const ids = new Set(archive.users.map(u => u.id));
    store.joins = store.joins.filter(j => !ids.has(j.user)).concat(archive.access.map(j => ({ user: j.user, device: j.device, rights: rights(j.rights) })));
    return copy(result);
  }
  const api = { snapshot, userRows, preview, restoreDemo };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else global.UserBackupPrototype = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
