# Demo shared integration contract
Buildless vanilla JS Chinese demo, all data simulated, navy/cyan unified. Runtime global `Demo` (model) and `App` (shell).

## Model `Demo`
- `state`: {schema:1, now: ISO string with +08:00, users:[{id,name,phone,registeredAt,role}], devices:[{id,name,vendor,model,module,region,place,online,run,hz,target,current,voltage,bus,fault,lastSeen}], contracts:[{id,number,deviceId,ownerId,start,end,monthlyCents}], memberships:[{deviceId,userId,rights:{view,control,frequency,reset}}], receipts:[{id,contractId,deviceId,userId,type:'initial'|'renewal',amountCents,paidAt,reference}], commands:[{id,deviceId,userId,action,value,status,createdAt,result}], alarms:[{id,deviceId,kind,severity,message,createdAt,ackAt,resolvedAt}], logs:[{id,actor,action,detail,deviceId,time}], messages:[{id,userId,deviceId,title,body,createdAt,read}], sync:{online:true,localVersion:1,cloudVersion:1,pending:0}, backups:[]}
- default ids `admin`, `chen`, `li`, `wang`; devices `D001` ... `D008`. `chen` owner of D001 expiring 2026-10-25T18:00:00+08:00; `wang` only views D001. One offline one fault one expired and stock devices. Demo clock starts 2026-10-24T10:00:00+08:00. Real browser date does not affect business.
- `device(id)`, `user(id)`, `contract(deviceId)`, `membership(deviceId,userId)`, `lease(deviceId)` returns {key:'stock'|'future'|'active'|'near'|'expired',label,days}; `can(deviceId,userId,action)` returns {ok,reason}; `qr(deviceOrId)`; `parseQR(raw)` returns {vendor,model,module}; `history(deviceId,metric,hours=24)` returns [{time,value}] synthetic consistent demonstration.
- `inventory({raw,name,region,place},actorId='admin')`; `scan(raw,userId)` -> device, adds view only, never first owner; `registerUser({name,phone})`; `registerContract({deviceId,phone,number,start,end,monthlyCents,amountCents,paidAt,reference},actorId='admin')`; `renew({deviceId,end,amountCents,paidAt,reference},actorId='admin')`; `grant(deviceId,userId,rights,actorId='admin')`.
- `command(deviceId,userId,action,value)` validates access, queues command then async simulated receipt; no actual control; action start/stop/frequency/reset; pending -> succeeded/failed/uncertain. `setScenario(deviceId,'offline'|'online'|'fault'|'recover'|'timeout')` simulation; `ackAlarm(id)`; `setNow(iso)` monotonic clock + expiry/reminders (7/3/1 dedupe), `markRead(id)`, `setSyncOnline(bool)`, `syncNow()`, `reset()`; mutation methods persist and dispatch `window` event `demo:change`. Unknown/invalid errors throw human-readable Error.message.
- `exportBackup(password)` async returns encrypted JSON object using WebCrypto (user master only, includes user/contract/membership snapshots + identity index, excludes device telemetry, receipts, commands/alarms). `inspectBackup(object,password)` async validates schema/digest/auth, returns {payload,summary:{users,contracts,memberships},conflicts:[]}; `restoreBackup(inspected)` validates references/conflicts first; must preserve receipts, telemetry, command logs and enforce current expiry. Snapshot browser cache is NOT production local database.

## Shell global `App`
- `ui` object contains {view:'admin'|'monitor'|'mini',page:'overview',userId:'chen',deviceId:'D001',monitorPage:'overview',miniPage:'devices',...}.
- `App.e(value)` HTML escape; `App.icon(name,size=20)` returns inline SVG from bundled lucide if available (fallback safe); `App.money(cents)` CN currency string; `App.time(value)` Beijing time string; `App.badge(label,tone)` returns markup (tone success/warning/danger/muted/info).
- `App.render()` rerenders whole active view; `App.toast(text)`; `App.modal(title,html,onMount?)` inserts accessible dialog body with close, then callback(element); `App.closeModal()`; `App.navigate(view,page,deviceId?)`; `App.download(filename,text,type='application/json')`; `App.openScan({inventory:false,userId:'chen',onDone(device){}})` opens sample/manual/optional camera scanner; `App.openCommand(deviceId,userId,action)` confirm+value+submit; `App.openLease(deviceId)` read-only lease modal. `App.openInventory()` admin phone/desktop inventory form.
- Shared CSS classes: .panel .panel-head .muted .eyebrow .btn (.primary/.danger/.small/.ghost), .badge (+ tone), .metric-grid .metric .table-wrap table .field .fields .toolbar .empty .text-link .status-dot .stack .split .chip .tabs .row .grow .banner .info-list.
- All buttons type=button except form submit. Event handlers attached on rendering to container via onclick/onchange; avoid permanent duplicate listeners. Model event rerender should not reset modal inputs.

## Page modules
`globalThis.Mini = {render(container)}` in mini.js + mini.css .
`globalThis.Monitor = {render(container)}` in monitor.js + monitor.css .
index.html/style.css/app.js provide the shared shell; admin.js provides the management console. demo.js holds the shared model, covered by tests/model.test.cjs.

## Final integration notes (2026-10-24)

- Demo.state.cloudMirror persists confirmed contracts and memberships. Online changes publish automatically; offline local changes queue. Reconnecting with setSyncOnline(true) publishes pending changes.
- Demo.contract(id) returns locally registered contract. Demo.effectiveContract(id) returns the confirmed execution lease. lease and can use effective lease rules; local revocations narrow permissions immediately.
- membership exposes effective rights and a pending flag. Contract registration does not create membership: customer must scan, then administrator grants permissions.
- Model frequency input is a number within 0–50 Hz for this Demo. Real ranges are model-specific.
- Seed user names and phones are fictitious demonstration values; dates use Beijing time.
- Backup encryption, download and import run in the browser. Browser storage is a demonstration substitute for a future local database, not the production system of record.
- Background simulation commands wait about 900 ms for a simulated receipt. Reload converts pending commands to uncertain and never replays starts.


## Monitor V1.1

- Monitor renders the original Hainan display shell and overview. MonitorPages.regional/detail/alarms render the inner pages; MonitorPages.bind owns the page-specific tab and tree actions.
- HainanMapData provides local SVG geometry. No map runtime network request is made. See MAP-SOURCE.md for its source.
- body[data-product-view] selects the display shell. Product navigation handlers bind only #app button[data-view], so modal navigation remains independent.
- Regional rotation is opt-in, changes pages every 10 seconds, and pauses on manual operations. All overview history charts are explicitly synthetic examples.
- Offline detail uses the last known measurement and clips the chart at lastSeen, leaving the remaining time range as missing data.

## Monitor V1.2 map navigation

- ui.monitorPage='map' and ui.monitorMapCode select a node from MapLevels.nodes. Invalid node IDs fall back to the province overview; code 460000 is the province return node.
- MonitorMap provides render/open/bind/showList. Its data-map-open, data-map-back, and data-map-list controls handle map traversal independently of regional device-list controls.
- Nodes contain string code/name/parent/level, paths in the same projection as the province map, bounds and child IDs. A missing child geometry is never inferred.
- Device districtCode is optional display metadata. District membership requires the explicit code and a matching parent city region. Installation-address text is not used to infer location. Unassigned devices remain in city totals only.
- ui.monitorDistrictCode scopes both the region page summary and filtered card list. Selecting a city/all in the region tree clears this district scope; clearing search/status keeps the current geographic scope.
- App.navigate records monitorDetailReturn before entering a monitor detail. A detail opened from a map returns to that same map node.
