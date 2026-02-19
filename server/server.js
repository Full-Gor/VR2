/* ===== SERVEUR LOCAL CASQUE VR ===== */
/* Sert les fichiers statiques + API pour explorer les fichiers du système */
/* HTTPS activé automatiquement pour le gyroscope VR sur mobile */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { execSync } = require('child_process');

const PORT = 9090;
const HTTPS_PORT = 9443;
const STATIC_DIR = path.join(__dirname, '..');
const HOME_DIR = require('os').homedir();

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain'
};

// === Génération automatique du certificat HTTPS ===
function ensureCerts() {
  const keyPath = path.join(__dirname, 'key.pem');
  const certPath = path.join(__dirname, 'cert.pem');

  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    return { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
  }

  try {
    console.log('Generation du certificat HTTPS auto-signe...');
    const localIP = getLocalIP();
    // Certificat avec SAN pour localhost + IP locale
    execSync(
      `openssl req -x509 -newkey rsa:2048 ` +
      `-keyout "${keyPath}" -out "${certPath}" ` +
      `-days 365 -nodes ` +
      `-subj "/CN=casque-vr" ` +
      `-addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:${localIP}"`,
      { stdio: 'pipe' }
    );
    console.log('Certificat genere OK');
    return { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
  } catch (e) {
    // OpenSSL sans -addext (anciennes versions)
    try {
      execSync(
        `openssl req -x509 -newkey rsa:2048 ` +
        `-keyout "${keyPath}" -out "${certPath}" ` +
        `-days 365 -nodes ` +
        `-subj "/CN=casque-vr"`,
        { stdio: 'pipe' }
      );
      console.log('Certificat genere OK (sans SAN)');
      return { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
    } catch (e2) {
      console.warn('OpenSSL non disponible, HTTPS desactive');
      console.warn('Le gyroscope VR necessite HTTPS sur mobile !');
      return null;
    }
  }
}

// === Signaling WebRTC pour screen sharing ===
var signalStore = { pc: [], vr: [] };

// === Handler de requêtes (partagé HTTP + HTTPS) ===
function handleRequest(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // API Routes
  if (pathname === '/api/files') {
    handleFileList(parsedUrl.query, res);
  } else if (pathname === '/api/media') {
    handleMediaStream(parsedUrl.query, req, res);
  } else if (pathname === '/api/proxy') {
    handleWebProxy(parsedUrl.query, res);
  } else if (pathname === '/api/signal') {
    if (req.method === 'POST') {
      handleSignalPost(req, res);
    } else {
      handleSignalGet(parsedUrl.query, res);
    }
  } else if (pathname === '/api/signal/reset') {
    signalStore = { pc: [], vr: [] };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{"ok":true}');
  } else {
    serveStatic(pathname, res);
  }
}

// Lister les fichiers d'un répertoire
function handleFileList(query, res) {
  const requestedPath = query.path || '/';

  const safePath = path.resolve(HOME_DIR, requestedPath.replace(/^\/+/, ''));
  if (!safePath.startsWith(HOME_DIR)) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Acces refuse' }));
    return;
  }

  fs.readdir(safePath, { withFileTypes: true }, (err, entries) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Repertoire introuvable' }));
      return;
    }

    const files = entries
      .filter(e => !e.name.startsWith('.'))
      .map(entry => {
        const fullPath = path.join(safePath, entry.name);
        let size = '';
        let type = 'file';

        if (entry.isDirectory()) {
          type = 'directory';
        } else {
          try {
            const stats = fs.statSync(fullPath);
            size = formatSize(stats.size);
            type = getFileType(entry.name);
          } catch (e) { /* ignore */ }
        }

        return { name: entry.name, type, size };
      })
      .sort((a, b) => {
        if (a.type === 'directory' && b.type !== 'directory') return -1;
        if (a.type !== 'directory' && b.type === 'directory') return 1;
        return a.name.localeCompare(b.name);
      });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ path: requestedPath, files }));
  });
}

// Streamer un fichier media
function handleMediaStream(query, req, res) {
  const requestedPath = query.path || '';
  const safePath = path.resolve(HOME_DIR, requestedPath.replace(/^\/+/, ''));

  if (!safePath.startsWith(HOME_DIR)) {
    res.writeHead(403);
    res.end('Acces refuse');
    return;
  }

  fs.stat(safePath, (err, stats) => {
    if (err) {
      res.writeHead(404);
      res.end('Fichier introuvable');
      return;
    }

    const ext = path.extname(safePath);
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
    const fileSize = stats.size;
    const range = req.headers.range;

    if (range) {
      // Support Range requests pour le streaming vidéo
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': mimeType
      });

      fs.createReadStream(safePath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Type': mimeType,
        'Content-Length': fileSize,
        'Accept-Ranges': 'bytes'
      });

      fs.createReadStream(safePath).pipe(res);
    }
  });
}

