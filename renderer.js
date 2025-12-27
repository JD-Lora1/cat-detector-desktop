const { ipcRenderer } = require('electron');

let stats = {
  imagesProcessed: 0,
  catsDetected: 0
};

const detections = [];
const MAX_DETECTIONS = 10;

let model = null;
let modelLoading = false;

// Cargar TensorFlow.js y MobileNet desde CDN
async function loadModel() {
  if (model || modelLoading) return;
  
  modelLoading = true;
  console.log('[MODELO] Cargando TensorFlow.js y CocoSSD...');
  updateStatus('Cargando modelo de IA...', false);
  
  try {
    // Cargar scripts locales
    console.log('[MODELO] Cargando TensorFlow.js local...');
    await loadScript('./tf.min.js');
    console.log('[MODELO] TensorFlow.js cargado');
    
    console.log('[MODELO] Cargando CocoSSD local...');
    await loadScript('./coco-ssd.min.js');
    console.log('[MODELO] CocoSSD cargado');
    
    // Esperar un momento para que los scripts se inicialicen
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Verificar que las librerías estén disponibles
    if (typeof tf === 'undefined') {
      throw new Error('TensorFlow.js no se cargó correctamente');
    }
    
    if (typeof cocoSsd === 'undefined') {
      throw new Error('CocoSSD no se cargó correctamente');
    }
    
    console.log('[MODELO] Inicializando modelo CocoSSD...');
    updateStatus('Inicializando modelo...', false);
    
    // Cargar modelo CocoSSD (detecta gatos entre otras cosas)
    model = await cocoSsd.load();
    
    console.log('[MODELO] Cargado exitosamente');
    console.log('[MODELO] Listo para detectar gatos');
    updateStatus('Modelo cargado - Listo para detectar', true);
    modelLoading = false;
    
  } catch (error) {
    console.error('[ERROR] Cargando modelo:', error);
    console.error('[ERROR] Detalles:', error.message);
    updateStatus('Error cargando modelo - Verifica tu conexion', false);
    modelLoading = false;
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    // Verificar si ya existe
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      console.log('[SCRIPT] Ya cargado:', src);
      resolve();
      return;
    }
    
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    
    script.onload = () => {
      console.log('✓ Script cargado:', src);
      resolve();
    };
    
    script.onerror = (error) => {
      console.error('✗ Error cargando script:', src, error);
      reject(new Error(`Failed to load ${src}`));
    };
    
    document.head.appendChild(script);
    
    // Timeout de 30 segundos
    setTimeout(() => {
      reject(new Error(`Timeout loading ${src}`));
    }, 30000);
  });
}

function updateStatus(text, ready) {
  const statusEl = document.getElementById('status');
  statusEl.textContent = text;
  statusEl.className = ready ? 'status ready' : 'status loading';
}

// Actualizar estadísticas en la UI
function updateStats() {
  document.getElementById('imagesProcessed').textContent = stats.imagesProcessed;
  document.getElementById('catsDetected').textContent = stats.catsDetected;
  
  const rate = stats.imagesProcessed > 0 
    ? ((stats.catsDetected / stats.imagesProcessed) * 100).toFixed(1)
    : 0;
  document.getElementById('successRate').textContent = `${rate}%`;
}

// Agregar detección a la lista
function addDetection(data) {
  detections.unshift(data);
  
  if (detections.length > MAX_DETECTIONS) {
    detections.pop();
  }
  
  renderDetections();
}

