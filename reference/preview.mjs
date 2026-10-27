import http from 'node:http';
import { readFile } from 'node:fs/promises';
const root = new URL('./simplied-iot-monitoring-go-main/web/', import.meta.url);
http.createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (path !== '/' && !/^\/static\/[a-zA-Z0-9_./-]+$/.test(path)) {
    res.writeHead(404); res.end(); return;
  }
  const file = new URL(path === '/' ? 'templates/index.html' : path.slice(1), root);
  if (!file.href.startsWith(root.href)) { res.writeHead(403); res.end(); return; }
  try {
    let data = await readFile(file);
    if (path === '/') data = data.toString().replace('{{define "index"}}', '').replace('{{end}}', '');
    res.setHeader('Content-Type', path === '/' ? 'text/html; charset=utf-8' : path.endsWith('.css') ? 'text/css' : 'text/javascript');
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
}).listen(4186, '127.0.0.1', () => console.log('Reference UI: http://127.0.0.1:4186'));
