/* 所有设备、收款、指令、同步均为当前浏览器内的演示数据。 */
(function(root){
'use strict';
const KEY='inverter-rental-demo:v1',DAY=86400000,INITIAL_NOW='2026-10-24T10:00:00+08:00';
const RIGHTS=['view','control','frequency','reset'],ACTIONS=['start','stop','frequency','reset'];
const inspectedBackups=new WeakMap(),timers=new Set();
let sequence=0,generation=0,current;
const copy=v=>JSON.parse(JSON.stringify(v));
const fail=m=>{throw new Error(m);};
const uid=p=>p+'-'+Date.now().toString(36)+'-'+(++sequence).toString(36)+'-'+Math.random().toString(36).slice(2,7);
function text(v,label,max=120){if(typeof v!=='string'||!v.trim()||v.trim().length>max)fail(label+'不能为空，且不能超过 '+max+' 个字符');return v.trim();}
function iso(v,label='时间'){if(typeof v!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,3})?)?(?:Z|[+-]\d\d:\d\d)$/.test(v)||!Number.isFinite(Date.parse(v)))fail(label+'格式无效，请使用带时区的日期时间');if(Number(v.slice(11,13))>23||new Date(v.slice(0,10)+'T00:00:00Z').toISOString().slice(0,10)!==v.slice(0,10))fail(label+'包含无效的日历日期或时刻');return v;}
function cents(v,label){if(!Number.isSafeInteger(v)||v<1||v>10000000000)fail(label+'必须是有效的整数分金额');return v;}
function phone(v){v=text(v,'手机号',11);if(!/^1[3-9]\d{9}$/.test(v))fail('请输入有效的 11 位手机号');return v;}
function device(s,id){return s.devices.find(d=>d.id===id)||fail('设备不存在');}
function user(s,id){return s.users.find(u=>u.id===id)||fail('用户不存在');}
function admin(s,id){if(user(s,id).role!=='admin')fail('仅管理员可以执行此操作');}
function contract(s,id){return s.contracts.find(c=>c.deviceId===id)||null;}
function membership(s,d,u){return s.memberships.find(m=>m.deviceId===d&&m.userId===u)||null;}
function effectiveContract(s,id){
 const confirmed=s.cloudMirror.contracts.find(c=>c.deviceId===id)||null,local=contract(s,id);
 if(!confirmed)return null;
 if(!local)return confirmed;
 return {...confirmed,start:Date.parse(local.start)>Date.parse(confirmed.start)?local.start:confirmed.start,end:Date.parse(local.end)<Date.parse(confirmed.end)?local.end:confirmed.end};
}
function effectiveMembership(s,d,u){
 const local=membership(s,d,u),confirmed=s.cloudMirror.memberships.find(m=>m.deviceId===d&&m.userId===u);
 if(!local)return null;
 const revoked=(s.sync.revokedRights||[]).find(m=>m.deviceId===d&&m.userId===u)?.rights||{};
 const result={deviceId:d,userId:u,rights:{},pending:!confirmed||RIGHTS.some(r=>local.rights[r]!==confirmed.rights[r]||revoked[r])};
 // A new scan may show cached device information, but never confers offline control.
 result.rights.view=!!local.rights.view&&(!confirmed||!!confirmed.rights.view)&&!revoked.view;
 for(const r of RIGHTS.slice(1))result.rights[r]=result.rights.view&&!!local.rights[r]&&!!confirmed?.rights[r]&&!revoked[r];
 return result;
}
function lease(s,id){
  device(s,id);const c=effectiveContract(s,id);if(!c)return{key:'stock',label:contract(s,id)?'合同待同步':'库存待出租',days:null};
  const now=Date.parse(s.now),days=Math.ceil((Date.parse(c.end)-now)/DAY);
  if(now<Date.parse(c.start))return{key:'future',label:'租约未开始',days};
  if(now>=Date.parse(c.end))return{key:'expired',label:'租约已到期',days:0};
  return{key:days<=7?'near':'active',label:days<=7?'即将到期':'租约有效',days};
}
function allowed(s,did,userid,action){
  const d=s.devices.find(d=>d.id===did),u=s.users.find(u=>u.id===userid);
  if(!d||!u)return{ok:false,reason:'设备或用户不存在'};
  if(!['view',...ACTIONS].includes(action))return{ok:false,reason:'不支持的操作'};
  const m=effectiveMembership(s,did,userid),local=membership(s,did,userid),r=['start','stop'].includes(action)?'control':action;
  if(u.role!=='admin'&&(!m||!m.rights.view||!m.rights[r]))return{ok:false,reason:local?.rights.view&&local.rights[r]?'授权尚未同步至云端，暂不可操作':local&&!local.rights.view?'查看权限已撤销，请联系管理员':action==='view'?'尚未添加此设备':'管理员尚未授予此操作权限'};
  if(action==='view')return{ok:true,reason:''};
  if(!d.online)return{ok:false,reason:'设备离线，无法确认执行结果'};
  const l=lease(s,did);
  if(action!=='stop'&&!['active','near'].includes(l.key)){const localLease=contract(s,did),waiting=localLease&&Date.parse(localLease.start)<=Date.parse(s.now)&&Date.parse(localLease.end)>Date.parse(s.now);return{ok:false,reason:waiting?'合同或续租尚未同步至云端，暂不可操作':l.key==='expired'?'租约已到期，请续租后再操作':'设备没有生效中的租约'};}
  if(action==='start'&&d.fault)return{ok:false,reason:'设备存在故障，请先排查并复位'};
  if(s.commands.some(c=>c.deviceId===did&&c.status==='pending'))return{ok:false,reason:'已有指令等待回执，请稍后重试'};
  return{ok:true,reason:''};
}
function log(s,actor,action,detail,deviceId=null){s.logs.unshift({id:uid('LOG'),actor,action,detail,deviceId,time:s.now});if(s.logs.length>1000)s.logs.length=1000;}
function publishMaster(s){s.cloudMirror={version:s.sync.localVersion,confirmedAt:s.now,contracts:copy(s.contracts),memberships:copy(s.memberships)};s.sync.cloudVersion=s.sync.localVersion;s.sync.pending=0;s.sync.revokedRights=[];}
function masterChanged(s){
 s.sync.localVersion++;s.sync.pending=s.sync.localVersion-s.sync.cloudVersion;
 if(s.sync.online){publishMaster(s);return;}
 s.sync.revokedRights=s.sync.revokedRights||[];
 for(const confirmed of s.cloudMirror.memberships){
  const local=membership(s,confirmed.deviceId,confirmed.userId),removed=RIGHTS.filter(r=>confirmed.rights[r]&&!local?.rights[r]);
  if(!removed.length)continue;
  let record=s.sync.revokedRights.find(m=>m.deviceId===confirmed.deviceId&&m.userId===confirmed.userId);
  if(!record){record={deviceId:confirmed.deviceId,userId:confirmed.userId,rights:{}};s.sync.revokedRights.push(record);}
  removed.forEach(r=>record.rights[r]=true);
 }
}
function message(s,userId,deviceId,title,body,key){if(key&&s.messages.some(m=>m.key===key))return;s.messages.unshift({id:uid('MSG'),userId,deviceId,title,body,createdAt:s.now,read:false,key:key||null});}
function alarm(s,d,kind,content,severity='warning'){if(s.alarms.some(a=>a.deviceId===d.id&&a.kind===kind&&!a.resolvedAt))return;s.alarms.unshift({id:uid('ALM'),deviceId:d.id,kind,severity,message:content,createdAt:s.now,ackAt:null,resolvedAt:null});}
function resolve(s,did,kind){s.alarms.filter(a=>a.deviceId===did&&a.kind===kind&&!a.resolvedAt).forEach(a=>a.resolvedAt=s.now);}
function seed(){
 const s={schema:1,now:INITIAL_NOW,users:[
 {id:'admin',name:'平台管理员',phone:'13800000000',registeredAt:'2026-09-01T09:00:00+08:00',role:'admin'},
 {id:'chen',name:'陈建国',phone:'13800138001',registeredAt:'2026-09-01T10:00:00+08:00',role:'customer'},
 {id:'li',name:'李海明',phone:'13800138002',registeredAt:'2026-09-02T10:00:00+08:00',role:'customer'},
 {id:'wang',name:'王晓燕',phone:'13800138003',registeredAt:'2026-09-03T10:00:00+08:00',role:'customer'}
 ],devices:[
 ['D001','东山一号灌溉泵','海口市','东山镇水稻基地',true,true,38.5,null],
 ['D002','崖州二号供水泵','三亚市','崖州区果园',true,true,42,null],
 ['D003','那大三号增压泵','儋州市','那大镇泵站',false,true,35,null],
 ['D004','嘉积四号排水泵','琼海市','嘉积镇排水站',true,false,0,'E006 · 过载保护'],
 ['D005','龙华五号循环泵','海口市','龙华区养殖场',true,false,0,null],
 ['D006','吉阳六号水泵','三亚市','吉阳区温室基地',true,true,32,null],
 ['D007','库存 15kW 变频器','儋州市','中心仓库 A-01',false,false,0,null],
 ['D008','库存 22kW 变频器','琼海市','中心仓库 A-02',false,false,0,null]
 ].map((a,i)=>({id:a[0],name:a[1],vendor:'HN',model:i===7?'VFD-22KW':'VFD-15KW',module:'86410000000000'+(i+1),region:a[2],place:a[3],online:a[4],run:a[5],hz:a[6],target:a[6]||35,current:a[5]?Number((a[6]*.36).toFixed(1)):0,voltage:380,bus:537,fault:a[7],lastSeen:a[4]?INITIAL_NOW:'2026-10-24T08:15:00+08:00'})),
 contracts:[
 ['C001','HT-2026-1001','D001','chen','2026-09-25T18:00:00+08:00','2026-10-25T18:00:00+08:00',150000],
 ['C002','HT-2026-1002','D002','li','2026-10-15T10:00:00+08:00','2026-11-15T10:00:00+08:00',180000],
 ['C003','HT-2026-1003','D003','chen','2026-10-05T10:00:00+08:00','2026-11-05T10:00:00+08:00',150000],
 ['C004','HT-2026-1004','D004','wang','2026-10-10T10:00:00+08:00','2026-11-10T10:00:00+08:00',200000],
 ['C005','HT-2026-1005','D005','li','2026-09-23T10:00:00+08:00','2026-10-23T10:00:00+08:00',120000],
 ['C006','HT-2026-1006','D006','wang','2026-09-27T10:00:00+08:00','2026-10-27T10:00:00+08:00',160000]
 ].map(a=>({id:a[0],number:a[1],deviceId:a[2],ownerId:a[3],start:a[4],end:a[5],monthlyCents:a[6]})),
 memberships:[],receipts:[],commands:[],alarms:[],logs:[],messages:[],sync:{online:true,localVersion:1,cloudVersion:1,pending:0},backups:[]};
 s.contracts.forEach(c=>{const u=s.users.find(u=>u.id===c.ownerId);s.memberships.push({deviceId:c.deviceId,userId:c.ownerId,rights:{view:true,control:true,frequency:true,reset:true}});s.receipts.push({id:'R'+c.id.slice(1),contractId:c.id,deviceId:c.deviceId,userId:c.ownerId,type:'initial',amountCents:c.monthlyCents,paidAt:c.start,reference:'演示收款-'+c.number,userName:u.name,userPhone:u.phone,contractNumber:c.number});});
 s.memberships.push({deviceId:'D001',userId:'wang',rights:{view:true,control:false,frequency:false,reset:false}});
 alarm(s,s.devices[2],'offline','4G 模块离线，当前显示的是最后一次采样');
 alarm(s,s.devices[3],'fault','E006 过载保护，请先检查负载','danger');
 alarm(s,s.devices[4],'lease','租约到期，设备已执行停机（模拟）');
 const exp=s.contracts[4];
 s.commands.push({id:'CMD-SEED-STOP',deviceId:'D005',userId:'system',action:'stop',value:null,status:'succeeded',createdAt:'2026-10-23T10:00:00+08:00',completedAt:'2026-10-23T10:00:01+08:00',result:'租约到期，已收到模拟停机回执',source:'expiry',leaseEnd:exp.end});
 message(s,'li','D005','租约已到期','租约已到期，设备已经模拟停机。请联系管理员登记续租。','expiry:C005:'+exp.end);
 message(s,'chen','D001','设备权限已授予','管理员已授予启停、调频和故障复位权限。','seed-permission');
 message(s,'wang','D006','租约到期提醒 · 3 天','吉阳六号水泵租约将在 2026-10-27 到期，请联系管理员续租。短信通道暂未启用。','reminder:C006:'+s.contracts[5].end+':3');
 publishMaster(s);log(s,'admin','初始化演示','已载入 8 台设备、6 份合同和 4 位用户。演示数据不代表真实设备。');return s;
}
function unique(rows,key,label){const values=rows.map(key);if(new Set(values).size!==values.length)fail(label+'有重复数据');}
function validate(s){
 if(!s||s.schema!==1||typeof s!=='object')fail('不支持的数据版本');iso(s.now);
 for(const key of ['users','devices','contracts','memberships','receipts','commands','alarms','logs','messages','backups'])if(!Array.isArray(s[key])||s[key].length>20000)fail('数据结构无效：'+key);
 if(!s.sync||typeof s.sync.online!=='boolean'||!Number.isSafeInteger(s.sync.localVersion)||!Number.isSafeInteger(s.sync.cloudVersion)||s.sync.localVersion<s.sync.cloudVersion||s.sync.cloudVersion<1||s.sync.pending!==s.sync.localVersion-s.sync.cloudVersion)fail('同步版本无效');
 if(s.sync.revokedRights!==undefined){if(!Array.isArray(s.sync.revokedRights)||s.sync.revokedRights.length>20000)fail('待同步撤权记录无效');s.sync.revokedRights.forEach(m=>{device(s,m.deviceId);text(m.userId,'撤权用户');if(!m.rights||Object.keys(m.rights).some(r=>!RIGHTS.includes(r)||m.rights[r]!==true))fail('待同步撤权字段无效');});}
 if(!s.cloudMirror||s.cloudMirror.version!==s.sync.cloudVersion||!Array.isArray(s.cloudMirror.contracts)||!Array.isArray(s.cloudMirror.memberships)||s.cloudMirror.contracts.length>20000||s.cloudMirror.memberships.length>20000)fail('已确认云端镜像无效');
 iso(s.cloudMirror.confirmedAt);unique(s.cloudMirror.contracts,c=>c.deviceId,'镜像设备租约');unique(s.cloudMirror.memberships,m=>m.deviceId+':'+m.userId,'镜像设备用户关系');
 s.cloudMirror.contracts.forEach(c=>{device(s,c.deviceId);text(c.id,'镜像合同 ID');text(c.ownerId,'镜像客户 ID');iso(c.start);iso(c.end);if(Date.parse(c.end)<=Date.parse(c.start))fail('镜像合同租期无效');});
 s.cloudMirror.memberships.forEach(m=>{device(s,m.deviceId);text(m.userId,'镜像用户 ID');if(!m.rights||RIGHTS.some(r=>typeof m.rights[r]!=='boolean')||(!m.rights.view&&RIGHTS.slice(1).some(r=>m.rights[r])))fail('镜像权限配置无效');});
 unique(s.users,u=>u.id,'用户');unique(s.users,u=>u.phone,'手机号');unique(s.devices,d=>d.id,'设备');unique(s.devices,d=>d.module,'4G 模块');
 unique(s.contracts,c=>c.id,'合同');unique(s.contracts,c=>c.deviceId,'设备租约');unique(s.contracts,c=>c.number,'合同编号');unique(s.memberships,m=>m.deviceId+':'+m.userId,'设备用户关系');
 s.users.forEach(u=>{text(u.id,'用户 ID');text(u.name,'姓名',40);phone(u.phone);iso(u.registeredAt);if(!['admin','customer'].includes(u.role))fail('用户角色无效');});
 if(!s.users.some(u=>u.id==='admin'&&u.role==='admin'))fail('缺少演示管理员');
 s.devices.forEach(d=>{text(d.id,'设备 ID');text(d.name,'设备名称');text(d.vendor,'厂商');text(d.model,'型号');text(d.module,'模块');if(typeof d.online!=='boolean'||typeof d.run!=='boolean')fail('设备状态无效');});
 s.contracts.forEach(c=>{device(s,c.deviceId);user(s,c.ownerId);text(c.number,'合同编号');iso(c.start);iso(c.end);if(Date.parse(c.end)<=Date.parse(c.start))fail('合同结束时间必须晚于开始时间');cents(c.monthlyCents,'月租金');});
 s.memberships.forEach(m=>{device(s,m.deviceId);user(s,m.userId);if(!m.rights||RIGHTS.some(r=>typeof m.rights[r]!=='boolean')||(!m.rights.view&&RIGHTS.slice(1).some(r=>m.rights[r])))fail('权限配置无效');});
 s.receipts.forEach(r=>{cents(r.amountCents,'收款金额');iso(r.paidAt);if(!['initial','renewal'].includes(r.type))fail('收款类型无效');});
 s.commands.forEach(c=>{if(!ACTIONS.includes(c.action)||!['pending','succeeded','failed','uncertain'].includes(c.status))fail('指令结构无效');});return true;
}
function persist(next){validate(next);if(root.localStorage){try{root.localStorage.setItem(KEY,JSON.stringify(next));}catch(_){fail('浏览器存储不可用或已满，本次修改未保存；请先导出备份');}}current=next;if(root.dispatchEvent&&typeof root.CustomEvent==='function')root.dispatchEvent(new root.CustomEvent('demo:change',{detail:{now:next.now}}));}
function mutate(fn){const next=copy(current),result=fn(next);persist(next);return result;}
function migrateMirror(s){
 if(s.schema!==1||s.cloudMirror||!s.sync||!Array.isArray(s.contracts)||!Array.isArray(s.memberships)||!Array.isArray(s.devices))return s;
 if(s.sync.pending===0)s.cloudMirror={version:s.sync.cloudVersion,confirmedAt:s.now,contracts:copy(s.contracts),memberships:copy(s.memberships)};
 else{
  // An old cache never stored its confirmed mirror. Do not assume pending grants/renewals were published.
  const baseline=seed();
  s.cloudMirror={version:s.sync.cloudVersion,confirmedAt:s.now,contracts:baseline.contracts.filter(c=>s.devices.some(d=>d.id===c.deviceId&&d.module===baseline.devices.find(x=>x.id===c.deviceId).module)),memberships:s.memberships.map(m=>({deviceId:m.deviceId,userId:m.userId,rights:{view:!!m.rights.view,control:false,frequency:false,reset:false}}))};
  log(s,'system','旧缓存兼容迁移','原缓存未保存云端确认镜像，待同步控制权限保持关闭；同步后按本地主档生效');
 }
 return s;
}
function load(){try{const saved=root.localStorage&&root.localStorage.getItem(KEY);if(saved){const s=migrateMirror(JSON.parse(saved));validate(s);s.commands.filter(c=>c.status==='pending').forEach(c=>{c.status='uncertain';c.result='页面已重新载入，模拟回执中断，未确认设备执行';});return s;}}catch(_){/* Invalid local cache is not trusted. */}return seed();}
function parseQR(raw){const rawValue=text(raw,'二维码内容',300),parts=rawValue.split(rawValue.includes('|')?'|':'+');if(parts.length!==3||parts.some(p=>!p.trim()||p!==p.trim()))fail('二维码格式应为：厂商代号+变频器型号+4G模块ID');const[vendor,model,module]=parts;if(!/^[A-Za-z0-9_-]{1,24}$/.test(vendor)||!/^[A-Za-z0-9_.-]{1,48}$/.test(model)||!/^[A-Za-z0-9_-]{4,40}$/.test(module))fail('二维码厂商、型号或模块 ID 格式无效');return{vendor,model,module};}


