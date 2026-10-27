(function(){
'use strict';
let carousel=null;
const e=v=>App.e(v==null?'':v),icon=(n,s=18)=>App.icon(n,s),state=()=>Demo.state;
const region=d=>d.region||'未分区';
const run=d=>d.online&&d.run===true;
const count=ds=>({total:ds.length,running:ds.filter(run).length,stopped:ds.filter(d=>d.online&&d.run===false).length,offline:ds.filter(d=>!d.online).length,unknown:ds.filter(d=>!d.online||typeof d.run!=='boolean').length,fault:ds.filter(d=>d.fault).length,online:ds.filter(d=>d.online).length});
const regions=()=>[...new Set(state().devices.map(region))];
const sectionTitle=t=>'<h2 class="mon-section-title">'+t+'</h2>';
const button=(t,a,c='')=>'<button type="button" class="mon-button '+c+'" '+a+'>'+t+'</button>';
function shortTime(t,withDate=false){return new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',...(withDate?{month:'2-digit',day:'2-digit'}:{}),hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(t));}
function aggregateSeries(kind,days=false){
 const c=count(state().devices),last=c[kind],n=days?7:13;
 return Array.from({length:n},(_,i)=>({time:Date.parse(state().now)-(n-1-i)*(days?86400000:7200000),value:i===n-1?last:Math.max(0,Math.min(c.total,last+Math.round(Math.sin(i*1.3+(kind==='fault'?2:0))*Math.min(2,c.total/3))))}));
}
function lineChart(series,opts={}){
 const w=opts.width||760,h=opts.height||180,p={l:42,r:30,t:20,b:32},max=Math.max(1,...series.flatMap(s=>s.points.map(p=>p.value))),top=Math.max(2,Math.ceil(max*1.15));
 const n=series[0].points.length,x=i=>p.l+i*(w-p.l-p.r)/(n-1),y=v=>h-p.b-v/top*(h-p.t-p.b);
 let html='';
 for(let i=0;i<4;i++){let v=Math.round(top*i/3),yy=y(v);html+='<line x1="'+p.l+'" y1="'+yy+'" x2="'+(w-p.r)+'" y2="'+yy+'" class="mon-gridline"/><text x="'+(p.l-10)+'" y="'+(yy+5)+'" text-anchor="end">'+v+'</text>';}
 series.forEach((s,idx)=>{let line=s.points.map((p,i)=>(i?'L':'M')+x(i).toFixed(1)+','+y(p.value).toFixed(1)).join(' ');if(opts.area)html+='<path d="'+line+' L'+x(n-1)+','+(h-p.b)+' L'+p.l+','+(h-p.b)+' Z" fill="url(#mon-trend-fill)"/>';html+='<path d="'+line+'" fill="none" stroke="'+s.color+'" stroke-width="2.5" '+(idx?'stroke-dasharray="6 5"':'')+'/>';html+=s.points.map((p,i)=>'<circle cx="'+x(i)+'" cy="'+y(p.value)+'" r="3.5" fill="'+s.color+'"><title>'+e(App.time(new Date(p.time).toISOString()))+' · '+p.value+' 台（合成示例）</title></circle>').join('');});
 [0,Math.floor((n-1)/2),n-1].forEach((i,j)=>{let time=series[0].points[i].time,label=opts.days?new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit'}).format(new Date(time)):shortTime(time);html+='<text x="'+x(i)+'" y="'+(h-7)+'" text-anchor="'+(j===0?'start':j===2?'end':'middle')+'">'+label+'</text>';});
 return '<svg class="mon-aggregate-chart" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+e(opts.label||'合成趋势示例')+'"><defs><linearGradient id="mon-trend-fill" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#00e5f4" stop-opacity=".25"/><stop offset="1" stop-color="#00e5f4" stop-opacity="0"/></linearGradient></defs>'+html+'</svg>';
}
function stateDonut(){
 const c=count(state().devices),rows=[['运行',c.running,'#24edee'],['停止',c.stopped,'#659de9'],['状态未知',c.unknown,'#91a8cc']];let offset=0;
 const arcs=rows.map(([label,n,color])=>{let size=c.total?n/c.total*100:0;let s='<circle cx="100" cy="100" r="72" pathLength="100" fill="none" stroke="'+color+'" stroke-width="22" stroke-dasharray="'+Math.max(0,size-(size?1:0))+' '+(100-size+(size?1:0))+'" stroke-dashoffset="'+(-offset)+'" transform="rotate(-90 100 100)"/>';offset+=size;return s;}).join('');
 return '<div class="mon-donut"><svg viewBox="0 0 200 200" role="img" aria-label="运行 '+c.running+'，停止 '+c.stopped+'，未知 '+c.unknown+'"><circle cx="100" cy="100" r="72" fill="none" stroke="#163963" stroke-width="22"/>'+arcs+'</svg><div><strong>'+(c.total?Math.round(c.running/c.total*100):0)+'<small>%</small></strong><span>运行占比</span></div></div><div class="mon-state-legend">'+rows.map(([l,n,col])=>'<div><span><i style="background:'+col+'"></i>'+l+'</span><strong>'+n+' <small>台</small></strong></div>').join('')+'</div><p class="mon-small-note">离线设备运行状态记为未知<br>故障单独统计，可与其他状态重叠</p>';
}
function mapView(){
 const data=globalThis.HainanMapData;if(!data)return '<div class="empty">地图资源未加载</div>';
 const rs=regions();let paths=data.regions.map(f=>'<path class="mon-map-region has-map '+(rs.includes(f.name)?'has-devices':'')+'" d="'+f.path+'" data-map-open="'+e(f.code)+'" tabindex="0" role="button" aria-label="进入'+e(f.name)+'地图"><title>'+e(f.name)+' · 点击进入下一级地图'+(rs.includes(f.name)?'':' · 暂无演示设备')+'</title></path>').join('');
 let pins=rs.map(name=>{let f=data.regions.find(x=>x.name===name);if(!f)return '';let ds=state().devices.filter(d=>region(d)===name),c=count(ds),[x,y]=f.center,left=name==='儋州市',dx=left?-172:30,dy=name==='三亚市'?-26:-44;
 return '<g class="mon-map-pin" data-map-open="'+e(f.code)+'" role="button" tabindex="0" aria-label="进入'+e(name)+'地图"><circle class="mon-pin-halo" cx="'+x+'" cy="'+y+'" r="12"/><circle cx="'+x+'" cy="'+y+'" r="5.5" fill="#edffff" stroke="#00e9ef" stroke-width="2"/><path d="M'+x+','+y+' l'+(left?-22:22)+',-22" fill="none" stroke="#25e6f3"/><g transform="translate('+(x+dx)+','+(y+dy)+')"><rect x="-10" y="-20" width="155" height="66" rx="3" fill="#002850" fill-opacity=".9"/><text class="mon-city-name">'+e(name)+'</text><text y="28" class="mon-city-value">运行 '+c.running+' <tspan>台 / '+c.total+' 台</tspan></text>'+(c.fault?'<circle cx="132" cy="-6" r="5" fill="#ff795e"/>':'')+'</g></g>';
 }).join('');
 return '<div class="mon-map-wrap"><svg class="mon-map" viewBox="0 0 900 540" role="group" aria-label="海南省区域设备分布地图"><defs><radialGradient id="mon-map-sea"><stop stop-color="#0b5796" stop-opacity=".45"/><stop offset="1" stop-color="#021a3b" stop-opacity="0"/></radialGradient><linearGradient id="mon-map-land" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#0871a8" stop-opacity=".8"/><stop offset="1" stop-color="#064476" stop-opacity=".55"/></linearGradient><filter id="mon-map-glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter><pattern id="mon-map-grid" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="rotate(-18)"><path d="M 24 0 L 0 0 0 24" fill="none" stroke="#1f9ae8" stroke-opacity=".15" stroke-width=".6"/></pattern></defs><ellipse cx="450" cy="280" rx="430" ry="260" fill="url(#mon-map-sea)"/><ellipse cx="450" cy="280" rx="415" ry="245" fill="url(#mon-map-grid)"/><g class="mon-land">'+paths+'</g>'+pins+'<g class="mon-map-inset" transform="translate(746,352)"><rect width="126" height="148" rx="3"/><path transform="translate(4,2)" d="'+data.inset+'"/><text x="63" y="137" text-anchor="middle">南海诸岛</text></g><text x="35" y="521" class="mon-map-caption">点击市县进入下一级地图 · 聚合示意</text></svg></div>';
}
function overview(){
 const ds=state().devices,c=count(ds),rs=regions(),max=Math.max(1,...rs.map(r=>count(ds.filter(d=>region(d)===r)).running));
 return '<div class="mon-overview"><aside class="mon-left-column"><section>'+sectionTitle('运行状态')+stateDonut()+'</section><section>'+sectionTitle('区域运行分布')+'<div class="mon-region-bars">'+rs.map(r=>{let n=count(ds.filter(d=>region(d)===r));return '<button type="button" data-mon-region="'+e(r)+'"><span>'+e(r.replace(/市$/,''))+'</span><i><b style="width:'+(n.running/max*100)+'%"></b></i><strong>'+n.running+' <small>台</small></strong></button>';}).join('')+'</div><p class="mon-small-note">点击区域查看设备明细</p></section></aside><section class="mon-center-column"><div class="mon-head-numbers">'+[['接入设备',c.total,''],['运行设备',c.running,'cyan'],['故障设备',c.fault,'coral']].map(x=>'<div><span>'+x[0]+'</span><strong class="'+x[2]+'">'+x[1]+'<small>台</small></strong></div>').join('')+'</div>'+mapView()+'<section class="mon-main-trend">'+sectionTitle('近24小时运行趋势 <small>台 · 合成示例</small>')+lineChart([{points:aggregateSeries('running'),color:'#16e7ef'}],{area:true,label:'近24小时运行台数，历史为合成示例'})+'</section></section><aside class="mon-right-column">'+sectionTitle('历史健康状态')+'<div class="mon-health-caption">近7天故障与离线趋势<span>合成示例</span></div><div class="mon-chart-legend"><span><i style="background:#ff8068"></i>故障设备</span><span><i style="background:#89b7fa"></i>离线设备</span></div>'+lineChart([{points:aggregateSeries('fault',true),color:'#ff8068'},{points:aggregateSeries('offline',true),color:'#89b7fa'}],{days:true,width:420,height:280,label:'近7天故障和离线台数，合成示例'})+'<div class="mon-health-current"><div><span>当前通信在线</span><strong>'+c.online+' <small>/ '+c.total+' 台</small></strong></div><div><span>当前离线设备</span><strong class="pale">'+c.offline+' <small>台</small></strong></div><div><span>当前故障设备</span><strong class="coral">'+c.fault+' <small>台</small></strong></div></div><div class="mon-health-note">'+icon('info',17)+'<p>历史曲线用于展示分析界面，当前点来自演示设备状态；不代表真实采集记录或健康评分。</p></div>'+button('查看全部设备 '+icon('arrow-up-right',16),'data-mon-region="all"','mon-all-devices')+'</aside></div>';
}
function alarmStrip(){
 const alarms=state().alarms.filter(a=>!a.ackAt).sort((a,b)=>Number(!!a.resolvedAt)-Number(!!b.resolvedAt)||(a.severity==='danger'?0:1)-(b.severity==='danger'?0:1)||Date.parse(b.createdAt)-Date.parse(a.createdAt));
 if(!alarms.length)return '';
 const a=alarms[0],d=Demo.device(a.deviceId);
 return '<div class="mon-alarm-strip">'+icon('triangle-alert',22)+'<strong>全域有 '+alarms.length+' 条未确认报警</strong><span>'+e(d?.name||a.deviceId)+' · '+e(a.message)+'</span>'+button('查看 '+icon('chevron-right',16),'data-mon-open-unack','')+'</div>';
}
function workspace(){
 App.modal('演示工作台','<p class="muted">监控中心用于展示。可切换到管理后台办理合同与授权，或进入手机端体验扫码与控制。</p><div class="mon-workspace-links">'+[['admin','管理后台','panels-top-left'],['mini','手机小程序','smartphone']].map(([v,t,i])=>'<button type="button" class="btn" data-view="'+v+'">'+icon(i,20)+t+'</button>').join('')+'<button type="button" class="btn" data-mon-scenario>'+icon('sliders-horizontal',20)+'演示场景</button><button type="button" class="btn" data-mon-guide>'+icon('circle-help',20)+'演示指南</button></div><p class="mon-workspace-foot">当前为本地模拟环境 · 未连接真实设备或收款</p>',el=>{el.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{App.closeModal();App.navigate(b.dataset.view,b.dataset.view==='admin'?App.ui.page:App.ui.miniPage)});el.querySelector('[data-mon-scenario]').onclick=()=>App.openScenarios();el.querySelector('[data-mon-guide]').onclick=()=>App.openGuide();});
}
function navigate(page,id){App.ui.monitorAutoplay=false;App.navigate('monitor',page,id);}
function bind(container){
 container.onclick=ev=>{
  const b=ev.target.closest('[data-mon-nav],[data-mon-region],[data-mon-detail],[data-mon-page],[data-mon-clear],[data-mon-metric],[data-mon-alarm-filter],[data-mon-ack],[data-mon-lease],[data-mon-manage],[data-mon-inventory],[data-mon-workspace],[data-mon-fullscreen],[data-mon-autoplay],[data-mon-open-unack]');
  if(!b||b.disabled)return;if(!b.hasAttribute('data-mon-autoplay')){App.ui.monitorAutoplay=false;clearInterval(carousel);}
  try{
   if(b.hasAttribute('data-mon-nav')){if(b.dataset.monNav==='region'&&App.ui.monitorPage==='map'&&globalThis.MonitorMap?.showList)return MonitorMap.showList();return navigate(b.dataset.monNav);}
   if(b.hasAttribute('data-mon-region')){App.ui.monitorRegion=b.dataset.monRegion;App.ui.monitorDistrictCode='';App.ui.monitorDevicePage=1;return navigate('region');}
   if(b.hasAttribute('data-mon-detail'))return navigate('detail',b.dataset.monDetail);
   if(b.hasAttribute('data-mon-page')){App.ui.monitorDevicePage=Number(b.dataset.monPage);return App.render();}
   if(b.hasAttribute('data-mon-clear')){App.ui.monitorSearch='';App.ui.monitorOnline='all';App.ui.monitorRun='all';App.ui.monitorDevicePage=1;return App.render();}
   if(b.hasAttribute('data-mon-metric')){App.ui.monitorMetric=b.dataset.monMetric;return App.render();}
   if(b.hasAttribute('data-mon-alarm-filter')){App.ui.monitorAlarmFilter=b.dataset.monAlarmFilter;return App.render();}
   if(b.hasAttribute('data-mon-open-unack')){App.ui.monitorAlarmFilter='unack';App.ui.monitorAlarmDevice='all';return navigate('alarms');}
   if(b.hasAttribute('data-mon-ack')){Demo.ackAlarm(b.dataset.monAck);return App.toast('已确认报警；故障恢复状态保持独立。');}
   if(b.hasAttribute('data-mon-lease'))return App.openLease(b.dataset.monLease);
   if(b.hasAttribute('data-mon-manage'))return App.navigate('admin','devices',b.dataset.monManage);
   if(b.hasAttribute('data-mon-inventory'))return App.openInventory();
   if(b.hasAttribute('data-mon-workspace'))return workspace();
   if(b.hasAttribute('data-mon-autoplay')){App.ui.monitorAutoplay=!App.ui.monitorAutoplay;return App.render();}
   if(b.hasAttribute('data-mon-fullscreen')){const p=document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen?.();if(p?.catch)p.catch(()=>App.toast('当前浏览器不支持全屏，请使用浏览器全屏模式。'));return;}
  }catch(err){App.toast(err.message||'操作未完成');}
 };
 container.onkeydown=ev=>{const pin=ev.target.closest('svg [data-mon-region]');if(pin&&(ev.key==='Enter'||ev.key===' ')){ev.preventDefault();pin.dispatchEvent(new MouseEvent('click',{bubbles:true}));}};
 container.onchange=ev=>{const t=ev.target;App.ui.monitorAutoplay=false;clearInterval(carousel);if(t.hasAttribute('data-mon-select-device'))navigate('detail',t.value);if(t.hasAttribute('data-mon-hours')){App.ui.monitorHours=Number(t.value);App.render();}if(t.hasAttribute('data-mon-alarm-device')){App.ui.monitorAlarmDevice=t.value;App.render();}};
 const form=container.querySelector('#mon-filter-form');if(form)form.onsubmit=ev=>{ev.preventDefault();const fd=new FormData(form);App.ui.monitorAutoplay=false;App.ui.monitorSearch=fd.get('search')||'';App.ui.monitorOnline=fd.get('online')||'all';App.ui.monitorRun=fd.get('running')||'all';App.ui.monitorDevicePage=1;App.render();};
 globalThis.MonitorPages?.bind(container);
 globalThis.MonitorMap?.bind(container);
 if(App.ui.monitorPage==='region'&&App.ui.monitorAutoplay){carousel=setInterval(()=>{if(App.ui.view!=='monitor'||App.ui.monitorPage!=='region'){clearInterval(carousel);return;}const next=[...document.querySelectorAll('[data-mon-page]')].find(b=>Number(b.dataset.monPage)>Number(App.ui.monitorDevicePage||1));App.ui.monitorDevicePage=next&&!next.disabled?Number(next.dataset.monPage):1;App.render();},10000);}
}
function render(container){
 clearInterval(carousel);
 const page=['overview','map','region','detail','alarms'].includes(App.ui.monitorPage)?App.ui.monitorPage:'overview';
 const now=App.time(state().now),unack=state().alarms.filter(a=>!a.ackAt).length;
 const title='<header class="mon-screen-header"><div class="mon-screen-time"><span>'+e(now.slice(0,10).replaceAll('-','.'))+'</span><strong>'+e(now.slice(11))+':00</strong></div><div class="mon-screen-title"><h1>海南省电机运行监控中心</h1><svg viewBox="0 0 800 28" preserveAspectRatio="none" aria-hidden="true"><path d="M0 2 H150 L180 25 H620 L650 2 H800"/></svg></div><div class="mon-server-state"><span class="mon-server-dot"></span><span>服务已连接<small>模拟</small></span><span class="mon-data-tag">演示数据</span>'+button(icon('expand',17),'data-mon-fullscreen aria-label="切换全屏"','icon-only')+button(icon('panels-top-left',17),'data-mon-workspace aria-label="打开演示工作台"','icon-only')+'</div></header>';
 const nav='<footer class="mon-screen-footer"><span class="mon-update">最近数据更新 <b>'+e(now.slice(11))+':00</b></span><nav aria-label="监控界面导航">'+[['overview','全域总览'],['region','区域设备'],['alarms','报警记录']].map(([key,label])=>'<button type="button" class="'+(page===key||key==='region'&&['detail','map'].includes(page)?'active':'')+'" data-mon-nav="'+key+'" '+(page===key||key==='region'&&['detail','map'].includes(page)?'aria-current="page"':'')+'>'+label+(key==='alarms'&&unack?'<small>'+unack+'</small>':'')+'</button>').join('')+'</nav><span class="mon-footer-meta">本地演示 '+button('工作台 '+icon('arrow-up-right',15),'data-mon-workspace','')+'</span></footer>';
 const body=page==='overview'?overview():page==='map'&&globalThis.MonitorMap?MonitorMap.render():globalThis.MonitorPages?({region:MonitorPages.regional,detail:MonitorPages.detail,alarms:MonitorPages.alarms})[page]():'<div class="empty">监控页面载入中，请刷新。</div>';
 container.innerHTML='<main class="monitor-app" data-monitor-page="'+page+'">'+title+'<div class="mon-screen-body">'+body+'</div>'+(page==='alarms'?'':alarmStrip())+nav+'</main>';
 bind(container);
}
globalThis.Monitor={render};
})();


