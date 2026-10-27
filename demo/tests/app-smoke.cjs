'use strict';
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const {chromium,browserOptions}=require('../../tools/test-runtime.cjs');
const root=path.resolve(__dirname,'../dist'),results=[];
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
async function loadedPage(url,viewport={width:1440,height:1000}){
 const context=await browser.newContext({viewport});const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(8000);
 if(process.env.APP_SMOKE_STUB_ADMIN==='1')await page.route('**/admin.js',route=>route.fulfill({contentType:'application/javascript',body:"globalThis.Admin={render(container){container.innerHTML='<section class=panel>Admin placeholder for App smoke</section>'}};"}));
 await page.goto(url);await page.waitForFunction(()=>globalThis.App&&globalThis.Demo&&globalThis.Mini&&globalThis.Monitor);
 return{context,page,errors};
}
async function command(page,action,value){
 await page.evaluate(a=>App.openCommand('D001','chen',a),action);await page.locator('#command-form').waitFor();
 if(action==='frequency')await page.locator('#command-form input[name=value]').fill(String(value));
 await page.locator('#command-form button[type=submit]').click();
 const id=await page.evaluate(()=>Demo.state.commands[0].id);
 await page.waitForFunction(id=>Demo.state.commands.find(c=>c.id===id)?.status!=='pending',id);
 const result=await page.evaluate(id=>Demo.state.commands.find(c=>c.id===id),id);assert.equal(result.status,'succeeded');return result;
}
(async()=>{
 const url=process.argv[2]||await startServer();
 browser=await chromium.launch(browserOptions());
 const target=new URL(url);target.searchParams.set('view','monitor');
 const{context,page,errors}=await loadedPage(target.href);
 assert.equal(await page.evaluate(()=>App.ui.view),'monitor');
 const selectVisibleView=async view=>{
  if(await page.evaluate(()=>App.ui.view)==='monitor')await page.locator('[data-mon-workspace]:visible').first().click();
  await page.locator('[data-view="'+view+'"]:visible').first().click();
 };
 for(const view of ['mini','admin','monitor']){
  await selectVisibleView(view);assert.equal(await page.evaluate(()=>App.ui.view),view);
  assert.equal(new URL(page.url()).searchParams.get('view'),view);
 }
 await selectVisibleView('mini');await page.reload();assert.equal(await page.evaluate(()=>App.ui.view),'mini');
 passed('three views and query override/navigation/reload');
 await command(page,'stop');assert.equal(await page.evaluate(()=>Demo.device('D001').run),false);
 await command(page,'start');assert.equal(await page.evaluate(()=>Demo.device('D001').run),true);
 const freq=await command(page,'frequency',40.5);assert.equal(freq.value,40.5);assert.equal(typeof freq.value,'number');
 assert.equal(await page.evaluate(()=>Demo.device('D001').target),40.5);passed('start / stop / numeric frequency dialogs and receipts');
 // An actual delayed device receipt must not discard the input in a different modal.
 const pendingId=await page.evaluate(()=>{const c=Demo.command('D001','chen','frequency',39.2);App.openInventory();window.__modalRef=document.querySelector('#modal-root').firstElementChild;return c.id});
 await page.locator('#inventory-form [name=name]').fill('尚未提交的设备名称');
 await page.waitForFunction(id=>Demo.state.commands.find(c=>c.id===id)?.status==='succeeded',pendingId);
 assert.equal(await page.locator('#inventory-form [name=name]').inputValue(),'尚未提交的设备名称');
 assert.equal(await page.evaluate(()=>document.querySelector('#modal-root').firstElementChild===window.__modalRef),true);
 passed('async model updates preserve modal element and entered values');
 await page.evaluate(()=>App.closeModal());const oldCount=await page.evaluate(()=>Demo.state.devices.length);
 await page.evaluate(()=>App.openInventory());await page.locator('#inv-sample').click();
 const raw=await page.locator('#inventory-form [name=raw]').inputValue();
 await page.locator('#inventory-form button[type=submit]').click();assert.match(await page.locator('#dialog-title').innerText(),/确认设备入库/);
 await page.locator('#inv-confirm').click();
 const inv=await page.evaluate(()=>{const d=Demo.device(App.ui.deviceId);return{count:Demo.state.devices.length,device:d,contract:Demo.contract(d.id),memberships:Demo.state.memberships.filter(m=>m.deviceId===d.id)}});
 assert.equal(inv.count,oldCount+1);assert.equal(inv.device.module,raw.split('+')[2]);assert.equal(inv.contract,null);assert.equal(inv.memberships.length,0);
 passed('inventory sample confirmation adds the correct stock device without owner/control');
 await page.evaluate(()=>{App.ui.deviceId='D001';App.openScenarios()});
 await page.locator('[data-scene=offline]').click();assert.equal(await page.evaluate(()=>Demo.device('D001').online),false);
 await page.evaluate(()=>App.openCommand('D001','chen','start'));assert.equal(await page.locator('#command-form').count(),0);
 await page.evaluate(()=>App.openScenarios());await page.locator('[data-scene=online]').click();
 assert.equal(await page.evaluate(()=>Demo.device('D001').online),true);
 const before=await page.evaluate(()=>Date.parse(Demo.state.now));
 await page.evaluate(()=>App.openScenarios());await page.locator('#advance-day').click();
 assert.equal(await page.evaluate(()=>Date.parse(Demo.state.now)),before+86400000);
 await page.evaluate(()=>App.openScenarios());await page.locator('[data-scene=offline]').click();
 await page.evaluate(()=>App.openScenarios());await page.locator('#advance-expiry').click();
 assert.equal(await page.evaluate(()=>Demo.lease('D001').key),'expired');
 assert.equal(await page.evaluate(()=>Demo.state.commands.find(c=>c.deviceId==='D001'&&c.source==='expiry').status),'uncertain');
 assert.equal(await page.evaluate(()=>Demo.device('D001').run),true,'offline expiry must not claim a confirmed stop');
 await page.evaluate(()=>App.openScenarios());await page.locator('[data-scene=online]').click();
 await page.waitForFunction(()=>Demo.state.commands.find(c=>c.deviceId==='D001'&&c.source==='expiry')?.status==='succeeded');
 assert.equal(await page.evaluate(()=>Demo.device('D001').run),false);
 passed('offline expiry remains unconfirmed until online stop receipt');
 await page.evaluate(()=>App.openScenarios());await page.locator('#sync-toggle').click();
 await page.evaluate(()=>Demo.registerUser({name:'同步测试',phone:'13900139999'}));
 assert.ok(await page.evaluate(()=>Demo.state.sync.pending>0));
 await page.evaluate(()=>App.openScenarios());await page.locator('#sync-toggle').click();
 assert.deepEqual(await page.evaluate(()=>({online:Demo.state.sync.online,pending:Demo.state.sync.pending,equal:Demo.state.sync.localVersion===Demo.state.sync.cloudVersion})),{online:true,pending:0,equal:true});
 passed('offline blocks control; scene clock and reconnection synchronization work');
 await page.setViewportSize({width:390,height:844});
 for(const view of ['admin','monitor','mini']){
  await page.evaluate(view=>App.navigate(view,view==='mini'?'devices':'overview'),view);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,view+' viewport overflow');
 }
 await page.evaluate(()=>App.openInventory());assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.evaluate(()=>App.closeModal());passed('390 px three-view and inventory dialog overflow checks');
 await page.evaluate(()=>{Demo.setSyncOnline(false);Demo.renew({deviceId:'D001',end:'2026-11-25T18:00:00+08:00',amountCents:150000,paidAt:Demo.state.now,reference:'APP-SMOKE-RENEW'});App.openLease('D001')});
 assert.match(await page.locator('[data-lease-local]').innerText(),/2026-11-25/);
 assert.match(await page.locator('[data-lease-effective]').innerText(),/2026-10-25/);
 assert.match(await page.locator('.modal-body').innerText(),/本地登记尚未同步/);
 await page.evaluate(()=>{App.closeModal();App.navigate('monitor','detail','D001')});
 assert.match(await page.locator('.mon-lease-summary').innerText(),/新租期等待同步/);
 passed('lease modal and monitoring distinguish registered and effective expiry');

 assert.deepEqual(errors,[]);await context.close();
 // Camera unavailable: no real hardware or permissions are used by these tests.
 const camera1=await loadedPage(url);
 await camera1.page.evaluate(()=>{Object.defineProperty(navigator,'mediaDevices',{value:undefined,configurable:true});App.openCamera(()=>{})});
 assert.match(await camera1.page.locator('#camera-message').innerText(),/不支持摄像头/);
 assert.deepEqual(camera1.errors,[]);await camera1.context.close();passed('unsupported camera reports a usable fallback');
 const camera2=await loadedPage(url);
 await camera2.page.evaluate(()=>{
  window.__stops=0;window.__callbacks=0;
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:()=>new Promise(r=>window.__mediaResolve=r)}});
  window.BarcodeDetector=class{detect(){return Promise.resolve([])}};
  App.openCamera(()=>window.__callbacks++);
  App.modal('后续窗口','<input id="retained" value="保留">');
  window.__mediaResolve({getTracks:()=>[{stop(){window.__stops++}}]});
 });
 await camera2.page.waitForFunction(()=>window.__stops===1);
 assert.equal(await camera2.page.locator('#dialog-title').innerText(),'后续窗口');
 await camera2.page.evaluate(()=>App.closeModal());assert.equal(await camera2.page.evaluate(()=>window.__stops),1);
 assert.deepEqual(camera2.errors,[]);await camera2.context.close();passed('late camera stream is stopped once after modal replacement');
 const camera3=await loadedPage(url);
 await camera3.page.evaluate(()=>{
  window.__stops=0;window.__callbacks=0;
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>({getTracks:()=>[{stop(){window.__stops++}}]})}});
  Object.defineProperty(HTMLMediaElement.prototype,'srcObject',{configurable:true,get(){return this.__src},set(v){this.__src=v}});
  HTMLMediaElement.prototype.play=()=>Promise.resolve();
  window.BarcodeDetector=class{detect(){return new Promise(r=>window.__detectResolve=r)}};
  App.openCamera(()=>window.__callbacks++);
 });
 await camera3.page.waitForFunction(()=>typeof window.__detectResolve==='function');
 await camera3.page.evaluate(()=>{App.modal('后续窗口','<input value="保留">');window.__detectResolve([{rawValue:'HN+VF-22+TEST0001'}])});
 await camera3.page.waitForTimeout(30);
 assert.equal(await camera3.page.evaluate(()=>window.__callbacks),0);
 assert.equal(await camera3.page.locator('#dialog-title').innerText(),'后续窗口');
 assert.equal(await camera3.page.evaluate(()=>window.__stops),1);
 assert.deepEqual(camera3.errors,[]);await camera3.context.close();passed('late barcode result cannot close a replacement dialog or invoke callback');
 const camera4=await loadedPage(url);
 await camera4.page.evaluate(()=>{
  window.__stops=0;
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>({getTracks:()=>[{stop(){window.__stops++}}]})}});
  Object.defineProperty(HTMLMediaElement.prototype,'srcObject',{configurable:true,set(){}});
  HTMLMediaElement.prototype.play=()=>Promise.reject(new Error('摄像头播放失败'));
  window.BarcodeDetector=class{detect(){return Promise.resolve([])}};
  App.openCamera(()=>{});
 });
 await camera4.page.waitForFunction(()=>window.__stops===1);
 assert.match(await camera4.page.locator('#camera-message').innerText(),/播放失败/);
 await camera4.page.evaluate(()=>App.closeModal());assert.equal(await camera4.page.evaluate(()=>window.__stops),1);
 assert.deepEqual(camera4.errors,[]);await camera4.context.close();passed('camera playback failure releases hardware immediately without duplicate cleanup');
 console.log(JSON.stringify({passed:results.length,tests:results},null,2));
})().catch(err=>{console.error(err);process.exitCode=1}).finally(async()=>{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r))});