// Fetch une URL avec suivi des redirections (max 5)
function fetchUrl(targetUrl, callback, maxRedirects) {
  if (maxRedirects === undefined) maxRedirects = 5;
  if (maxRedirects <= 0) {
    callback(new Error('Trop de redirections'));
    return;
  }

  const lib = targetUrl.startsWith('https') ? https : http;

  lib.get(targetUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8'
    }
  }, (proxyRes) => {
    if ([301, 302, 303, 307, 308].includes(proxyRes.statusCode) && proxyRes.headers.location) {
      let redirectUrl = proxyRes.headers.location;
      if (redirectUrl.startsWith('/')) {
        const parsed = new URL(targetUrl);
        redirectUrl = parsed.origin + redirectUrl;
      }
      proxyRes.resume();
      fetchUrl(redirectUrl, callback, maxRedirects - 1);
      return;
    }

    let data = '';
    proxyRes.on('data', chunk => data += chunk);
    proxyRes.on('end', () => {
      callback(null, data);
    });
  }).on('error', (err) => {
    callback(err);
  });
}

// Proxy web
function handleWebProxy(query, res) {
  const targetUrl = query.url;
  if (!targetUrl) {
    res.writeHead(400);
    res.end('URL manquante');
    return;
  }

  fetchUrl(targetUrl, (err, data) => {
    if (err) {
      res.writeHead(502);
      res.end('Erreur de connexion: ' + err.message);
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(data);
  });
}

// WebRTC signaling - stocker un message pour l'autre pair
function handleSignalPost(req, res) {
  var body = '';
  req.on('data', function (chunk) { body += chunk; });
  req.on('end', function () {
    try {
      var data = JSON.parse(body);
      var target = data.target; // 'pc' ou 'vr'
      if (signalStore[target]) {
        signalStore[target].push(data);
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    } catch (e) {
      res.writeHead(400);
      res.end('Bad request');
    }
  });
}

// WebRTC signaling - récupérer les messages en attente
function handleSignalGet(query, res) {
  var role = query.role; // 'pc' ou 'vr'
  var messages = signalStore[role] || [];
  signalStore[role] = [];
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(messages));
}

// Servir fichiers statiques
function serveStatic(pathname, res) {
  let filePath = path.join(STATIC_DIR, pathname === '/' ? 'index.html' : pathname);
  filePath = path.resolve(filePath);

  if (!filePath.startsWith(STATIC_DIR)) {
    res.writeHead(403);
    res.end('Acces refuse');
    return;
  }

  const ext = path.extname(filePath);
  const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': mimeType });
    res.end(data);
  });
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

function getFileType(name) {
  const ext = name.split('.').pop().toLowerCase();
  const types = {
    mp4: 'video', mkv: 'video', avi: 'video', webm: 'video',
    mp3: 'audio', wav: 'audio', flac: 'audio', ogg: 'audio',
    jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image',
    txt: 'text', pdf: 'document', doc: 'document', docx: 'document'
  };
  return types[ext] || 'file';
}

function getLocalIP() {
  const interfaces = require('os').networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// === Démarrage des serveurs ===

// Serveur HTTP (toujours actif)
const httpServer = http.createServer(handleRequest);
httpServer.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP();
  console.log(`\n  Casque VR Server`);
  console.log(`   HTTP:    http://localhost:${PORT}`);
  console.log(`   HTTP:    http://${ip}:${PORT}`);
});

// Serveur HTTPS (pour le gyroscope VR)
const certs = ensureCerts();
if (certs) {
  const httpsServer = https.createServer(certs, handleRequest);
  httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
    const ip = getLocalIP();
    console.log(`\n   HTTPS:   https://localhost:${HTTPS_PORT}`);
    console.log(`   HTTPS:   https://${ip}:${HTTPS_PORT}  <-- Utiliser cette URL pour le VR !`);
    console.log(`\n   IMPORTANT: Accepter le certificat auto-signe dans le navigateur`);
    console.log(`   (cliquer "Avance" > "Continuer" lors de l'avertissement)\n`);
  });
} else {
  console.log(`\n   ATTENTION: HTTPS non disponible`);
  console.log(`   Le gyroscope VR ne fonctionnera pas sur mobile via HTTP`);
  console.log(`   Installer OpenSSL pour activer HTTPS\n`);
}
