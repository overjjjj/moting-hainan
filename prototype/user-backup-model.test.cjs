const test=require('node:test'),assert=require('node:assert/strict');
const M=require('./workflow-model.js'),B=require('./user-backup-model.js');
test('only customer master fields enter backup; motor, receipts and admin are excluded',()=>{
 const s=M.seed();s.users[0].unrelatedSecret='must-not-copy';s.devices[0].history=[100];s.devices[0].alarm='demo';
 const archive=B.snapshot(s,M.NOW);
 assert.equal(archive.users.length,3);assert.equal(archive.devices.length,4);
 assert.deepEqual(Object.keys(archive.users[0]).sort(),['id','name','phone','registeredAt']);
 assert.deepEqual(Object.keys(archive.devices[0]).sort(),['id','model','module','name','vendor']);
 assert.deepEqual(Object.keys(archive.leases[0]).sort(),['device','end','id','number','owner','start']);
 assert.equal(archive.access.length,6);
 assert.ok(!JSON.stringify(archive).includes('must-not-copy'));
 assert.ok(!['receipts','logs','hz','history','alarm','paid','rent'].some(k=>JSON.stringify(archive).includes('"'+k+'":')));
});
test('user table includes first ownership and shared devices, and preserves unknown registration',()=>{
 const s=M.seed();delete s.users[0].registeredAt;
 const u=B.userRows(s).find(u=>u.id==='chen');assert.equal(u.registeredAt,null);
 assert.equal(u.devices.length,4);assert.equal(u.devices.filter(d=>d.owner).length,3);
 assert.equal(u.devices.find(d=>d.id==='02').owner,false);
 assert.equal(u.devices.find(d=>d.id==='04').end,'2026-10-20T18:00');
});
test('restoration reverts only user fields, links and lease authority; keeps current motor state and revenue',()=>{
 const s=M.seed(),archive=B.snapshot(s,M.NOW);
 s.users[0].name='修改后的示例姓名';
 M.renew(s,'01','2026-11-24T18:00','360',true,'2026-10-21','test');
 M.command(s,'01','chen','frequency',45);
 M.grant(s,'01',{wang:{view:true,control:true,frequency:false,reset:false}});
 M.addByScan(s,'chen',M.qr(M.device(s,'05')));
 s.users.push({id:'extra',name:'新客户',phone:'13800009999'});
 s.joins.push({user:'extra',device:'05',rights:{view:true}});
 const devices=M.copy(s.devices),receipts=M.copy(s.receipts),admin=M.copy(M.user(s,'admin'));
 const current=JSON.stringify(s);
 assert.throws(()=>B.restoreDemo(s,archive,false),/勾选确认/);assert.equal(JSON.stringify(s),current);
 const result=B.preview(s,archive);assert.equal(result.conflicts.length,0);
 assert.deepEqual(result.changes.map(c=>c.field).sort(),['access','access','end','name']);
 B.restoreDemo(s,archive,true);
 assert.equal(M.user(s,'chen').name,'陈先生');assert.equal(M.contract(s,'01').end,'2026-10-24T18:00');
 assert.equal(M.join(s,'01','wang').rights.control,false);assert.equal(M.join(s,'05','chen'),undefined);
 assert.ok(M.join(s,'05','extra'));assert.deepEqual(s.devices,devices);assert.deepEqual(s.receipts,receipts);assert.deepEqual(M.user(s,'admin'),admin);
 assert.equal(B.preview(s,archive).changes.length,0);
});
test('device identity and newly signed contracts block a stale restore without partial writes',()=>{
 for(const change of [s=>{s.devices[0].module='CHANGED';},s=>{s.contracts.push({id:'new',number:'new-contract',device:'05',owner:'chen'});},s=>{s.users[1].phone=s.users[0].phone;}]){
  const s=M.seed(),archive=B.snapshot(s,M.NOW);change(s);const before=JSON.stringify(s);
  assert.ok(B.preview(s,archive).conflicts.length);assert.throws(()=>B.restoreDemo(s,archive,true));assert.equal(JSON.stringify(s),before);
 }
});
