  const reportNames={device:'设备台账',month:'月度收入',customer:'客户汇总'};
  function reportMonthText(value){return value==='all'?'全部月份':value==='undated'?'未登记日期':value.replace('-',' 年 ')+' 月';}
  function adminReports(){
    if(!reportNames[ui.reportDimension])ui.reportDimension='device';
    const dimension=ui.reportDimension,report=M.tableReport(store,dimension,ui.reportMonth);
    const months=[...new Set([M.NOW.slice(0,7),...store.receipts.filter(r=>r.paidAt).map(r=>r.paidAt.slice(0,7))])].sort().reverse();
    const options=['all',...months];if(store.receipts.some(r=>!r.paidAt))options.push('undated');
    const columns=dimension==='device'?['设备 / 型号','第一所有人','当前租赁状态','到期日期','收款笔数','实收租金 / 元','操作']:dimension==='month'?['收款月份','收款设备数','收款笔数','首次收款 / 元','续租收款 / 元','实收合计 / 元','操作']:['合同签约客户','合同设备数','收款笔数','首次收款 / 元','续租收款 / 元','实收合计 / 元','操作'];
    main.innerHTML=aHeading('统计报表','集中查看设备租赁、月度收入和客户收款')+
      '<section class="ia-panel wf-report-panel"><div class="wf-report-toolbar"><div class="ia-tabs" aria-label="统计表类型">'+Object.entries(reportNames).map(([key,label])=>'<button type="button" data-report-dimension="'+key+'" aria-pressed="'+(dimension===key)+'">'+label+'</button>').join('')+'</div><label class="wf-report-month">收款月份<select class="ia-select" id="wf-report-month">'+options.map(m=>'<option value="'+m+'" '+(ui.reportMonth===m?'selected':'')+'>'+reportMonthText(m)+'</option>').join('')+'</select></label></div>'+
      '<div class="wf-report-summary" aria-live="polite"><div><h2>'+reportNames[dimension]+'</h2><span>'+reportMonthText(ui.reportMonth)+' · '+report.rows.length+(dimension==='device'?' 台设备':dimension==='customer'?' 位客户':' 个月份分组')+'</span></div><div>实收合计 <strong data-report-total>'+money(report.total.totalCents)+'</strong><span>元 · '+report.total.count+' 笔收款</span></div></div>'+
      '<div class="ia-table-wrap"><table class="ia-table wf-report-table" aria-label="'+reportNames[dimension]+'统计表"><thead><tr>'+columns.map((c,i)=>'<th'+((dimension==='device'?[4,5]:[1,2,3,4,5]).includes(i)?' class="wf-number"':'')+'>'+c+'</th>').join('')+'</tr></thead><tbody>'+
      (report.rows.length?report.rows.map(g=>reportTableRow(dimension,g)).join(''):'<tr><td colspan="7" class="ia-empty">当前月份暂无收款记录</td></tr>')+
      '</tbody><tfoot><tr><th colspan="5">合计 · '+report.total.count+' 笔收款</th><th class="wf-number" data-report-footer>'+money(report.total.totalCents)+'</th><th></th></tr></tfoot></table></div></section>'+
      '<p class="ia-note">收入按实际收款日期统计；首次收款与续租分别记录。短信充值仍仅预留接口，不计入报表。</p>'+
      (dimension==='device'?'<p class="ia-note">设备所属人、租赁状态和到期日期显示当前档案；月份筛选仅影响收款数据，未收款设备也会保留。</p>':'')+
      (store.receipts.some(r=>!r.paidAt)?'<p class="ia-note">缺少收款日期的旧演示记录单独归入“未登记日期”，不计入具体月份。</p>':'');
  }
  function reportTableRow(dimension,g){
    const action='<td><button type="button" class="ia-text-button" data-report-open="'+esc(g.key)+'">收款明细</button></td>';
    const amount=value=>'<td class="wf-number">'+money(value)+'</td>';
    const count=value=>'<td class="wf-number">'+value+'</td>';
    let cells='';
    if(dimension==='device'){
      const d=M.device(store,g.key),c=M.contract(store,g.key),u=c&&M.user(store,c.owner);
      cells='<td>'+esc(d?d.name:'历史设备')+'<small>'+esc(d?d.model+' · INV-'+d.id:g.key)+'</small></td><td>'+esc(u?u.name:'尚未登记')+(u?'<small>'+M.mask(u.phone)+'</small>':'')+'</td><td>'+(d?badge(d):'—')+'</td><td>'+(c?c.end.slice(0,10)+'<small>'+c.end.slice(11)+'</small>':'—')+'</td>'+count(g.count)+amount(g.totalCents);
    }else{
      const u=M.user(store,g.key);
      cells='<td>'+(dimension==='month'?reportMonthText(g.key):esc(u?u.name:'历史客户')+(u?'<small>'+M.mask(u.phone)+'</small>':''))+'</td>'+count(dimension==='month'?g.deviceCount:g.contractDeviceCount)+count(g.count)+amount(g.initialCents)+amount(g.renewalCents)+amount(g.totalCents);
    }
    return '<tr data-report-row="'+esc(g.key)+'">'+cells+action+'</tr>';
  }
  root.addEventListener('change',function(e){if(e.target.id==='wf-report-month'){ui.reportMonth=e.target.value;render();save();}});
  root.addEventListener('click',function(e){
    const b=e.target.closest('button');if(!b||b.disabled)return;
    if(b.dataset.reportDimension){ui.reportDimension=b.dataset.reportDimension;render();save();return;}
    if(b.hasAttribute('data-report-back')){navigate('admin','reports');return;}
    if(b.hasAttribute('data-report-open')){
      const key=b.dataset.reportOpen,dimension=ui.reportDimension;
      ui.incomeMonth=dimension==='month'?key:ui.reportMonth;ui.incomeKind='all';ui.incomeScope=null;ui.incomeFromReport=true;
      if(dimension==='device')ui.incomeScope={dimension,key,label:'设备：'+((M.device(store,key)||{}).name||key)};
      if(dimension==='customer')ui.incomeScope={dimension,key,label:'客户：'+((M.user(store,key)||{}).name||key)};
      navigate('admin','income');
    }
  });
