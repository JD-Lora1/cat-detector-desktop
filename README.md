# Cat Detector Desktop

Aplicación de escritorio que detecta imágenes de gatos en la propia ventana interna (webview) de la app Electron usando TensorFlow.js. La detección se realiza en el proceso renderer sobre las imágenes que se muestran dentro del `webview` integrado.

## Características

- Monitoreo en la app: analiza las imágenes que carga el `webview` interno (no monitoriza todo el tráfico del sistema por defecto).
- Detección con IA: utiliza CocoSSD (TensorFlow.js) para identificar la clase `cat`.
- Navegador integrado: el `webview` es el ámbito de inspección y de aplicación del blur.
- Notificaciones y estadísticas en vivo: muestra alertas y mantiene un contador de imágenes procesadas y gatos detectados.

## Instalación

```bash
cd v-light/cat-detector-desktop
npm install
```

Nota: `electron` y las dependencias se instalan localmente. TensorFlow.js y CocoSSD se cargan desde los scripts incluidos en `renderer.js` (archivos locales como `tf.min.js` y `coco-ssd.min.js`).

## Uso

```bash
npm start
```

La aplicación abre una ventana con un dashboard, un `webview` para navegar y una lista de detecciones.

## Cómo funciona

1. Inspección en renderer: la lógica del renderer analiza imágenes que aparecen en el `webview`.
2. Clasificación: `coco-ssd` (TensorFlow.js) clasifica cada imagen mostrada.
3. Acción: si la imagen no contiene un gato, el renderer aplica un filtro CSS `blur` sobre la imagen; si contiene un gato, se muestra una notificación y se registra la detección.

## Notas

- Esta versión no activa un proxy global por defecto. Si necesitas interceptar todo el tráfico del sistema (Chrome, Firefox, etc.), puedo reintroducir esa opción como feature opcional y documentar su uso.
- Para mejorar rendimiento, la app procesa principalmente imágenes visibles y evita reprocesar imágenes ya analizadas.

## Próximos pasos (opcional)

- Reimplementar proxy global como opción configurable.
- Añadir controles para ajustar umbral de detección y nivel de blur.
# Cat Detector Desktop

Aplicación de escritorio que monitorea el tráfico de red y detecta imágenes de gatos usando TensorFlow.js.

## Características

- **Monitoreo en tiempo real**: Intercepta todas las imágenes del tráfico de red
- **Detección con IA**: Usa CocoSSD para detectar gatos
- **Proxy HTTP integrado**: Monitorea TODO el tráfico del sistema (Chrome, Firefox, Edge, etc.)
- **Navegador integrado**: Webview interno de Electron
- **Notificaciones**: Muestra popup cuando detecta un gato
- **Estadísticas en vivo**: Contador de imágenes procesadas y gatos detectados
- **Interfaz visual**: Dashboard con detecciones recientes
- **Sin compilación nativa**: Usa TensorFlow.js en el navegador (sin necesidad de Visual Studio)

## Instalación

```bash
cd cat-detector-desktop
npm install
```

**Nota**: Solo instala Electron (~150MB), sin dependencias nativas. TensorFlow.js se carga desde CDN.

## Uso

```bash
npm start
```

La aplicación abrirá una ventana con:
1. **Dashboard principal**: Muestra estadísticas en tiempo real
2. **Lista de detecciones**: Historial de los últimos 10 gatos detectados
3. **Notificaciones del sistema**: Popup cuando detecta un gato

## Cómo funciona

### Modo 1: Navegador Integrado (Por defecto)
1. **Interceptación**: Usa `session.webRequest.onCompleted` de Electron
2. **Filtrado**: Identifica URLs de imágenes (jpg, png, gif, webp)
3. **Clasificación**: Usa CocoSSD para detectar gatos
4. **Notificación**: Muestra popup cuando encuentra un gato

### Modo 2: Proxy HTTP (Todo el Sistema)
1. **Proxy local**: Servidor HTTP en `127.0.0.1:8888`
2. **Interceptación global**: Captura tráfico de TODAS las aplicaciones
3. **Detección de imágenes**: Analiza URLs de peticiones HTTP/HTTPS
4. **Clasificación**: Descarga y clasifica imágenes con CocoSSD
5. **Notificación**: Alerta cuando detecta gatos

## Usar con Otros Navegadores

Para monitorear Chrome, Firefox, Edge y otras aplicaciones:

### Opción 1: Script Automático (Recomendado)
```powershell
# Habilitar proxy del sistema
.\configure-proxy.ps1 -Enable

# Cuando termines
.\configure-proxy.ps1 -Disable
```

### Opción 2: Configuración Manual
Ver [PROXY-GUIDE.md](./PROXY-GUIDE.md) para instrucciones detalladas de configuración por navegador.

**Importante**: El proxy debe estar corriendo (`npm start`) antes de habilitarlo.

## Tecnologías

- **Electron**: Framework para aplicaciones desktop
- **TensorFlow.js**: Motor de ML en el navegador
- **CocoSSD**: Modelo de detección de objetos (incluye gatos)
- **Proxy HTTP**: Servidor proxy para interceptar tráfico del sistema
- **Native Notifications**: API nativa de notificaciones del SO

## Modelos detectables

CocoSSD puede detectar 80 clases de objetos, incluyendo:
- `cat` (gato)

El modelo está optimizado para detección de objetos en tiempo real.

## Configuración

### Ajustar umbral de detección
Edita `renderer.js`:
```javascript
if (catDetection && catDetection.score >= 0.5) {
  // Cambiar 0.5 a otro valor (0.3 = más sensible, 0.7 = más estricto)
}
```

### Cambiar puerto del proxy
Edita `main.js`:
```javascript
startProxy(mainWindow, 8888);  // Cambiar 8888 a otro puerto
```

Luego actualiza el script de configuración:
```powershell
.\configure-proxy.ps1 -Enable -ProxyServer "127.0.0.1:NUEVO_PUERTO"
```

## Notas

- **Navegador integrado**: Monitorea el webview interno de Electron automáticamente
- **Proxy HTTP**: Opcional, permite monitorear Chrome, Firefox, Edge, y otras aplicaciones
- **HTTPS**: El proxy maneja túneles CONNECT (ve URLs pero no contenido cifrado)
- **Rendimiento**: El proxy agrega ~10-50ms de latencia por petición
- **Privacidad**: Todo el procesamiento es local, nada se envía a servidores externos
- Las imágenes <5KB son ignoradas para optimizar rendimiento
- Máximo 1000 URLs únicas en caché para evitar procesamiento duplicado

## Importante

**No olvides desactivar el proxy cuando termines**:
```powershell
.\configure-proxy.ps1 -Disable
```

Si el proxy queda habilitado y cierras la app, no podrás navegar hasta que lo desactives.

