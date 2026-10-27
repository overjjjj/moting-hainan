const test=require('node:test');
const assert=require('node:assert/strict');
const M=require('./workflow-model.js');
test('月度、设备与客户汇总金额一致，台账保留零收入设备',()=>{
 const s=M.seed();
 for(const type of ['device','month','customer']){
  const r=M.tableReport(s,type);
  assert.equal(r.rows.reduce((sum,x)=>sum+x.totalCents,0),128000);
  assert.equal(r.total.totalCents,128000);
 }
 const devices=M.tableReport(s,'device').rows;
 assert.equal(devices.length,5);
 assert.equal(devices.find(x=>x.key==='05').totalCents,0);
 assert.equal(M.tableReport(s,'customer').rows.find(x=>x.key==='chen').contractDeviceCount,3);
 M.addByScan(s,'wang',M.qr(M.device(s,'02')));
 assert.equal(M.tableReport(s,'customer').rows.length,2);
});
test('续租只计一次，日期与设备/客户明细筛选一致',()=>{
 const s=M.seed();M.renew(s,'01','2026-11-24T18:00','123.45',true,'2026-10-21');
 for(const type of ['device','month','customer'])assert.equal(M.tableReport(s,type,'2026-10').total.totalCents,76345);
 const scope={dimension:'device',key:'01'};
 assert.equal(M.incomeReport(s,'2026-10','all',scope).totalCents,12345);
 assert.equal(M.incomeReport(s,'all','initial',scope).totalCents,36000);
 assert.equal(M.incomeReport(s,'all','all',{dimension:'customer',key:'chen'}).totalCents,112345);
 assert.equal(M.incomeReport(s,'all','all',{dimension:'device',key:'05'}).count,0);
 const chen=M.tableReport(s,'customer').rows.find(x=>x.key==='chen');
 assert.equal(chen.deviceCount,3);
 assert.equal(chen.count,4);
});
test('缺失日期独立成组，不丢收入或混入已知月份',()=>{
 const s=M.seed();s.receipts[0].paidAt=null;
 assert.equal(M.tableReport(s,'month').rows.find(x=>x.key==='undated').totalCents,36000);
 assert.equal(M.tableReport(s,'month','undated').total.totalCents,36000);
 assert.equal(M.tableReport(s,'month','2026-09').total.totalCents,28000);
 assert.equal(M.tableReport(s,'month').total.totalCents,128000);
});