function allowedIgnoringPending(s,c){const trial=copy(s);trial.commands=trial.commands.filter(x=>x.id!==c.id);return allowed(trial,c.deviceId,c.userId,c.action).ok;}
function scheduleReceipt(commandId){
 const born=generation,timer=setTimeout(()=>{
  timers.delete(timer);if(born!==generation||!current.commands.some(c=>c.id===commandId&&c.status==='pending'))return;
  mutate(s=>{const c=s.commands.find(c=>c.id===commandId),d=device(s,c.deviceId);c.completedAt=s.now;
   if(!d.online||c.simulatedTimeout){c.status='uncertain';c.result=d.online?'模拟回执超时，不能认定设备已经执行':'设备已离线，尚未收到执行回执';}
   else if(c.action==='start'&&(d.fault||!['active','near'].includes(lease(s,d.id).key))){c.status='failed';c.result=d.fault?'设备故障，启动被拒绝':'租约状态已变化，启动被拒绝';}
   else if(c.userId!=='system'&&!allowedIgnoringPending(s,c)){c.status='failed';c.result='权限或租约已变化，指令被拒绝';}
   else{c.status='succeeded';c.result='已收到模拟设备执行回执';
    if(c.action==='start'){d.run=true;d.hz=d.target||35;d.current=Number((d.hz*.36).toFixed(1));}
    if(c.action==='stop'){d.run=false;d.hz=0;d.current=0;}
    if(c.action==='frequency'){d.target=c.value;if(d.run){d.hz=c.value;d.current=Number((d.hz*.36).toFixed(1));}}
    if(c.action==='reset'){d.fault=null;resolve(s,d.id,'fault');}d.lastSeen=s.now;
   }
   log(s,c.userId,'指令回执',c.action+' / '+c.status+' / '+c.result,d.id);
  });
 },900);timers.add(timer);if(timer&&timer.unref)timer.unref();
}
function queueExpiry(s,c){
 const d=device(s,c.deviceId),previous=s.commands.find(x=>x.deviceId===d.id&&x.source==='expiry'&&x.leaseEnd===c.end);
 if(previous&&(previous.status==='pending'||(previous.status==='succeeded'&&!d.run)||(!d.online&&previous.status!=='succeeded')))return null;
 if(previous&&previous.status!=='succeeded'){previous.status='pending';previous.createdAt=s.now;previous.result='设备已恢复在线，重新等待模拟停机回执';previous.simulatedTimeout=false;return previous.id;}
 const cmd={id:uid('CMD'),deviceId:d.id,userId:'system',action:'stop',value:null,status:d.online?'pending':'uncertain',createdAt:s.now,result:d.online?'租约到期，等待模拟停机回执':'租约到期但设备离线，停机尚未确认；恢复在线后模拟补发',source:'expiry',leaseEnd:c.end};
 s.commands.unshift(cmd);log(s,'system','到期停机',cmd.result,d.id);return d.online?cmd.id:null;
}
function enforceTime(s,previousNow){
 const queued=[];
 for(const c of s.devices.map(d=>effectiveContract(s,d.id)).filter(Boolean)){
  const remaining=Date.parse(c.end)-Date.parse(s.now);
  if(remaining<=0){
   alarm(s,device(s,c.deviceId),'lease','租约已到期；在线设备等待停机回执，离线设备待补发');
   message(s,c.ownerId,c.deviceId,'租约已到期','未续租，已触发停机流程；设备离线时不能确认停机，请关注回执。','expiry:'+c.id+':'+c.end);
   const commandId=queueExpiry(s,c);if(commandId)queued.push(commandId);
  }else{
   const before=Date.parse(c.end)-Date.parse(previousNow);
   for(const days of [7,3,1])if(remaining<=days*DAY&&before>days*DAY)message(s,c.ownerId,c.deviceId,'租约到期提醒 · '+days+' 天','设备 '+device(s,c.deviceId).name+' 的租约将在 '+c.end.slice(0,10)+' 到期，请联系管理员续租。短信通道暂未启用。','reminder:'+c.id+':'+c.end+':'+days);
  }
 }return queued;
}
function addReceipt(s,c,type,data){
 const u=user(s,c.ownerId),r={id:uid('REC'),contractId:c.id,deviceId:c.deviceId,userId:c.ownerId,type,amountCents:cents(data.amountCents,'实际收款金额'),paidAt:iso(data.paidAt,'收款时间'),reference:text(data.reference,'收款凭证号',100),userName:u.name,userPhone:u.phone,contractNumber:c.number};
 if(Date.parse(r.paidAt)>Date.parse(s.now))fail('收款时间不能晚于当前演示时间');
 if(s.receipts.some(r=>r.reference===data.reference.trim()))fail('该收款凭证号已经登记，请勿重复收款');
 s.receipts.unshift(r);return r;
}
const Demo={
 get state(){return current;},
 device(id){return current.devices.find(d=>d.id===id)||null;},
 user(id){return current.users.find(u=>u.id===id)||null;},
 contract(id){return contract(current,id);},
 membership(d,u){return effectiveMembership(current,d,u);},
 effectiveContract(id){return effectiveContract(current,id);},
 lease(id){return lease(current,id);},
 can(d,u,a){return allowed(current,d,u,a);},
 parseQR,
 qr(value){const d=typeof value==='string'?device(current,value):value;if(!d)fail('设备不存在');return d.vendor+'+'+d.model+'+'+d.module;},
 inventory(data,actorId='admin'){
  return mutate(s=>{
   admin(s,actorId);const parsed=parseQR(data.raw);
   if(s.devices.some(d=>d.module===parsed.module))fail('4G 模块已入库，不能重复登记或绑定另一台设备');
   const number=Math.max(0,...s.devices.map(d=>Number(d.id.replace(/^D/,''))||0))+1;
   const d={id:'D'+String(number).padStart(3,'0'),name:text(data.name,'设备名称',60),...parsed,region:text(data.region,'区域',30),place:text(data.place,'安装位置',100),online:false,run:false,hz:0,target:35,current:0,voltage:0,bus:0,fault:null,lastSeen:null};
   s.devices.push(d);log(s,actorId,'扫码入库',d.name+' / '+d.module,d.id);return d;
  });
 },
 scan(raw,userId){
  return mutate(s=>{user(s,userId);const parsed=parseQR(raw),d=s.devices.find(d=>d.vendor===parsed.vendor&&d.model===parsed.model&&d.module===parsed.module);
   if(!d)fail('设备尚未入库或二维码信息不匹配，请联系管理员');
   if(membership(s,d.id,userId)&&!membership(s,d.id,userId).rights.view)fail('该设备查看权限已撤销，请联系管理员重新授权；重复扫码不能恢复权限');
   if(membership(s,d.id,userId)&&!effectiveMembership(s,d.id,userId).rights.view)fail('查看权限恢复尚未同步，请联系管理员完成同步后再试');
   if(!membership(s,d.id,userId)){s.memberships.push({deviceId:d.id,userId,rights:{view:true,control:false,frequency:false,reset:false}});masterChanged(s);log(s,userId,'扫码添加','仅获得查看权限，未改变合同归属',d.id);}return d;
  });
 },
 registerUser(data){
  return mutate(s=>{const p=phone(data.phone);if(s.users.some(u=>u.phone===p))fail('该手机号已登记，请使用已有用户');
   const u={id:uid('USER'),name:text(data.name,'用户姓名',40),phone:p,registeredAt:s.now,role:'customer'};
   s.users.push(u);masterChanged(s);log(s,'admin','用户登记',u.name+' / '+u.phone);return u;
  });
 },
 registerContract(data,actorId='admin'){
  return mutate(s=>{
   admin(s,actorId);const d=device(s,data.deviceId);if(contract(s,d.id))fail('该设备已登记合同，请使用续租流程');
   const u=s.users.find(u=>u.phone===phone(data.phone));if(!u||u.role==='admin')fail('请先登记已绑定手机号的客户，再登记合同');
   const number=text(data.number,'合同编号',60);if(s.contracts.some(c=>c.number===number))fail('合同编号已经存在');
   const c={id:uid('CON'),number,deviceId:d.id,ownerId:u.id,start:iso(data.start,'合同开始时间'),end:iso(data.end,'合同结束时间'),monthlyCents:cents(data.monthlyCents,'月租金')};
   if(Date.parse(c.end)<=Date.parse(c.start))fail('合同结束时间必须晚于开始时间');
   if(Date.parse(c.end)<=Date.parse(s.now))fail('新合同结束时间必须晚于当前演示时间');
   addReceipt(s,c,'initial',data);s.contracts.push(c);
   masterChanged(s);log(s,actorId,'合同与收款登记',number+'；首位所有人：'+u.name+'；实收 '+(data.amountCents/100).toFixed(2)+' 元',d.id);
   message(s,u.id,d.id,'合同已登记','您已成为合同第一所有人。请先扫码添加设备，再由管理员单独授予启停等操作权限。');return c;
  });
 },
 renew(data,actorId='admin'){
  return mutate(s=>{
   admin(s,actorId);const c=contract(s,data.deviceId);if(!c)fail('该设备尚无合同，请先登记合同');
   const end=iso(data.end,'续租结束时间');if(Date.parse(end)<=Math.max(Date.parse(c.end),Date.parse(s.now)))fail('续租结束时间必须晚于原到期时间及当前演示时间');
   addReceipt(s,c,'renewal',data);c.end=end;masterChanged(s);if(lease(s,data.deviceId).key!=='expired')resolve(s,data.deviceId,'lease');
   log(s,actorId,'续租登记','租约延长至 '+end+'；设备不会自动启动',data.deviceId);
   message(s,c.ownerId,data.deviceId,'续租已登记',(s.sync.pending?'本地续租待同步，设备仍按云端已确认租期判断到期。':'租约已延长至 '+end.slice(0,10)+'；')+'续租不会自动启动设备。');return c;
  });
 },
 grant(deviceId,userId,rights,actorId='admin'){
  return mutate(s=>{
   admin(s,actorId);device(s,deviceId);user(s,userId);const m=membership(s,deviceId,userId);
   if(!m)fail('该用户尚未扫码添加设备，不能直接授予权限');
   if(!rights||RIGHTS.some(k=>typeof rights[k]!=='boolean')||Object.keys(rights).some(k=>!RIGHTS.includes(k)))fail('请提交完整的查看、启停、调频与复位权限');
   if(!rights.view&&RIGHTS.slice(1).some(k=>rights[k]))fail('授予操作权限时必须保留查看权限');
   m.rights={view:rights.view,control:rights.control,frequency:rights.frequency,reset:rights.reset};masterChanged(s);
   log(s,actorId,'设备授权',user(s,userId).name+'：'+RIGHTS.filter(r=>rights[r]).join(', '),deviceId);
   message(s,userId,deviceId,'设备权限已更新',rights.view?'您的设备权限已更新，请进入设备详情查看可用操作。':'该设备的查看及操作权限已被撤销。');return m;
  });
 },
 command(deviceId,userId,action,value){
  const cmd=mutate(s=>{
   const access=allowed(s,deviceId,userId,action);if(!access.ok)fail(access.reason);if(!ACTIONS.includes(action))fail('不支持的指令');
   const d=device(s,deviceId);if(action==='frequency'&&(typeof value!=='number'||!Number.isFinite(value)||value<0||value>50))fail('目标频率必须为 0–50 Hz');
   const c={id:uid('CMD'),deviceId,userId,action,value:action==='frequency'?Math.round(value*10)/10:null,status:'pending',createdAt:s.now,result:'已提交模拟指令，等待设备回执',simulatedTimeout:!!d._timeout};
   d._timeout=false;s.commands.unshift(c);log(s,userId,'提交指令',action+(action==='frequency'?' '+c.value+' Hz':''),deviceId);return c;
  });scheduleReceipt(cmd.id);return cmd;
 },
 setScenario(deviceId,scenario){
  const queued=[],result=mutate(s=>{
   const d=device(s,deviceId);if(!['offline','online','fault','recover','timeout'].includes(scenario))fail('不支持的演示场景');
   if(scenario==='offline'){d.online=false;alarm(s,d,'offline','4G 模块离线，运行数据停留在最后一次采样');}
   if(scenario==='online'){d.online=true;d.lastSeen=s.now;resolve(s,d.id,'offline');const c=effectiveContract(s,d.id);if(c&&lease(s,d.id).key==='expired'){const q=queueExpiry(s,c);if(q)queued.push(q);}}
   if(scenario==='fault'){d.fault='E006 · 过载保护';d.run=false;d.hz=0;d.current=0;alarm(s,d,'fault','模拟过载保护，设备已经停机','danger');}
   if(scenario==='recover'){d.fault=null;resolve(s,d.id,'fault');}
   if(scenario==='timeout')d._timeout=true;log(s,'admin','切换演示场景',scenario,d.id);return d;
  });queued.forEach(scheduleReceipt);return result;
 },
 ackAlarm(id){return mutate(s=>{const a=s.alarms.find(a=>a.id===id)||fail('告警不存在');if(!a.ackAt){a.ackAt=s.now;log(s,'admin','确认告警',a.message,a.deviceId);}return a;});},
 setNow(value){const next=iso(value,'演示时间');if(Date.parse(next)<Date.parse(current.now))fail('演示时间不能倒退；需要重新开始时请重置演示');let queued=[];mutate(s=>{const previous=s.now;s.now=next;queued=enforceTime(s,previous);log(s,'admin','推进演示时间',next);});queued.forEach(scheduleReceipt);return current.now;},
 markRead(id){return mutate(s=>{const m=s.messages.find(m=>m.id===id)||fail('通知不存在');m.read=true;return m;});},
 setSyncOnline(value){if(typeof value!=='boolean')fail('同步连接状态无效');let queued=[];const result=mutate(s=>{s.sync.online=value;if(value){publishMaster(s);s.devices.filter(d=>['active','near'].includes(lease(s,d.id).key)).forEach(d=>resolve(s,d.id,'lease'));queued=enforceTime(s,s.now);}log(s,'admin','本地同步连接',value?'已恢复连接并发布本地主档（模拟）':'已断开；本地变更排队，设备仍使用云端已确认租约与权限');return s.sync;});queued.forEach(scheduleReceipt);return result;},
 syncNow(){let queued=[];const result=mutate(s=>{if(!s.sync.online)fail('同步连接已断开，请先恢复连接');publishMaster(s);s.devices.filter(d=>['active','near'].includes(lease(s,d.id).key)).forEach(d=>resolve(s,d.id,'lease'));queued=enforceTime(s,s.now);log(s,'admin','同步用户主数据','已将本地版本 '+s.sync.localVersion+' 同步到云端镜像（模拟）');return s.sync;});queued.forEach(scheduleReceipt);return result;},
 history(deviceId,metric,hours=24){
  const d=device(current,deviceId);if(!['hz','frequency','current','voltage','bus'].includes(metric))fail('不支持的历史指标');if(!Number.isFinite(hours)||hours<=0||hours>744)fail('历史时长需在 0–744 小时之间');
  const end=Date.parse(current.now),basis={hz:d.target||35,frequency:d.target||35,current:(d.target||35)*.36,voltage:380,bus:537}[metric],seed=Number(d.id.replace(/\D/g,''))||1;
  return Array.from({length:49},(_,i)=>({time:new Date(end-hours*3600000+i*hours*3600000/48).toISOString(),value:Number(Math.max(0,basis+(Math.sin(i*.63+seed)+Math.cos(i*.31))*basis*.035).toFixed(1))}));
 },
 reset(){generation++;timers.forEach(clearTimeout);timers.clear();persist(seed());return current;}
};


