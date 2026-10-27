'use strict';
/* End-to-end verification of the administrator flow and the miniapp's effective
 * lease/permission display. Runs only against isolated browser demonstration data.
 * Usage: node tests/admin-flow.cjs [http://127.0.0.1:PORT/]
 * Set PLAYWRIGHT_MODULE and EDGE_PATH to override the local browser runtime. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium,browserOptions}=require('../../tools/test-runtime.cjs');
const root=path.resolve(__dirname,'../dist'),results=[],artifacts=fs.mkdtempSync(path.join(os.tmpdir(),'inverter-admin-flow-'));
const qa=path.resolve(__dirname,'../qa');fs.mkdirSync(qa,{recursive:true});
let server,browser;
const passed=name=>{results.push(name);console.log('PASS '+name)};
async function startServer(){
 server=http.createServer((req,res)=>{
  let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch{res.statusCode=400;res.end();return}
  const filename=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(filename!==root&&!filename.startsWith(root+path.sep)){res.statusCode=403;res.end();return}
  try{const ext=path.extname(filename);res.setHeader('Content-Type',ext==='.js'?'application/javascript; charset=utf-8':ext==='.css'?'text/css; charset=utf-8':'text/html; charset=utf-8');res.end(fs.readFileSync(filename))}catch{res.statusCode=404;res.end()}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return 'http://127.0.0.1:'+server.address().port+'/';
}
(async()=>{
 const url=process.argv[2]||await startServer();
 browser=await chromium.launch(browserOptions());
 const context=await browser.newContext({viewport:{width:1440,height:1050},acceptDownloads:true}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);
 await page.goto(url);await page.waitForFunction(()=>globalThis.App&&globalThis.Demo&&globalThis.Admin&&globalThis.Mini);
 await page.evaluate(()=>App.navigate('admin','overview'));
 for(const section of ['overview','devices','leases','users','permissions','reports','reminders','backup','logs','settings']){
  await page.evaluate(s=>App.navigate('admin',s),section);
  assert.ok(await page.locator('#admin-root h1').textContent());
  assert.equal((await page.locator('#admin-root').innerText()).includes('NaN'),false);
  if(section==='overview')await page.screenshot({path:path.join(qa,'admin-overview.png'),fullPage:true});
  if(section==='reports')await page.screenshot({path:path.join(qa,'admin-reports.png'),fullPage:true});
  if(section==='backup'){
   await page.setViewportSize({width:390,height:844});
   await page.screenshot({path:path.join(qa,'admin-backup-mobile.png'),fullPage:true});
   await page.locator('[data-admin="backup-export"]').click();
   await page.screenshot({path:path.join(qa,'admin-backup-modal-mobile.png')});
   await page.evaluate(()=>App.closeModal());await page.setViewportSize({width:1440,height:1050});
  }
 }
 passed('all ten admin pages render without invalid numeric values');
 await page.evaluate(()=>App.navigate('admin','devices'));await page.locator('#admin-search').fill('D007');
 assert.equal(await page.locator('#admin-results tbody tr').count(),1);
 await page.locator('[data-admin="contract"][data-id="D007"]').click();
 await page.locator('#contract-form [name=phone]').selectOption('13800138001');
 await page.locator('#contract-form [name=verified]').check();
 await page.locator('#contract-form button[type=submit]').click();
 assert.equal(await page.evaluate(()=>Demo.contract('D007').ownerId),'chen');
 assert.equal(await page.evaluate(()=>Demo.membership('D007','chen')),null);
 assert.equal(await page.evaluate(()=>Demo.state.memberships.some(m=>m.deviceId==='D007'&&m.userId==='chen')),false);
 assert.equal(await page.evaluate(()=>{try{Demo.grant('D007','chen',{view:true,control:true,frequency:false,reset:false});return false}catch{return true}}),true);
 passed('contract/payment creates first owner without automatic membership or control rights');
 await page.evaluate(()=>{App.ui.userId='chen';App.navigate('mini','devices')});
 assert.equal(await page.locator('.mini-device-card[data-id="D007"]').count(),0);
 await page.locator('.mini-tabbar [data-mini="scan"]').click();
 await page.locator('#scan-sample').selectOption('D007');await page.locator('#scan-form button[type=submit]').click();
 assert.equal(await page.evaluate(()=>Demo.contract('D007').ownerId),'chen');
 assert.deepEqual(await page.evaluate(()=>Demo.membership('D007','chen').rights),{view:true,control:false,frequency:false,reset:false});
 passed('customer must scan after signing; scanning adds view only and preserves owner');
 await page.evaluate(()=>{App.ui.permissionDevice='D007';App.navigate('admin','permissions')});
 await page.locator('[data-admin="grant"][data-user="chen"]').click();
 await page.locator('#grant-form [name=control]').check();await page.locator('#grant-form [name=frequency]').check();
 await page.locator('#grant-form button[type=submit]').click();
 assert.deepEqual(await page.evaluate(()=>Demo.membership('D007','chen').rights),{view:true,control:true,frequency:true,reset:false});
 passed('administrator grants independent control and frequency rights after scan');
 await page.evaluate(()=>App.navigate('admin','leases'));
 await page.locator('[data-admin="renew"][data-id="D007"]').click();await page.locator('#renew-form [name=verified]').check();
 await page.locator('#renew-form button[type=submit]').click();
 assert.equal(await page.evaluate(()=>Demo.state.receipts.length),8);
 assert.equal(await page.evaluate(()=>Demo.device('D007').run),false);
 passed('renewal records receipt and extends lease without starting device');
 await page.evaluate(()=>App.navigate('admin','reports'));
 for(const tab of ['month','customer','device'])await page.locator('[data-admin="report-tab"][data-id="'+tab+'"]').click();
 const csvEvent=page.waitForEvent('download');await page.locator('[data-admin="export-report"]').click();
 const csvDownload=await csvEvent,csvPath=path.join(artifacts,'device-report.csv');await csvDownload.saveAs(csvPath);
 const csv=fs.readFileSync(csvPath,'utf8');assert.ok(csv.startsWith('\ufeff'));assert.match(csv,/设备名称/);assert.match(csv,/D007/);
 await page.locator('[data-admin="report-detail"][data-id="device:D007"]').click();assert.match(await page.locator('.modal-body').innerText(),/2 笔/);
 const detailEvent=page.waitForEvent('download');await page.locator('#export-drill').click();
 const detail=await detailEvent,detailPath=path.join(artifacts,'device-receipts.csv');await detail.saveAs(detailPath);
 assert.match(fs.readFileSync(detailPath,'utf8'),/续租/);await page.evaluate(()=>App.closeModal());
 passed('three report views, filtered receipt drilldown, and UTF-8 CSV exports work');
 await page.evaluate(()=>App.navigate('admin','backup'));await page.locator('[data-admin="backup-export"]').click();
 await page.locator('#backup-export-form [name=password]').fill('DemoTest123!');
 await page.locator('#backup-export-form [name=confirm]').fill('DemoTest123!');
 const backupEvent=page.waitForEvent('download');await page.locator('#backup-export-form button[type=submit]').click();
 const backupDownload=await backupEvent,backupPath=path.join(artifacts,'user-master-encrypted.json');await backupDownload.saveAs(backupPath);
 const encrypted=JSON.parse(fs.readFileSync(backupPath,'utf8'));assert.equal(encrypted.format,'inverter-user-master-encrypted');assert.ok(encrypted.ciphertext);assert.equal(encrypted.users,undefined);
 await page.evaluate(()=>App.navigate('admin','users'));await page.locator('[data-admin="new-user"]').click();
 await page.locator('#user-form [name=name]').fill('恢复测试客户');await page.locator('#user-form [name=phone]').fill('18900000001');
 await page.locator('#user-form button[type=submit]').click();assert.equal(await page.evaluate(()=>Demo.state.users.length),5);
 await page.evaluate(()=>Demo.grant('D001','wang',{view:true,control:true,frequency:false,reset:false}));
 assert.equal(await page.evaluate(()=>Demo.membership('D001','wang').rights.control),true);
 await page.evaluate(()=>App.navigate('admin','backup'));await page.locator('[data-admin="backup-import"]').click();
 await page.locator('#backup-import-form [name=file]').setInputFiles(backupPath);
 await page.locator('#backup-import-form [name=password]').fill('DemoTest123!');await page.locator('#backup-import-form button[type=submit]').click();
 await page.locator('#backup-restore-form').waitFor();assert.equal(await page.evaluate(()=>Demo.state.users.length),5);
 const removedUser=page.locator('#backup-differences [data-diff-domain="用户资料"][data-diff-field="删除记录"]');
 assert.match(await removedUser.innerText(),/恢复测试客户/);assert.match(await removedUser.innerText(),/18900000001/);
 assert.match(await removedUser.locator('td').nth(3).innerText(),/恢复后移除/);
 const permissionDiff=page.locator('#backup-differences [data-diff-domain="设备关联与授权"][data-diff-field="启停权限"]');
 assert.match(await permissionDiff.locator('td').nth(0).innerText(),/D001/);assert.match(await permissionDiff.locator('td').nth(0).innerText(),/王晓燕/);
 assert.equal(await permissionDiff.locator('td').nth(2).innerText(),'启用');assert.equal(await permissionDiff.locator('td').nth(3).innerText(),'禁用');
 assert.equal(await page.evaluate(()=>Demo.membership('D001','wang').rights.control),true);
 await page.screenshot({path:path.join(qa,'admin-backup-differences.png')});
 await page.locator('[data-admin="save-current-before-restore"]').click();await page.locator('#backup-export-form').waitFor();
 await page.evaluate(()=>App.closeModal());await page.locator('[data-admin="backup-import"]').click();
 await page.locator('#backup-import-form [name=file]').setInputFiles(backupPath);
 await page.locator('#backup-import-form [name=password]').fill('DemoTest123!');await page.locator('#backup-import-form button[type=submit]').click();
 await page.locator('#backup-restore-form').waitFor();
 passed('backup preview exposes removed user and same-count permission changes before restore; export-current action works');
 await page.locator('#backup-restore-form [name=confirmed]').check();await page.locator('#backup-restore-form button[type=submit]').click();
 assert.equal(await page.evaluate(()=>Demo.state.users.length),4);
 assert.equal(await page.evaluate(()=>Demo.membership('D001','wang').rights.control),false);
 assert.equal(await page.evaluate(()=>Demo.state.receipts.length),8);
 assert.equal(await page.evaluate(()=>Demo.device('D001').hz),38.5);
 passed('encrypted backup preview is read-only; confirmed restore preserves receipts and telemetry');
 const oldEnd=await page.evaluate(()=>Demo.effectiveContract('D001').end);
 await page.evaluate(()=>{
  Demo.setSyncOnline(false);
  Demo.renew({deviceId:'D001',end:'2026-11-25T18:00:00+08:00',amountCents:150000,paidAt:Demo.state.now,reference:'OFFLINE-E2E-RENEW'});
  Demo.grant('D001','wang',{view:true,control:true,frequency:true,reset:false});
  App.ui.userId='wang';App.navigate('mini','detail','D001');
 });
 const oldDisplay=await page.evaluate(end=>App.time(end),oldEnd);
 assert.equal(await page.locator('[data-mini-effective-end]').innerText(),oldDisplay);
 assert.match(await page.locator('[data-mini-pending=lease]').innerText(),/2026-11-25/);
 assert.match(await page.locator('[data-mini-pending=permissions]').innerText(),/暂不可用/);
 assert.equal(await page.locator('.mini-control[data-action=start]').isDisabled(),true);
 assert.equal(await page.locator('.mini-control[data-action=frequency]').isDisabled(),true);
 await page.evaluate(end=>Demo.setNow(end),oldEnd);
 assert.equal(await page.evaluate(()=>Demo.lease('D001').key),'expired');
 await page.waitForFunction(()=>!Demo.state.commands.some(c=>c.status==='pending'));
 passed('miniapp shows confirmed lease and pending local changes; offline renewal cannot bypass expiry');
 await page.evaluate(()=>{Demo.setSyncOnline(true);Demo.syncNow()});
 assert.equal(await page.locator('[data-mini-pending]').count(),0);
 assert.equal(await page.locator('[data-mini-effective-end]').innerText(),'2026-11-25 18:00');
 assert.equal(await page.evaluate(()=>Demo.membership('D001','wang').rights.control),true);
 assert.equal(await page.evaluate(()=>Demo.device('D001').run),false);
 passed('sync publishes new lease and permissions without automatically restarting device');
 assert.deepEqual(errors,[]);await context.close();
 console.log(JSON.stringify({passed:results.length,tests:results,artifacts},null,2));
})().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve))});

