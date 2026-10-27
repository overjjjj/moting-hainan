const {chromium,browserOptions}=require('../tools/test-runtime.cjs');
const assert=require('node:assert/strict'),path=require('node:path');
const out=path.resolve(__dirname,'../output');
(async()=>{
 const browser=await chromium.launch(browserOptions());
 try{
  const page=await browser.newPage({viewport:{width:1024,height:1500},deviceScaleFactor:1}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('file:///'+path.join(out,'workflow-preview-qa.html').replaceAll('\\','/'),{waitUntil:'domcontentloaded'});
  const f=page.frameLocator('iframe'),a=f.locator('#inv-admin');
  const capture=async name=>{await page.waitForTimeout(350);const frame=page.frames().find(x=>x!==page.mainFrame());const h=await frame.locator('#rental-workflow').evaluate(el=>Math.ceil(el.getBoundingClientRect().bottom));await page.waitForFunction(height=>document.querySelector('iframe').getBoundingClientRect().height>=height-1,h);await page.waitForTimeout(200);assert.ok(await frame.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(out,name),fullPage:true});};
  await a.locator('[data-backup-user-row]').first().waitFor();
  assert.equal(await a.locator('[data-backup-user-row]').count(),3);
  assert.match(await a.locator('[data-backup-user-row="chen"]').innerText(),/第一所有人/);
  await capture('user-backup-home.png');
  await a.locator('[data-backup-user="chen"]').click();
  assert.match(await a.locator('.ia-modal').innerText(),/13800002608/);
  assert.equal(await a.locator('.ia-modal .wf-delta').count(),4);
  await a.getByRole('button',{name:'关闭',exact:true}).last().click();
  for(const target of ['usb','disc','computer']){
   await a.locator('[data-backup-action="export"]').click();
   await a.locator('input[name="wf-backup-target"][value="'+target+'"]').check();
   if(target==='usb')await capture('user-backup-destination.png');
   await a.locator('[data-backup-action="review-export"]').click();
   assert.match(await a.locator('.ia-modal').innerText(),/不包含电机实时状态/);
   if(target==='disc'){assert.match(await a.locator('.ia-modal').innerText(),/刻录工具/);await capture('user-backup-disc.png');}
   await a.locator('[data-backup-action="commit-export"]').click();
   assert.match(await a.locator('.ia-modal').innerText(),/未创建真实备份文件/);
   await a.getByRole('button',{name:'返回档案',exact:true}).click();
  }
  assert.equal(await a.locator('.wf-backup-records [data-backup-restore]').count(),3);
  // Advance a lease and revenue after backup. Restore must roll back only lease, not revenue or motor.
  await a.locator('[data-page="leases"]').click();await a.locator('[data-renew="01"]').click();
  await a.locator('#wf-renew-paid').fill('123.45');await a.locator('#wf-renew-confirmed').check();
  await a.locator('[data-action="renew-save"]').click();
  await a.locator('[data-page="backup"]').click();await a.locator('[data-backup-restore="B1"]').click();
  assert.match(await a.locator('.wf-restore-diffs').innerText(),/差异 · 1 项/);
  assert.match(await a.locator('.wf-restore-diffs').innerText(),/到期时间/);
  await a.locator('[data-backup-action="commit-restore"]').click();assert.match(await a.locator('#wf-error').innerText(),/勾选确认/);
  await a.locator('#ia-toast').waitFor({state:'hidden'});await capture('user-backup-restore.png');
  await a.locator('#wf-restore-confirm').check();await a.locator('[data-backup-action="commit-restore"]').click();
  await a.locator('[data-page="reports"]').click();assert.equal(await a.locator('[data-report-total]').innerText(),'1,403.45');
  assert.match(await a.locator('[data-report-row="01"]').innerText(),/2026-10-24/);
  await a.locator('[data-page="backup"]').click();
  await a.locator('[data-backup-restore="B1"]').click();assert.match(await a.locator('.wf-restore-diffs').innerText(),/无字段需要更改/);
  await a.getByRole('button',{name:'取消',exact:true}).click();
  await a.locator('#ia-toast').waitFor({state:'hidden'});
  await page.setViewportSize({width:320,height:1600});await capture('user-backup-narrow.png');
  await a.locator('[data-backup-action="export"]').click();await a.locator('[data-backup-action="review-export"]').click();await capture('user-backup-modal-narrow.png');
  await a.getByRole('button',{name:'关闭',exact:true}).click();
  await page.setViewportSize({width:1024,height:1500});
  await page.frames().find(x=>x!==page.mainFrame()).evaluate(()=>document.documentElement.style.colorScheme='dark');
  await capture('user-backup-dark.png');
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({result:'PASS',checks:'用户档案、三种保存介质、光盘待刻录、恢复差异、确认拦截、租期恢复、收入保留、窄屏与深色',errors}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
