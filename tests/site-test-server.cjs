const { createServer } = require('node:http');
const { createReadStream } = require('node:fs');
const path = require('node:path');

function createSiteServer(handler) {
  return createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (!pathname.endsWith('/workspace.css')) return handler(req, res);
    const stream = createReadStream(path.resolve(__dirname, '../workspace.css'));
    stream.once('open', () => {
      res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8' });
      stream.pipe(res);
    });
    stream.once('error', () => res.writeHead(500).end('Run npm run build:css'));
  });
}

module.exports = { createSiteServer };
