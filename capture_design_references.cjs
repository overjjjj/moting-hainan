const {chromium,browserOptions}=require('tools/test-runtime.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve(__dirname,'output/design-spec-assets');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch(browserOptions());try{
const page=await browser.newPage({viewport:{width:1200,height:1600},deviceScaleFactor:1}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('file:///'+path.resolve(__dirname,'output/workflow-preview-qa.html').replaceAll('\\','/'),{waitUntil:'domcontentloaded'});
const f=page.frameLocator('iframe'),a=f.locator('#inv-admin'),m=f.locator('#inv-mini'); await a.waitFor(); const frame=page.frames().find(x=>x!==page.mainFrame()); await frame.addScriptTag({path:path.resolve(__dirname,'demo/dist/lucide.min.js')}); await frame.evaluate(()=>lucide.createIcons());
const capture=async(el,name)=>{await page.waitForTimeout(400);await el.screenshot({path:path.join(out,name)});};
await a.locator('[data-page="devices"]').click();await capture(a,'admin-devices-unified.png');
assert.equal(await a.evaluate(el=>getComputedStyle(el).getPropertyValue('--ia-brand').trim()),'#27d6ed');
await a.locator('[data-page="reports"]').click();await capture(a,'admin-reports-unified.png');
await a.locator('[data-page="backup"]').click();await capture(a,'admin-backup-unified.png');
await f.locator('[data-mode="mini"]').click();await f.locator('#wf-demo-user').selectOption('chen');await capture(m,'mini-devices-unified.png');
await m.locator('[data-device="01"]').click();await capture(m,'mini-detail-unified.png');
await f.locator('#wf-demo-user').selectOption('admin');await capture(m,'mobile-inventory-unified.png');
await page.setViewportSize({width:320,height:1600});await capture(m,'mobile-unified-narrow.png');
assert.deepEqual(errors,[]);console.log('Unified references rendered successfully');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

