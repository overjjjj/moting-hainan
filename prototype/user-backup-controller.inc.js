  const UB = globalThis.UserBackupPrototype;
  const backupTargets = { computer:'本机文件夹', usb:'U盘', disc:'光盘' };
  const backupFieldNames = { name:'姓名', phone:'手机号', registeredAt:'登记时间', owner:'第一所有人', start:'起租时间', end:'到期时间', access:'设备关联与权限' };
  let backupDraft = null, backupRecords = [], restoreRecord = null;
  function adminUserBackup(){
    const rows = UB.userRows(store);
    main.innerHTML = aHeading('用户数据与备份','用户资料以本地主数据为准，云端和小程序同步副本') +
      '<div class="wf-data-boundary"><section><div>'+icon('hard-drive')+'<h2>本地 · 用户主数据</h2></div><p>姓名、手机号、登记时间、设备归属、租期、权限</p><span>本地确认 → 云端副本 → 小程序</span></section><section><div>'+icon('cloud')+'<h2>云端 · 运行数据</h2></div><p>电机状态、运行历史、频率、电流、告警</p><span>4G设备 → 云服务器</span></section></div>'+
      '<section class="ia-panel"><div class="wf-backup-heading"><div><h2>用户档案</h2><span>'+rows.length+' 位客户 · 登记时间未知的旧记录保留“未登记”</span></div><button type="button" class="ia-primary" data-backup-action="export">'+icon('download')+'备份用户数据</button></div><div class="ia-table-wrap"><table class="ia-table wf-user-table" aria-label="本地用户档案"><thead><tr><th>姓名 / 手机号</th><th>登记时间</th><th>全部关联设备</th><th>设备到期时间</th><th>操作</th></tr></thead><tbody>'+
      rows.map(u=>'<tr data-backup-user-row="'+esc(u.id)+'"><td>'+esc(u.name)+'<small>'+M.mask(u.phone)+'</small></td><td>'+esc(u.registeredAt?dateText(u.registeredAt).slice(0,16):'未登记')+'</td><td>'+u.devices.map(d=>'<div class="wf-user-device">'+esc(d.name)+'<small>'+(d.owner?'第一所有人':'共享用户')+' · '+esc(rightsText(d.rights))+'</small></div>').join('')+'</td><td>'+u.devices.map(d=>'<div class="wf-user-device">'+esc(d.end?dateText(d.end):'未登记租赁')+'<small>INV-'+esc(d.id)+'</small></div>').join('')+'</td><td><button type="button" class="ia-text-button" data-backup-user="'+esc(u.id)+'">查看档案</button></td></tr>').join('')+
      '</tbody></table></div></section>'+
      '<section class="ia-panel wf-backup-records"><div class="wf-backup-heading"><div><h2>备份记录</h2><span>仅为当前演示会话记录，未写入真实存储介质</span></div></div>'+
      (backupRecords.length?'<div class="ia-table-wrap"><table class="ia-table wf-backup-table" aria-label="备份演示记录"><thead><tr><th>文件名 / 范围</th><th>目标介质</th><th>演示状态</th><th>操作</th></tr></thead><tbody>'+backupRecords.map(r=>'<tr><td>'+esc(r.filename)+'<small>'+r.archive.users.length+' 位客户 · '+r.archive.devices.length+' 台关联设备</small></td><td>'+backupTargets[r.target]+'</td><td>'+(r.target==='disc'?'文件准备演示 · 未刻录':'导出流程演示 · 未写入')+'</td><td><button type="button" class="ia-text-button" data-backup-restore="'+r.id+'">预览恢复</button></td></tr>').join('')+'</tbody></table></div>':'<div class="wf-backup-empty">'+icon('archive')+'<p>暂无演示备份</p><span>选择本机、U盘或光盘，预览用户数据备份流程。</span></div>')+'</section>'+
      '<p class="ia-note">原型演示：本地数据库、文件加密、实际导出、光盘刻录与云端同步待接入。运行数据和收款流水不包含在用户备份中。</p>';
  }
  function backupUserDetail(id){
    const u = UB.userRows(store).find(u=>u.id===id); if(!u)return;
    modal('admin','用户档案','本地主数据 · 示例账号', '<div class="wf-review">'+row('姓名',u.name)+row('微信绑定手机号',u.phone)+row('登记时间',u.registeredAt?dateText(u.registeredAt):'未登记')+'</div>'+u.devices.map(d=>'<div class="wf-delta"><strong>'+esc(d.name)+'</strong><p>'+esc(d.model+' · '+d.module)+'</p>'+row('身份',d.owner?'第一所有人（合同签约人）':'共享用户')+row('到期时间',d.end?dateText(d.end):'未登记租赁')+row('管理员授予权限',rightsText(d.rights))+'</div>').join('')+'<div class="ia-modal-footer"><button type="button" class="ia-secondary" data-action="close">关闭</button></div>');
  }
  function startBackup(){
    backupDraft = {target:'usb'};
    modal('admin','备份用户数据','第 1 步 · 选择保存介质',
      '<fieldset class="wf-backup-targets"><legend>保存到</legend>'+Object.entries(backupTargets).map(([key,label])=>'<label><input type="radio" name="wf-backup-target" value="'+key+'" '+(key==='usb'?'checked':'')+'><span>'+label+'<small>'+({computer:'选择本地电脑的备份文件夹',usb:'插入U盘后选择保存位置',disc:'先生成文件，再由电脑刻录到光盘'})[key]+'</small></span></label>').join('')+'</fieldset><p class="ia-note">本次只演示流程，不读取磁盘、不写入U盘，也不执行光盘刻录。</p><div class="ia-modal-footer"><button type="button" class="ia-secondary" data-action="close">取消</button><button type="button" class="ia-primary" data-backup-action="review-export">预览备份内容</button></div>');
  }
  function reviewBackup(){
    backupDraft.target = aLayer.querySelector('input[name="wf-backup-target"]:checked').value;
    backupDraft.archive = UB.snapshot(store,M.NOW);
    backupDraft.filename = '用户数据_20261021_143200_'+String(backupRecords.length+1).padStart(3,'0')+'.json';
    const data = backupDraft.archive;
    modal('admin','核对备份内容','第 2 步 · 仅备份用户资料与关联关系',
      '<div class="wf-review">'+row('目标介质',backupTargets[backupDraft.target])+row('拟用文件名',backupDraft.filename)+row('用户资料',data.users.length+' 位 · 姓名 / 完整手机号 / 登记时间')+row('关联设备',data.devices.length+' 台 · 厂商 / 型号 / 4G模块ID')+row('设备归属与租期',data.leases.length+' 份 · 合同编号 / 第一所有人 / 起止时间')+row('用户权限',data.access.length+' 条 · 查看 / 启停 / 调频 / 复位')+'</div><p class="ia-note">不包含电机实时状态、运行历史、告警、控制指令或收款流水。</p>'+
      (backupDraft.target==='disc'?'<div class="wf-backup-path">生成文件 → 打开电脑刻录工具 → 刻录到光盘 → 校验</div>':'<div class="wf-backup-path">生成文件 → 选择'+backupTargets[backupDraft.target]+'位置 → 写入并校验</div>')+
      '<p class="ia-note">真实系统需要加密备份与完整性校验；当前仅保存内存中的演示快照。</p><div class="ia-modal-footer"><button type="button" class="ia-secondary" data-backup-action="export">重新选择</button><button type="button" class="ia-primary" data-backup-action="commit-export">模拟'+(backupDraft.target==='disc'?'生成待刻录文件':'导出')+'</button></div>');
  }
  function commitBackup(){
    if(!backupDraft||!backupDraft.archive)return;
    const record={...backupDraft,id:'B'+(backupRecords.length+1)};
    backupRecords.unshift(record);backupDraft=null;render();
    modal('admin','备份流程演示完成','第 3 步 · 未创建真实备份文件',
      '<div class="wf-success"><span>'+icon('check')+'</span><h3>'+(record.target==='disc'?'已演示准备待刻录文件':'已完成'+backupTargets[record.target]+'导出流程演示')+'</h3><p>'+esc(record.filename)+'</p></div><p class="ia-note">'+(record.target==='disc'?'正式接入后，需在电脑上选择刻录设备并完成刻录校验。':'正式接入后，需选择实际保存位置并完成写入校验。')+'当前记录仅用于预览恢复，刷新后不保证保留。</p><div class="ia-modal-footer"><button type="button" class="ia-secondary" data-action="close">返回档案</button><button type="button" class="ia-primary" data-backup-restore="'+record.id+'">预览恢复</button></div>');
  }
  function backupValue(field,value){
    if(value==null)return '无记录';
    if(field==='access')return rightsText(value);
    if(field==='owner'){const u=M.user(store,value);return u?u.name:String(value);}
    return dateText(value);
  }
  function previewBackupRestore(id){
    const record=backupRecords.find(r=>r.id===id);if(!record)return;
    restoreRecord=record;
    const result=UB.preview(store,record.archive);
    modal('admin','恢复用户数据','预览差异后确认 · 当前仅修改演示数据',
      '<div class="wf-review">'+row('备份来源',backupTargets[record.target])+row('文件',record.filename)+row('恢复范围',record.archive.users.length+' 位客户及其设备归属、租期、权限')+row('处理规则','备份内用户按备份恢复；其他用户保留')+'</div>'+
      (result.conflicts.length?'<div class="ia-error" role="alert">'+result.conflicts.map(esc).join('<br>')+'</div>':'')+
      '<div class="wf-restore-diffs"><h3>与当前档案的差异 · '+result.changes.length+' 项</h3>'+(result.changes.length?result.changes.map(c=>'<div class="wf-delta"><strong>'+esc(c.label)+' · '+backupFieldNames[c.field]+'</strong><p>当前：'+esc(backupValue(c.field,c.before))+'</p><p>备份：'+esc(backupValue(c.field,c.after))+'</p></div>').join(''):'<p class="ia-note">用户数据一致，无字段需要更改。</p>')+'</div>'+
      '<p class="ia-note">不回滚云端运行数据，不恢复收款流水，也不重放启停指令。恢复旧租期或权限可能改变用户后续操作资格，须核对差异。</p>'+errorBox()+
      '<label class="wf-check-line"><input type="checkbox" id="wf-restore-confirm"><span>已核对范围与差异，确认以这份备份中的用户数据为准。</span></label><div class="ia-modal-footer"><button type="button" class="ia-secondary" data-action="close">取消</button><button type="button" class="ia-primary" data-backup-action="commit-restore" '+(result.conflicts.length?'disabled':'')+'>模拟恢复用户数据</button></div>');
  }
  function commitBackupRestore(){
    if(!restoreRecord)return;
    const result=UB.restoreDemo(store,restoreRecord.archive,Boolean(aLayer.querySelector('#wf-restore-confirm').checked));
    store.logs.unshift({id:'BU'+Date.now(),who:'管理员',action:'模拟恢复用户数据',device:'',result:result.changes.length+' 项差异已应用；运行数据与收款流水未修改',time:M.NOW});
    store.logs=store.logs.slice(0,18);permissionDraft=null;permissionDevice=null;
    closeModal();render();save();toast('用户数据模拟恢复完成 · 云端运行数据保持当前状态');
  }
  root.addEventListener('click',function(e){
    const b=e.target.closest('button');if(!b||b.disabled)return;
    if(!b.dataset.backupAction&&!b.dataset.backupUser&&!b.dataset.backupRestore)return;
    e.stopImmediatePropagation();
    try{
      if(b.dataset.backupUser){backupUserDetail(b.dataset.backupUser);return;}
      if(b.dataset.backupRestore){previewBackupRestore(b.dataset.backupRestore);return;}
      ({export:startBackup,'review-export':reviewBackup,'commit-export':commitBackup,'commit-restore':commitBackupRestore})[b.dataset.backupAction]();
    }catch(error){showError(error);}
  });
