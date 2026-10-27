const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const {webcrypto}=require('node:crypto');
const source=fs.readFileSync(path.join(__dirname,'../dist/demo.js'),'utf8');
const plain=v=>JSON.parse(JSON.stringify(v));
function fixture(saved){
 const values=new Map(saved?[['inverter-rental-demo:v1',JSON.stringify(saved)]]:[]);
 const scheduled=new Map(),events=[],listeners={};let timerId=0,storageFails=false;
 const context={console,Buffer,TextEncoder,TextDecoder,crypto:webcrypto,
   localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>{if(storageFails)throw new Error('quota');values.set(k,v);}},
   CustomEvent:class{constructor(type,data){this.type=type;this.detail=data.detail;}},
   dispatchEvent:event=>events.push(event),addEventListener:(name,fn)=>listeners[name]=fn,
   setTimeout:fn=>{const id=++timerId;scheduled.set(id,fn);return id;},clearTimeout:id=>scheduled.delete(id)
 };
 vm.createContext(context);vm.runInContext(source,context,{filename:'demo.js'});
 return{Demo:context.Demo,events,values,listeners,failStorage(){storageFails=true;},flush(){let limit=100;while(scheduled.size){if(--limit<0)throw new Error('Unbounded timers');const [id,fn]=scheduled.entries().next().value;scheduled.delete(id);fn();}}};
}
const rights=(control=false,frequency=false,reset=false,view=true)=>({view,control,frequency,reset});
const contractInput=(d='D007',extras={})=>({deviceId:d,phone:'13800138002',number:'HT-NEW-01',start:'2026-10-24T10:00:00+08:00',end:'2026-11-24T10:00:00+08:00',monthlyCents:150000,amountCents:150000,paidAt:'2026-10-24T09:00:00+08:00',reference:'PAY-NEW-01',...extras});

