const http = require('http');
const https = require('https');
const url = require('url');
const { ipcMain } = require('electron');

let proxyServer = null;
let mainWindow = null;

// Estadísticas del proxy
const stats = {
  totalRequests: 0,
  imageRequests: 0,
  bytesTransferred: 0
};

// Extensiones de imagen soportadas
const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.ico'];

function isImageUrl(urlString) {
  try {
    const pathname = new URL(urlString).pathname.toLowerCase();
    return imageExtensions.some(ext => pathname.endsWith(ext));
  } catch {
    return false;
  }
}

// Descargar imagen como base64
async function downloadImageAsBase64(imageUrl) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(imageUrl);
    const protocol = urlObj.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 5000
    };
    
    const req = protocol.request(options, (res) => {
      const chunks = [];
      let totalSize = 0;
      
      res.on('data', (chunk) => {
        chunks.push(chunk);
        totalSize += chunk.length;
        
        // Limitar a 5MB
        if (totalSize > 5 * 1024 * 1024) {
          req.destroy();
          reject(new Error('Image too large'));
        }
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          const buffer = Buffer.concat(chunks);
          const base64 = buffer.toString('base64');
          const contentType = res.headers['content-type'] || 'image/jpeg';
          resolve(`data:${contentType};base64,${base64}`);
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
    
    req.end();
  });
}

// Crear servidor proxy
function createProxyServer(port = 8888) {
  proxyServer = http.createServer((clientReq, clientRes) => {
    stats.totalRequests++;
    
    const targetUrl = clientReq.url;
    
    // Log de todas las peticiones
    console.log(`🌐 Proxy: ${clientReq.method} ${targetUrl}`);
    
    // Manejar errores de escritura en el socket del cliente
    clientRes.on('error', (err) => {
      if (err.code === 'ECONNABORTED' || err.code === 'ECONNRESET') {
        // Cliente cerró la conexión - ignorar silenciosamente
        return;
      }
      console.error(`❌ Error en respuesta al cliente: ${err.message}`);
    });
    
    clientReq.on('error', (err) => {
      if (err.code === 'ECONNRESET' || err.code === 'ECONNABORTED') {
        // Cliente cerró la conexión - ignorar silenciosamente
        return;
      }
      console.error(`❌ Error en petición del cliente: ${err.message}`);
    });
    
    // Parsear URL
    let urlObj;
    try {
      urlObj = new URL(targetUrl);
    } catch {
      if (!clientRes.headersSent) {
        clientRes.writeHead(400, { 'Content-Type': 'text/plain' });
        clientRes.end('Invalid URL');
      }
      return;
    }
    
    // Detectar imágenes
    if (isImageUrl(targetUrl)) {
      stats.imageRequests++;
      console.log(`📷 Imagen detectada: ${targetUrl.substring(0, 80)}...`);
      
      // Enviar al renderer para clasificación
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('image-intercepted', { url: targetUrl });
        
        // Descargar y clasificar
        downloadImageAsBase64(targetUrl)
          .then(base64Data => {
            mainWindow.webContents.send('classify-image', {
              url: targetUrl,
              data: base64Data
            });
          })
          .catch(err => {
            console.error(`❌ Error descargando imagen: ${err.message}`);
          });
      }
    }
    
    // Reenviar petición al servidor real
    const protocol = urlObj.protocol === 'https:' ? https : http;
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: clientReq.method,
      headers: clientReq.headers
    };
    
    const proxyReq = protocol.request(options, (proxyRes) => {
      // Verificar si el cliente aún está conectado
      if (clientRes.destroyed || !clientRes.writable) {
        proxyReq.destroy();
        return;
      }
      
      // Enviar respuesta al cliente
      try {
        clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(clientRes);
        
        // Contar bytes
        proxyRes.on('data', (chunk) => {
          stats.bytesTransferred += chunk.length;
        });
      } catch (err) {
        if (err.code !== 'ERR_HTTP_HEADERS_SENT') {
          console.error(`❌ Error enviando respuesta: ${err.message}`);
        }
      }
    });
    
    proxyReq.on('error', (err) => {
      if (err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
        // Error común de red - no spam
        return;
      }
      console.error(`❌ Proxy error: ${err.message}`);
      
      if (!clientRes.headersSent && clientRes.writable) {
        try {
          clientRes.writeHead(502, { 'Content-Type': 'text/plain' });
          clientRes.end('Proxy Error');
        } catch {}
      }
    });
    
    // Reenviar el body de la petición original
    clientReq.pipe(proxyReq).on('error', (err) => {
      if (err.code !== 'ECONNRESET') {
        console.error(`❌ Error pipe: ${err.message}`);
      }
    });
  });
  
  proxyServer.listen(port, '127.0.0.1', () => {
    console.log(`\n🚀 Proxy HTTP iniciado en http://127.0.0.1:${port}`);
    console.log(`\n⚠️  LIMITACIÓN IMPORTANTE:`);
    console.log(`   - El proxy puede interceptar HTTP (raro en 2025)`);
    console.log(`   - HTTPS está cifrado - solo vemos el dominio, no las URLs`);
    console.log(`   - Google Images usa HTTPS - el proxy NO puede ver las imágenes`);
    console.log(`\n💡 SOLUCIÓN: Usa la vista web integrada de la app (WebView)`);
    console.log(`   Ahí SÍ interceptamos todo antes del cifrado\n`);
    console.log(`📋 Configuración del proxy:\n`);
    console.log(`   Dirección: 127.0.0.1`);
    console.log(`   Puerto:    ${port}\n`);
  });
  
  return proxyServer;
}

