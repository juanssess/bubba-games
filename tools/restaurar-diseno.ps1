$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$archivePath = Join-Path $projectRoot 'backups/casino-antes-rediseno-2026-09-28.zip'
$targets = @('index.html', 'src/catalog/catalog.js', 'src/ui/carousel.js', 'src/ui/game-card.js', 'src/ui/shell.js')
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::OpenRead($archivePath)
try {
    # Validar todos los originales antes de modificar el primer archivo.
    foreach ($relative in $targets) {
        if (-not $archive.GetEntry($relative)) { throw "Falta $relative en el respaldo." }
    }
    $saved = Join-Path $projectRoot ('backups/rediseno-guardado-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
    New-Item -ItemType Directory -Path $saved | Out-Null
    foreach ($relative in ($targets + 'src/styles/midnight.css')) {
        $source = Join-Path $projectRoot $relative
        if (Test-Path -LiteralPath $source) {
            $copy = Join-Path $saved $relative
            New-Item -ItemType Directory -Force -Path (Split-Path -Parent $copy) | Out-Null
            Copy-Item -LiteralPath $source -Destination $copy
        }
    }
    foreach ($relative in $targets) {
        $destination = [IO.Path]::GetFullPath((Join-Path $projectRoot $relative))
        if (-not $destination.StartsWith($projectRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
            throw 'Ruta fuera del proyecto.'
        }
        [IO.Compression.ZipFileExtensions]::ExtractToFile($archive.GetEntry($relative), $destination, $true)
    }
    Write-Host 'Diseno anterior restaurado. Recarga el casino con Ctrl+F5.'
    Write-Host "El rediseno tambien quedo guardado en: $saved"
} finally { $archive.Dispose() }
