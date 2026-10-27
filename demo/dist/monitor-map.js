(function(){
'use strict';
const ROOT='460000',e=v=>App.e(v==null?'':v),ico=(name,size=19)=>App.icon(name,size),ui=()=>App.ui;
const data=()=>globalThis.MapLevels,nodes=()=>data()?.nodes||{};
const button=(label,attrs='',cls='')=>'<button type="button" class="mm-button '+cls+'" '+attrs+'>'+label+'</button>';
const current=()=>nodes()[String(ui().monitorMapCode||ROOT)]||null;
const nodeChildren=node=>(node?.children||[]).map(code=>nodes()[String(code)]).filter(Boolean);
function cityOf(node){let cursor=node,guard=0;while(cursor&&guard++<8){if(cursor.level==='city')return cursor;if(!cursor.parent)return null;cursor=nodes()[String(cursor.parent)];}return null;}
function validDistrict(device,city){
 if(!city||typeof device.districtCode!=='string'||String(device.region||'').trim()!==city.name)return null;
 const district=nodes()[device.districtCode];
 return district&&district.level==='district'&&cityOf(district)?.code===city.code?district:null;
}
function cityDevices(city){return city?Demo.state.devices.filter(d=>String(d.region||'').trim()===city.name):[];}
function devicesFor(node){
 if(!node)return [];
 if(node.level==='province')return Demo.state.devices.slice();
 const city=cityOf(node),all=cityDevices(city);
 return node.level==='district'?all.filter(d=>validDistrict(d,city)?.code===node.code):all;
}
function stats(devices){return{total:devices.length,online:devices.filter(d=>d.online).length,running:devices.filter(d=>d.online&&d.run===true).length,fault:devices.filter(d=>d.fault).length,unknown:devices.filter(d=>!d.online||typeof d.run!=='boolean').length};}
function breadcrumbs(node){const chain=[];let cursor=node,guard=0;while(cursor&&guard++<8){chain.unshift(cursor);cursor=cursor.parent?nodes()[String(cursor.parent)]:null;}return chain;}
function zoomValue(){const value=Number(ui().monitorMapZoom);return Number.isFinite(value)?Math.max(.75,Math.min(3,value)):1;}
function baseBox(node){
 const b=Array.isArray(node.bounds)&&node.bounds.length===4&&node.bounds.every(Number.isFinite)?node.bounds:[0,0,900,540];
 const midX=b[0]+b[2]/2,midY=b[1]+b[3]/2;let width=Math.max(1,b[2])*1.22,height=Math.max(1,b[3])*1.22;
 const ratio=1.6;if(width/height<ratio)width=height*ratio;else height=width/ratio;
 return{midX,midY,width,height};
}
function viewBox(node){const b=baseBox(node),zoom=zoomValue();return[b.midX-b.width/zoom/2,b.midY-b.height/zoom/2,b.width/zoom,b.height/zoom];}
function geometry(node){
 const children=nodeChildren(node),box=viewBox(node),font=box[2]/66,small=font*.76,stroke=font*.26;
 const paths=children.length?children.map(child=>'<path class="mm-region-path" d="'+e(child.path)+'" fill-rule="evenodd" data-map-open="'+e(child.code)+'" tabindex="0" role="button" aria-label="进入'+e(child.name)+'区域地图"><title>'+e(child.name)+' · '+devicesFor(child).length+' 台已登记设备</title></path>').join(''):'<path class="mm-leaf-path" d="'+e(node.path)+'" fill-rule="evenodd"><title>'+e(node.name)+'当前区域边界</title></path>';
 const labelNodes=children.length?children:[node];
 const labels=labelNodes.map(child=>{
  const center=Array.isArray(child.center)&&child.center.every(Number.isFinite)?child.center:[child.bounds[0]+child.bounds[2]/2,child.bounds[1]+child.bounds[3]/2],count=devicesFor(child).length;
  return '<g class="mm-region-label '+(children.length?'interactive':'')+'" '+(children.length?'data-map-open="'+e(child.code)+'" tabindex="0" role="button" aria-label="进入'+e(child.name)+'区域地图"':'')+' data-map-label-x="'+center[0]+'" data-map-label-y="'+center[1]+'" transform="translate('+center[0]+','+center[1]+')"><text text-anchor="middle" class="mm-place-label" font-size="'+font.toFixed(3)+'" stroke-width="'+stroke.toFixed(3)+'">'+e(child.name)+'</text><text text-anchor="middle" class="mm-place-count" y="'+(font*1.35).toFixed(3)+'" font-size="'+small.toFixed(3)+'" stroke-width="'+stroke.toFixed(3)+'">'+count+' 台已登记</text></g>';
 }).join('');
 return '<svg class="mm-map-svg" viewBox="'+box.map(n=>Number(n.toFixed(4))).join(' ')+'" data-map-viewbox="'+box.map(n=>Number(n.toFixed(4))).join(' ')+'" aria-label="'+e(node.name)+(children.length?'下辖区域地图，点击区域下钻':'区域边界地图')+'" role="group" data-map-children="'+children.length+'"><defs><linearGradient id="mm-land-fill" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#0876a8"/><stop offset="1" stop-color="#063e70"/></linearGradient><filter id="mm-border-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation=".8" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>'+(children.length?'<path class="mm-parent-outline" d="'+e(node.path)+'" fill-rule="evenodd"/>':'')+'<g class="mm-map-geography">'+paths+'</g>'+labels+'</svg>';
}
function deviceStatus(d){
 if(!d.online)return '<span class="mm-status offline">离线 · 运行未知</span>'+(d.fault?'<span class="mm-status fault">故障</span>':'');
 return '<span class="mm-status '+(d.run===true?'running':d.run===false?'stopped':'offline')+'">'+(d.run===true?'运行中':d.run===false?'已停止':'运行未知')+'</span>'+(d.fault?'<span class="mm-status fault">故障</span>':'');
}
function ownerName(d){const c=Demo.effectiveContract?Demo.effectiveContract(d.id):Demo.contract(d.id),u=c&&Demo.user(c.ownerId);return u?u.name:c?'资料待同步':'待出租';}
function section(title,extra=''){return '<div class="mm-section-heading"><h2>'+e(title)+'</h2><span></span>'+extra+'</div>';}
function invalidMarkup(){return '<section class="mm-invalid" data-map-invalid><h2>区域地图暂不可用</h2><p>当前区域不存在或地图资料尚未加载，请返回全域总览重新选择。</p>'+button('返回全域总览','data-map-open="'+ROOT+'"','primary')+'</section>';}
function render(){
 const node=current();if(!node||node.level==='province')return invalidMarkup();
 const city=cityOf(node),children=nodeChildren(node),allCity=cityDevices(city),selected=devicesFor(node).sort((a,b)=>a.id.localeCompare(b.id,'zh-CN',{numeric:true})),s=stats(selected),unassigned=allCity.filter(d=>!validDistrict(d,city)).length;
 const isDistrict=node.level==='district',hasDistricts=nodeChildren(city).some(n=>n.level==='district');
 const path=breadcrumbs(node),parent=node.parent||ROOT,zoom=zoomValue(),cards=selected.slice(0,5);
 return '<section class="mm-drilldown" data-map-current="'+e(node.code)+'" data-map-level="'+e(node.level)+'"><header class="mm-page-header"><div class="mm-title-group"><h1>区域地图</h1><nav class="mm-breadcrumb" aria-label="地图行政区域路径">'+path.map((n,i)=>(i?'<span class="mm-breadcrumb-separator">/</span>':'')+(i===path.length-1?'<span class="current" aria-current="page">'+e(n.name)+'</span>':button(e(n.name),'data-map-open="'+e(n.code)+'"','breadcrumb'))).join('')+'</nav></div><div class="mm-page-actions">'+button(ico('arrow-left',18)+'返回上级','data-map-back="'+e(parent)+'"')+button(ico('list',18)+'查看设备列表','data-map-list="'+e(node.code)+'"','primary')+'</div></header><div class="mm-main-grid"><div class="mm-map-column"><div class="mm-map-panel"><div class="mm-map-caption"><div><strong>'+e(node.name)+'</strong><span>'+ (children.length?'点击下辖区域继续查看':'当前区域边界')+'</span></div><div class="mm-zoom-controls" aria-label="地图观察工具">'+button(ico('plus',18),'data-map-zoom="in" aria-label="放大地图" '+(zoom>=3?'disabled':''),'icon')+button(ico('minus',18),'data-map-zoom="out" aria-label="缩小地图" '+(zoom<=.75?'disabled':''),'icon')+button(ico('scan',18),'data-map-zoom="reset" aria-label="复位地图"','icon')+'<span data-map-zoom-value>'+Math.round(zoom*100)+'%</span></div></div><div class="mm-map-canvas">'+geometry(node)+'</div><div class="mm-map-footnote"><span>'+ico('map',16)+'行政区域边界 · 未标注设备精确位置</span><span>'+ (children.length?'共 '+children.length+' 个下辖区域':isDistrict?'区级边界':'当前来源未提供更细一级边界')+'</span></div></div>'+(hasDistricts&&unassigned?'<div class="mm-assignment-notice" data-map-unassigned="'+unassigned+'">'+ico('info',21)+'<div><strong>市内 '+unassigned+' 台设备区县待登记</strong><p>未登记区县码或归属资料不匹配的设备计入市级总数，不计入当前区县。</p></div>'+button('查看'+e(city.name)+'设备','data-map-list="'+e(city.code)+'"','quiet')+'</div>':'<div class="mm-scope-note">'+ico('info',16)+(isDistrict?'当前统计仅包含明确登记在'+e(node.name)+'的设备。':children.length?'市级统计包含辖区内已登记及区县待登记设备。':'按'+e(node.name)+'汇总设备；当前公开边界资料未提供下一级，保留本区放大与设备列表。')+'</div>')+'</div><aside class="mm-side-panel"><section class="mm-overview-section">'+section('区域概览','<small>'+e(isDistrict?'区级':'市县级')+'</small>')+'<div class="mm-stat-grid">'+[['设备总数',s.total,'total'],['通信在线',s.online,'online'],['运行设备',s.running,'running'],['故障设备',s.fault,'fault']].map(([label,n,key])=>'<div class="mm-stat '+key+'"><span>'+label+'</span><strong '+(key==='total'?'data-map-total="'+n+'"':'')+'>'+n+'<small>台</small></strong></div>').join('')+'</div><p class="mm-stat-note">运行未知 '+s.unknown+' 台 · 故障独立统计</p></section><section class="mm-children-section">'+section(children.length?'下辖区域':'当前层级')+(children.length?'<div class="mm-children-list">'+children.map(child=>'<button type="button" class="mm-child-row" data-map-open="'+e(child.code)+'"><span>'+e(child.name)+'</span><small>'+devicesFor(child).length+' 台</small>'+ico('chevron-right',17)+'</button>').join('')+'</div>':'<div class="mm-leaf-note">'+ico('map-pin',22)+'<p>'+e(isDistrict?'已进入'+node.name+'地图。当前地图资料未提供可继续下钻的乡镇边界。':'当前来源未提供'+node.name+'更细一级边界，可在本区地图查看和筛选设备。')+'</p></div>')+'</section><section class="mm-devices-section">'+section('该区域设备','<small>'+selected.length+' 台</small>')+'<div class="mm-device-list">'+(cards.length?cards.map(d=>'<button type="button" class="mm-device-row" data-mon-detail="'+e(d.id)+'" data-map-device="'+e(d.id)+'"><div class="mm-device-head"><strong>'+e(d.name)+'</strong>'+ico('chevron-right',17)+'</div><div class="mm-device-sub">'+e(d.id)+' · '+e(ownerName(d))+'</div><div class="mm-device-status">'+deviceStatus(d)+'</div></button>').join(''):'<div class="mm-empty-devices">'+ico('inbox',31)+'<strong>暂无已登记设备</strong><span>'+e(isDistrict?'尚无设备明确归属到此区县。':'该市县当前没有演示设备。')+'</span></div>')+'</div>'+(selected.length>cards.length?'<div class="mm-more-devices"><span>显示前 '+cards.length+' 台</span>'+button('查看全部 '+selected.length+' 台','data-map-list="'+e(node.code)+'"','quiet')+'</div>':'')+'</section></aside></div></section>';
}
function open(code){
 const key=String(code||''),node=nodes()[key];ui().monitorAutoplay=false;
 if(!node){ui().monitorMapCode=ROOT;ui().monitorMapZoom=1;App.navigate('monitor','overview');App.toast('未找到该区域地图，已返回海南省总览。');return;}
 ui().monitorMapCode=node.code;ui().monitorMapZoom=1;
 App.navigate('monitor',node.code===ROOT||node.level==='province'?'overview':'map');
}
function showList(code){
 const node=nodes()[String(code||ui().monitorMapCode||ROOT)];if(!node){open(ROOT);App.toast('未找到区域资料，请重新选择。');return;}
 const city=cityOf(node);ui().monitorRegion=city?city.name:'all';ui().monitorDistrictCode=node.level==='district'?node.code:'';ui().monitorSearch='';ui().monitorOnline='all';ui().monitorRun='all';ui().monitorDevicePage=1;ui().monitorAutoplay=false;
 App.navigate('monitor','region');
}
function zoom(action){
 const before=zoomValue(),next=action==='reset'?1:action==='in'?Math.min(3,before+.25):action==='out'?Math.max(.75,before-.25):before;
 ui().monitorMapZoom=Math.round(next*100)/100;ui().monitorAutoplay=false;App.render();
}
let resizeObserver=null;
function fitLabels(container){
 const svg=container.querySelector('.mm-map-svg');if(!svg)return;
 const matrix=svg.getScreenCTM();if(!matrix||!matrix.a)return;
 const compact=window.innerWidth<760,target=compact?14:svg.dataset.mapChildren==='0'?22:18,scale=Math.abs(matrix.a),font=target/scale;
 const groups=[...svg.querySelectorAll('.mm-region-label')];
 groups.forEach(group=>{const title=group.querySelector('.mm-place-label'),count=group.querySelector('.mm-place-count');group.setAttribute('transform','translate('+group.dataset.mapLabelX+','+group.dataset.mapLabelY+')');title.setAttribute('font-size',font.toFixed(4));count.setAttribute('font-size',(font*.76).toFixed(4));count.setAttribute('y',(font*1.38).toFixed(4));count.style.display=compact?'none':'';[title,count].forEach(label=>label.setAttribute('stroke-width',(font*.25).toFixed(4)));});
 // Labels annotate administrative areas, not device GPS positions. Separate close names on narrow screens.
 if(compact){const placed=[];groups.sort((a,b)=>Number(a.dataset.mapLabelY)-Number(b.dataset.mapLabelY)).forEach(group=>{let offset=0;for(let attempt=0;attempt<8;attempt++){const rect=group.getBoundingClientRect(),hit=placed.find(p=>rect.left<p.right+4&&rect.right>p.left-4&&rect.top<p.bottom+4&&rect.bottom>p.top-4);if(!hit)break;offset+=(hit.bottom+5-rect.top)/scale;group.setAttribute('transform','translate('+group.dataset.mapLabelX+','+(Number(group.dataset.mapLabelY)+offset)+')');}placed.push(group.getBoundingClientRect());});}
}
function bind(container){
 if(resizeObserver){resizeObserver.disconnect();resizeObserver=null;}
 fitLabels(container);const canvas=container.querySelector('.mm-map-canvas');if(canvas&&typeof ResizeObserver==='function'){resizeObserver=new ResizeObserver(()=>fitLabels(container));resizeObserver.observe(canvas);}
 container.querySelectorAll('[data-map-open]').forEach(el=>{
  el.onclick=event=>{event.preventDefault();event.stopPropagation();open(el.getAttribute('data-map-open'));};
  if(el.tagName.toLowerCase()!=='button')el.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();open(el.getAttribute('data-map-open'));}};
 });
 container.querySelectorAll('[data-map-back]').forEach(el=>el.onclick=event=>{event.preventDefault();event.stopPropagation();open(current()?.parent||ROOT);});
 container.querySelectorAll('[data-map-list]').forEach(el=>el.onclick=event=>{event.preventDefault();event.stopPropagation();showList(el.getAttribute('data-map-list'));});
 container.querySelectorAll('[data-map-zoom]').forEach(el=>el.onclick=event=>{event.preventDefault();event.stopPropagation();zoom(el.getAttribute('data-map-zoom'));});
}
globalThis.MonitorMap={render,open,showList,bind};
})();