// Conectar con HTTPS (túnel CONNECT)
function handleConnect(req, clientSocket, head) {
  const { port, hostname } = url.parse(`http://${req.url}`);
  
  // Log de conexiones HTTPS para debug
  console.log(`🔒 HTTPS CONNECT: ${hostname}`);
  
  // Intentar detectar si es un dominio de imágenes conocido
  if (hostname && (hostname.includes('googleusercontent.com') || 
                   hostname.includes('pexels.com') ||
                   hostname.includes('unsplash.com') ||
                   hostname.includes('imgur.com') ||
                   hostname.includes('flickr.com') ||
                   hostname.includes('staticflickr.com'))) {
    console.log(`📸 Posible tráfico de imágenes: ${hostname}`);
  }
  
  // Manejar errores del socket del cliente
  clientSocket.on('error', (err) => {
    if (err.code === 'ECONNRESET' || err.code === 'ECONNABORTED') {
      // Cliente cerró la conexión - ignorar
      return;
    }
    console.error(`❌ Error CONNECT cliente: ${err.message}`);
  });
  
  const serverSocket = require('net').connect(port || 443, hostname, () => {
    try {
      if (!clientSocket.destroyed) {
        clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        serverSocket.write(head);
        serverSocket.pipe(clientSocket);
        clientSocket.pipe(serverSocket);
      }
    } catch (err) {
      console.error(`❌ Error estableciendo túnel: ${err.message}`);
      if (!clientSocket.destroyed) {
        clientSocket.end();
      }
    }
  });
  
  serverSocket.on('error', (err) => {
    // Ignorar errores comunes de red y servicios de publicidad/tracking
    if (err.code === 'ECONNRESET' || 
        err.code === 'ECONNREFUSED' || 
        err.code === 'ENOTFOUND' ||
        err.code === 'EAI_AGAIN' ||
        err.code === 'ETIMEDOUT') {
      // Error común - no mostrar
      return;
    }
    console.error(`❌ CONNECT error: ${err.message}`);
    if (!clientSocket.destroyed) {
      clientSocket.end();
    }
  });
}

function startProxy(window, port = 8888) {
  mainWindow = window;
  
  if (proxyServer) {
    console.log('⚠️ Proxy ya está corriendo');
    return proxyServer;
  }
  
  const server = createProxyServer(port);
  
  // Manejar HTTPS CONNECT
  server.on('connect', handleConnect);
  
  return server;
}

function stopProxy() {
  if (proxyServer) {
    proxyServer.close(() => {
      console.log('🛑 Proxy detenido');
      proxyServer = null;
    });
  }
}

function getProxyStats() {
  return { ...stats };
}

module.exports = {
  startProxy,
  stopProxy,
  getProxyStats
};