// Renderizar lista de detecciones
function renderDetections() {
  const list = document.getElementById('detectionsList');
  
  if (detections.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        Esperando detecciones de gatos...
      </div>
    `;
    return;
  }
  
  list.innerHTML = detections.map(det => {
    const time = new Date(det.timestamp).toLocaleTimeString('es-ES');
    return `
      <div class="detection-item">
        <div class="time">${time}</div>
        <div class="type">🐱 ${det.prediction.className}</div>
        <div class="confidence">Confianza: ${(det.prediction.probability * 100).toFixed(1)}%</div>
        <div class="url" title="${det.url}">${det.url}</div>
      </div>
    `;
  }).join('');
}

// Clasificar imagen
async function classifyImage(imageData, url) {
  if (!model) {
    console.warn('⚠️ Modelo no cargado aún');
    return;
  }
  
  try {
    const img = new Image();
    img.src = imageData;
    
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });
    
    const predictions = await model.detect(img);
    
    console.log(`[DETECCIONES] ${url.substring(0, 50)}:`);
    predictions.forEach(p => {
      console.log(`  - ${p.class}: ${(p.score * 100).toFixed(1)}%`);
    });
    
    // Buscar gatos (CocoSSD usa "cat" como clase)
    const catDetection = predictions.find(pred => 
      pred.class.toLowerCase() === 'cat'
    );
    
    if (catDetection && catDetection.score >= 0.5) {
      const data = {
        prediction: { className: catDetection.class, probability: catDetection.score },
        url: url,
        timestamp: new Date().toISOString()
      };
      
      stats.catsDetected++;
      updateStats();
      addDetection(data);
      
      // Notificar al proceso principal - HAY GATO
      ipcRenderer.send('cat-detected', data);
      
      // Hacer que la ventana parpadee
      const originalTitle = document.title;
      document.title = '[GATO DETECTADO]';
      setTimeout(() => {
        document.title = originalTitle;
      }, 3000);
    } else {
      // NO HAY GATOS - notificar para cerrar blur si está abierto
      ipcRenderer.send('no-cat-detected');
    }
    
  } catch (error) {
    console.error('❌ Error clasificando imagen:', error);
  }
}

// Escuchar eventos del proceso principal
ipcRenderer.on('image-intercepted', (event, data) => {
  console.log('📥 Imagen interceptada:', data.url);
  stats.imagesProcessed++;
  updateStats();
  console.log('📊 Stats actualizadas - Imágenes procesadas:', stats.imagesProcessed);
});

ipcRenderer.on('classify-image', async (event, data) => {
  console.log('🔍 Clasificando imagen:', data.url);
  console.log('   Modelo disponible:', !!model);
  
  if (!model) {
    console.warn('⚠️ Modelo aún no está cargado, esperando...');
    // Intentar cargar si no está cargado
    await loadModel();
  }
  
  await classifyImage(data.imageData, data.url);
});

// Inicializar
console.log('[INICIO] Inicializando renderer...');
updateStats();
console.log('[INICIO] Cargando modelo...');
loadModel().then(() => {
  console.log('[INICIO] Modelo cargado completamente');
}).catch(err => {
  console.error('[ERROR] En carga inicial del modelo:', err);
});

// Configurar navegación
const urlInput = document.getElementById('urlInput');
const goButton = document.getElementById('goButton');
const webview = document.getElementById('webview');
const browserView = document.getElementById('browserView');

function navigateToUrl() {
  let url = urlInput.value.trim();
  
  if (!url) {
    alert('Por favor ingresa una URL');
    return;
  }
  
  // Agregar https:// si no tiene protocolo
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  
  console.log('[NAVEGACION]', url);
  browserView.style.display = 'block';
  webview.src = url;
}

goButton.addEventListener('click', navigateToUrl);

urlInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    navigateToUrl();
  }
});

// Sugerencias rápidas
urlInput.value = 'www.anipedia.net/gatos/';

// Screen capture UI removed; related code guarded in case elements exist
const toggleBtn = document.getElementById('toggleScreenCapture');
const intervalSelect = document.getElementById('captureInterval');
const statusSpan = document.getElementById('captureStatus');

if (toggleBtn && intervalSelect && statusSpan) {
  // keep functions local to this block so they don't run when UI is absent
  let screenCaptureInterval = null;
  let isCapturing = false;

  async function captureAndAnalyzeScreen() {
    try {
      console.log('[CAPTURA] Capturando pantalla...');
      const result = await ipcRenderer.invoke('get-screen-sources');
      if (result.success) {
        stats.imagesProcessed++;
        updateStats();
        await classifyImage(result.thumbnail, 'Captura de Pantalla');
      } else {
        console.error('[ERROR] Capturando pantalla:', result.error);
      }
    } catch (error) {
      console.error('[ERROR] En captura de pantalla:', error);
    }
  }

  function startScreenCapture() {
    if (isCapturing) return;
    const interval = parseInt(intervalSelect.value);
    console.log('[CAPTURA] Iniciando captura cada', interval/1000, 'segundos');
    isCapturing = true;
    toggleBtn.textContent = 'Detener Captura';
    toggleBtn.classList.add('active');
    statusSpan.textContent = 'Activo';
    statusSpan.className = 'status-active';
    intervalSelect.disabled = true;
    captureAndAnalyzeScreen();
    screenCaptureInterval = setInterval(captureAndAnalyzeScreen, interval);
  }

  function stopScreenCapture() {
    if (!isCapturing) return;
    console.log('[CAPTURA] Deteniendo captura de pantalla');
    isCapturing = false;
    toggleBtn.textContent = 'Iniciar Captura';
    toggleBtn.classList.remove('active');
    statusSpan.textContent = 'Inactivo';
    statusSpan.className = 'status-inactive';
    intervalSelect.disabled = false;
    if (screenCaptureInterval) {
      clearInterval(screenCaptureInterval);
      screenCaptureInterval = null;
    }
  }

  toggleBtn.addEventListener('click', () => {
    if (isCapturing) stopScreenCapture(); else startScreenCapture();
  });

  window.addEventListener('beforeunload', () => {
    stopScreenCapture();
  });
}

// === NUEVO ENFOQUE: Filtrar imágenes en el DOM ===
async function filterAndBlurImages() {
  await loadModel();
  const images = Array.from(document.querySelectorAll('img'));
  for (const img of images) {
    if (img.dataset.catChecked) continue;
    img.dataset.catChecked = 'true';
    try {
      // Esperar a que la imagen cargue
      if (!img.complete || img.naturalWidth === 0) {
        await new Promise(resolve => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      }
      const predictions = await model.detect(img);
      const isCat = predictions.some(pred => pred.class === 'cat' && pred.score > 0.5);
      if (!isCat) {
        img.style.filter = 'blur(12px)';
        img.title = 'Imagen filtrada: no es un gato';
      } else {
        img.style.filter = '';
        img.title = '¡Gato detectado!';
      }
    } catch (e) {
      // Si hay error, no aplicar blur
      img.style.filter = '';
    }
  }
}

// Observar cambios en el DOM para nuevas imágenes
const observer = new MutationObserver(() => {
  filterAndBlurImages();
});
observer.observe(document.body, { childList: true, subtree: true });

// Ejecutar al cargar el modelo y la página
window.addEventListener('DOMContentLoaded', () => {
  filterAndBlurImages();
});

