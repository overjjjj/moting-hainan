'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'dist'),port=Number(process.env.PORT||4173);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.json':'application/json; charset=utf-8','.ico':'image/x-icon'};
const server=http.createServer((req,res)=>{
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch{res.writeHead(400).end();return}
 const target=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(target!==root&&!target.startsWith(root+path.sep)){res.writeHead(403).end();return}
 fs.stat(target,(err,st)=>{if(err||!st.isFile()){res.writeHead(404).end('Not found');return}res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});if(req.method==='HEAD'){res.end();return}fs.createReadStream(target).pipe(res)})
});
server.on('error',error=>{console.error('Unable to start demo:',error.message);process.exitCode=1});
server.listen(port,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:'+port+'\nDemo data only. Press Ctrl+C to stop.'));

