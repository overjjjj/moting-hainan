'use strict';
/* Local monitor UI regression checks. No production server or external upload.
 * Usage: node tests/monitor-ui.cjs [http://127.0.0.1:PORT/]
 * Optional runtime overrides: PLAYWRIGHT_MODULE, EDGE_PATH. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium,browserOptions}=require('../../tools/test-runtime.cjs');
const root=path.resolve(__dirname,'../dist'),artifacts=fs.mkdtempSync(path.join(os.tmpdir(),'inverter-monitor-ui-')),results=[];
let server,browser;
const passed=name=>{results.push(name);console.log('PASS '+name)};
async function startServer(){
 server=http.createServer((req,res)=>{
  let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch{res.statusCode=400;res.end();return}
  const filename=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(filename!==root&&!filename.startsWith(root+path.sep)){res.statusCode=403;res.end();return}
  try{const ext=path.extname(filename);res.setHeader('Content-Type',ext==='.js'?'application/javascript; charset=utf-8':ext==='.css'?'text/css; charset=utf-8':ext==='.svg'?'image/svg+xml':'text/html; charset=utf-8');res.end(fs.readFileSync(filename))}catch{res.statusCode=404;res.end()}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return 'http://127.0.0.1:'+server.address().port+'/';
}
const counterSelectors={
 region:'[data-mon-region-total],[data-region-total]',
 filtered:'[data-mon-filter-total],[data-filter-count]',
 page:'[data-mon-current-page],[data-current-page]'
};
async function counter(page,key){
 return page.locator(counterSelectors[key]).first().evaluate((el,key)=>{
  const attributes={region:['data-mon-region-total','data-region-total'],filtered:['data-mon-filter-total','data-filter-count'],page:['data-mon-current-page','data-current-page']}[key];
  const raw=attributes.map(a=>el.getAttribute(a)).find(v=>v!==null&&v!=='')||el.textContent;
  return Number(String(raw).match(/\d+/)?.[0]);
 },key);
}
async function cardIds(page){return page.locator('[data-mon-card]').evaluateAll(els=>els.map(el=>el.getAttribute('data-mon-card')))}
async function region(page,name){await page.locator('[data-mon-region="'+name+'"]:visible').last().click();assert.equal(await page.evaluate(()=>App.ui.monitorRegion),name)}
async function filters(page,values={}){
 const f=page.locator('#mon-filter-form');
 if(values.search!==undefined)await f.locator('[name=search]').fill(values.search);
 if(values.online!==undefined)await f.locator('[name=online]').selectOption(values.online);
 if(values.running!==undefined)await f.locator('[name=running]').selectOption(values.running);
 await f.locator('button[type=submit]').click();
}
async function noHorizontalOverflow(page,label){
 const widths=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth}));
 assert.ok(widths.document<=widths.viewport+1,label+': '+JSON.stringify(widths));
 assert.ok(widths.body<=widths.viewport+1,label+': '+JSON.stringify(widths));
}
async function chooseView(page,view){
 if(await page.evaluate(()=>App.ui.view)==='monitor')await page.locator('[data-mon-workspace]:visible').first().click();
 await page.locator('[data-view="'+view+'"]:visible').first().click();
 assert.equal(await page.evaluate(()=>App.ui.view),view);
 assert.equal(await page.evaluate(()=>document.body.dataset.productView),view);
}
(async()=>{
 const base=process.argv[2]||await startServer();
 browser=await chromium.launch(browserOptions());
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(10000);
 const target=new URL(base);target.searchParams.set('view','monitor');await page.goto(target.href);
 await page.waitForFunction(()=>globalThis.Demo&&globalThis.App&&globalThis.Monitor&&globalThis.MonitorPages);
 await page.evaluate(()=>App.navigate('monitor','overview'));
 assert.equal(await page.locator('.app-top').isVisible(),false);
 assert.equal(await page.locator('.demo-strip').isVisible(),false);
 assert.ok(await page.locator('svg [data-map-open="460100"]:visible').count()>0,'main screen must contain an interactive geographic map region');
 await page.locator('svg [data-map-open="460100"]:visible').first().click();
 assert.equal(await page.evaluate(()=>App.ui.monitorPage),'map');
 assert.equal(String(await page.evaluate(()=>App.ui.monitorMapCode)),'460100');
 await page.locator('[data-map-list]:visible').first().click();
 assert.equal(await page.evaluate(()=>App.ui.monitorPage),'region');
 assert.equal(await page.evaluate(()=>App.ui.monitorRegion),'海口市');
 const initialHaikou=await page.evaluate(()=>Demo.state.devices.filter(d=>d.region==='海口市').length);
 assert.equal(await counter(page,'region'),initialHaikou);
 assert.equal(await counter(page,'filtered'),initialHaikou);
 passed('geographic map drills into the selected city and its device-list action preserves scoped statistics');

 const haikouBefore=await counter(page,'region');
 await filters(page,{search:'不存在的设备-UI-TEST',online:'all',running:'all'});
 assert.equal(await counter(page,'region'),haikouBefore);
 assert.equal(await counter(page,'filtered'),0);
 assert.deepEqual(await cardIds(page),[]);
 assert.ok(await page.locator('[data-mon-page]:enabled').count()===0,'empty results must disable pagination');
 await page.locator('[data-mon-clear]:visible').first().click();
 assert.equal(await counter(page,'region'),haikouBefore);
 assert.equal(await counter(page,'filtered'),initialHaikou);
 passed('zero-result search retains regional statistics and provides clear-filter recovery');

 await region(page,'all');
 const totalBeforeOwner=await counter(page,'region');
 const owner=await page.evaluate(()=>{const u=Demo.state.users.find(u=>u.id==='chen');return{name:u.name,ids:Demo.state.devices.filter(d=>Demo.effectiveContract(d.id)?.ownerId===u.id).map(d=>d.id).sort()}});
 await filters(page,{search:owner.name,online:'all',running:'all'});
 assert.equal(await counter(page,'region'),totalBeforeOwner);
 assert.equal(await counter(page,'filtered'),owner.ids.length);
 assert.deepEqual(await cardIds(page),owner.ids.slice(0,6));
 passed('owner-name search finds the correct contracted devices without changing regional totals');

 // Create seven isolated stock devices through the actual public inventory API.
 // This guarantees meaningful six-card pagination even when initial seed size changes.
 const fixtureIds=await page.evaluate(()=>Array.from({length:7},(_,i)=>Demo.inventory({raw:'QA+VFD-15KW+MONITOR_PAGE_'+String(i+1).padStart(3,'0'),name:'分页验收设备 '+(i+1),region:'海口市',place:'界面验收专用仓位 '+(i+1)},'admin').id).sort());
 await region(page,'海口市');
 await filters(page,{search:'分页验收',online:'offline',running:'all'});
 assert.equal(await counter(page,'region'),initialHaikou+7);
 assert.equal(await counter(page,'filtered'),7);
 assert.equal(await counter(page,'page'),1);
 assert.deepEqual(await cardIds(page),fixtureIds.slice(0,6));
 await page.locator('[data-mon-page="2"]:visible').click();
 assert.equal(await counter(page,'page'),2);
 assert.deepEqual(await cardIds(page),fixtureIds.slice(6));
 const filterState=await page.evaluate(()=>({region:App.ui.monitorRegion,query:App.ui.monitorSearch,online:App.ui.monitorOnline,running:App.ui.monitorRun,page:App.ui.monitorDevicePage}));
 await page.locator('[data-mon-detail="'+fixtureIds[6]+'"]:visible').first().click();
 assert.equal(await page.evaluate(()=>App.ui.monitorPage),'detail');
 await page.locator('[data-mon-nav="region"]:visible').first().click();
 assert.deepEqual(await page.evaluate(()=>({region:App.ui.monitorRegion,query:App.ui.monitorSearch,online:App.ui.monitorOnline,running:App.ui.monitorRun,page:App.ui.monitorDevicePage})),filterState);
 assert.equal(await counter(page,'page'),2);assert.deepEqual(await cardIds(page),fixtureIds.slice(6));
 passed('regional six-card pagination and detail return preserve all filters and the current page');

 await filters(page,{search:'分页验收设备 1'});
 assert.equal(await counter(page,'page'),1);
 assert.deepEqual(await cardIds(page),[fixtureIds[0]]);
 await filters(page,{search:'分页验收',online:'offline',running:'all'});
 const stableOrder=await cardIds(page);
 await page.evaluate(id=>Demo.setScenario(id,'fault'),fixtureIds[2]);
 assert.deepEqual(await cardIds(page),stableOrder);
 assert.equal(await counter(page,'region'),initialHaikou+7);
 passed('changing filters resets page one; new faults do not reorder device cards or alter query-independent counts');

 // Exercise the actual ten-second interval. A virtual clock makes this precise
 // without waiting thirty seconds; older runtimes use bounded real-time waits.
 const virtualClock=!!(page.clock&&typeof page.clock.install==='function'&&typeof page.clock.runFor==='function');
 if(virtualClock){
  await page.clock.install({time:new Date('2026-10-24T02:00:00Z')});
  await page.clock.pauseAt(new Date('2026-10-24T02:00:01Z'));
 }
 const advance=async ms=>virtualClock?page.clock.runFor(ms):page.waitForTimeout(ms);
 await page.locator('[data-mon-autoplay]:visible').click();
 assert.equal(await page.evaluate(()=>App.ui.monitorAutoplay),true);
 if(virtualClock){
  await advance(9999);assert.equal(await counter(page,'page'),1,'carousel must not advance before ten seconds');
  await advance(1);
 }else await advance(10500);
 assert.equal(await counter(page,'page'),2,'carousel must advance after ten seconds');
 assert.deepEqual(await cardIds(page),fixtureIds.slice(6));
 await page.locator('[data-mon-page="1"]:visible').click();
 assert.equal(await page.evaluate(()=>App.ui.monitorAutoplay),false,'manual paging pauses autoplay');
 await advance(10500);
 assert.equal(await counter(page,'page'),1,'manual page remains stable after another interval');
 await page.locator('[data-mon-autoplay]:visible').click();
 assert.equal(await page.evaluate(()=>App.ui.monitorAutoplay),true);
 await filters(page,{search:'分页验收',online:'offline',running:'unknown'});
 assert.equal(await page.evaluate(()=>App.ui.monitorAutoplay),false,'manual filtering pauses autoplay');
 assert.equal(await counter(page,'filtered'),7);
 await advance(10500);
 assert.equal(await counter(page,'page'),1,'filtered page remains stable after another interval');
 if(virtualClock)await page.clock.resume();
 passed('carousel advances at ten seconds; manual paging and filtering cancel further automatic transitions');

 const fault=await page.evaluate(()=>{const a=Demo.state.alarms.find(a=>a.deviceId==='D004'&&a.kind==='fault'&&!a.ackAt);return{id:a.id,deviceId:a.deviceId,code:Demo.device(a.deviceId).fault}});
 await page.locator('[data-mon-nav="alarms"]:visible').first().click();
 await page.locator('[data-mon-ack="'+fault.id+'"]:visible').click();
 const afterAck=await page.evaluate(id=>{const a=Demo.state.alarms.find(a=>a.id===id);return{ack:a.ackAt,resolved:a.resolvedAt,fault:Demo.device(a.deviceId).fault}},fault.id);
 assert.ok(afterAck.ack);assert.equal(afterAck.resolved,null);assert.equal(afterAck.fault,fault.code);
 const alarmRow=page.locator('[data-mon-alarm-id="'+fault.id+'"]');
 assert.match(await alarmRow.innerText(),/已确认/);assert.match(await alarmRow.innerText(),/未恢复/);
 passed('alarm acknowledgement records awareness while preserving active fault and unrecovered status');

 await page.evaluate(()=>{App.ui.monitorMetric='hz';App.ui.monitorHours=24;App.navigate('monitor','detail','D003')});
 const offline=await page.evaluate(()=>({hz:Demo.device('D003').hz,lastSeen:Demo.device('D003').lastSeen}));
 const reading=page.locator('[data-mon-reading="hz"]');
 assert.equal(await reading.getAttribute('data-history'),'true');
 assert.match(await reading.innerText(),new RegExp(String(offline.hz).replace('.','\\.')));
 const gap=page.locator('rect[data-mon-offline-gap="true"],rect[data-history-gap]').first();
 assert.ok(await gap.count()>0,'offline history needs a visible no-data range');
 const series=page.locator('path[data-mon-series]').first();
 assert.ok(await series.count()>0,'24-hour window should retain earlier valid samples');
 const lastValid=await series.getAttribute('data-last-valid-time');
 assert.ok(Date.parse(lastValid)<=Date.parse(offline.lastSeen));
 const geometry=await page.evaluate(()=>{
  const p=document.querySelector('path[data-mon-series]'),gap=document.querySelector('rect[data-mon-offline-gap="true"],rect[data-history-gap]');
  const end=p.getPointAtLength(p.getTotalLength());
  return{pathEndX:end.x,gapStartX:Number(gap.getAttribute('x')),gapWidth:Number(gap.getAttribute('width')),points:Number(p.getAttribute('data-valid-point-count'))};
 });
 assert.ok(geometry.gapWidth>0);
 assert.ok(geometry.points>0&&geometry.points<49);
 assert.ok(geometry.pathEndX<=geometry.gapStartX+0.5,JSON.stringify(geometry));
 await page.screenshot({path:path.join(artifacts,'offline-history-1440.png'),fullPage:true});
 await page.locator('button[data-mon-hours="1"]:visible').click();
 assert.equal(await page.locator('path[data-mon-series]').count(),0,'fully offline window must not synthesize zero or stale continuous samples');
 passed('offline detail labels historical readings and truncates the actual SVG path before the no-data interval');

 await chooseView(page,'admin');assert.ok(await page.locator('.app-top').isVisible());
 await chooseView(page,'monitor');await chooseView(page,'mini');assert.ok(await page.locator('.mini-phone').isVisible());
 await chooseView(page,'monitor');
 await page.locator('[data-mon-workspace]:visible').first().click();await page.locator('[data-mon-scenario]:visible').click();
 assert.match(await page.locator('#dialog-title').innerText(),/演示场景/);await page.evaluate(()=>App.closeModal());
 passed('monitor workspace reaches admin, miniapp and scenarios, with valid return navigation');

 for(const size of [{width:1440,height:1000},{width:1920,height:1080},{width:390,height:844}]){
  await page.setViewportSize(size);
  for(const section of ['overview','region','detail','alarms']){
   await page.evaluate(section=>{App.ui.monitorRegion='all';App.ui.monitorSearch='';App.ui.monitorOnline='all';App.ui.monitorRun='all';App.ui.monitorDevicePage=1;App.ui.monitorHours=24;App.navigate('monitor',section,'D003')},section);
   await noHorizontalOverflow(page,size.width+'px '+section);
   assert.equal(await page.locator('.app-top').isVisible(),false);
   assert.equal(await page.locator('.demo-strip').isVisible(),false);
   if(section==='overview')await page.screenshot({path:path.join(artifacts,'monitor-overview-'+size.width+'.png'),fullPage:true});
  }
 }
 passed('overview, region, detail and alarms have no viewport overflow at 390 / 1440 / 1920 pixels');
 assert.deepEqual(errors,[]);
 await context.close();
 console.log(JSON.stringify({passed:results.length,tests:results,artifacts},null,2));
})().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve))});



