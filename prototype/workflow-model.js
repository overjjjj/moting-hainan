(function (global) {
  'use strict';
  const NOW = '2026-10-21T14:32:00';
  const fields = ['view', 'control', 'frequency', 'reset'];
  const viewOnly = () => ({ view: true, control: false, frequency: false, reset: false });
  const all = () => ({ view: true, control: true, frequency: true, reset: true });
  const copy = value => JSON.parse(JSON.stringify(value));
  const epoch = value => Date.parse(value + '+08:00');
  function fail(message, code = 'INVALID') { const e = new Error(message); e.code = code; throw e; }
  function seed() {
    const users = [
      { id: 'chen', name: '陈先生', phone: '13800002608', registeredAt: '2026-09-20T09:30:00' },
      { id: 'wang', name: '王师傅', phone: '13600001820', registeredAt: '2026-09-26T10:15:00' },
      { id: 'li', name: '李先生', phone: '13900000516', registeredAt: '2026-10-18T15:20:00' }
    ];
    const devices = [
      { id: '01', name: '东区 01 号变频器', vendor: 'HN', model: 'VF-22', module: 'DEMO4G001001', online: true, run: true, target: 42, hz: 42, current: 6.7, voltage: 311, bus: 537, place: '东区机房' },
      { id: '02', name: '西区 02 号变频器', vendor: 'HN', model: 'VF-15', module: 'DEMO4G001002', online: true, run: true, target: 38.5, hz: 38.5, current: 5.2, voltage: 285, bus: 531, place: '西区机房' },
      { id: '03', name: '北区 03 号变频器', vendor: 'HN', model: 'VF-22', module: 'DEMO4G001003', online: false, run: false, target: 40, hz: 0, current: 0, voltage: 0, bus: 0, place: '北区机房' },
      { id: '04', name: '备用 04 号变频器', vendor: 'HN', model: 'VF-15', module: 'DEMO4G001004', online: true, run: false, target: 40, hz: 0, current: 0, voltage: 0, bus: 528, place: '备用机房' },
      { id: '05', name: '库存 05 号变频器', vendor: 'HN', model: 'VF-22', module: 'DEMO4G001005', online: true, run: false, target: 40, hz: 0, current: 0, voltage: 0, bus: 530, place: '海口仓库' }
    ];
    const contracts = [
      { id: 'C01', number: 'ZL-2026-1001', device: '01', owner: 'chen', start: '2026-09-25T00:00', end: '2026-10-24T18:00', rent: 360, paid: 360, reference: 'FK-1001' },
      { id: 'C02', number: 'ZL-2026-1002', device: '02', owner: 'li', start: '2026-10-19T00:00', end: '2026-11-18T18:00', rent: 280, paid: 280, reference: 'FK-1002' },
      { id: 'C03', number: 'ZL-2026-1003', device: '03', owner: 'chen', start: '2026-10-06T00:00', end: '2026-11-05T18:00', rent: 360, paid: 360, reference: 'FK-1003' },
      { id: 'C04', number: 'ZL-2026-1004', device: '04', owner: 'chen', start: '2026-09-21T00:00', end: '2026-10-20T18:00', rent: 280, paid: 280, reference: 'FK-1004' }
    ];
    contracts.forEach(c => { c.paidAt = c.start.slice(0, 10); });
    const state = { version: 3, users, devices, contracts, joins: [
      { device: '01', user: 'chen', rights: all() }, { device: '01', user: 'wang', rights: viewOnly() },
      { device: '02', user: 'chen', rights: viewOnly() }, { device: '02', user: 'li', rights: all() },
      { device: '03', user: 'chen', rights: all() }, { device: '04', user: 'chen', rights: all() }
    ], logs: [{ id: 'L1', who: '系统', action: '到期停机', device: '04', result: '停机已确认', time: NOW }], next: 6 };
    ensureAdministrator(state);
    ensureReceipts(state);
    return state;
  }
  const device = (s, id) => s.devices.find(d => d.id === id);
  const user = (s, id) => s.users.find(u => u.id === id);
  const contract = (s, id) => s.contracts.find(c => c.device === id);
  const join = (s, d, u) => s.joins.find(j => j.device === d && j.user === u);
  const mask = phone => phone.slice(0, 3) + ' **** ' + phone.slice(-4);
  function ensureAdministrator(s) {
    if (!s.users.some(u => u.id === 'admin')) s.users.push({id:'admin',name:'仓库管理员',phone:'13700000001',role:'admin'});
  }
  const canInventory = (s, uid) => Boolean(user(s, uid) && user(s, uid).role === 'admin');
  function addInventoryFor(s, uid, input, source = 'mobile') {
    if (!canInventory(s, uid)) fail('只有管理员可以扫码入库，普通用户请使用扫码添加。', 'ADMIN_REQUIRED');
    const d = addInventory(s, input);
    d.createdAt = NOW;
    d.createdBy = uid;
    d.inventorySource = source === 'mobile' ? '手机扫码' : '管理后台';
    s.logs[0].who = user(s, uid).name;
    s.logs[0].result = d.inventorySource + '入库；设备档案已建立，尚未登记租赁';
    return d;
  }
  function validatePaidAt(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) fail('请填写实际收款日期。');
    const parsed = Date.parse(value + 'T00:00:00Z');
    if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== value || value > NOW.slice(0, 10)) fail('收款日期必须有效，且不能晚于演示当前日期。');
    return value;
  }
  function addReceipt(s, c, kind, paid, paidAt, start, end, reference) {
    const receipt = { id:'R' + (s.receipts.length + 1), contract:c.id, number:c.number, device:c.device, owner:c.owner, kind, amountCents:Math.round(Number(paid) * 100), paidAt:paidAt || null, start, end, reference:reference || '' };
    s.receipts.push(receipt);
    return receipt;
  }
  function ensureReceipts(s) {
    if (Array.isArray(s.receipts)) return;
    s.receipts = [];
    s.contracts.forEach(c => {
      const renewals = c.renewals || [];
      addReceipt(s, c, 'initial', c.paid, c.paidAt, c.start, renewals.length ? renewals[0].old : c.end, c.reference);
      renewals.forEach(r => addReceipt(s, c, 'renewal', r.paid, r.paidAt, r.old, r.end, r.reference));
    });
  }
  function incomeReport(s, month = 'all', kind = 'all', scope = null) {
    ensureReceipts(s);
    const rows = s.receipts.filter(r => (month === 'all' || (month === 'undated' ? !r.paidAt : r.paidAt && r.paidAt.slice(0, 7) === month)) && (kind === 'all' || r.kind === kind) && (!scope || (scope.dimension === 'device' ? r.device === scope.key : scope.dimension === 'customer' ? r.owner === scope.key : true))).slice().sort((a,b) => (b.paidAt || '').localeCompare(a.paidAt || '') || b.id.localeCompare(a.id, undefined, {numeric:true}));
    const initialCents = rows.filter(r => r.kind === 'initial').reduce((total,r) => total + r.amountCents, 0);
    const renewalCents = rows.filter(r => r.kind === 'renewal').reduce((total,r) => total + r.amountCents, 0);
    return { rows, count:rows.length, totalCents:initialCents + renewalCents, initialCents, renewalCents };
  }
  function tableReport(s, dimension = 'device', month = 'all') {
    const total = incomeReport(s, month), groups = new Map();
    function group(key) {
      if (!groups.has(key)) groups.set(key, {key,count:0,initialCents:0,renewalCents:0,totalCents:0,devices:new Set()});
      return groups.get(key);
    }
    if (dimension === 'device') s.devices.forEach(d => group(d.id));
    if (dimension === 'customer') s.contracts.forEach(c => group(c.owner));
    total.rows.forEach(r => {
      const key = dimension === 'device' ? r.device : dimension === 'customer' ? r.owner : r.paidAt ? r.paidAt.slice(0,7) : 'undated';
      const g = group(key);g.count++;g.devices.add(r.device);g.totalCents += r.amountCents;
      if (r.kind === 'initial') g.initialCents += r.amountCents;else g.renewalCents += r.amountCents;
    });
    const rows = Array.from(groups.values()).map(g => ({key:g.key,count:g.count,initialCents:g.initialCents,renewalCents:g.renewalCents,totalCents:g.totalCents,deviceCount:g.devices.size,contractDeviceCount:new Set(s.contracts.filter(c=>c.owner===g.key).map(c=>c.device)).size}));
    rows.sort((a,b)=>dimension === 'month' ? a.key === 'undated' ? 1 : b.key === 'undated' ? -1 : b.key.localeCompare(a.key) : a.key.localeCompare(b.key,undefined,{numeric:true}));
    return {rows,total};
  }
  const days = c => Math.ceil((epoch(c.end) - epoch(NOW)) / 86400000);
  function leaseStatus(s, id) {
    const c = contract(s, id);
    if (!c) return 'stock';
    if (epoch(c.end) <= epoch(NOW)) return 'expired';
    if (epoch(c.start) > epoch(NOW)) return 'future';
    return days(c) <= 7 ? 'near' : 'active';
  }
  function log(s, who, action, id, result) {
    s.logs.unshift({ id: 'L' + Date.now() + '-' + s.logs.length, who, action, device: id, result, time: NOW });
    s.logs = s.logs.slice(0, 18);
  }
  function parseQR(raw) {
    if (typeof raw !== 'string' || raw.length > 180) fail('二维码内容无效，请重新扫码。', 'INVALID_QR');
    const parts = raw.trim().split(/[|+]/).map(x => x.trim());
    if (parts.length !== 3 || parts.some(x => !/^[A-Za-z0-9_-]{2,40}$/.test(x))) fail('二维码格式不正确，需要厂商代号、变频器型号和 4G 模块 ID。', 'INVALID_QR');
    return { vendor: parts[0], model: parts[1], module: parts[2] };
  }
  const qr = d => [d.vendor, d.model, d.module].join('|');
  function inspectInventory(s, raw) {
    const p = parseQR(raw);
    if (s.devices.some(d => d.module === p.module)) fail('该 4G 模块已经入库，请查看已有设备，不能重复入库。', 'DUPLICATE_DEVICE');
    return p;
  }
  function addInventory(s, input) {
    const p = inspectInventory(s, input.raw);
    const name = String(input.name || '').trim();
    if (!name || name.length > 30) fail('请填写 1–30 个字符的设备名称。');
    const id = String(s.next++).padStart(2, '0');
    const d = { id, name, ...p, place: String(input.place || '').trim().slice(0, 60), online: true, run: false, target: 40, hz: 0, current: 0, voltage: 0, bus: 530 };
    s.devices.push(d);
    log(s, '管理员', '设备入库', id, '设备档案已建立，尚未登记租赁');
    return d;
  }
  function inspectScan(s, uid, raw) {
    if (!user(s, uid)) fail('请先使用微信绑定手机号登录。', 'LOGIN_REQUIRED');
    const p = parseQR(raw);
    const d = s.devices.find(x => x.module === p.module);
    if (!d) fail('设备尚未入库，请联系管理员完成入库。扫码不会创建设备档案。', 'NOT_INVENTORIED');
    if (d.vendor !== p.vendor || d.model !== p.model) fail('二维码厂商或型号与设备档案不一致，请联系管理员核对。', 'QR_MISMATCH');
    const j = join(s, d.id, uid);
    if (j && !j.rights.view) fail('管理员已收回此设备的访问权限，请联系管理员重新授权。扫码不能恢复已收回的权限。', 'ACCESS_REVOKED');
    return { device: d, added: Boolean(j), rights: j ? copy(j.rights) : viewOnly() };
  }
  function addByScan(s, uid, raw) {
    const result = inspectScan(s, uid, raw);
    if (!result.added) {
      s.joins.push({ device: result.device.id, user: uid, rights: viewOnly() });
      log(s, user(s, uid).name, '扫码添加', result.device.id, '默认仅查看，未改变第一所有人');
    }
    return result.device;
  }
  function validateContract(s, input) {
    if (!device(s, input.device)) fail('请选择已入库设备。');
    if (contract(s, input.device)) fail('该设备已有租赁记录，请通过续租处理，不能重复登记。', 'LEASE_EXISTS');
    const owner = s.users.find(u => u.phone === String(input.phone || '').trim());
    if (!owner) fail('未找到已绑定微信的手机号，请先让用户完成手机号绑定。', 'USER_NOT_FOUND');
    const number = String(input.number || '').trim();
    if (!/^[A-Za-z0-9_-]{3,40}$/.test(number)) fail('请填写 3–40 位合同编号，可使用字母、数字、横线和下划线。');
    if (s.contracts.some(c => c.number === number)) fail('合同编号已存在，请核对后重新填写。', 'DUPLICATE_CONTRACT');
    const rent = Number(input.rent), paid = Number(input.paid);
    if (!Number.isFinite(rent) || rent <= 0 || rent > 1000000 || !/^\d+(\.\d{1,2})?$/.test(String(input.rent))) fail('请填写有效月租金额，最多两位小数。');
    if (!Number.isFinite(paid) || paid <= 0 || paid > 1000000 || !/^\d+(\.\d{1,2})?$/.test(String(input.paid))) fail('请填写已确认收到的本期金额，最多两位小数。');
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input.start || '') || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input.end || '') || !Number.isFinite(epoch(input.start)) || !Number.isFinite(epoch(input.end)) || epoch(input.end) <= epoch(input.start)) fail('请填写有效租期，到期时间必须晚于起租时间。');
    if (epoch(input.end) <= epoch(NOW)) fail('新租赁合同的到期时间必须晚于演示当前时间。');
    const paidAt = validatePaidAt(input.paidAt === undefined ? NOW.slice(0, 10) : input.paidAt);
    return { device: input.device, number, owner: owner.id, start: input.start, end: input.end, rent, paid, paidAt, reference: String(input.reference || '').trim().slice(0, 60) };
  }
  function registerContract(s, input) {
    const validated = validateContract(s, input);
    if (input.confirmed !== true) fail('请核对合同签约人与付款记录后确认登记。');
    ensureReceipts(s);
    const c = { ...validated, id: 'C' + (s.contracts.length + 1) };
    s.contracts.push(c);
    addReceipt(s, c, 'initial', c.paid, c.paidAt, c.start, c.end, c.reference);
    log(s, '管理员', '合同登记', c.device, '第一所有人：' + user(s, c.owner).name + '；控制权限未改变');
    return c;
  }
  function normalizeRights(value) {
    const r = {}; fields.forEach(k => { r[k] = Boolean(value[k]); });
    if (!r.view) fields.slice(1).forEach(k => { r[k] = false; });
    return r;
  }
  function permissionChanges(s, did, draft) {
    const changes = [];
    Object.keys(draft).forEach(uid => {
      const j = join(s, did, uid);
      if (!j) fail('用户尚未扫码添加此设备，不能保存此用户的授权。', 'NOT_ASSOCIATED');
      const next = normalizeRights(draft[uid]);
      const diff = fields.filter(k => Boolean(j.rights[k]) !== next[k]);
      if (diff.length) changes.push({ uid, next, before: copy(j.rights), fields: diff });
    });
    return changes;
  }
  function grant(s, did, draft, reason = '') {
    if (!device(s, did)) fail('设备不存在。');
    const changes = permissionChanges(s, did, draft);
    if (!changes.length) fail('没有需要保存的权限变更。');
    changes.forEach(c => { join(s, did, c.uid).rights = c.next; });
    log(s, '管理员', '权限变更', did, changes.map(c => user(s, c.uid).name + '：' + (c.next.view ? fields.filter(k => c.next[k]).map(k => ({ view:'查看',control:'启停',frequency:'调频',reset:'复位' })[k]).join('、') : '已收回全部权限')).join('；') + (reason ? '。' + reason.slice(0, 100) : ''));
    return changes;
  }
  function can(s, did, uid, action) {
    const d = device(s, did), j = join(s, did, uid);
    if (!d || !j || !j.rights.view) return { ok: false, reason: '当前无权访问此设备。' };
    if (action === 'view') return { ok: true };
    const permission = ['start', 'stop'].includes(action) ? 'control' : action;
    if (!j.rights[permission]) return { ok: false, reason: '此项操作尚未获得管理员授权。' };
    if (!d.online) return { ok: false, reason: '设备离线，暂时无法下发控制指令。' };
    const status = leaseStatus(s, did);
    if (action !== 'stop' && !['near', 'active'].includes(status)) return { ok:false, reason: status === 'expired' ? '租赁已到期，续租后恢复控制。' : '设备尚无生效中的租赁合同。' };
    return { ok:true };
  }
  function command(s, did, uid, action, value) {
    const access = can(s, did, uid, action); if (!access.ok) fail(access.reason, 'CONTROL_DENIED');
    const d = device(s, did);
    if (action === 'frequency') {
      if (value === '' || !Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 80) fail('示例频率范围为 0–80 Hz。');
      d.target = Math.round(Number(value) * 10) / 10;
      if (d.run) d.hz = d.target;
    } else if (action === 'start') { d.run = true; d.hz = d.target; d.current = 6.7; d.voltage = 311; }
    else if (action === 'stop') { d.run = false; d.hz = 0; d.current = 0; d.voltage = 0; }
    log(s, user(s, uid).name, ({ start:'启动',stop:'停止',frequency:'频率设定',reset:'故障复位' })[action], did, '模拟设备已确认' + (action === 'frequency' ? '：' + d.target.toFixed(1) + ' Hz' : ''));
  }
  function renew(s, did, end, paid, confirmed, paidAt = NOW.slice(0, 10), reference = '') {
    const c = contract(s, did);
    if (!c || !confirmed || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(end) || !Number.isFinite(epoch(end)) || epoch(end) <= Math.max(epoch(c.end), epoch(NOW)) || !/^\d+(\.\d{1,2})?$/.test(String(paid)) || Number(paid) <= 0) fail('请填写新的有效到期时间、付款金额，并确认已核对付款。');
    validatePaidAt(paidAt);
    if (Number(paid) > 1000000) fail('付款金额不能超过 1,000,000 元。');
    ensureReceipts(s);
    const old = c.end; c.end = end;
    const ref = String(reference).trim().slice(0, 60);
    c.renewals = (c.renewals || []).concat({ old, end, paid:Number(paid), paidAt, reference:ref }).slice(-4);
    addReceipt(s, c, 'renewal', paid, paidAt, old, end, ref);
    log(s, '管理员', '续租登记', did, old.replace('T',' ') + ' → ' + end.replace('T',' ') + '，设备未自动启动');
    return c;
  }
  const api = { NOW, fields, seed, copy, epoch, device, user, contract, join, mask, days, leaseStatus, parseQR, qr, inspectInventory, addInventory, inspectScan, addByScan, validateContract, registerContract, normalizeRights, permissionChanges, grant, can, command, renew, validatePaidAt, ensureReceipts, incomeReport, ensureAdministrator, canInventory, addInventoryFor, tableReport };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else global.RentalPrototype = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
