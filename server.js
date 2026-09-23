import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.env.PORT) || 8080;

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function localIps() {
  const ips = [];
  for (const iface of Object.values(networkInterfaces())) {
    for (const addr of iface ?? []) {
      if (addr.family === 'IPv4' && !addr.internal) ips.push(addr.address);
    }
  }
  return ips;
}

const server = http.createServer(async (req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const relativePath = urlPath === '/' ? '/index.html' : urlPath;
  const filePath = normalize(join(ROOT, relativePath));

  // Reject anything that escapes the project folder (e.g. "/../../secret").
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Acesso negado.');
    return;
  }

  try {
    const data = await readFile(filePath);
    const contentType = CONTENT_TYPES[extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Arquivo não encontrado.');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('Calculadora de Cozinha rodando!');
  console.log('');
  console.log(`  Neste computador:  http://localhost:${PORT}`);
  for (const ip of localIps()) {
    console.log(`  No celular (mesma Wi-Fi):  http://${ip}:${PORT}`);
  }
  console.log('');
  console.log('Deixe esta janela aberta enquanto estiver usando a calculadora.');
  console.log('Para fechar, feche esta janela ou pressione Ctrl+C.');
  console.log('');
});
