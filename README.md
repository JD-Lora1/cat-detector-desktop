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

## Próximos pasos

El proxy HTTP ya está implementado! ✅

### Usar con Todo el Sistema:
1. `npm start` - Inicia la app y el proxy
2. `.\configure-proxy.ps1 -Enable` - Habilita proxy del sistema
3. Usa cualquier navegador o aplicación
4. `.\configure-proxy.ps1 -Disable` - Desactiva cuando termines

Ver [PROXY-GUIDE.md](./PROXY-GUIDE.md) para más detalles.
