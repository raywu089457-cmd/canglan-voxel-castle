'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const root=__dirname,port=Number(process.env.PORT||4173),host=process.env.HOST||'127.0.0.1';
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.md':'text/plain; charset=utf-8','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon'};
const server=http.createServer((req,res)=>{try{const requested=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(requested==='/favicon.ico'){res.writeHead(204).end();return;}const file=path.resolve(root,'.'+(requested==='/'?'/index.html':requested));if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end('Not found');return;}res.writeHead(200,{'Content-Type':mime[path.extname(file).toLowerCase()]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(data);});}catch(_){res.writeHead(400).end('Bad request');}});
server.on('error',error=>{console.error('Castle game failed to start:',error.code==='EADDRINUSE'?'port '+port+' is already in use - set PORT to a free port':'');
  console.error(error.message);process.exit(1);});
server.listen(port,host,()=>{
  const lines=['Castle game: http://127.0.0.1:'+port];
  if(host==='0.0.0.0'){for(const list of Object.values(os.networkInterfaces()))for(const net of list||[])if(net.family==='IPv4'&&!net.internal)lines.push('  on this network: http://'+net.address+':'+port);}
  else lines.push('  (bound to '+host+'; set HOST=0.0.0.0 to expose it on the LAN)');
  console.log(lines.join('\n'));
});
