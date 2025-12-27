const { app, BrowserWindow, session, Notification, ipcMain, desktopCapturer, screen } = require('electron');
const path = require('path');
const https = require('https');
const http = require('http');

let mainWindow;
let lastCatDetectionState = false; // Evitar intermitencia
const processedUrls = new Set();

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webviewTag: true
    }
  });

  mainWindow.loadFile('index.html');
  // No inyectamos observer en la ventana principal; usamos webRequest onCompleted

  // Abrir DevTools para ver logs
  mainWindow.webContents.openDevTools();
}

async function downloadImage(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    
    const timeout = setTimeout(() => {
      reject(new Error('Timeout'));
    }, 5000);
    
    client.get(url, (res) => {
      clearTimeout(timeout);
      
      if (res.statusCode !== 200) {
        reject(new Error(`Status ${res.statusCode}`));
        return;
      }
      
      const chunks = [];
      let totalSize = 0;
      const maxSize = 5 * 1024 * 1024; // 5MB max
      
      res.on('data', (chunk) => {
        totalSize += chunk.length;
        if (totalSize > maxSize) {
          res.destroy();
          reject(new Error('Image too large'));
          return;
        }
        chunks.push(chunk);
      });
      
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve(buffer.toString('base64'));
      });
      
      res.on('error', reject);
    }).on('error', reject);
  });
}

function isImageUrl(url) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();
    return pathname.match(/\.(jpg|jpeg|png|gif|webp)$/i) || 
           urlObj.searchParams.get('format') === 'image';
  } catch {
    return false;
  }
}

function showCatNotification(prediction, url) {
  const notification = new Notification({
    title: '🐱 ¡Gato Detectado!',
    body: `${prediction.className}\nConfianza: ${(prediction.probability * 100).toFixed(1)}%`,
    silent: false
  });
  
  notification.show();
}

async function interceptImageRequest(details) {
  const url = details.url;
  
  if (!isImageUrl(url)) return;
  if (processedUrls.has(url)) return;
  
  processedUrls.add(url);
  
  if (processedUrls.size > 500) {
    const firstKey = processedUrls.keys().next().value;
    processedUrls.delete(firstKey);
  }
  
  console.log('[IMAGEN]', url.substring(0, 80) + '...');
  
  if (mainWindow) {
    mainWindow.webContents.send('image-intercepted', { url });
  }
  
  try {
    const imageBase64 = await downloadImage(url);
    
    if (mainWindow) {
      mainWindow.webContents.send('classify-image', { 
        url, 
        imageData: `data:image/jpeg;base64,${imageBase64}` 
      });
    }
    
  } catch (error) {
    console.error(`❌ Error descargando ${url}:`, error.message);
  }
}

// Escuchar clasificación desde el renderer
ipcMain.on('cat-detected', (event, data) => {
  // Solo mostrar blur si el estado cambió (de NO gato a SÍ gato)
  if (!lastCatDetectionState) {
    console.log('\n[GATO DETECTADO]');
    console.log('  Tipo:', data.prediction.className);
    console.log('  Confianza:', (data.prediction.probability * 100).toFixed(1) + '%');
    console.log('  Fuente:', data.url);
    console.log('');
    
    // Mostrar ventana blur
    lastCatDetectionState = true;
  }
  // Si ya estaba detectado, no hacer nada (evitar intermitencia)
});

// Escuchar cuando NO hay gatos para cerrar el blur
ipcMain.on('no-cat-detected', () => {
  // Solo cerrar si el estado cambió (de SÍ gato a NO gato)
  if (lastCatDetectionState) {
    console.log('[BLUR] Cerrando - no hay gatos en pantalla');
    lastCatDetectionState = false;
  }
  // Si ya estaba sin gato, no hacer nada
});

// Cerrar ventana blur
ipcMain.on('close-blur', () => {
});

// Manejar solicitud de captura de pantalla
ipcMain.handle('get-screen-sources', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 }
    });
    
    // Devolver la primera pantalla (pantalla principal)
    if (sources.length > 0) {
      return {
        success: true,
        thumbnail: sources[0].thumbnail.toDataURL()
      };
    }
    
    return { success: false, error: 'No se encontraron pantallas' };
  } catch (error) {
    console.error('Error capturando pantalla:', error);
    return { success: false, error: error.message };
  }
});

// Classification is handled in the renderer process; main doesn't classify images anymore.

app.whenReady().then(async () => {
  console.log('[INICIO] Cat Detector Desktop');
  
  await createWindow();
  
  console.log('[LISTO] Interceptando trafico de red\n');
  
  session.defaultSession.webRequest.onCompleted(
    { urls: ['*://*/*'] },
    interceptImageRequest
  );

  // No onBeforeRequest processing here; renderer will apply blur via DOM.
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Cerrar ventana blur si existe
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
