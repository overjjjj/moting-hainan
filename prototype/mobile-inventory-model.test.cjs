const test=require('node:test');
const assert=require('node:assert/strict');
const M=require('./workflow-model.js');
const input={raw:'HN|VF-22|PHONE006',name:'手机入库设备',place:'海口仓库 A 区'};
test('只有管理员可从手机入库，拒绝普通客户且无半条记录',()=>{
 const s=M.seed(),before=JSON.stringify(s);
 for(const uid of ['chen','wang','li','unknown'])assert.throws(()=>M.addInventoryFor(s,uid,input),{code:'ADMIN_REQUIRED'});
 assert.equal(JSON.stringify(s),before);
 const d=M.addInventoryFor(s,'admin',input);
 assert.equal(d.inventorySource,'手机扫码');
 assert.equal(d.createdBy,'admin');
 assert.equal(M.contract(s,d.id),undefined);
 assert.equal(s.joins.some(j=>j.device===d.id),false);
 assert.equal(M.incomeReport(s).totalCents,128000);
 assert.match(s.logs[0].result,/手机扫码入库/);
});
test('手机与后台共享模块唯一性，入库后客户扫码仍只读',()=>{
 const s=M.seed(),d=M.addInventoryFor(s,'admin',input);
 assert.throws(()=>M.addInventoryFor(s,'admin',input,'desktop'),{code:'DUPLICATE_DEVICE'});
 assert.throws(()=>M.addInventoryFor(s,'admin',input),{code:'DUPLICATE_DEVICE'});
 assert.equal(s.devices.length,6);
 M.addByScan(s,'chen',M.qr(d));
 assert.deepEqual(M.join(s,d.id,'chen').rights,{view:true,control:false,frequency:false,reset:false});
 const other=M.addInventoryFor(s,'admin',{...input,raw:'HN|VF-22|DESKTOP007'},'desktop');
 assert.throws(()=>M.addInventoryFor(s,'admin',{...input,raw:M.qr(other)}),{code:'DUPLICATE_DEVICE'});
});
test('兼容旧数据时保留客户与设备，管理员迁移只添加一次',()=>{
 const s=M.seed();s.users=s.users.filter(u=>u.id!=='admin');
 const users=M.copy(s.users),devices=M.copy(s.devices);
 M.ensureAdministrator(s);M.ensureAdministrator(s);
 assert.deepEqual(s.users.filter(u=>u.id!=='admin'),users);
 assert.deepEqual(s.devices,devices);
 assert.equal(s.users.filter(u=>u.id==='admin').length,1);
});
