import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {attachLobbyServer} from './lobby-server.mjs';
const root=path.resolve(process.argv[2]||'dist'),port=Number(process.argv[3]||5192);
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.glb':'model/gltf-binary','.wasm':'application/wasm'};
const server=http.createServer((req,res)=>{
 if(req.url==='/health'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:true,lobbies:true}));return;}
 let filename;try{filename=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));}catch{res.writeHead(400).end();return;}
 if(filename!==root&&!filename.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 if(fs.existsSync(filename)&&fs.statSync(filename).isDirectory())filename=path.join(filename,'index.html');
 if(!fs.existsSync(filename)||!fs.statSync(filename).isFile()){res.writeHead(404).end();return;}
 res.setHeader('Content-Type',mime[path.extname(filename)]||'application/octet-stream');res.setHeader('Cache-Control','no-cache');
 fs.createReadStream(filename).on('error',()=>res.destroy()).pipe(res);
});attachLobbyServer(server);
server.listen(port,process.env.GAME_HOST||'127.0.0.1',()=>console.log('Game and lobbies: http://127.0.0.1:'+port));
