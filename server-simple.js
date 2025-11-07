// Servidor HTTP simples e direto - GARANTIDO para funcionar
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8000;
const BASE_DIR = __dirname || process.cwd();

console.log('\n🚀 Iniciando servidor...');
console.log(`📁 Diretório base: ${BASE_DIR}`);
console.log(`🌐 Porta: ${PORT}\n`);

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.csv': 'text/csv; charset=utf-8',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  // Trata OPTIONS para CORS
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  let url = req.url.split('?')[0];
  
  if (url === '/' || url === '') {
    url = '/index.html';
  }

  const filePath = path.join(BASE_DIR, url);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  // Verifica se arquivo existe antes de tentar ler
  fs.access(filePath, fs.constants.F_OK, (accessErr) => {
    if (accessErr) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found: ' + url);
      console.log(`❌ 404: ${url}`);
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('500 Internal Server Error');
        console.log(`❌ 500: ${url} - ${err.message}`);
        return;
      }

      // Headers para permitir CORS e módulos ES6
      const headers = {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      };
      
      res.writeHead(200, headers);
      res.end(data);
      console.log(`✅ 200: ${url}`);
    });
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('\n✅✅✅ SERVIDOR RODANDO! ✅✅✅\n');
  console.log(`📍 Acesse: http://localhost:${PORT}`);
  console.log(`📍 Ou: http://127.0.0.1:${PORT}`);
  console.log('\nPressione Ctrl+C para parar\n');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Porta ${PORT} já está em uso!\n`);
    console.log('Execute: npm run kill-port');
    console.log('Ou use outra porta: PORT=8001 node server-simple.js\n');
  } else {
    console.error('\n❌ Erro:', err.message);
  }
  process.exit(1);
});

