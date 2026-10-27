'use strict';
/* Geographic drilldown regression checks, confined to local demo assets.
 * Usage: node tests/map-drilldown.cjs [http://127.0.0.1:PORT/]
 * Optional overrides: PLAYWRIGHT_MODULE, EDGE_PATH. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),os=require('node:os'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {chromium,browserOptions}=require('../../tools/test-runtime.cjs');
const root=path.resolve(__dirname,'../dist'),artifacts=fs.mkdtempSync(path.join(os.tmpdir(),'inverter-map-drilldown-')),results=[];
let server,browser,activePage;
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
async function ready(page){await page.waitForFunction(()=>globalThis.Demo&&globalThis.App&&globalThis.Monitor&&document.querySelector('.monitor-app'))}
async function scope(page,code){
 assert.equal(await page.evaluate(()=>App.ui.monitorPage),'map');
 assert.equal(String(await page.evaluate(()=>App.ui.monitorMapCode)),String(code));
 assert.equal(await page.locator('[data-map-current]').first().getAttribute('data-map-current'),String(code));
}
async function province(page){
 assert.ok(['overview','map'].includes(await page.evaluate(()=>App.ui.monitorPage)));
 assert.equal(String(await page.evaluate(()=>App.ui.monitorMapCode)),'460000');
 assert.ok(await page.locator('svg [data-map-open="460100"]:visible').count()>0,'province view must contain clickable city geography');
}
async function openMap(page,code,keyboard){
 const targets=page.locator('svg [data-map-open="'+code+'"]:visible'),target=targets.first();
 assert.ok(await target.count()>0,'geographic target '+code+' must be visible');
 if(keyboard){
  assert.equal(await target.getAttribute('tabindex'),'0');assert.equal(await target.getAttribute('role'),'button');await target.focus();await page.keyboard.press(keyboard);
 }else{
  // Polygon, label and pin can overlap but all activate the same region. Use a
  // real, unobstructed pointer point whose topmost hit target has that code.
  await target.scrollIntoViewIfNeeded();
  const point=await targets.evaluateAll((els,code)=>{
   for(const el of els){const r=el.getBoundingClientRect();for(const fx of [.5,.25,.75,.1,.9])for(const fy of [.5,.25,.75,.1,.9]){
    const x=r.x+r.width*fx,y=r.y+r.height*fy;if(x<0||y<0||x>=innerWidth||y>=innerHeight)continue;
    if(document.elementFromPoint(x,y)?.closest('[data-map-open]')?.getAttribute('data-map-open')===code)return{x,y};
   }}return null;
  },String(code));
  assert.ok(point,'region '+code+' must expose a pointer-accessible geographic target');await page.mouse.click(point.x,point.y);
 }
 await scope(page,code);
}
async function total(page){return Number(await page.locator('[data-map-total]').first().getAttribute('data-map-total'))}
async function noOverflow(page,label){
 const dimensions=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth}));
 assert.ok(dimensions.document<=dimensions.viewport+1,label+': '+JSON.stringify(dimensions));
 assert.ok(dimensions.body<=dimensions.viewport+1,label+': '+JSON.stringify(dimensions));
}
(async()=>{
 const base=process.argv[2]||await startServer();
 browser=await chromium.launch(browserOptions());
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[],remoteRequests=[];
 activePage=page;page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));
 const target=new URL(base);target.searchParams.set('view','monitor');
 await context.route('**/*',route=>{const request=new URL(route.request().url());if(request.protocol==='http:'&&request.origin===target.origin)return route.continue();remoteRequests.push(request.href);return route.abort()});
 await page.goto(target.href);await ready(page);
 await page.evaluate(()=>{App.ui.monitorMapCode='460000';App.navigate('monitor','overview')});
 await province(page);
 const haikouCount=await page.evaluate(()=>Demo.state.devices.filter(d=>d.region==='海口市').length);
 await openMap(page,'460100');assert.equal(await total(page),haikouCount);
 assert.ok(await page.locator('svg [data-map-open="460105"]:visible').count()>0,'Haikou geography must expose Xiuying district');
 const mapBox=async()=>String(await page.locator('svg[data-map-viewbox]').getAttribute('data-map-viewbox')).trim().split(/\s+/).map(Number);
 const originalBox=await mapBox();
 await page.locator('[data-map-zoom="in"]:visible').click();
 const enlargedBox=await mapBox();assert.ok(enlargedBox[2]<originalBox[2]&&enlargedBox[3]<originalBox[3],'zoom-in must reduce both viewBox dimensions');
 await scope(page,'460100');assert.equal(await total(page),haikouCount);
 await page.locator('[data-map-zoom="out"]:visible').click();assert.deepEqual(await mapBox(),originalBox);
 await page.locator('[data-map-zoom="in"]:visible').click();
 await page.locator('[data-map-zoom="reset"]:visible').click();assert.deepEqual(await mapBox(),originalBox);
 await scope(page,'460100');assert.equal(await total(page),haikouCount);
 await page.locator('[data-map-zoom="in"]:visible').click();
 await openMap(page,'460105');
 assert.equal(await page.evaluate(()=>App.ui.monitorMapZoom),1,'entering a child resets map zoom');
 assert.equal((await page.locator('[data-map-zoom-value]').innerText()).trim(),'100%');
 passed('zoom changes geography viewBox without changing scope or totals, and reset or child entry restores 100 percent');
 passed('province and city map targets drill into real administrative codes');

 await page.locator('[data-map-back]:visible').first().click();await scope(page,'460100');
 await openMap(page,'460105');
 await page.locator('button[data-map-open="460100"]:visible').first().click();await scope(page,'460100');
 await page.locator('button[data-map-open="460000"]:visible').first().click();await province(page);
 passed('parent control and breadcrumb navigate back through city and province');

 await openMap(page,'460100','Enter');
 await openMap(page,'460105','Space');
 passed('geographic shapes are keyboard focusable and activate with Enter and Space');

 await page.reload();await ready(page);await scope(page,'460105');
 await page.locator('[data-map-back]:visible').first().click();await scope(page,'460100');
 await page.locator('[data-map-list]:visible').first().click();
 assert.equal(await page.evaluate(()=>App.ui.monitorPage),'region');
 assert.equal(await page.evaluate(()=>App.ui.monitorRegion),'海口市');
 assert.equal(Number(await page.locator('[data-mon-region-total]').first().getAttribute('data-mon-region-total')),haikouCount);
 passed('refresh preserves the selected district and city action opens the existing device list');

 // These records deliberately separate explicit geography from free-text place.
 // In particular, a place containing Xiuying must not imply district membership.
 const fixture=await page.evaluate(()=>{
  const city=Demo.inventory({raw:'QA+VFD-15KW+MAP_CITY_ONLY',name:'地图验收未分类设备',region:'海口市',place:'秀英区东山镇（地址文本不能推断所属区）'},'admin');
  const district=Demo.inventory({raw:'QA+VFD-15KW+MAP_XIUYING',name:'地图验收秀英设备',region:'海口市',place:'明确分类样例'},'admin');
  const mismatched=Demo.inventory({raw:'QA+VFD-15KW+MAP_MISMATCH',name:'地图验收区域不匹配',region:'三亚市',place:'不匹配代码样例'},'admin');
  Demo.device(district.id).districtCode='460105';
  Demo.device(mismatched.id).districtCode='460105';
  App.ui.monitorMapCode='460100';App.navigate('monitor','map');
  return{city:city.id,district:district.id,mismatched:mismatched.id};
 });
 await scope(page,'460100');assert.equal(await total(page),haikouCount+2);
 assert.match(await page.locator('[data-map-current]').innerText(),/待登记|未分类|未登记/,'city view must explain unclassified district ownership');
 assert.ok(await page.locator('[data-mon-detail="'+fixture.city+'"]:visible').count()>0,'city includes unclassified device');
 assert.ok(await page.locator('[data-mon-detail="'+fixture.district+'"]:visible').count()>0,'city includes explicit district device');
 assert.equal(await page.locator('[data-mon-detail="'+fixture.mismatched+'"]:visible').count(),0,'city excludes another city even when district code matches');
 await openMap(page,'460105');assert.equal(await total(page),1);
 assert.equal(await page.locator('[data-mon-detail="'+fixture.city+'"]:visible').count(),0,'address text cannot promote an unclassified device into a district');
 assert.equal(await page.locator('[data-mon-detail="'+fixture.mismatched+'"]:visible').count(),0,'district code cannot override a conflicting parent city');
 assert.ok(await page.locator('[data-mon-detail="'+fixture.district+'"]:visible').count()>0);
 passed('district statistics require an explicit code and matching city, excluding unclassified and contradictory records');

 await page.locator('[data-mon-detail="'+fixture.district+'"]:visible').first().click();
 assert.equal(await page.evaluate(()=>App.ui.monitorPage),'detail');
 assert.equal(await page.evaluate(()=>App.ui.deviceId),fixture.district);
 assert.equal(await page.evaluate(()=>App.ui.monitorDetailReturn),'map');
 await page.locator('[data-mon-nav="map"]:visible').first().click();await scope(page,'460105');assert.equal(await total(page),1);
 passed('map device detail returns to the same district map');
 await page.locator('[data-map-list]:visible').first().click();
 assert.equal(await page.evaluate(()=>App.ui.monitorPage),'region');
 assert.equal(await page.evaluate(()=>App.ui.monitorRegion),'海口市');
 assert.equal(String(await page.evaluate(()=>App.ui.monitorDistrictCode)),'460105');
 assert.equal(Number(await page.locator('[data-mon-region-total]').first().getAttribute('data-mon-region-total')),1);
 assert.deepEqual(await page.locator('[data-mon-card]').evaluateAll(cards=>cards.map(card=>card.getAttribute('data-mon-card'))),[fixture.district]);
 passed('district device-list action preserves district scope instead of expanding to all city devices');
 await page.evaluate(()=>{App.ui.monitorMapCode='999999';App.ui.monitorPage='map';localStorage.setItem('inverter-demo-ui',JSON.stringify(App.ui))});
 await page.reload();await ready(page);await province(page);
 assert.ok(!await page.locator('[data-map-current="999999"]').count());
 passed('an unknown persisted map node safely falls back to the province');
 await openMap(page,'469002');
 assert.equal(await total(page),await page.evaluate(()=>Demo.state.devices.filter(d=>d.region==='琼海市').length));
 assert.equal(await page.locator('svg [data-map-open]:visible').count(),0,'a leaf city must not invent clickable lower-level geography');
 await page.locator('[data-map-back]:visible').first().click();await province(page);
 passed('a city without published child boundaries shows its own scope without inventing lower-level regions');
 await openMap(page,'469005');assert.equal(await total(page),0);
 assert.equal(await page.locator('[data-mon-detail]:visible').count(),0);
 assert.match(await page.locator('[data-map-current]').innerText(),/暂无|无设备|0 台/);
 await page.locator('[data-map-back]:visible').first().click();await province(page);
 passed('a valid city with no devices opens its own zero-count state instead of falling back');

 for(const size of [{width:1440,height:1000},{width:1920,height:1080},{width:390,height:844}]){
  await page.setViewportSize(size);
  await page.evaluate(()=>{App.ui.monitorMapCode='460000';App.navigate('monitor','overview')});
  await noOverflow(page,size.width+'px province');
  await openMap(page,'460100');await noOverflow(page,size.width+'px city');
  await page.screenshot({path:path.join(artifacts,'map-city-'+size.width+'.png'),fullPage:true});
  await openMap(page,'460105');await noOverflow(page,size.width+'px district');
  await page.screenshot({path:path.join(artifacts,'map-district-'+size.width+'.png'),fullPage:true});
 }
 passed('province, city and district views have no horizontal overflow at 390 / 1440 / 1920 pixels');
 assert.deepEqual(errors,[]);assert.deepEqual(remoteRequests,[],'local demo must not request remote map assets');
 await context.close();

 // A separate browser storage partition proves that no cached HTTP assets are
 // required for direct file opening, drilldown, refresh, or return navigation.
 const offlineContext=await browser.newContext({offline:true,viewport:{width:1440,height:1000}}),offline=await offlineContext.newPage(),offlineErrors=[],offlineNetwork=[];
 activePage=offline;offline.on('pageerror',error=>offlineErrors.push(error.message));
 offline.on('request',request=>{if(/^https?:/i.test(request.url()))offlineNetwork.push(request.url())});
 const fileURL=pathToFileURL(path.join(root,'index.html'));fileURL.searchParams.set('view','monitor');
 await offline.goto(fileURL.href);await ready(offline);
 await offline.evaluate(()=>{App.ui.monitorMapCode='460000';App.navigate('monitor','overview')});
 await province(offline);await openMap(offline,'460100');await openMap(offline,'460105');
 await offline.reload();await ready(offline);await scope(offline,'460105');
 await offline.locator('[data-map-back]:visible').first().click();await scope(offline,'460100');
 await offline.locator('[data-map-back]:visible').first().click();await province(offline);
 await offline.screenshot({path:path.join(artifacts,'map-file-offline.png'),fullPage:true});
 assert.deepEqual(offlineErrors,[]);assert.deepEqual(offlineNetwork,[],'offline maps cannot depend on remote URLs');
 await offlineContext.close();
 passed('file:// opening works fully offline, preserves district after refresh, and returns to the province');
 console.log(JSON.stringify({passed:results.length,tests:results,artifacts},null,2));
})().catch(async error=>{console.error(error);if(activePage&&!activePage.isClosed()){try{await activePage.screenshot({path:path.join(artifacts,'failure.png'),fullPage:true});fs.writeFileSync(path.join(artifacts,'failure.html'),await activePage.content(),'utf8')}catch{}}console.error('Artifacts: '+artifacts);process.exitCode=1}).finally(async()=>{if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve))});








