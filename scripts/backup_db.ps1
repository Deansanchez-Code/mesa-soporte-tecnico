$ErrorActionPreference = "Stop"

# Configuration
$EnvFile = ".env"
$BackupDir = "backups"
$Date = Get-Date -Format "yyyy-MM-dd_HH-mm"
$BackupFile = "$BackupDir\backup_$Date.sql"

# Check if pg_dump is available
if (-not (Get-Command "pg_dump" -ErrorAction SilentlyContinue)) {
    Write-Host "Error: 'pg_dump' is not installed or not in PATH." -ForegroundColor Red
    Write-Host "Please install PostgreSQL Command Line Tools."
    exit 1
}

# Create backup directory
if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
}

# Load Connection String from .env
if (Test-Path $EnvFile) {
    # Simple .env parser
    $content = Get-Content $EnvFile
    foreach ($line in $content) {
        if ($line -match "^POSTGRES_URL_NON_POOLING=(.*)$") {
            $ConnectionString = $matches[1].Trim('"')
        }
    }
}

if (-not $ConnectionString) {
    # Try alternate name or prompt
    Write-Host "Could not find POSTGRES_URL_NON_POOLING in .env" -ForegroundColor Yellow
    $ConnectionString = Read-Host "Please enter your Supabase Connection String (Transaction Mode or Session Mode)"
}

if (-not $ConnectionString) {
    Write-Host "No connection string provided. Exiting." -ForegroundColor Red
    exit 1
}

Write-Host "Starting Backup to $BackupFile..." -ForegroundColor Cyan

try {
    # Execute pg_dump
    # Note: Supabase requires SSL mode usually
    pg_dump "$ConnectionString" -f "$BackupFile" --clean --if-exists --exclude-table-data 'storage.objects' 

    if ($LASTEXITCODE -eq 0) {
        Write-Host "Backup Successful: $BackupFile" -ForegroundColor Green
    } else {
        Write-Host "pg_dump failed with exit code $LASTEXITCODE" -ForegroundColor Red
    }
} catch {
    Write-Host "An error occurred: $_" -ForegroundColor Red
}