test('inventory is admin-only, supports both QR formats, rejects duplicate module atomically',()=>{
 const{Demo:d}=fixture(),initial=JSON.stringify(d.state);
 assert.throws(()=>d.inventory({raw:d.qr('D001'),name:'重复',region:'海口市',place:'仓库'}),/已入库/);
 assert.equal(JSON.stringify(d.state),initial);
 assert.throws(()=>d.inventory({raw:'HN|VFD-15KW|864999999999991',name:'新设备',region:'海口市',place:'仓库'},'chen'),/管理员/);
 const next=d.inventory({raw:'HN|VFD-15KW|864999999999991',name:'新设备',region:'海口市',place:'仓库'});
 assert.equal(next.id,'D009');assert.equal(d.lease(next.id).key,'stock');assert.equal(next.online,false);
 assert.deepEqual(plain(d.parseQR('HN+VFD-15KW+864999999999991')),{vendor:'HN',model:'VFD-15KW',module:'864999999999991'});
 assert.throws(()=>d.parseQR('HN|VFD+15KW|99999999'),/格式/);
});
test('scan is idempotent, view-only, and never transfers ownership',()=>{
 const{Demo:d}=fixture();d.scan(d.qr('D001'),'li');
 assert.equal(d.contract('D001').ownerId,'chen');assert.deepEqual(plain(d.membership('D001','li').rights),rights());
 assert.equal(d.can('D001','li','start').ok,false);
 const count=d.state.memberships.length,version=d.state.sync.localVersion;d.scan(d.qr('D001'),'li');
 assert.equal(d.state.memberships.length,count);assert.equal(d.state.sync.localVersion,version);
 assert.throws(()=>d.scan('HN+VFD-15KW+99999999','li'),/尚未入库/);
});
test('paid contract sets owner without auto-association; owner must scan then receive a separate grant',()=>{
 const{Demo:d}=fixture();d.scan(d.qr('D007'),'wang');
 const c=d.registerContract(contractInput());
 assert.equal(c.ownerId,'li');assert.equal(d.membership('D007','wang').rights.control,false);
 assert.equal(d.membership('D007','li'),null);
 assert.throws(()=>d.grant('D007','li',rights(true)),/尚未扫码/);
 d.scan(d.qr('D007'),'li');assert.deepEqual(plain(d.membership('D007','li').rights),rights());
 assert.equal(d.contract('D007').ownerId,'li');
 d.grant('D007','li',rights(true));assert.equal(d.membership('D007','li').rights.control,true);
 assert.equal(d.state.receipts[0].userId,'li');assert.equal(d.state.receipts[0].amountCents,150000);
 assert.equal(d.state.receipts[0].userName,'李海明');
 const before=JSON.stringify(d.state);assert.throws(()=>d.registerContract(contractInput('D008',{amountCents:150.25,number:'HT-NEW-02'})),/整数分/);assert.equal(JSON.stringify(d.state),before);
 assert.throws(()=>d.registerContract(contractInput('D008',{number:'HT-NEW-02'})),/重复收款/);
 assert.throws(()=>d.registerContract(contractInput('D008',{number:'HT-NEW-03',reference:'PAY-02',phone:'13912345678'})),/先登记/);
 assert.throws(()=>d.registerContract(contractInput('D008',{number:'HT-NEW-04',reference:'PAY-03',end:'2027-02-30T10:00:00+08:00'})),/日历/);
});
test('grants are granular, validate invariants, and do not change contract owner',()=>{
 const{Demo:d}=fixture();assert.throws(()=>d.grant('D001','li',rights(true)),/尚未扫码/);
 assert.throws(()=>d.grant('D001','wang',rights(true),'chen'),/管理员/);
 assert.throws(()=>d.grant('D001','wang',rights(true,false,false,false)),/查看权限/);
 d.grant('D001','wang',rights(false,true));assert.equal(d.can('D001','wang','frequency').ok,true);assert.equal(d.can('D001','wang','start').ok,false);
 assert.equal(d.contract('D001').ownerId,'chen');
});
test('command requires receipt, rejects duplicates, rechecks revoked permissions, and handles timeout',()=>{
 const f=fixture(),d=f.Demo,first=d.command('D001','chen','stop');
 assert.equal(first.status,'pending');assert.equal(d.device('D001').run,true);
 assert.throws(()=>d.command('D001','chen','stop'),/等待回执/);
 f.flush();assert.equal(d.state.commands.find(c=>c.id===first.id).status,'succeeded');assert.equal(d.device('D001').run,false);
 const start=d.command('D001','chen','start');d.grant('D001','chen',rights());f.flush();
 assert.equal(d.state.commands.find(c=>c.id===start.id).status,'failed');assert.equal(d.device('D001').run,false);
 d.grant('D001','chen',rights(true,true,true));d.setScenario('D001','timeout');const timed=d.command('D001','chen','start');f.flush();
 assert.equal(d.state.commands.find(c=>c.id===timed.id).status,'uncertain');assert.equal(d.device('D001').run,false);
 assert.throws(()=>d.command('D001','chen','frequency',51),/0–50/);
});
test('fault/reset, frequency, and offline transitions retain credible device state',()=>{
 const f=fixture(),d=f.Demo;d.setScenario('D001','fault');
 assert.equal(d.can('D001','chen','start').ok,false);d.command('D001','chen','reset');f.flush();assert.equal(d.device('D001').fault,null);
 d.command('D001','chen','frequency',27.4);f.flush();assert.equal(d.device('D001').target,27.4);assert.equal(d.device('D001').run,false);
 d.command('D001','chen','start');d.setScenario('D001','offline');f.flush();
 assert.equal(d.state.commands[0].status,'uncertain');assert.equal(d.device('D001').run,false);
});
test('expiry blocks restart, stops only on receipt, offline expiry waits until reconnect',()=>{
 const f=fixture(),d=f.Demo;d.setScenario('D001','offline');d.setNow('2026-10-25T18:00:00+08:00');
 assert.equal(d.lease('D001').key,'expired');assert.equal(d.device('D001').run,true);
 let cmd=d.state.commands.find(c=>c.deviceId==='D001'&&c.source==='expiry');assert.equal(cmd.status,'uncertain');
 d.setScenario('D001','online');assert.equal(d.device('D001').run,true);f.flush();assert.equal(d.device('D001').run,false);
 cmd=d.state.commands.find(c=>c.deviceId==='D001'&&c.source==='expiry');assert.equal(cmd.status,'succeeded');assert.equal(d.can('D001','chen','start').ok,false);
 const count=d.state.commands.length;d.setNow(d.state.now);assert.equal(d.state.commands.length,count);
});
test('renewal records actual cents and never auto-starts stopped expired device',()=>{
 const f=fixture(),d=f.Demo;d.setNow('2026-10-26T10:00:00+08:00');f.flush();
 d.renew({deviceId:'D001',end:'2026-11-25T18:00:00+08:00',amountCents:149999,paidAt:d.state.now,reference:'PAY-RENEW'});
 assert.equal(d.device('D001').run,false);assert.equal(d.lease('D001').key,'active');assert.equal(d.state.receipts[0].amountCents,149999);
 assert.equal(d.state.receipts[0].type,'renewal');
});
test('7/3/1 reminders are deduplicated by lease end and recipient',()=>{
 const f=fixture(),d=f.Demo;
 for(const at of ['2026-11-08T10:00:00+08:00','2026-11-12T10:00:00+08:00','2026-11-14T10:00:00+08:00']){d.setNow(at);f.flush();d.setNow(at);}
 const notices=d.state.messages.filter(m=>m.deviceId==='D002'&&m.key&&m.key.startsWith('reminder:'));
 assert.equal(notices.length,3);assert.deepEqual(plain(notices.map(m=>m.key.split(':').pop()).sort()),['1','3','7']);
 assert.ok(notices.every(m=>m.userId==='li'));
 assert.throws(()=>d.setNow('2026-10-01T00:00:00+08:00'),/不能倒退/);
});
test('user master versions queue offline and sync; failures do not partially mutate',()=>{
 const f=fixture(),d=f.Demo;d.setSyncOnline(false);d.registerUser({name:'新客户',phone:'13912345678'});
 assert.equal(d.state.sync.pending,1);assert.throws(()=>d.syncNow(),/断开/);d.setSyncOnline(true);d.syncNow();assert.equal(d.state.sync.pending,0);assert.equal(d.state.sync.localVersion,d.state.sync.cloudVersion);
 const before=JSON.stringify(d.state);f.failStorage();assert.throws(()=>d.registerUser({name:'存储失败',phone:'13912345679'}),/未保存/);assert.equal(JSON.stringify(d.state),before);
});
test('encrypted backup has no plaintext contacts or cloud data; restore keeps telemetry, receipts, and current clock',async()=>{
 const f=fixture(),d=f.Demo,backup=await d.exportBackup('Demo-password-2026');
 assert.equal(JSON.stringify(backup).includes('13800138001'),false);assert.equal(backup.format,'inverter-user-master-encrypted');
 const inspected=await d.inspectBackup(backup,'Demo-password-2026');
 assert.deepEqual(Object.keys(inspected.payload).sort(),['contracts','createdAt','identities','kind','memberships','schema','sourceVersion','users']);
 assert.deepEqual(plain(inspected.conflicts),[]);
 d.registerUser({name:'备份后新增',phone:'13912345678'});d.setScenario('D002','fault');d.renew({deviceId:'D002',end:'2026-12-15T10:00:00+08:00',amountCents:180001,paidAt:d.state.now,reference:'NEW-RECEIPT'});
 const deviceBefore=JSON.stringify(d.state.devices),receiptsBefore=JSON.stringify(d.state.receipts),clock=d.state.now,logs=d.state.logs.length;
 d.restoreBackup(inspected);
 assert.equal(d.state.users.length,4);assert.equal(d.contract('D002').end,'2026-11-15T10:00:00+08:00');
 assert.equal(JSON.stringify(d.state.devices),deviceBefore);assert.equal(JSON.stringify(d.state.receipts),receiptsBefore);assert.equal(d.state.now,clock);assert.ok(d.state.logs.length>logs);
 assert.throws(()=>d.restoreBackup(inspected),/先解密/);
});
test('wrong password, tampered ciphertext, unknown schema, and forged restore are atomic',async()=>{
 const{Demo:d}=fixture(),backup=await d.exportBackup('Demo-password-2026'),before=JSON.stringify(d.state);
 await assert.rejects(d.inspectBackup(backup,'Wrong-password'),/密码错误/);
 const tampered=plain(backup);tampered.ciphertext=(tampered.ciphertext[0]==='A'?'B':'A')+tampered.ciphertext.slice(1);
 await assert.rejects(d.inspectBackup(tampered,'Demo-password-2026'),/修改/);
 await assert.rejects(d.inspectBackup({...backup,version:2},'Demo-password-2026'),/版本/);
 assert.throws(()=>d.restoreBackup({payload:{},conflicts:[]}),/先解密/);
 const inspected=await d.inspectBackup(backup,'Demo-password-2026');inspected.payload.users[1].name='修改预览';
 assert.throws(()=>d.restoreBackup(inspected),/发生变化/);assert.equal(JSON.stringify(d.state),before);
});
test('restore checks actual device identity conflicts again at execution time',async()=>{
 const{Demo:d}=fixture(),backup=await d.exportBackup('Demo-password-2026'),inspected=await d.inspectBackup(backup,'Demo-password-2026');
 // Simulates the inventory changing in another tab after the preview was opened.
 d.state.devices[0].module='DIFFERENT-MODULE';
 const before=JSON.stringify(d.state);assert.throws(()=>d.restoreBackup(inspected),/身份/);assert.equal(JSON.stringify(d.state),before);
});
test('restore old expired lease enforces expiry without reverting cloud financial history',async()=>{
 const f=fixture(),d=f.Demo,backup=await d.exportBackup('Demo-password-2026');
 d.setNow('2026-10-26T10:00:00+08:00');f.flush();
 d.renew({deviceId:'D001',end:'2026-11-25T18:00:00+08:00',amountCents:150000,paidAt:d.state.now,reference:'RESTORE-RENEW'});
 d.command('D001','chen','start');f.flush();assert.equal(d.device('D001').run,true);
 const receiptCount=d.state.receipts.length,inspected=await d.inspectBackup(backup,'Demo-password-2026');
 d.restoreBackup(inspected);f.flush();assert.equal(d.lease('D001').key,'expired');assert.equal(d.device('D001').run,false);assert.equal(d.state.receipts.length,receiptCount);
});
test('invalid persisted and cross-tab states are ignored; valid shared changes dispatch updates',()=>{
 const bad=fixture({schema:999});assert.equal(bad.Demo.state.devices.length,8);
 const f=fixture(),next=plain(f.Demo.state);next.users[1].name='跨页更新';f.listeners.storage({key:'inverter-rental-demo:v1',newValue:JSON.stringify(next)});
 assert.equal(f.Demo.user('chen').name,'跨页更新');assert.ok(f.events.at(-1).detail.external);
 f.listeners.storage({key:'inverter-rental-demo:v1',newValue:'{"schema":8}'});assert.equal(f.Demo.user('chen').name,'跨页更新');
 const a=plain(f.Demo.history('D001','hz',168)),b=plain(f.Demo.history('D001','hz',168));assert.deepEqual(a,b);assert.equal(a.length,49);assert.ok(a.every(p=>Number.isFinite(p.value)));
});