function strictKeys(value,keys,label){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!keys.includes(k)))fail(label+'包含未知字段');}
function masterPayload(){return{
 schema:1,kind:'inverter-user-master',createdAt:current.now,sourceVersion:current.sync.localVersion,
 users:current.users.map(u=>({id:u.id,name:u.name,phone:u.phone,registeredAt:u.registeredAt,role:u.role})),
 contracts:current.contracts.map(c=>({id:c.id,number:c.number,deviceId:c.deviceId,ownerId:c.ownerId,start:c.start,end:c.end,monthlyCents:c.monthlyCents})),
 memberships:current.memberships.map(m=>({deviceId:m.deviceId,userId:m.userId,rights:copy(m.rights)})),
 identities:current.devices.map(d=>({id:d.id,vendor:d.vendor,model:d.model,module:d.module}))
};}
function validateMaster(p){
 strictKeys(p,['schema','kind','createdAt','sourceVersion','users','contracts','memberships','identities'],'备份数据');
 if(p.schema!==1||p.kind!=='inverter-user-master')fail('备份类型或版本不受支持');iso(p.createdAt);
 if(!Number.isSafeInteger(p.sourceVersion)||p.sourceVersion<1)fail('备份版本无效');
 for(const key of ['users','contracts','memberships','identities'])if(!Array.isArray(p[key])||p[key].length>20000)fail('备份结构或规模无效：'+key);
 p.users.forEach(u=>strictKeys(u,['id','name','phone','registeredAt','role'],'用户'));
 p.contracts.forEach(c=>strictKeys(c,['id','number','deviceId','ownerId','start','end','monthlyCents'],'合同'));
 p.memberships.forEach(m=>{strictKeys(m,['deviceId','userId','rights'],'授权');strictKeys(m.rights,RIGHTS,'授权权限');});
 p.identities.forEach(d=>{strictKeys(d,['id','vendor','model','module'],'设备身份索引');text(d.id,'设备 ID');parseQR(d.vendor+'+'+d.model+'+'+d.module);});
 unique(p.identities,d=>d.id,'备份设备 ID');unique(p.identities,d=>d.module,'备份模块 ID');
 const trial=seed();trial.users=copy(p.users);trial.contracts=copy(p.contracts);trial.memberships=copy(p.memberships);trial.devices=p.identities.map(d=>({...d,name:'备份身份校验',online:false,run:false}));trial.receipts=[];trial.commands=[];publishMaster(trial);validate(trial);
 const conflicts=[];
 p.identities.forEach(identity=>{const d=current.devices.find(d=>d.id===identity.id);if(!d)conflicts.push('当前环境缺少设备 '+identity.id+'，请先在设备台账核对');else if(['vendor','model','module'].some(k=>identity[k]!==d[k]))conflicts.push('设备 '+identity.id+' 的身份与当前台账不一致');});
 return conflicts;
}
function webcrypto(){if(!root.crypto||!root.crypto.subtle)fail('当前浏览器不支持安全加密，请通过 localhost 或 HTTPS 打开演示');return root.crypto;}
function b64(bytes){if(typeof Buffer!=='undefined')return Buffer.from(bytes).toString('base64');let raw='';for(const byte of bytes)raw+=String.fromCharCode(byte);return root.btoa(raw);}
function unb64(raw,label,max=5000000){if(typeof raw!=='string'||raw.length>max||!/^[A-Za-z0-9+/]*={0,2}$/.test(raw)||raw.length%4!==0)fail(label+'编码无效');try{if(typeof Buffer!=='undefined')return new Uint8Array(Buffer.from(raw,'base64'));const str=root.atob(raw);return Uint8Array.from(str,c=>c.charCodeAt(0));}catch(_){fail(label+'编码无效');}}
async function derive(password,salt,usage){if(typeof password!=='string'||password.length<8||password.length>200)fail('备份密码需为 8–200 个字符');const c=webcrypto(),material=await c.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);return c.subtle.deriveKey({name:'PBKDF2',salt,iterations:120000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,usage);}
Demo.exportBackup=async function(password){
 const crypto=webcrypto(),payload=masterPayload();validateMaster(payload);
 const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12)),key=await derive(password,salt,['encrypt']);
 const plain=new TextEncoder().encode(JSON.stringify(payload)),digest=b64(new Uint8Array(await crypto.subtle.digest('SHA-256',plain)));
 const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode('inverter-user-master:1')},key,plain);
 const envelope={format:'inverter-user-master-encrypted',version:1,createdAt:payload.createdAt,kdf:{name:'PBKDF2',hash:'SHA-256',iterations:120000,salt:b64(salt)},encryption:{name:'AES-GCM',iv:b64(iv)},digest,ciphertext:b64(new Uint8Array(cipher))};
 mutate(s=>{s.backups.unshift({id:uid('BKP'),createdAt:s.now,sourceVersion:payload.sourceVersion,users:payload.users.length,contracts:payload.contracts.length,format:'AES-256-GCM',status:'已生成加密备份文件'});log(s,'admin','生成用户备份','加密备份仅含用户、合同归属、租期与授权；不含运行数据与收款流水');});return envelope;
};
Demo.inspectBackup=async function(object,password){
 strictKeys(object,['format','version','createdAt','kdf','encryption','digest','ciphertext'],'备份文件');
 if(object.format!=='inverter-user-master-encrypted'||object.version!==1)fail('不支持的备份文件或版本');
 strictKeys(object.kdf,['name','hash','iterations','salt'],'密码参数');strictKeys(object.encryption,['name','iv'],'加密参数');
 if(object.kdf.name!=='PBKDF2'||object.kdf.hash!=='SHA-256'||object.kdf.iterations!==120000||object.encryption.name!=='AES-GCM')fail('备份加密参数不受支持');
 const salt=unb64(object.kdf.salt,'盐值',100),iv=unb64(object.encryption.iv,'随机向量',100),cipher=unb64(object.ciphertext,'密文');
 if(salt.length!==16||iv.length!==12||cipher.length<16)fail('备份加密数据长度无效');
 const key=await derive(password,salt,['decrypt']);let plain;
 try{plain=await webcrypto().subtle.decrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode('inverter-user-master:1')},key,cipher);}catch(_){fail('备份密码错误，或文件已被修改、损坏');}
 const digest=b64(new Uint8Array(await webcrypto().subtle.digest('SHA-256',plain)));if(digest!==object.digest)fail('备份完整性校验失败');
 let payload;try{payload=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(plain));}catch(_){fail('备份内容不是有效数据');}
 const conflicts=validateMaster(payload),result={payload:copy(payload),summary:{users:payload.users.length,contracts:payload.contracts.length,memberships:payload.memberships.length},conflicts};
 inspectedBackups.set(result,JSON.stringify(payload));return result;
};
Demo.restoreBackup=function(inspected){
 if(!inspected||!inspectedBackups.has(inspected))fail('请先解密、校验并预览备份文件');
 const serialized=inspectedBackups.get(inspected);if(JSON.stringify(inspected.payload)!==serialized)fail('预览后的备份数据发生变化，请重新校验');
 const payload=JSON.parse(serialized),conflicts=validateMaster(payload);if(conflicts.length)fail('备份存在冲突：'+conflicts.join('；'));
 let queued=[];mutate(s=>{s.users=copy(payload.users);s.contracts=copy(payload.contracts);s.memberships=copy(payload.memberships);masterChanged(s);queued=enforceTime(s,s.now);log(s,'admin','恢复用户备份','已恢复用户资料、合同归属、租期与授权；当前演示时间、设备采样、收款流水及操作历史保持不变');});
 inspectedBackups.delete(inspected);queued.forEach(scheduleReceipt);return{users:payload.users.length,contracts:payload.contracts.length,memberships:payload.memberships.length};
};
current=load();
if(root.addEventListener)root.addEventListener('storage',event=>{if(event.key!==KEY||!event.newValue)return;try{const next=migrateMirror(JSON.parse(event.newValue));validate(next);current=next;if(root.dispatchEvent&&typeof root.CustomEvent==='function')root.dispatchEvent(new root.CustomEvent('demo:change',{detail:{external:true}}));}catch(_){/* Ignore invalid cross-tab input. */}});
root.Demo=Demo;
if(typeof module==='object'&&module.exports)module.exports=Demo;
})(typeof window!=='undefined'?window:globalThis);

