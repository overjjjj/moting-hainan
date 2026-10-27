(() => {
  'use strict';
  const metricInfo = {hz:{label:'运行频率',unit:'Hz',color:'#2DD4EA'},current:{label:'输出电流',unit:'A',color:'#61DBB5'},voltage:{label:'输出电压',unit:'V',color:'#86A9FF'}};
  const E = value => App.e(value == null ? '' : value);
  const icon = (name, size=20) => App.icon(name,size);
  const number = (value, digits=1) => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? '—' : Number(value).toFixed(digits);
  const faulted = d => !!d.fault && String(d.fault) !== '0';
  const user = () => Demo.state.users.find(u=>u.id===App.ui.userId) || Demo.state.users.find(u=>u.id==='chen') || Demo.state.users[0];
  const isAdmin = () => user()?.role === 'admin' || user()?.id === 'admin';
  const allDevices = () => isAdmin() ? Demo.state.devices : Demo.state.devices.filter(d => !!Demo.membership(d.id,user()?.id)?.rights?.view);
  const contract = d => Demo.effectiveContract(d.id);
  const lease = d => Demo.lease(d.id);
  const status = d => !d.online ? {text:'离线',tone:'muted'} : faulted(d) ? {text:'故障',tone:'danger'} : d.run ? {text:'运行中',tone:'success'} : {text:'已停止',tone:'info'};
  const stateTag = d => {const s=status(d);return '<span class="mini-state '+s.tone+'"><i></i>'+s.text+'</span>';};
  const unread = () => Demo.state.messages.filter(m=>m.userId===user()?.id&&!m.read).length;
  const localDate = s => s ? String(s).slice(0,10).replaceAll('-','.') : '待登记';
  const pageName = () => ({devices:'我的设备',detail:'设备监控',messages:'消息中心',profile:'我的账户',inventory:'手机入库'})[App.ui.miniPage] || '我的设备';
  const navigate = (page, deviceId) => {App.ui.miniPage=page;if(deviceId)App.ui.deviceId=deviceId;App.render();};
  function accessibleDevice() {
    const list=allDevices();
    return list.find(d=>d.id===App.ui.deviceId)||list[0];
  }
  function rights(d) {
    if(isAdmin())return {view:true,control:true,frequency:true,reset:true};
    return Demo.membership(d.id,user()?.id)?.rights||{};
  }
  function header() {
    const back=['detail','inventory'].includes(App.ui.miniPage);
    const clock=new Intl.DateTimeFormat('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Shanghai'}).format(new Date(Demo.state.now));
    return '<div class="mini-statusbar"><span>'+E(clock)+'</span><span class="mini-status-icons">'+icon('signal',13)+icon('wifi',13)+icon('battery-full',18)+'</span></div>'+
      '<header class="mini-topbar"><button type="button" class="mini-icon-btn" data-mini="'+(back?'back':'profile')+'" aria-label="'+(back?'返回设备':'我的账户')+'">'+icon(back?'chevron-left':'user-round',20)+'</button><div><strong>'+pageName()+'</strong><span class="mini-demo-label">演示环境</span></div><button type="button" class="mini-capsule" data-mini="profile" aria-label="账户与角色">'+icon('ellipsis',18)+'<i></i>'+icon('circle',14)+'</button></header>';
  }
  function bottom() {
    const page=App.ui.miniPage;
    return '<nav class="mini-tabbar" aria-label="小程序导航">'+[
      ['devices','cpu','设备',page==='devices'||page==='detail'||page==='inventory'],
      ['scan','scan-line','扫一扫',false],
      ['messages','bell','消息',page==='messages'],
      ['profile','user-round','我的',page==='profile']
    ].map(([key,ico,label,active])=>'<button type="button" class="'+(active?'active':'')+'" data-mini="'+key+'"'+(active?' aria-current="page"':'')+'><span>'+icon(ico,22)+(key==='messages'&&unread()?'<b class="mini-dot">'+Math.min(unread(),99)+'</b>':'')+'</span><small>'+label+'</small></button>').join('')+'</nav>';
  }
  function empty(title,body,action) {
    return '<div class="mini-empty">'+icon('inbox',38)+'<h3>'+E(title)+'</h3><p>'+E(body)+'</p>'+(action||'')+'</div>';
  }
  function card(d) {
    const c=contract(d),l=lease(d),r=rights(d),owner=c?Demo.user(c.ownerId):null;
    const expiry=l.key==='expired'?'租期已到期':l.key==='stock'?(Demo.contract(d.id)?'合同待同步':'待登记合同'):l.key==='future'?'合同待生效':l.days<=7?'剩余 '+Math.max(0,l.days)+' 天':'租赁有效';
    return '<button type="button" class="mini-device-card" data-mini="device" data-id="'+E(d.id)+'" aria-label="查看'+E(d.name)+'">'+
      '<div class="mini-device-card-head"><span class="mini-device-symbol">'+icon('cpu',22)+'</span><div class="mini-device-title"><h3>'+E(d.name)+'</h3><span>'+E(d.model)+' · '+E(d.id)+'</span></div>'+stateTag(d)+'</div>'+
      '<div class="mini-device-place">'+icon('map-pin',13)+E(d.region)+' · '+E(d.place||'位置待登记')+'</div>'+
      '<div class="mini-device-stats"><div><strong>'+number(d.hz)+'</strong><span>Hz · 运行频率</span></div><div><strong>'+number(d.current)+'</strong><span>A · 输出电流</span></div><div><strong>'+number(d.voltage,0)+'</strong><span>V · 输出电压</span></div></div>'+
      (!d.online?'<div class="mini-stale">'+icon('wifi-off',12)+'离线数据 · 最后上报 '+E(App.time(d.lastSeen))+'</div>':'')+
      '<div class="mini-device-foot"><span class="'+(['expired','near'].includes(l.key)?'mini-warn':'')+'">'+icon('calendar-clock',14)+E(expiry)+'</span><span>'+(!(r.control||r.frequency||r.reset)?'仅查看':owner?.id===user()?.id?'第一所有人':'已授权')+icon('chevron-right',14)+'</span></div></button>';
  }
  function filteredDevices() {
    const q=(App.ui.miniSearch||'').trim().toLowerCase(),f=App.ui.miniFilter||'all';
    return allDevices().filter(d=>(!q||[d.name,d.id,d.model,d.module,d.region,d.place].join(' ').toLowerCase().includes(q))&&
      (f==='all'||f==='running'&&d.online&&d.run&&!faulted(d)||f==='attention'&&(!d.online||faulted(d)||['near','expired'].includes(lease(d).key))||f==='view'&&!(rights(d).control||rights(d).frequency||rights(d).reset)));
  }
  function deviceList() {
    const list=filteredDevices();
    return list.length?list.map(card).join(''):empty('暂无匹配设备','可调整筛选条件，或扫描设备二维码添加查看。','<button type="button" class="mini-primary" data-mini="scan">'+icon('scan-line',17)+'扫码添加设备</button>');
  }
  function devicesPage() {
    const list=allDevices(),running=list.filter(d=>d.online&&d.run&&!faulted(d)).length,needs=list.filter(d=>!d.online||faulted(d)||['near','expired'].includes(lease(d).key)).length;
    return '<section class="mini-welcome"><div><span class="mini-eyebrow">设备管理 · 实时连接</span><h2>你好，'+E(user()?.name)+'</h2><p>设备状态与租赁信息，一目了然</p></div><span class="mini-welcome-icon">'+icon('radio-tower',36)+'</span><div class="mini-overview"><div><strong>'+list.length+'</strong><span>全部设备</span></div><div><strong>'+running+'</strong><span>运行中</span></div><div><strong class="'+(needs?'mini-warn':'')+'">'+needs+'</strong><span>需关注</span></div></div></section>'+
      '<div class="mini-content-pad"><div class="mini-quick-row"><button type="button" class="mini-quick-scan" data-mini="scan">'+icon('scan-line',23)+'<span><b>扫码添加</b><small>首次添加仅获得查看权限</small></span>'+icon('arrow-up-right',18)+'</button></div>'+
      (isAdmin()?'<button type="button" class="mini-admin-entry" data-mini="inventory">'+icon('package-plus',20)+'<span><b>仓库扫码入库</b><small>手机登记设备，后台同步管理</small></span>'+icon('chevron-right',17)+'</button>':'')+
      '<label class="mini-search">'+icon('search',17)+'<input aria-label="搜索设备名称、型号或模块 ID" id="mini-search" placeholder="搜索设备名称 / 模块 ID" value="'+E(App.ui.miniSearch||'')+'"></label>'+
      '<div class="mini-filter" role="group" aria-label="设备筛选">'+[['all','全部'],['running','运行中'],['attention','需关注'],['view','仅查看']].map(([key,name])=>'<button type="button" data-mini="filter" data-filter="'+key+'" class="'+((App.ui.miniFilter||'all')===key?'active':'')+'" aria-pressed="'+((App.ui.miniFilter||'all')===key)+'">'+name+'</button>').join('')+'</div>'+
      '<div class="mini-list" id="mini-device-list">'+deviceList()+'</div><p class="mini-end-note">演示数据 · 4G 连接与设备状态均为模拟</p></div>';
  }
  function chart(d) {
    const key=App.ui.miniMetric||'hz',hours=Number(App.ui.miniHours)||24,meta=metricInfo[key]||metricInfo.hz;
    let points=[];try{points=Demo.history(d.id,key,hours)||[];}catch(_){}
    points=points.filter(p=>Number.isFinite(Number(p.value))&&p.value!==null);
    if(!points.length)return '<div class="mini-chart-empty">暂无可展示的历史数据</div>';
    const values=points.map(p=>Number(p.value)),min=Math.max(0,Math.min(...values)*.82),max=Math.max(...values)*1.12||1,span=max-min||1;
    const x=i=>28+i/(Math.max(points.length-1,1))*288,y=v=>122-(v-min)/span*95;
    const line=points.map((p,i)=>(i?'L':'M')+x(i).toFixed(1)+' '+y(Number(p.value)).toFixed(1)).join(' ');
    const area=line+' L316 122 L28 122 Z';
    const labels=[max,(max+min)/2,min].map((v,i)=>'<text x="1" y="'+(27+i*47.5+4)+'">'+number(v,0)+'</text><line x1="28" x2="316" y1="'+(27+i*47.5)+'" y2="'+(27+i*47.5)+'"/>').join('');
    return '<svg class="mini-chart" viewBox="0 0 330 151" role="img" aria-label="'+E(meta.label)+'，近 '+hours+' 小时模拟趋势"><defs><linearGradient id="mini-chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+meta.color+'" stop-opacity=".3"/><stop offset="1" stop-color="'+meta.color+'" stop-opacity="0"/></linearGradient></defs><g class="mini-chart-axis">'+labels+'</g><path d="'+area+'" fill="url(#mini-chart-fill)"/><path d="'+line+'" fill="none" stroke="'+meta.color+'" stroke-width="2.3" stroke-linejoin="round"/><circle cx="'+x(points.length-1)+'" cy="'+y(values.at(-1))+'" r="3.3" fill="'+meta.color+'"/><g class="mini-chart-axis"><text x="28" y="145">'+hours+' 小时前</text><text x="283" y="145">当前</text></g></svg>';
  }
  function detailPage() {
    const d=accessibleDevice();
    if(!d)return '<div class="mini-content-pad">'+empty('尚未添加设备','扫描已入库的设备二维码，获得查看权限。','<button type="button" class="mini-primary" data-mini="scan">扫码添加</button>')+'</div>';
    App.ui.deviceId=d.id;
    const c=contract(d),l=lease(d),owner=c?Demo.user(c.ownerId):null,r=rights(d),pending=Demo.state.commands.find(x=>x.deviceId===d.id&&x.status==='pending');
    const localContract=Demo.contract(d.id),member=Demo.membership(d.id,user().id);
    const leasePending=!!localContract&&(!c||['id','ownerId','number','start','end','monthlyCents'].some(key=>localContract[key]!==c[key]));
    const syncNotes=(leasePending?'<div class="mini-control-note mini-warn" data-mini-pending="lease">'+icon('cloud-upload',14)+'<span><b>本地新租期待同步</b><br>本地登记到期：'+E(App.time(localContract.end))+'。当前展示云端已确认租期，新增租期暂未生效。</span></div>':'')+
      (member?.pending?'<div class="mini-control-note mini-warn" data-mini-pending="permissions">'+icon('shield-alert',14)+'<span><b>本地权限变更待同步</b><br>下方仅展示当前生效权限；新增操作权限暂不可用，已撤销权限立即限制。</span></div>':'');
    const commandButton=(action,label,ico,cls='')=>{
      const permission=Demo.can(d.id,user().id,action),blocked=!permission.ok||!!pending;
      return '<button type="button" class="mini-control '+cls+'" data-mini="command" data-id="'+E(d.id)+'" data-action="'+action+'" '+(blocked?'disabled ':'')+'title="'+E(pending?'等待上一条指令回执':permission.reason||label)+'">'+icon(ico,22)+'<span>'+label+'</span></button>';
    };
    const restrictions=[!r.control?'当前仅可查看或使用单独授予的权限。':null,!d.online?'设备离线，显示最后上报值；暂不可下发控制指令。':null,l.key==='expired'?'租期已到期，启动已锁定；续租后仍需手动启动。':null,pending?'指令已提交，正在等待模拟设备回执。':null].filter(Boolean);
    const latest=Demo.state.commands.filter(x=>x.deviceId===d.id).slice().sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).slice(0,3);
    const actionName={start:'启动',stop:'停止',frequency:'调整频率',reset:'故障复位'};
    const outcome={pending:'等待回执',succeeded:'执行成功',failed:'执行失败',uncertain:'结果待确认'};
    return '<div class="mini-content-pad mini-detail-page"><div class="mini-detail-title"><div><span class="mini-eyebrow">'+E(d.model)+' · '+E(d.id)+'</span><h2>'+E(d.name)+'</h2><p>'+icon('map-pin',13)+E(d.region)+' · '+E(d.place||'位置待登记')+'</p></div>'+stateTag(d)+'</div>'+
      '<section class="mini-live-panel"><div class="mini-live-label"><span>'+icon('activity',15)+'运行频率</span><span>'+(!d.online?'最后上报值':'模拟实时数据')+'</span></div><div class="mini-frequency">'+number(d.hz)+'<small>Hz</small></div><div class="mini-live-grid"><div><small>输出电流</small><strong>'+number(d.current)+' <em>A</em></strong></div><div><small>输出电压</small><strong>'+number(d.voltage,0)+' <em>V</em></strong></div><div><small>母线电压</small><strong>'+number(d.bus,0)+' <em>V</em></strong></div></div><div class="mini-data-time">'+icon('radio',12)+'最后上报 '+E(App.time(d.lastSeen))+'</div></section>'+
      (faulted(d)?'<div class="mini-alert danger">'+icon('triangle-alert',18)+'<span><b>设备故障</b><br>'+E(d.fault)+' · 请先排查现场原因</span></div>':'')+
      '<section class="mini-section"><div class="mini-section-head"><h3>设备控制</h3><span>'+icon('shield-check',13)+'权限校验</span></div><div class="mini-controls">'+commandButton('start','启动','play','start')+commandButton('stop','停止','square','stop')+commandButton('frequency','设置频率','sliders-horizontal')+commandButton('reset','故障复位','rotate-ccw')+'</div>'+
      restrictions.map(t=>'<div class="mini-control-note">'+icon('info',14)+'<span>'+E(t)+'</span></div>').join('')+'</section>'+
      '<section class="mini-section"><div class="mini-section-head"><h3>运行趋势</h3><select aria-label="趋势时间范围" id="mini-hours"><option value="24" '+((Number(App.ui.miniHours)||24)===24?'selected':'')+'>近 24 小时</option><option value="72" '+(Number(App.ui.miniHours)===72?'selected':'')+'>近 3 天</option><option value="168" '+(Number(App.ui.miniHours)===168?'selected':'')+'>近 7 天</option></select></div><div class="mini-chart-tabs">'+Object.entries(metricInfo).map(([key,m])=>'<button type="button" data-mini="metric" data-metric="'+key+'" class="'+((App.ui.miniMetric||'hz')===key?'active':'')+'">'+m.label+'</button>').join('')+'</div>'+chart(d)+'<p class="mini-caption">模拟历史曲线 · 单位 '+E((metricInfo[App.ui.miniMetric||'hz']||metricInfo.hz).unit)+'</p></section>'+
      '<section class="mini-section"><div class="mini-section-head"><h3>租赁与权限</h3>'+App.badge(l.label,['expired'].includes(l.key)?'danger':['near'].includes(l.key)?'warning':'info')+'</div>'+syncNotes+'<dl class="mini-info"><div><dt>第一所有人</dt><dd>'+E(owner?.name||'待登记')+'</dd></div><div><dt>合同编号</dt><dd>'+E(c?.number||'待登记')+'</dd></div><div><dt>生效租期到期</dt><dd data-mini-effective-end class="'+(['near','expired'].includes(l.key)?'mini-warn':'')+'">'+(c?E(App.time(c.end)):'待登记')+'</dd></div><div><dt>我的权限</dt><dd class="mini-permissions">'+[['view','查看'],['control','启停'],['frequency','调频'],['reset','复位']].filter(([key])=>r[key]).map(([,v])=>'<span>'+v+'</span>').join('')+'</dd></div></dl><button type="button" class="mini-inline-link" data-mini="lease" data-id="'+E(d.id)+'">查看完整租赁资料'+icon('chevron-right',15)+'</button><p class="mini-caption">扫码只添加查看；操作权限由管理员授予。</p></section>'+
      '<section class="mini-section"><div class="mini-section-head"><h3>最近操作回执</h3><span>模拟记录</span></div>'+(latest.length?latest.map(x=>'<div class="mini-command-row"><div><b>'+E(actionName[x.action]||x.action)+(x.action==='frequency'?' '+E(x.value)+' Hz':'')+'</b><small>'+E(App.time(x.createdAt))+'</small></div><span class="'+(x.status==='succeeded'?'mini-good':x.status==='failed'?'mini-warn':'mini-soft')+'">'+E(outcome[x.status]||x.status)+'</span></div>').join(''):'<p class="mini-caption mini-caption-roomy">暂无操作记录</p>')+'</section></div>';
  }
  function messagesPage() {
    const list=Demo.state.messages.filter(m=>m.userId===user()?.id).slice().sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
    return '<div class="mini-content-pad"><div class="mini-page-intro"><h2>消息中心</h2><p>租期提醒、设备告警与操作通知</p></div><div class="mini-message-toolbar"><span>'+unread()+' 条未读</span><button type="button" data-mini="read-all" '+(!unread()?'disabled':'')+'>'+icon('check-check',15)+'全部已读</button></div>'+
      (list.length?list.map(m=>'<button type="button" class="mini-message '+(m.read?'read':'')+'" data-mini="message" data-id="'+E(m.id)+'"><span class="mini-message-icon">'+icon(/到期|租/.test(m.title)?'calendar-clock':'bell-ring',20)+'</span><div><div class="mini-message-title"><strong>'+E(m.title)+'</strong>'+(!m.read?'<i></i>':'')+'</div><p>'+E(m.body)+'</p><small>'+E(App.time(m.createdAt))+'</small></div>'+icon('chevron-right',15)+'</button>').join(''):empty('暂时没有新消息','设备告警及租期 7 天、3 天、1 天提醒将在这里展示。'))+
      '<div class="mini-notice-note">'+icon('message-square',18)+'<span><b>短信服务暂未开放</b><small>本期只预留接口，不产生短信扣费。</small></span></div></div>';
  }
  function profilePage() {
    const u=user(),list=allDevices(),owned=Demo.state.devices.filter(d=>contract(d)?.ownerId===u?.id).length;
    return '<div class="mini-content-pad"><section class="mini-profile-card"><span class="mini-avatar">'+E(u?.name?.slice(-1)||'用')+'</span><div><h2>'+E(u?.name)+'</h2><p>'+E(u?.phone||'未绑定')+'</p><span>'+icon('badge-check',13)+'微信手机号身份 · 演示</span></div></section><div class="mini-profile-stats"><div><strong>'+list.length+'</strong><span>可查看设备</span></div><div><strong>'+owned+'</strong><span>名下合同</span></div><div><strong>'+unread()+'</strong><span>未读消息</span></div></div>'+
      '<section class="mini-section"><div class="mini-section-head"><h3>账户信息</h3></div><dl class="mini-info"><div><dt>身份</dt><dd>'+E(isAdmin()?'管理员':'租赁用户')+'</dd></div><div><dt>登记日期</dt><dd>'+E(localDate(u?.registeredAt))+'</dd></div><div><dt>资料管理</dt><dd>本地主数据 · 云端同步</dd></div></dl><p class="mini-caption">姓名、手机号、设备归属及租期由管理员在本地登记维护。</p></section>'+
      '<div class="mini-menu">'+(isAdmin()?'<button type="button" data-mini="inventory">'+icon('package-plus',21)+'<span>手机扫码入库</span>'+icon('chevron-right',17)+'</button>':'')+'<button type="button" data-mini="scan">'+icon('scan-line',21)+'<span>扫码添加设备</span>'+icon('chevron-right',17)+'</button><button type="button" data-mini="messages">'+icon('bell',21)+'<span>消息中心</span><b>'+unread()+'</b>'+icon('chevron-right',17)+'</button><button type="button" data-mini="sms">'+icon('message-square',21)+'<span>短信服务</span><small>接口预留</small>'+icon('chevron-right',17)+'</button></div>'+
      '<section class="mini-section mini-demo-switch"><div class="mini-section-head"><h3>体验不同角色</h3><span>演示专用</span></div><p class="mini-caption">切换账户，查看不同设备和授权范围。</p><div class="mini-accounts">'+Demo.state.users.map(x=>'<button type="button" data-mini="switch-user" data-id="'+E(x.id)+'" class="'+(x.id===u?.id?'active':'')+'"><span class="mini-account-avatar">'+E(x.name.slice(-1))+'</span><span><b>'+E(x.name)+'</b><small>'+E(x.role==='admin'||x.id==='admin'?'管理员':x.id==='wang'?'共享设备体验':'租赁用户')+'</small></span>'+(x.id===u?.id?icon('check',18):'')+'</button>').join('')+'</div></section><p class="mini-end-note">完整业务 Demo · 不连接真实设备</p></div>';
  }
  function inventoryPage() {
    if(!isAdmin())return '<div class="mini-content-pad">'+empty('需要管理员权限','请在“我的”切换至管理员演示账户。','<button type="button" class="mini-primary" data-mini="profile">查看账户</button>')+'</div>';
    const stock=Demo.state.devices.filter(d=>!Demo.contract(d.id)),list=(App.ui.miniStockFilter||'stock')==='stock'?stock:Demo.state.devices;
    return '<div class="mini-content-pad"><section class="mini-inventory-hero"><span>'+icon('package-plus',32)+'</span><h2>设备扫码入库</h2><p>识别厂商、型号与 4G 模块 ID<br>完善位置后登记设备台账</p><button type="button" class="mini-primary" data-mini="inventory-scan">'+icon('scan-line',20)+'扫描二维码入库</button><button type="button" class="mini-secondary" data-mini="inventory-manual">'+icon('keyboard',17)+'手动录入设备</button></section><div class="mini-inventory-summary"><span>'+icon('package',19)+'待租设备</span><strong>'+stock.length+' <small>台</small></strong></div><div class="mini-filter mini-stock-tabs">'+[['stock','待签约'],['all','全部库存']].map(([key,name])=>'<button type="button" data-mini="stock-filter" data-filter="'+key+'" class="'+((App.ui.miniStockFilter||'stock')===key?'active':'')+'">'+name+'</button>').join('')+'</div><div class="mini-inventory-list">'+(list.length?list.map(d=>'<div class="mini-stock-card"><div><span class="mini-device-symbol">'+icon('cpu',21)+'</span><div><h3>'+E(d.name)+'</h3><p>'+E(d.vendor)+' · '+E(d.model)+'</p></div>'+App.badge(!Demo.contract(d.id)?'待签约':contract(d)?'已登记合同':'合同待同步',!contract(d)?'warning':'info')+'</div><dl><div><dt>模块 ID</dt><dd>'+E(d.module)+'</dd></div><div><dt>位置</dt><dd>'+E(d.region)+' · '+E(d.place||'待登记')+'</dd></div></dl><button type="button" data-mini="device" data-id="'+E(d.id)+'">查看设备资料'+icon('arrow-up-right',15)+'</button></div>').join(''):empty('暂无待签约设备','扫描新设备二维码完成手机入库。'))+'</div><p class="mini-end-note">入库不自动签约，也不指定第一所有人。</p></div>';
  }
  function sidePanel() {
    const u=user(),d=accessibleDevice(),r=d?rights(d):{},owner=d&&contract(d)?Demo.user(contract(d).ownerId):null;
    return '<aside class="mini-stage-notes"><span class="mini-stage-kicker">WECHAT MINI PROGRAM</span><h1>掌上设备管理<br><em>连接每一次运行</em></h1><p class="mini-stage-description">扫码添加、实时监控、授权控制与租期提醒，形成完整的移动端使用流程。</p><div class="mini-role-panel"><div class="mini-stage-section-label">当前体验账户<span>可随时切换</span></div><div class="mini-role-buttons">'+Demo.state.users.map(x=>'<button type="button" data-mini="switch-user" data-id="'+E(x.id)+'" class="'+(x.id===u?.id?'active':'')+'"><span>'+E(x.name)+'</span><small>'+E(x.role==='admin'||x.id==='admin'?'管理员':x.id==='wang'?'共享体验':'租赁用户')+'</small>'+(x.id===u?.id?icon('check-circle-2',18):icon('circle',18))+'</button>').join('')+'</div></div>'+
      '<div class="mini-journey"><div><span>01</span><p><b>扫码建立关联</b><small>用户扫码后获得查看权限。</small></p></div><div><span>02</span><p><b>合同确认归属</b><small>签约并登记付款的客户成为第一所有人。</small></p></div><div><span>03</span><p><b>管理员单独授权</b><small>启停、调频、复位按设备分别授予。</small></p></div></div>'+
      (d?'<div class="mini-selected-summary"><div>'+icon('shield-check',19)+'<strong>'+E(d.name)+'</strong></div><p>第一所有人：'+E(owner?.name||'待签约')+'</p><div class="mini-permissions">'+[['view','查看'],['control','启停'],['frequency','调频'],['reset','复位']].map(([k,label])=>'<span class="'+(r[k]?'':'unavailable')+'">'+icon(r[k]?'check':'lock-keyhole',12)+label+'</span>').join('')+'</div></div>':'')+
      '<p class="mini-stage-footnote">'+icon('flask-conical',15)+'演示环境，不下发真实控制指令。</p></aside>';
  }
  function openMessage(id) {
    const m=Demo.state.messages.find(x=>x.id===id&&x.userId===user()?.id);
    if(!m)return;
    Demo.markRead(id);
    const d=Demo.device(m.deviceId),visible=d&&allDevices().some(x=>x.id===d.id);
    App.modal(m.title,'<p class="muted">'+E(App.time(m.createdAt))+'</p><p>'+E(m.body)+'</p>'+(visible?'<div class="toolbar"><button type="button" class="btn primary" id="mini-message-device">查看设备</button></div>':''),el=>{
      el.querySelector('#mini-message-device')?.addEventListener('click',()=>{App.closeModal();navigate('detail',d.id);});
    });
  }
  function handleClick(event) {
    const b=event.target.closest('[data-mini]');if(!b||b.disabled)return;
    const action=b.dataset.mini;
    try {
      if(['devices','messages','profile','inventory'].includes(action))return navigate(action);
      if(action==='back')return navigate('devices');
      if(action==='device')return navigate('detail',b.dataset.id);
      if(action==='scan')return App.openScan({inventory:false,userId:user().id,onDone:d=>navigate('detail',d.id)});
      if(action==='inventory-scan')return App.openScan({inventory:true,userId:user().id,onDone:()=>navigate('inventory')});
      if(action==='inventory-manual')return App.openInventory();
      if(action==='filter'){App.ui.miniFilter=b.dataset.filter;return App.render();}
      if(action==='stock-filter'){App.ui.miniStockFilter=b.dataset.filter;return App.render();}
      if(action==='metric'){App.ui.miniMetric=b.dataset.metric;return App.render();}
      if(action==='command')return App.openCommand(b.dataset.id,user().id,b.dataset.action);
      if(action==='lease')return App.openLease(b.dataset.id);
      if(action==='message')return openMessage(b.dataset.id);
      if(action==='read-all'){Demo.state.messages.filter(m=>m.userId===user().id&&!m.read).forEach(m=>Demo.markRead(m.id));App.toast('全部消息已标记为已读');return;}
      if(action==='switch-user'){
        const u=Demo.user(b.dataset.id);if(!u)return;
        App.ui.userId=u.id;App.ui.miniSearch='';App.ui.miniFilter='all';
        const d=accessibleDevice();if(d)App.ui.deviceId=d.id;
        if(App.ui.miniPage==='inventory'&&!isAdmin())App.ui.miniPage='devices';
        App.render();return App.toast('已切换为 '+u.name+' 的演示账户');
      }
      if(action==='sms')return App.modal('短信服务接口预留','<div class="banner">'+icon('message-square',24)+'<div><strong>短信充值服务暂未开放</strong><p>计划采用预充值、按条扣费。当前 Demo 仅展示入口，不支持充值、不发送短信，也不产生扣费。</p></div></div><p class="muted">租期提醒可在小程序消息中心查看。短信单价、充值规则和供应商待后续确定。</p>');
    }catch(error){App.toast(error.message||'操作未完成，请稍后重试');}
  }
  function render(container) {
    if(!App.ui.miniPage)App.ui.miniPage='devices';
    const pages={devices:devicesPage,detail:detailPage,messages:messagesPage,profile:profilePage,inventory:inventoryPage};
    const body=(pages[App.ui.miniPage]||devicesPage)();
    App.ui.miniScrollPositions=App.ui.miniScrollPositions||{};
    const scrollKey=user().id+':'+App.ui.miniPage+(App.ui.miniPage==='detail'?':'+App.ui.deviceId:'');
    container.innerHTML='<div class="mini-stage"><div class="mini-phone"><div class="mini-phone-screen">'+header()+'<main class="mini-scroll" aria-label="'+pageName()+'">'+body+'</main>'+bottom()+'<div class="mini-home-indicator"></div></div></div>'+sidePanel()+'</div>';
    container.style.setProperty('--mini-shell-height',Math.max(0,container.getBoundingClientRect().top)+'px');
    const scroller=container.querySelector('.mini-scroll');
    scroller.scrollTop=App.ui.miniScrollPositions[scrollKey]||0;
    scroller.onscroll=()=>{App.ui.miniScrollPositions[scrollKey]=scroller.scrollTop;};
    container.onclick=handleClick;
    container.oninput=event=>{
      if(event.target.id==='mini-search'){
        App.ui.miniSearch=event.target.value;
        const list=container.querySelector('#mini-device-list');if(list){list.innerHTML=deviceList();App.icons?.();}
      }
    };
    container.onchange=event=>{if(event.target.id==='mini-hours'){App.ui.miniHours=Number(event.target.value);App.render();}};
  }
  globalThis.Mini={render};
})();

