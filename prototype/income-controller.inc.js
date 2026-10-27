  const money = cents => (cents / 100).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});
  function adminIncome(){
    const report=M.incomeReport(store,ui.incomeMonth,ui.incomeKind,ui.incomeScope);
    const months=[...new Set([M.NOW.slice(0,7),...store.receipts.filter(r=>r.paidAt).map(r=>r.paidAt.slice(0,7))])].sort().reverse();
    const monthOptions=[['all','全部月份'],...months.map(m=>[m,m.replace('-',' 年 ')+' 月'])];
    if(store.receipts.some(r=>!r.paidAt))monthOptions.push(['undated','未登记日期']);
    const period=monthOptions.find(m=>m[0]===ui.incomeMonth);
    const kindName=ui.incomeKind==='all'?'全部租金':ui.incomeKind==='initial'?'首次登记':'续租收入';
    main.innerHTML=aHeading('收款明细','逐笔核对合同及续租收款，金额单位：元')+
      (ui.incomeFromReport?'<div class="wf-report-drill"><button type="button" class="ia-secondary" data-report-back>'+icon('arrow-left')+'返回统计报表</button><span>'+esc(ui.incomeScope?ui.incomeScope.label:'按所选月份查看收款')+'</span></div>':'')+
      '<div class="wf-income-filters"><label>收款月份<select id="wf-income-month" class="ia-select">'+monthOptions.map(m=>'<option value="'+m[0]+'" '+(m[0]===ui.incomeMonth?'selected':'')+'>'+m[1]+'</option>').join('')+'</select></label><label>收入类型<select id="wf-income-kind" class="ia-select">'+[['all','全部租金'],['initial','首次登记'],['renewal','续租收入']].map(k=>'<option value="'+k[0]+'" '+(k[0]===ui.incomeKind?'selected':'')+'>'+k[1]+'</option>').join('')+'</select></label><span>'+esc(period?period[1]:'全部月份')+' · '+kindName+'</span></div>'+
      '<div class="ia-stats wf-income-stats" aria-live="polite">'+[
        ['实收租金','wallet',report.totalCents,report.count+' 笔已登记收款','total'],
        ['首次登记','file-plus-2',report.initialCents,report.rows.filter(r=>r.kind==='initial').length+' 笔首次收款','initial'],
        ['续租收入','calendar-check',report.renewalCents,report.rows.filter(r=>r.kind==='renewal').length+' 笔续租收款','renewal']
      ].map(v=>'<div class="ia-stat"><div class="ia-stat-label">'+v[0]+' / 元'+icon(v[1])+'</div><strong data-income-total="'+v[4]+'">'+money(v[2])+'</strong><small>'+v[3]+'</small></div>').join('')+'</div>'+
      '<section class="ia-panel"><div class="ia-toolbar"><h3>租金收款明细</h3><span class="wf-income-count">共 '+report.count+' 笔</span></div><div class="ia-table-wrap"><table class="ia-table wf-income-table" aria-label="租金收入统计表"><thead><tr><th>收款日期</th><th>合同 / 设备</th><th>承租人</th><th>收款类型</th><th class="wf-money">实收金额 / 元</th><th>操作</th></tr></thead><tbody>'+(
      report.rows.length?report.rows.map(r=>{const d=M.device(store,r.device),u=M.user(store,r.owner);return '<tr><td>'+esc(r.paidAt||'未登记日期')+'</td><td>'+esc(r.number)+'<small>'+esc(d?d.name:'历史设备')+'</small></td><td>'+esc(u?u.name:'历史用户')+'<small>'+esc(u?M.mask(u.phone):'')+'</small></td><td><span class="ia-status '+(r.kind==='renewal'?'green':'')+'">'+(r.kind==='renewal'?'续租':'首次登记')+'</span></td><td class="wf-money">'+money(r.amountCents)+'</td><td><button type="button" class="ia-text-button" data-receipt="'+r.id+'">明细</button></td></tr>';}).join(''):'<tr><td colspan="6" class="ia-empty">当前筛选下暂无收款记录</td></tr>')+
      '</tbody><tfoot><tr><th colspan="4">筛选合计 · '+report.count+' 笔</th><th class="wf-money" data-income-sum>'+money(report.totalCents)+'</th><th></th></tr></tfoot></table></div></section>'+
      '<p class="ia-note">只统计已确认登记的租金收款；合同登记、续租登记后自动更新。短信充值仅预留接口，不计入本表。</p>'+
      (store.receipts.some(r=>!r.paidAt)?'<p class="ia-note">旧版演示记录未保存收款日期，保留在“全部月份 / 未登记日期”中，不计入具体月份。</p>':'');
  }
  function receiptDetails(id){
    const r=store.receipts.find(x=>x.id===id);if(!r)return;
    const d=M.device(store,r.device),u=M.user(store,r.owner);
    modal('admin','收款明细',(r.kind==='renewal'?'续租收款':'首次登记收款')+' · '+r.id,
      '<div class="wf-review">'+[
        ['实收金额','¥ '+money(r.amountCents)],['收款日期',r.paidAt||'未登记日期'],['承租人',u.name+' · '+M.mask(u.phone)],['合同编号',r.number],['设备',d.name],['本次登记租期',dateText(r.start)+' 至 '+dateText(r.end)],['付款记录编号',r.reference||'未填写'],['登记状态','已确认登记（示例）']
      ].map(v=>row(v[0],v[1])).join('')+'</div><div class="wf-footer-buttons"><button type="button" class="ia-secondary" data-action="close">关闭</button><button type="button" class="ia-primary" data-contract-details="'+r.device+'">查看合同</button></div>');
  }
  root.addEventListener('change',function(e){
    if(e.target.id==='wf-income-month'||e.target.id==='wf-income-kind'){
      if(e.target.id==='wf-income-month')ui.incomeMonth=e.target.value;else ui.incomeKind=e.target.value;
      render();save();
    }
  });
  root.addEventListener('click',function(e){const button=e.target.closest('button[data-receipt]');if(button)receiptDetails(button.dataset.receipt);});
