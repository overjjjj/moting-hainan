const test=require('node:test');
const assert=require('node:assert/strict');
const M=require('./workflow-model.js');
const input={device:'05',phone:'13600001820',number:'ZL-2026-1005',rent:'300',paid:'299.99',paidAt:'2026-10-20',start:'2026-10-21T00:00',end:'2026-11-21T18:00',confirmed:true};

test('按收款月份汇总，过期合同收入仍保留，金额以分精确累加',()=>{
 const s=M.seed();
 assert.equal(M.incomeReport(s,'2026-10').totalCents,64000);
 assert.equal(M.incomeReport(s,'2026-09').totalCents,64000);
 assert.equal(M.incomeReport(s).totalCents,128000);
 M.registerContract(s,input);
 assert.equal(M.incomeReport(s,'2026-10').totalCents,93999);
 assert.equal(M.incomeReport(s,'2026-11').totalCents,0);
 const count=s.receipts.length;
 M.addByScan(s,'wang',M.qr(M.device(s,'05')));
 M.addByScan(s,'chen',M.qr(M.device(s,'05')));
 M.grant(s,'05',{wang:{view:true,control:true}});
 assert.equal(s.receipts.length,count);
});
test('续租单独记收入，原收款租期不被覆盖，历史不会随摘要截断而丢失',()=>{
 const s=M.seed(),initial=M.copy(s.receipts[0]);
 for(let month=11;month<=16;month++){
  const end=new Date(Date.UTC(2026,month-1,24)).toISOString().slice(0,10)+'T18:00';
  M.renew(s,'01',end,'0.10',true,'2026-10-21','R-'+month);
 }
 assert.equal(M.contract(s,'01').renewals.length,4);
 assert.equal(M.incomeReport(s,'2026-10','renewal').count,6);
 assert.equal(M.incomeReport(s,'2026-10','renewal').totalCents,60);
 assert.deepEqual(s.receipts[0],initial);
 assert.equal(M.incomeReport(s,'2026-10','initial').totalCents,64000);
});
test('未核对、无效日期或重复提交不产生收入',()=>{
 const s=M.seed(),before=JSON.stringify(s);
 for(const patch of [{confirmed:false},{paidAt:''},{paidAt:'2026-02-30'},{paidAt:'2026-10-22'}])assert.throws(()=>M.registerContract(s,{...input,...patch}));
 for(const date of ['2026-02-30','2026-10-22',''])assert.throws(()=>M.renew(s,'01','2026-11-24T18:00','360',true,date));
 assert.equal(JSON.stringify(s),before);
 M.registerContract(s,input);
 assert.throws(()=>M.registerContract(s,input));
 M.renew(s,'01','2026-11-24T18:00','360',true);
 assert.throws(()=>M.renew(s,'01','2026-11-24T18:00','360',true));
 assert.equal(s.receipts.length,6);
});
test('旧演示数据保留金额，未知收款日不伪造为起租日，迁移不重复',()=>{
 const s=M.seed();delete s.receipts;
 s.contracts.forEach(c=>delete c.paidAt);
 M.ensureReceipts(s);M.ensureReceipts(s);
 assert.equal(s.receipts.length,4);
 assert.equal(M.incomeReport(s,'2026-10').totalCents,0);
 assert.equal(M.incomeReport(s,'undated').totalCents,128000);
 assert.equal(M.incomeReport(s).totalCents,128000);
});
