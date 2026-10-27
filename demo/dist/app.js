(function(){
'use strict';
const D=globalThis.Demo;
const saved=(()=>{try{return JSON.parse(localStorage.getItem('inverter-demo-ui')||'{}')}catch{return {}}})();
const ui=Object.assign({view:'admin',page:'overview',userId:'chen',deviceId:'D001',monitorPage:'overview',miniPage:'devices'},saved);
if(!['admin','mini','monitor'].includes(ui.view))ui.view='admin';
const requestedView=new URLSearchParams(location.search).get('view');
if(['admin','mini','monitor'].includes(requestedView))ui.view=requestedView;
let modalCleanup=null,previousFocus=null;
function cleanupModal(){const cleanup=modalCleanup;modalCleanup=null;if(cleanup)cleanup();}
const App=globalThis.App={ui};
App.e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const e=App.e;
App.icon=(name,size=20)=>'<i data-lucide="'+e(name)+'" width="'+size+'" height="'+size+'" aria-hidden="true"></i>';
App.money=n=>(Number(n||0)/100).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});
App.time=v=>v?new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(v)).replaceAll('/','-'):'未登记';
App.badge=(label,tone='muted')=>'<span class="badge '+e(tone)+'">'+e(label)+'</span>';
App.icons=()=>{if(globalThis.lucide)lucide.createIcons({attrs:{'stroke-width':1.7}})};
App.toast=text=>{const el=document.createElement('div');el.className='toast';el.textContent=text;document.querySelector('#toasts').append(el);setTimeout(()=>el.remove(),4200)};
App.download=(name,text,type='application/json')=>{const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),6000)};
App.error=(form,err)=>{let el=form.querySelector('.form-error');if(!el){el=document.createElement('div');el.className='form-error';el.setAttribute('role','alert');form.prepend(el)}el.textContent=err.message||String(err);el.scrollIntoView({block:'nearest'})};
App.modal=(title,html,onMount)=>{
 cleanupModal();
 if(!document.querySelector('.modal-overlay'))previousFocus=document.activeElement;
 const root=document.querySelector('#modal-root');
 root.innerHTML='<div class="modal-overlay"><section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><header class="modal-head"><h2 id="dialog-title">'+e(title)+'</h2><button type="button" class="close-btn" aria-label="关闭">'+App.icon('x',22)+'</button></header><div class="modal-body">'+html+'</div></section></div>';
 document.body.style.overflow='hidden';
 root.querySelector('.close-btn').onclick=App.closeModal;
 root.querySelector('.modal-overlay').onclick=ev=>{if(ev.target.classList.contains('modal-overlay'))App.closeModal()};
 root.querySelectorAll('[data-close]').forEach(b=>b.onclick=App.closeModal);
 if(onMount){const cleanup=onMount(root.querySelector('.modal-body'));if(typeof cleanup==='function')modalCleanup=cleanup}
 App.icons();setTimeout(()=>root.querySelector('input,select,textarea,button')?.focus(),30);
};
App.closeModal=()=>{cleanupModal();document.querySelector('#modal-root').innerHTML='';document.body.style.overflow='';if(previousFocus?.isConnected)previousFocus.focus();previousFocus=null};
document.addEventListener('keydown',ev=>{
 const dialog=document.querySelector('[role=dialog]');if(!dialog)return;
 if(ev.key==='Escape')App.closeModal();
 if(ev.key==='Tab'){const f=[...dialog.querySelectorAll('button,input,select,textarea,a[href]')].filter(el=>!el.disabled&&el.offsetParent!==null);const first=f[0],last=f.at(-1);if(ev.shiftKey&&document.activeElement===first){last?.focus();ev.preventDefault()}else if(!ev.shiftKey&&document.activeElement===last){first?.focus();ev.preventDefault()}}
});
App.navigate=(view,page,deviceId)=>{if(!['admin','mini','monitor'].includes(view))return;if(view==='monitor'&&page==='detail')ui.monitorDetailReturn=ui.view==='monitor'&&ui.monitorPage==='map'?'map':'region';if(view==='monitor'&&page==='overview')ui.monitorMapCode='460000';ui.view=view;if(view==='admin')ui.page=page||'overview';if(view==='mini')ui.miniPage=page||'devices';if(view==='monitor')ui.monitorPage=page||'overview';if(deviceId)ui.deviceId=deviceId;try{const url=new URL(location.href);url.searchParams.set('view',view);history.replaceState(null,'',url)}catch{}App.render();window.scrollTo({top:0})};
const nav=[['overview','工作概览','layout-dashboard'],['devices','设备管理','cpu'],['leases','租赁合同','file-text'],['users','客户档案','contact'],['permissions','用户授权','shield-check'],['reports','统计报表','chart-no-axes-combined'],['reminders','到期与提醒','bell-ring'],['backup','用户数据与备份','database-backup'],['logs','操作记录','history'],['settings','服务与接口','plug']];
App.render=()=>{
 document.body.dataset.productView=ui.view;
 if(!D){document.querySelector('#app').innerHTML='<div class="empty">演示引擎加载失败，请刷新页面。</div>';return}
 if(!D.user(ui.userId))ui.userId='chen';
 if(ui.view==='monitor'&&ui.monitorPage==='map'&&(!globalThis.MapLevels?.nodes?.[String(ui.monitorMapCode)]||String(ui.monitorMapCode)==='460000')){ui.monitorMapCode='460000';ui.monitorPage='overview';}
 try{localStorage.setItem('inverter-demo-ui',JSON.stringify(ui))}catch{}
 const sync=D.state.sync||{};
 document.querySelector('#app').innerHTML='<header class="app-top"><div class="brand"><span class="brand-mark">'+App.icon('radio-tower',23)+'</span><div><strong>云控</strong><small>INVERTER OPERATIONS</small></div></div><nav class="view-tabs" aria-label="产品视角">'+[['admin','管理后台','panels-top-left'],['monitor','监控中心','monitor'],['mini','手机小程序','smartphone']].map(([key,label,ico])=>'<button type="button" data-view="'+key+'" class="'+(ui.view===key?'active':'')+'" aria-pressed="'+(ui.view===key)+'">'+App.icon(ico,17)+label+'</button>').join('')+'</nav><div class="top-right"><span class="demo-label">DEMO · 示例数据</span><button class="btn small" id="scenario-open">'+App.icon('sliders-horizontal',15)+'演示场景</button><button class="btn ghost small" id="guide-open" aria-label="演示指南">'+App.icon('circle-help',18)+'</button><span class="top-avatar">管</span></div></header><div class="demo-strip"><span>三端联动演示 · 不连接真实设备或收款</span><span class="sync-indicator">'+(sync.online?'本地主档 v'+sync.localVersion+' → 云端副本 v'+sync.cloudVersion:'本地主服务离线 · 等待同步')+'<span style="color:'+(sync.online?'var(--green)':'var(--amber)')+'">●</span><span>'+App.time(D.state.now)+'</span></span></div><div id="view-root"></div>';
 const container=document.querySelector('#view-root');
 if(ui.view==='admin'){
  container.innerHTML='<div class="shell"><aside class="sidebar"><div class="nav-label">运营工作台</div>'+nav.map(([key,label,ico],i)=>(i===5?'<div class="nav-label">统计与维护</div>':'')+'<button class="nav-btn '+(ui.page===key?'active':'')+'" data-page="'+key+'">'+App.icon(ico,17)+label+'</button>').join('')+'<div class="sidebar-foot"><div>海南 · 设备租赁管理</div><div>统一业务演示 V1.2</div></div></aside><main class="main" id="admin-root"></main></div>';
  if(globalThis.Admin)Admin.render(document.querySelector('#admin-root'));else document.querySelector('#admin-root').textContent='管理模块加载中…';
  container.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>App.navigate('admin',b.dataset.page));
 }else if(ui.view==='mini'){if(globalThis.Mini)Mini.render(container);else container.innerHTML='<div class="empty">小程序模块加载中…</div>'}
 else{if(globalThis.Monitor)Monitor.render(container);else container.innerHTML='<div class="empty">监控模块加载中…</div>'}
 document.querySelectorAll('#app button[data-view]').forEach(b=>b.onclick=()=>App.navigate(b.dataset.view, b.dataset.view==='admin'?ui.page:b.dataset.view==='monitor'?ui.monitorPage:ui.miniPage));
 document.querySelector('#scenario-open').onclick=App.openScenarios;document.querySelector('#guide-open').onclick=App.openGuide;App.icons();
};
App.openGuide=()=>App.modal('演示指南 · 从入库到租赁运营','<p class="muted">这是一套可操作的业务 Demo。三端共享示例状态，刷新后会保留本浏览器的操作记录。</p>'+[
['设备入库','在管理后台或管理员手机端，扫描示例码或输入二维码内容，建立设备档案。'],
['签约与收款','选择已绑定手机号的客户，登记租期、月租与实际收款；确认第一所有人。'],
['客户扫码与授权','切换手机账号扫码添加设备，默认仅查看；管理员按设备逐项授权。'],
['运行与到期','在小程序启停或调频，查看模拟回执；演示场景可推进到期时间、切换离线和故障。'],
['统计与备份','统计表按实际收款日期汇总；用户备份可加密导出、导入预览与恢复，运行和收款不会回滚。']
].map(([t,p],i)=>'<div class="guide-step"><span class="step-no">'+(i+1)+'</span><div><strong>'+t+'</strong><p>'+p+'</p></div></div>').join('')+'<div class="banner" style="margin-top:20px">手机号、设备、金额均为样例。微信身份、4G 通信为模拟；扫码可尝试本机摄像头，不支持时可输入二维码内容。短信充值与发送未开放。</div><button class="btn primary" data-close>开始体验</button>');
App.openLease=did=>{
 const d=D.device(did),local=D.contract(did),effective=D.effectiveContract?D.effectiveContract(did):local,c=local||effective,u=c&&D.user(c.ownerId);if(!d)return;
 const waiting=!!local&&(!effective||['id','ownerId','start','end'].some(key=>local[key]!==effective[key]));
 const range=contract=>contract?App.time(contract.start)+' 至 '+App.time(contract.end):'尚未生效';
 App.modal('租赁与设备信息','<h3>'+e(d.name)+'</h3><dl class="info-list"><dt>设备编号</dt><dd>'+e(d.id)+'</dd><dt>4G 模块</dt><dd>'+e(d.module)+'</dd><dt>'+(waiting?'已登记第一所有人':'第一所有人')+'</dt><dd>'+e(u?.name||'尚未登记')+'</dd><dt>合同编号</dt><dd>'+e(c?.number||'无')+'</dd>'+(waiting?'<dt>本地登记租期</dt><dd data-lease-local>'+range(local)+'</dd><dt>云端生效租期</dt><dd data-lease-effective>'+range(effective)+'</dd>':'<dt>生效租期</dt><dd data-lease-effective>'+(effective?range(effective):'待出租')+'</dd>')+'<dt>月租</dt><dd>'+(c?'¥ '+App.money(c.monthlyCents):'—')+'</dd><dt>当前生效状态</dt><dd>'+App.badge(D.lease(did).label,D.lease(did).key==='expired'?'danger':'info')+'</dd></dl>'+(waiting?'<div class="banner warning">本地登记尚未同步。设备控制和到期停机仍按云端已确认租期执行，恢复同步后新租期才生效。</div>':'')+'<div class="banner">扫码添加只获得查看权限；第一所有人以签约及管理员登记付款为准。合同登记不会自动授予控制权限。</div>');
};
App.openCommand=(did,uid,action)=>{
 const d=D.device(did),names={start:'启动设备',stop:'停止设备',frequency:'设置频率',reset:'故障复位'};
 const access=D.can(did,uid,action);if(!access.ok){App.toast(access.reason);return}
 App.modal(names[action]||'设备操作','<form id="command-form"><div class="banner">'+e(d.name)+' · '+e(d.id)+'<br>'+e(d.region)+' / '+e(d.place)+'</div>'+(action==='frequency'?'<label class="field"><span>目标频率 / Hz</span><input name="value" type="number" min="0" max="50" step="0.1" value="'+e(d.target)+'" required><small>本 Demo 型号范围 0–50 Hz，实际参数以设备型号为准。</small></label>':'<p>确认'+e(names[action])+'？操作后会展示受理状态和模拟设备回执。</p>')+'<p class="muted" style="font-size:12px">演示操作不会控制真实设备。停止是正常停机，不代替现场急停。</p><div class="form-actions"><button type="button" class="btn" data-close>取消</button><button class="btn '+(action==='stop'?'danger':'primary')+'" type="submit">确认'+e(names[action])+'</button></div></form>',el=>{
 el.querySelector('form').onsubmit=ev=>{ev.preventDefault();try{D.command(did,uid,action,action==='frequency'?Number(el.querySelector('[name=value]').value):undefined);App.closeModal();App.toast('请求已受理，正在等待模拟设备回执')}catch(err){App.error(ev.target,err)}};
 });
};
App.openInventory=(raw='')=>{
 const next='DEMO4G'+String(D.state.devices.length+1).padStart(6,'0');
 App.modal('扫码入库 · '+(ui.view==='mini'?'管理员手机':'管理后台'),'<form id="inventory-form"><div class="banner">二维码内容：厂商代号 + 变频器型号 + 4G 模块 ID。重复模块会被拦截。</div><div class="row" style="margin-bottom:14px"><button type="button" class="btn small" id="inv-camera">'+App.icon('scan-line',16)+'摄像头扫码</button><button type="button" class="btn small" id="inv-sample">填入新设备示例</button></div><label class="field"><span>二维码内容</span><input name="raw" value="'+e(raw)+'" placeholder="HN+VF-22+DEMO4G000009" required maxlength="180"></label><div class="fields"><label class="field"><span>设备名称</span><input name="name" required maxlength="30" placeholder="例如：东区 09 号变频器"></label><label class="field"><span>所属区域</span><select name="region"><option>海口市</option><option>三亚市</option><option>儋州市</option><option>琼海市</option></select></label><label class="field full"><span>安装 / 仓储位置</span><input name="place" required maxlength="60" placeholder="仓库或机房位置"></label></div><div class="form-actions"><button class="btn" type="button" data-close>取消</button><button class="btn primary" type="submit">核对并入库</button></div></form>',el=>{
 const form=el.querySelector('form');
 el.querySelector('#inv-sample').onclick=()=>{form.elements.raw.value='HN+VF-22+'+next;form.elements.name.value='新入库 '+String(D.state.devices.length+1).padStart(2,'0')+' 号变频器';form.elements.place.value='海口仓库'};
 el.querySelector('#inv-camera').onclick=()=>App.openCamera(value=>App.openInventory(value));
 form.onsubmit=ev=>{ev.preventDefault();try{const data=Object.fromEntries(new FormData(form)),p=D.parseQR(data.raw);App.modal('确认设备入库','<dl class="info-list"><dt>设备</dt><dd>'+e(data.name)+'</dd><dt>厂商 / 型号</dt><dd>'+e(p.vendor)+' / '+e(p.model)+'</dd><dt>4G 模块</dt><dd>'+e(p.module)+'</dd><dt>区域 / 位置</dt><dd>'+e(data.region)+' / '+e(data.place)+'</dd></dl><div class="banner">入库后为待出租设备，第一所有人和控制权限需另行登记。</div><div class="form-actions"><button class="btn" id="inv-back">返回修改</button><button class="btn primary" id="inv-confirm">确认入库</button></div>',confirmEl=>{
 confirmEl.querySelector('#inv-back').onclick=()=>{App.openInventory(data.raw);const f=document.querySelector('#inventory-form');['name','region','place'].forEach(k=>f.elements[k].value=data[k])};
 confirmEl.querySelector('#inv-confirm').onclick=()=>{try{const d=D.inventory(data,'admin');ui.deviceId=d.id;App.closeModal();App.render();App.toast('设备已入库，可继续登记合同')}catch(err){App.error(confirmEl,err)}};
 });}catch(err){App.error(form,err)}};
 });
};
App.openScan=({inventory=false,userId=ui.userId,onDone}={})=>{
 if(inventory){App.openInventory();return}
 App.modal('扫一扫 · 添加设备','<form id="scan-form"><div class="scan-box">'+App.icon('scan-line',54)+'<strong style="color:var(--ink)">扫描设备标签</strong><span>扫码默认只获得查看权限</span><button class="btn small" id="scan-camera" type="button">开启摄像头</button></div><label class="field"><span>选择演示设备</span><select id="scan-sample"><option value="">请选择示例二维码</option>'+D.state.devices.map(d=>'<option value="'+e(d.id)+'">'+e(d.name)+' · '+e(d.module)+'</option>').join('')+'</select></label><label class="field"><span>或输入二维码内容</span><input name="raw" placeholder="HN+VF-22+DEMO4G000001" maxlength="180" required></label><div class="form-actions"><button class="btn" type="button" data-close>取消</button><button class="btn primary" type="submit">识别并添加</button></div></form>',el=>{
 el.querySelector('#scan-sample').onchange=ev=>{if(ev.target.value)el.querySelector('[name=raw]').value=D.qr(ev.target.value)};
 el.querySelector('#scan-camera').onclick=()=>App.openCamera(value=>{try{const d=D.scan(value,userId);ui.deviceId=d.id;ui.miniPage='detail';App.closeModal();App.render();if(onDone)onDone(d);App.toast('设备已添加，权限以管理员授权为准')}catch(err){App.toast(err.message)}});
 el.querySelector('form').onsubmit=ev=>{ev.preventDefault();try{const d=D.scan(new FormData(ev.target).get('raw'),userId);ui.deviceId=d.id;ui.miniPage='detail';App.closeModal();App.render();if(onDone)onDone(d);App.toast('设备已添加，权限以管理员授权为准')}catch(err){App.error(ev.target,err)}};
 });
};
App.openCamera=onValue=>{
 let stream=null,stopped=false,timer;
 const releaseStream=()=>{const active=stream;stream=null;active?.getTracks().forEach(track=>track.stop())};
 const stopCamera=()=>{stopped=true;clearTimeout(timer);releaseStream()};
 App.modal('摄像头扫码','<div class="scan-box"><video id="scan-video" autoplay muted playsinline></video><span id="camera-message">正在请求摄像头权限…</span></div><p class="muted">二维码需包含厂商、型号与模块 ID。摄像头不可用时，关闭此窗口后使用示例码或手动输入。</p>',el=>{
 (async()=>{try{
  if(!navigator.mediaDevices?.getUserMedia)throw new Error('当前环境不支持摄像头，请使用浏览器安全连接或本机 localhost。');
  if(!('BarcodeDetector'in window))throw new Error('当前浏览器不支持二维码识别，请使用手动输入或扫码枪输入。');
  const detector=new BarcodeDetector({formats:['qr_code']});stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}}});if(stopped){releaseStream();return}
  const video=el.querySelector('video');video.srcObject=stream;await video.play();if(stopped)return;el.querySelector('#camera-message').textContent='请将二维码放入画面';
  const poll=async()=>{if(stopped)return;try{const results=await detector.detect(video);if(stopped)return;if(results.length){const raw=results[0].rawValue;App.closeModal();onValue(raw);return}}catch{}if(!stopped)timer=setTimeout(poll,300)};poll();
 }catch(err){if(!stopped){el.querySelector('#camera-message').textContent=err.message||'无法打开摄像头，请使用示例码。';stopCamera()}}})();
 return stopCamera;
 });
};
App.openScenarios=()=>App.modal('演示场景控制台','<div class="banner">以下操作只改变演示数据。可测试到期、离线、故障和命令超时，不连接真实设备。</div><label class="field"><span>目标设备</span><select id="scene-device">'+D.state.devices.map(d=>'<option value="'+e(d.id)+'" '+(d.id===ui.deviceId?'selected':'')+'>'+e(d.name)+'</option>').join('')+'</select></label><div class="control-grid">'+[['offline','模拟离线'],['online','恢复在线'],['fault','模拟故障'],['recover','故障恢复'],['timeout','下次回执超时']].map(([k,t])=>'<button class="btn" data-scene="'+k+'">'+t+'</button>').join('')+'</div><h3 style="margin-top:22px">演示时钟</h3><p class="muted" style="font-size:12px">当前 '+App.time(D.state.now)+'。推进后自动评估租期与 7 / 3 / 1 天提醒。</p><div class="row"><button class="btn" id="advance-day">推进 1 天</button><button class="btn" id="advance-expiry">推进至目标设备到期</button></div><h3 style="margin-top:22px">本地主数据同步</h3><div class="row"><button class="btn" id="sync-toggle">'+(D.state.sync.online?'模拟主服务离线':'恢复主服务并同步')+'</button><span class="muted" style="font-size:12px">用户变更以本地确认版本为准</span></div><div class="form-actions"><button class="btn danger" id="reset-demo">重置全部演示数据</button></div>',el=>{
 el.querySelectorAll('[data-scene]').forEach(b=>b.onclick=()=>{try{D.setScenario(el.querySelector('#scene-device').value,b.dataset.scene);App.closeModal();App.toast('演示场景已更新')}catch(err){App.error(el,err)}});
 el.querySelector('#advance-day').onclick=()=>{try{D.setNow(new Date(Date.parse(D.state.now)+86400000).toISOString());App.closeModal();App.toast('演示时钟已推进 1 天')}catch(err){App.error(el,err)}};
 el.querySelector('#advance-expiry').onclick=()=>{try{const c=D.contract(el.querySelector('#scene-device').value);if(!c)throw Error('此设备尚未登记合同');if(Date.parse(c.end)<=Date.parse(D.state.now))throw Error('此设备已经到期');D.setNow(c.end);App.closeModal();App.toast('已推进至到期，停机结果请在设备与记录中查看')}catch(err){App.error(el,err)}};
 el.querySelector('#sync-toggle').onclick=()=>{try{const online=!D.state.sync.online;D.setSyncOnline(online);App.closeModal();App.toast(online?'主服务已恢复，用户资料已同步（模拟）':'主服务已离线，用户变更等待同步')}catch(err){App.error(el,err)}};
 el.querySelector('#reset-demo').onclick=()=>App.modal('确认重置演示数据','<p>这会清除本浏览器的演示合同、授权、收款与操作，恢复初始样例。已下载的备份文件不会删除。</p><div class="form-actions"><button class="btn" data-close>取消</button><button class="btn danger" id="reset-confirm">确认重置</button></div>',x=>x.querySelector('#reset-confirm').onclick=()=>{D.reset();Object.assign(ui,{deviceId:'D001',page:'overview',miniPage:'devices',monitorPage:'overview'});App.closeModal();App.render();App.toast('演示数据已重置')});
});
window.addEventListener('demo:change',()=>App.render());
App.render();
})();




