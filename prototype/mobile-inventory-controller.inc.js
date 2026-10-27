  let mobileDraft = null;
  function freshMobileDraft(){return {step:1,raw:'HN|VF-22|DEMO4G001'+String(store.next).padStart(3,'0'),name:'',place:'海口仓库',error:'',duplicate:null};}
  function requireInventory(){if(!M.canInventory(store,ui.user))throw new Error('只有管理员可以扫码入库。');}
  function startMobileInventory(){requireInventory();mobileDraft=freshMobileDraft();navigate('mini','inventory');}
  function staffHome(){
    content.innerHTML='<div class="im-intro"><div><h1>设备入库</h1><p>'+esc(uNow().name)+' · 管理员</p></div><span class="wf-staff-mark">'+icon('shield-check')+'</span></div>'+
      '<button type="button" class="im-primary wf-mobile-scan" data-mobile-action="start">'+icon('scan-line')+'扫码入库</button><p class="im-note">扫描设备标签，识别后确认入库</p>'+
      '<div class="im-summary">'+[[store.devices.length,'在册设备'],[store.devices.filter(d=>!cFor(d)).length,'待出租'],[store.devices.filter(d=>d.createdAt&&d.createdAt.slice(0,10)===M.NOW.slice(0,10)).length,'今日入库']].map(v=>'<div><strong>'+v[0]+'</strong><span>'+v[1]+'</span></div>').join('')+'</div>'+
      '<div class="wf-stock-heading"><h2>设备档案</h2><span>与管理后台同步</span></div><div class="wf-stock-list">'+store.devices.slice().reverse().map(d=>'<button type="button" class="wf-stock-item" data-mobile-device="'+d.id+'"><div><strong>'+esc(d.name)+'</strong><span>'+esc(d.model)+' · INV-'+d.id+'</span><small>'+esc(d.place||'未填写位置')+'</small></div><div class="wf-stock-right"><span class="wf-stock-tag">'+(cFor(d)?'已登记合同':'待出租')+'</span>'+icon('chevron-right')+'</div></button>').join('')+'</div>';
  }
  function staffProfile(){
    content.innerHTML='<div class="im-person"><div class="im-avatar">管</div><div><h2>'+esc(uNow().name)+'</h2><p>'+M.mask(uNow().phone)+' · 微信绑定手机号</p></div></div><div class="im-banner blue">'+icon('shield-check')+'<div>管理员账号<p>可以扫码创建设备档案。</p></div></div><div class="im-links"><button type="button" class="im-link" data-mobile-action="start"><span>'+icon('scan-line')+'扫码入库</span>'+icon('chevron-right')+'</button><button type="button" class="im-link" data-mobile-action="home"><span>'+icon('boxes')+'查看设备档案</span>'+icon('chevron-right')+'</button></div>';
  }
  function mobileError(){return '<p id="wf-mobile-error" class="im-error" role="alert">'+esc(mobileDraft.error)+'</p>';}
  function staffInventory(){
    if(!mobileDraft)mobileDraft=freshMobileDraft();
    const draft=mobileDraft;
    let body='<div class="wf-mobile-steps">'+['扫码识别','确认档案','入库完成'].map((label,i)=>'<span class="'+(draft.step===i+1?'active':'')+'">'+(i+1)+' · '+label+'</span>').join('')+'</div>';
    if(draft.step===1){
      const next='HN|VF-22|DEMO4G001'+String(store.next).padStart(3,'0');
      const options=[[next,'新设备 · 可入库'],[M.qr(store.devices[0]),'已有设备 · 重复入库'],['INVALID','无效二维码']];
      if(!options.some(o=>o[0]===draft.raw))options.unshift([draft.raw,'手动输入的识别内容']);
      body+='<h1>扫码入库</h1><p class="im-note">识别厂商、变频器型号和 4G 模块 ID</p><div class="wf-scanner"><div class="wf-viewfinder">'+icon('scan-line')+'</div><span>对准设备标签上的二维码</span><p>原型扫码演示 · 不调用真实相机</p></div><label class="wf-field">选择演示二维码<select class="wf-select" id="wf-mobile-qr-select">'+options.map(o=>'<option value="'+esc(o[0])+'" '+(draft.raw===o[0]?'selected':'')+'>'+o[1]+'</option>').join('')+'</select></label><label class="wf-field">二维码识别内容<input id="wf-mobile-qr" value="'+esc(draft.raw)+'" autocomplete="off"></label>'+mobileError()+
        (draft.duplicate?'<button type="button" class="im-secondary" data-mobile-device="'+draft.duplicate+'">查看已入库设备</button>':'')+
        '<button type="button" class="im-primary wf-mobile-scan" data-mobile-action="parse">'+icon('scan-line')+'演示相机扫码</button><div class="wf-two-actions"><button type="button" class="im-secondary" data-mobile-action="album">'+icon('image')+'相册演示</button><button type="button" class="im-secondary" data-mobile-action="cancel">取消</button></div>';
    }
    if(draft.step===2){
      body+='<h1>确认设备档案</h1><p class="im-note">二维码已识别，请补充设备名称与位置</p>'+mRows([['厂商代号',draft.parsed.vendor],['变频器型号',draft.parsed.model],['4G 模块 ID',draft.parsed.module]])+
        '<label class="wf-field">设备名称 *<input id="wf-mobile-name" maxlength="30" value="'+esc(draft.name)+'" placeholder="例如：东区 06 号变频器"></label><label class="wf-field">存放位置<input id="wf-mobile-place" maxlength="60" value="'+esc(draft.place)+'" placeholder="例如：海口仓库 A 区"></label><div class="im-banner blue">'+icon('info')+'<div>入库后状态为“待出租”<p>第一所有人和控制权限在合同及授权流程中登记。</p></div></div>'+mobileError()+
        '<button type="button" class="im-primary" data-mobile-action="save">确认入库</button><div class="wf-two-actions"><button type="button" class="im-secondary" data-mobile-action="back">重新扫码</button><button type="button" class="im-secondary" data-mobile-action="cancel">取消入库</button></div>';
    }
    if(draft.step===3){
      const d=M.device(store,draft.device);
      body+='<div class="wf-success-icon">'+icon('check')+'</div><div class="wf-centered"><h1>设备已入库</h1><p class="im-note">手机与管理后台已同步（示例）</p></div>'+mRows([['设备名称',d.name],['设备编号','INV-'+d.id],['4G 模块 ID',d.module],['存放位置',d.place||'未填写'],['设备状态','待出租'],['入库人',uNow().name]])+
        '<button type="button" class="im-primary" data-mobile-action="start">继续扫码入库</button><button type="button" class="im-secondary wf-mobile-gap" data-mobile-action="home">查看设备档案</button><button type="button" class="wf-mobile-text" data-mobile-contract="'+d.id+'">去后台登记合同'+icon('arrow-up-right')+'</button>';
    }
    content.innerHTML=body;
  }
  function mobileDeviceDetails(id){
    requireInventory();const d=M.device(store,id);if(!d)return;const c=cFor(d);
    modal('mini','设备档案',d.name,mRows([['厂商 / 型号',d.vendor+' / '+d.model],['4G 模块 ID',d.module],['存放位置',d.place||'未填写'],['状态',c?'已登记合同':'待出租'],['第一所有人',c?M.user(store,c.owner).name:'尚未登记合同'],['入库方式',d.inventorySource||'历史档案'],['入库时间',d.createdAt?dateText(d.createdAt):'未登记']])+'<button type="button" class="im-primary" data-mobile-contract="'+id+'">'+(c?'去后台查看合同':'去后台登记合同')+'</button>');
  }
  function renderStaffMini(){
    mini.classList.add('wf-staff');
    if(!['devices','profile','inventory'].includes(ui.screen))ui.screen='devices';
    const sub=ui.screen==='inventory';
    mini.querySelector('#im-back').hidden=!sub;
    mini.querySelector('#im-navtitle').textContent=sub?'扫码入库':'云控租赁';
    const nav=mini.querySelector('#im-bottom');nav.hidden=sub;
    nav.innerHTML=[['home','设备档案','boxes'],['start','扫码入库','scan-line'],['profile','我的','user-round']].map(v=>'<button type="button" data-mobile-action="'+v[0]+'" class="'+((v[0]==='home'&&ui.screen==='devices')||(v[0]==='profile'&&ui.screen==='profile')?'active':'')+'">'+icon(v[2])+'<span>'+v[1]+'</span></button>').join('');
    if(sub)staffInventory();else if(ui.screen==='profile')staffProfile();else staffHome();
  }
  function readMobileFields(){if(!mobileDraft)return;const name=content.querySelector('#wf-mobile-name'),place=content.querySelector('#wf-mobile-place');if(name)mobileDraft.name=name.value;if(place)mobileDraft.place=place.value;}
  function cancelMobileInventory(){
    if(mobileDraft&&mobileDraft.step===2){readMobileFields();modal('mini','取消本次入库？','设备尚未入库，取消会放弃本次填写。','<div class="wf-two-actions"><button type="button" class="im-secondary" data-action="close">继续填写</button><button type="button" class="im-primary" data-mobile-action="discard">放弃入库</button></div>');}
    else{mobileDraft=null;navigate('mini','devices');}
  }
  root.addEventListener('change',function(e){if(e.target.id==='wf-mobile-qr-select'&&mobileDraft){mobileDraft.raw=e.target.value;mobileDraft.error='';mobileDraft.duplicate=null;render();}});
  root.addEventListener('input',function(e){if(e.target.id==='wf-mobile-qr'&&mobileDraft)mobileDraft.raw=e.target.value;if(e.target.id.startsWith('wf-mobile-')&&mobileDraft){mobileDraft.error='';const el=content.querySelector('#wf-mobile-error');if(el)el.textContent='';}});
  root.addEventListener('click',function(e){
    const button=e.target.closest('button');if(!button||button.disabled)return;
    const data=button.dataset,isBack=button.id==='im-back'&&ui.mode==='mini'&&M.canInventory(store,ui.user)&&ui.screen==='inventory';
    if(!data.mobileAction&&!data.mobileDevice&&!data.mobileContract&&!isBack)return;
    e.stopImmediatePropagation();
    try{
      requireInventory();
      if(data.mobileDevice){mobileDeviceDetails(data.mobileDevice);return;}
      if(data.mobileContract){const id=data.mobileContract;navigate('admin','leases',id);if(M.contract(store,id))contractDetails(id);else startContract(id);return;}
      const action=isBack?'back':data.mobileAction;
      if(action==='start'){startMobileInventory();return;}
      if(action==='home'||action==='profile'){navigate('mini',action==='home'?'devices':'profile');return;}
      if(action==='cancel'){cancelMobileInventory();return;}
      if(action==='discard'){mobileDraft=null;navigate('mini','devices');return;}
      if(action==='back'){
        if(mobileDraft&&mobileDraft.step===2){readMobileFields();mobileDraft.step=1;mobileDraft.error='';render();}
        else{mobileDraft=null;navigate('mini','devices');}return;
      }
      if(!mobileDraft)return;
      if(action==='parse'||action==='album'){
        mobileDraft.raw=content.querySelector('#wf-mobile-qr').value;mobileDraft.duplicate=null;
        try{
          const parsed=M.inspectInventory(store,mobileDraft.raw);
          if(!mobileDraft.parsed||mobileDraft.parsed.module!==parsed.module)mobileDraft.name='新入库 '+String(store.next).padStart(2,'0')+' 号变频器';
          mobileDraft.parsed=parsed;mobileDraft.step=2;mobileDraft.error='';
        }catch(error){mobileDraft.error=error.message;if(error.code==='DUPLICATE_DEVICE')mobileDraft.duplicate=store.devices.find(d=>d.module===M.parseQR(mobileDraft.raw).module).id;}
        render();return;
      }
      if(action==='save'&&mobileDraft.step===2){
        readMobileFields();const d=M.addInventoryFor(store,ui.user,mobileDraft,'mobile');
        ui.selected=d.id;ui.scanRaw=M.qr(d);ui.adminQuery='';ui.adminFilter='all';mobileDraft.device=d.id;mobileDraft.step=3;mobileDraft.error='';render();save();
      }
    }catch(error){if(mobileDraft&&ui.mode==='mini'&&ui.screen==='inventory'){mobileDraft.error=error.message;render();}else toast(error.message);}
  });
