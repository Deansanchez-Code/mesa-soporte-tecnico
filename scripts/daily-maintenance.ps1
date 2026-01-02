$ErrorActionPreference = "Stop"

$PROJECT_ROOT = "D:\mesa-soporte-tecnico"
$LOG_FILE = "$PROJECT_ROOT\logs\maintenance.log"

# Asegurar carpeta de logs
if (!(Test-Path "$PROJECT_ROOT\logs")) {
    New-Item -ItemType Directory -Force -Path "$PROJECT_ROOT\logs"
}

function Log-Message {
    param ([string]$Message)
    $TimeStamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$TimeStamp - $Message" | Out-File -FilePath $LOG_FILE -Append -Encoding UTF8
    Write-Host "$TimeStamp - $Message"
}

Log-Message "🚀 Iniciando mantenimiento programado..."

try {
    Set-Location $PROJECT_ROOT
    
    # 1. Ejecutar Backup de Base de Datos
    Log-Message "📦 Ejecutando backup de base de datos..."
    # Usamos cmd /c para asegurar que pnpm se resuelva correctamente en el path
    cmd /c "pnpm run db:dump" 2>&1 | Out-String | ForEach-Object { Log-Message "   $_" }
    
    # 2. Sincronizar Tipos
    Log-Message "🔄 Ejecutando sincronización de tipos..."
    cmd /c "pnpm run types:sync" 2>&1 | Out-String | ForEach-Object { Log-Message "   $_" }

    Log-Message "✅ Mantenimiento finalizado exitosamente."
}
catch {
    Log-Message "❌ ERROR CRÍTICO durante el mantenimiento: $_"
    exit 1
}
