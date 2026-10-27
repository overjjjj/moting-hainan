const test=require('node:test');
const assert=require('node:assert/strict');
const M=require('./workflow-model.js');
const input={device:'05',phone:'13600001820',number:'ZL-2026-1005',rent:'300.00',paid:'300',start:'2026-10-21T00:00',end:'2026-11-21T18:00',reference:'PAY-005',confirmed:true};

test('入库校验格式及模块唯一性，失败不能产生半条档案',()=>{
  const s=M.seed(),before=JSON.stringify(s);
  assert.throws(()=>M.addInventory(s,{raw:'HN|VF-22|DEMO4G001001',name:'重复'}),{code:'DUPLICATE_DEVICE'});
  assert.throws(()=>M.addInventory(s,{raw:'INVALID',name:'无效'}),{code:'INVALID_QR'});
  assert.throws(()=>M.addInventory(s,{raw:'HN|VF-22|NEW006',name:' '}));
  assert.equal(JSON.stringify(s),before);
  const d=M.addInventory(s,{raw:'HN+VF-22+NEW006',name:'新设备'});
  assert.equal(d.module,'NEW006');
  assert.equal(M.contract(s,d.id),undefined);
  assert.equal(s.joins.filter(j=>j.device===d.id).length,0);
});
test('多人扫码默认只读，重复扫码幂等，不能抢占第一所有人',()=>{
  const s=M.seed(),c=M.contract(s,'01');
  M.addByScan(s,'li',M.qr(M.device(s,'01')));
  assert.deepEqual(M.join(s,'01','li').rights,{view:true,control:false,frequency:false,reset:false});
  M.addByScan(s,'li',M.qr(M.device(s,'01')));
  assert.equal(s.joins.filter(j=>j.device==='01'&&j.user==='li').length,1);
  assert.equal(c.owner,'chen');
});
test('未入库、不匹配、无效二维码不能添加关联',()=>{
  const s=M.seed(),n=s.joins.length;
  assert.throws(()=>M.addByScan(s,'chen','HN|VF-22|UNKNOWN'),{code:'NOT_INVENTORIED'});
  assert.throws(()=>M.addByScan(s,'chen','XX|VF-99|DEMO4G001001'),{code:'QR_MISMATCH'});
  assert.throws(()=>M.addByScan(s,'chen','bad'),{code:'INVALID_QR'});
  assert.equal(s.joins.length,n);
});
test('合同登记校验已绑定手机号、金额、租期和付款确认',()=>{
  const s=M.seed(),before=JSON.stringify(s);
  for(const patch of [{phone:'13899999999'},{rent:'-1'},{paid:'0'},{rent:'1.123'},{end:input.start},{confirmed:false},{number:'ZL-2026-1001'}])assert.throws(()=>M.registerContract(s,{...input,...patch}));
  assert.equal(JSON.stringify(s),before);
  const c=M.registerContract(s,input);
  assert.equal(c.owner,'wang');
  assert.equal(M.join(s,'05','wang'),undefined);
  M.addByScan(s,'wang',M.qr(M.device(s,'05')));
  assert.equal(M.can(s,'05','wang','start').ok,false);
  assert.throws(()=>M.registerContract(s,{...input,number:'ANOTHER'}),{code:'LEASE_EXISTS'});
});
test('授权只影响指定设备和指定用户，并与合同归属分离',()=>{
  const s=M.seed(),owner=M.contract(s,'01').owner;
  M.grant(s,'01',{wang:{view:true,control:true,frequency:true,reset:false}});
  assert.equal(M.can(s,'01','wang','stop').ok,true);
  assert.equal(M.can(s,'01','wang','reset').ok,false);
  assert.equal(M.can(s,'02','wang','view').ok,false);
  assert.equal(M.contract(s,'01').owner,owner);
  assert.throws(()=>M.grant(s,'05',{wang:{view:true,control:true}}),{code:'NOT_ASSOCIATED'});
});
test('撤回查看会清除控制权限，重新扫码不能绕过撤权',()=>{
  const s=M.seed();
  M.grant(s,'01',{chen:{view:false,control:true,frequency:true,reset:true}});
  assert.deepEqual(M.join(s,'01','chen').rights,{view:false,control:false,frequency:false,reset:false});
  assert.throws(()=>M.addByScan(s,'chen',M.qr(M.device(s,'01'))),{code:'ACCESS_REVOKED'});
  assert.equal(M.contract(s,'01').owner,'chen');
  M.grant(s,'01',{chen:{view:true,control:false,frequency:false,reset:false}});
  assert.equal(M.inspectScan(s,'chen',M.qr(M.device(s,'01'))).added,true);
});
test('离线、到期、未生效租约和未授权用户不能执行控制',()=>{
  const s=M.seed();
  assert.throws(()=>M.command(s,'03','chen','start'),{code:'CONTROL_DENIED'});
  assert.throws(()=>M.command(s,'04','chen','start'),{code:'CONTROL_DENIED'});
  assert.throws(()=>M.command(s,'01','wang','frequency',50),{code:'CONTROL_DENIED'});
  M.registerContract(s,{...input,start:'2026-10-22T00:00'});
  M.addByScan(s,'wang',M.qr(M.device(s,'05')));
  M.grant(s,'05',{wang:{view:true,control:true,frequency:true,reset:true}});
  assert.equal(M.can(s,'05','wang','start').ok,false);
});
test('频率边界有效，越界或空值不能覆盖设定，续租不自动启动',()=>{
  const s=M.seed();
  for(const value of ['',-1,81,'abc'])assert.throws(()=>M.command(s,'01','chen','frequency',value));
  assert.equal(M.device(s,'01').target,42);
  M.command(s,'01','chen','frequency',80);assert.equal(M.device(s,'01').hz,80);
  M.command(s,'01','chen','frequency',0);assert.equal(M.device(s,'01').hz,0);
  M.renew(s,'04','2026-11-20T18:00','280',true);
  assert.equal(M.leaseStatus(s,'04'),'active');
  assert.equal(M.device(s,'04').run,false);
  assert.equal(M.contract(s,'04').renewals.length,1);
});
test('短信充值仅为接口契约，未实现支付或扣款',()=>{
  const sms=require('./sms-interface-contract.json');
  assert.equal(sms.implemented,false);
  assert.equal(sms.rechargeChannel,null);
  assert.equal(sms.unitPrice,null);
});
