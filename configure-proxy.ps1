# Script para configurar el proxy del sistema en Windows
# Ejecutar como Administrador

param(
    [switch]$Enable,
    [switch]$Disable,
    [string]$ProxyServer = "127.0.0.1:8888"
)

function Enable-SystemProxy {
    Write-Host "🔧 Configurando proxy del sistema..." -ForegroundColor Cyan
    
    # Configurar proxy en el registro de Windows
    $regPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings"
    
    Set-ItemProperty -Path $regPath -Name ProxyEnable -Value 1
    Set-ItemProperty -Path $regPath -Name ProxyServer -Value $ProxyServer
    Set-ItemProperty -Path $regPath -Name ProxyOverride -Value "<local>"
    
    Write-Host "✅ Proxy habilitado: $ProxyServer" -ForegroundColor Green
    Write-Host "📝 Las aplicaciones ahora usarán el proxy para tráfico HTTP/HTTPS" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "⚠️  IMPORTANTE: Para desactivar el proxy cuando termines, ejecuta:" -ForegroundColor Yellow
    Write-Host "   .\configure-proxy.ps1 -Disable" -ForegroundColor White
}

function Disable-SystemProxy {
    Write-Host "🔧 Deshabilitando proxy del sistema..." -ForegroundColor Cyan
    
    $regPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings"
    
    Set-ItemProperty -Path $regPath -Name ProxyEnable -Value 0
    
    Write-Host "✅ Proxy deshabilitado" -ForegroundColor Green
    Write-Host "📝 El tráfico ahora va directamente a Internet" -ForegroundColor Yellow
}

function Show-ProxyStatus {
    $regPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings"
    $enabled = Get-ItemProperty -Path $regPath -Name ProxyEnable | Select-Object -ExpandProperty ProxyEnable
    $server = Get-ItemProperty -Path $regPath -Name ProxyServer -ErrorAction SilentlyContinue | Select-Object -ExpandProperty ProxyServer
    
    Write-Host ""
    Write-Host "📊 Estado del Proxy del Sistema" -ForegroundColor Cyan
    Write-Host "================================" -ForegroundColor Cyan
    
    if ($enabled -eq 1) {
        Write-Host "Estado:   " -NoNewline; Write-Host "HABILITADO ✅" -ForegroundColor Green
        Write-Host "Servidor: $server" -ForegroundColor White
    } else {
        Write-Host "Estado:   " -NoNewline; Write-Host "DESHABILITADO ❌" -ForegroundColor Red
    }
    Write-Host ""
}

# Main
if ($Enable) {
    Enable-SystemProxy
} elseif ($Disable) {
    Disable-SystemProxy
} else {
    Write-Host ""
    Write-Host "🌐 Configurador de Proxy del Sistema" -ForegroundColor Cyan
    Write-Host "====================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Uso:" -ForegroundColor Yellow
    Write-Host "  .\configure-proxy.ps1 -Enable          # Habilitar proxy (127.0.0.1:8888)"
    Write-Host "  .\configure-proxy.ps1 -Disable         # Deshabilitar proxy"
    Write-Host "  .\configure-proxy.ps1                  # Ver estado actual"
    Write-Host ""
    
    Show-ProxyStatus
    
    Write-Host "💡 Tip: El proxy debe estar corriendo antes de habilitarlo" -ForegroundColor Yellow
    Write-Host "   Inicia la app con: npm start" -ForegroundColor White
    Write-Host ""
}