test('online user master edits publish a durable confirmed mirror automatically',()=>{
 const f=fixture(),d=f.Demo;d.grant('D001','wang',rights(true));
 assert.equal(d.state.sync.pending,0);assert.equal(d.state.sync.localVersion,d.state.sync.cloudVersion);
 assert.equal(d.state.cloudMirror.version,d.state.sync.cloudVersion);assert.equal(d.can('D001','wang','stop').ok,true);
 const reloaded=fixture(d.state).Demo;assert.equal(reloaded.can('D001','wang','stop').ok,true);
 assert.equal(reloaded.state.cloudMirror.memberships.find(m=>m.deviceId==='D001'&&m.userId==='wang').rights.control,true);
});
test('offline grants and newly scanned users cannot gain control until reconnection publishes them',()=>{
 const f=fixture(),d=f.Demo;d.setSyncOnline(false);const cloudVersion=d.state.sync.cloudVersion;
 d.grant('D001','wang',rights(true,true));
 assert.equal(d.state.memberships.find(m=>m.deviceId==='D001'&&m.userId==='wang').rights.control,true);
 assert.equal(d.membership('D001','wang').rights.control,false);assert.equal(d.membership('D001','wang').pending,true);
 assert.match(d.can('D001','wang','start').reason,/尚未同步/);
 assert.throws(()=>d.command('D001','wang','start'),/尚未同步/);
 d.scan(d.qr('D001'),'li');d.grant('D001','li',rights(true));
 assert.equal(d.can('D001','li','view').ok,true);assert.equal(d.can('D001','li','stop').ok,false);
 assert.equal(d.state.sync.cloudVersion,cloudVersion);assert.equal(d.state.sync.pending,3);
 const reloaded=fixture(d.state).Demo;assert.equal(reloaded.can('D001','li','stop').ok,false);
 d.setSyncOnline(true);
 assert.equal(d.state.sync.pending,0);assert.equal(d.state.sync.localVersion,d.state.sync.cloudVersion);
 assert.equal(d.can('D001','wang','start').ok,true);assert.equal(d.can('D001','li','stop').ok,true);
});
test('offline revocation immediately narrows existing permissions and duplicate scan cannot restore them',()=>{
 const f=fixture(),d=f.Demo;d.setSyncOnline(false);d.grant('D001','chen',rights(false,false,false,false));
 assert.equal(d.state.cloudMirror.memberships.find(m=>m.deviceId==='D001'&&m.userId==='chen').rights.control,true);
 assert.equal(d.can('D001','chen','start').ok,false);assert.equal(d.can('D001','chen','view').ok,false);
 const before=JSON.stringify(d.state);assert.throws(()=>d.scan(d.qr('D001'),'chen'),/已撤销/);
 assert.equal(JSON.stringify(d.state),before);
 d.setSyncOnline(true);assert.equal(d.can('D001','chen','start').ok,false);
});
test('a queued device receipt rechecks an offline revocation before changing telemetry',()=>{
 const f=fixture(),d=f.Demo;d.command('D001','chen','stop');f.flush();
 const request=d.command('D001','chen','start');d.setSyncOnline(false);d.grant('D001','chen',rights());
 f.flush();assert.equal(d.state.commands.find(c=>c.id===request.id).status,'failed');assert.equal(d.device('D001').run,false);
});
test('offline renewal keeps cloud expiry and reminders active; reconnect never auto-starts the stopped device',()=>{
 const f=fixture(),d=f.Demo,oldEnd=d.contract('D001').end;d.setSyncOnline(false);
 d.renew({deviceId:'D001',end:'2026-11-25T18:00:00+08:00',amountCents:150000,paidAt:d.state.now,reference:'OFFLINE-RENEW'});
 assert.equal(d.contract('D001').end,'2026-11-25T18:00:00+08:00');assert.equal(d.effectiveContract('D001').end,oldEnd);
 d.setNow('2026-10-25T10:00:00+08:00');
 assert.ok(d.state.messages.some(m=>m.deviceId==='D001'&&m.key==='reminder:C001:'+oldEnd+':1'));
 d.setNow(oldEnd);f.flush();
 assert.equal(d.lease('D001').key,'expired');assert.equal(d.device('D001').run,false);
 assert.match(d.can('D001','chen','start').reason,/尚未同步/);
 assert.throws(()=>d.command('D001','chen','start'),/尚未同步/);
 assert.ok(d.state.alarms.some(a=>a.deviceId==='D001'&&a.kind==='lease'&&!a.resolvedAt));
 d.setSyncOnline(true);assert.equal(d.lease('D001').key,'active');assert.equal(d.device('D001').run,false);
 assert.equal(d.can('D001','chen','start').ok,true);assert.equal(d.state.sync.pending,0);
 assert.ok(!d.state.alarms.some(a=>a.deviceId==='D001'&&a.kind==='lease'&&!a.resolvedAt));
});
test('an offline device with a pending local renewal still receives its confirmed expiry stop on reconnect',()=>{
 const f=fixture(),d=f.Demo;d.setSyncOnline(false);d.setScenario('D001','offline');
 d.renew({deviceId:'D001',end:'2026-11-25T18:00:00+08:00',amountCents:150000,paidAt:d.state.now,reference:'OFFLINE-BOTH'});
 d.setNow('2026-10-26T10:00:00+08:00');assert.equal(d.device('D001').run,true);
 assert.equal(d.state.commands.find(c=>c.deviceId==='D001'&&c.source==='expiry').status,'uncertain');
 d.setScenario('D001','online');f.flush();assert.equal(d.device('D001').run,false);
 assert.equal(d.state.commands.find(c=>c.deviceId==='D001'&&c.source==='expiry').status,'succeeded');
});
test('an offline new contract cannot enable device control even for admin before sync',()=>{
 const f=fixture(),d=f.Demo;d.setSyncOnline(false);d.registerContract(contractInput());d.scan(d.qr('D007'),'li');d.grant('D007','li',rights(true));d.setScenario('D007','online');
 assert.equal(d.lease('D007').label,'合同待同步');assert.equal(d.can('D007','li','start').ok,false);assert.match(d.can('D007','admin','start').reason,/尚未同步/);
 d.setSyncOnline(true);assert.equal(d.can('D007','li','start').ok,true);assert.equal(d.can('D007','admin','start').ok,true);
});
test('schema 1 legacy seed migrates without losing data; legacy pending edits remain unconfirmed',()=>{
 const initial=plain(fixture().Demo.state);delete initial.cloudMirror;
 const clean=fixture(initial).Demo;assert.equal(clean.user('chen').name,'陈建国');assert.equal(clean.can('D001','chen','start').ok,true);
 initial.sync={online:false,localVersion:2,cloudVersion:1,pending:1};
 initial.contracts.find(c=>c.deviceId==='D001').end='2026-12-25T18:00:00+08:00';
 initial.memberships.find(m=>m.deviceId==='D001'&&m.userId==='wang').rights.control=true;
 const pending=fixture(initial).Demo;assert.equal(pending.contract('D001').end,'2026-12-25T18:00:00+08:00');
 assert.equal(pending.effectiveContract('D001').end,'2026-10-25T18:00:00+08:00');assert.equal(pending.can('D001','wang','start').ok,false);
 pending.setSyncOnline(true);assert.equal(pending.can('D001','wang','start').ok,true);
});

test('offline revoke followed by regrant stays narrowed until the cloud confirms the new grant',()=>{
 const f=fixture(),d=f.Demo;d.setSyncOnline(false);
 d.grant('D001','chen',rights(false,false,false,false));d.grant('D001','chen',rights(true,true,true));
 assert.equal(d.can('D001','chen','start').ok,false);assert.equal(d.membership('D001','chen').rights.view,false);
 assert.throws(()=>d.scan(d.qr('D001'),'chen'),/尚未同步/);
 const restored=fixture(d.state).Demo;assert.equal(restored.can('D001','chen','start').ok,false);
 d.setSyncOnline(true);assert.equal(d.can('D001','chen','start').ok,true);assert.equal(d.state.sync.revokedRights.length,0);
});
