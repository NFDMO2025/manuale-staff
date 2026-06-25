# Carica il progetto sulla VM Oracle da Windows
# Uso: .\deploy\upload-to-oracle.ps1 -KeyPath "C:\path\chiave.key" -ServerIp "123.45.67.89"

param(
    [Parameter(Mandatory = $true)]
    [string]$KeyPath,
    [Parameter(Mandatory = $true)]
    [string]$ServerIp,
    [string]$User = "ubuntu"
)

$ProjectRoot = Split-Path $PSScriptRoot -Parent
if (-not (Test-Path "$ProjectRoot\package.json")) {
    Write-Error "package.json non trovato in $ProjectRoot"
    exit 1
}

Write-Host "Progetto: $ProjectRoot"
Write-Host "Destinazione: ${User}@${ServerIp}:/tmp/manuale-staff-upload/"

$exclude = @("node_modules", ".git", "data")
$tempDir = Join-Path $env:TEMP "manuale-staff-upload"
if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force }
New-Item -ItemType Directory -Path $tempDir | Out-Null

Get-ChildItem $ProjectRoot | Where-Object { $exclude -notcontains $_.Name } | ForEach-Object {
    Copy-Item $_.FullName -Destination $tempDir -Recurse -Force
}

scp -i $KeyPath -r "$tempDir\*" "${User}@${ServerIp}:/tmp/manuale-staff-upload/"

Write-Host ""
Write-Host "File caricati. Ora connettiti via SSH ed esegui:"
Write-Host ""
Write-Host "  ssh -i `"$KeyPath`" ${User}@${ServerIp}"
Write-Host "  sudo mkdir -p /opt/manuale-staff"
Write-Host "  sudo cp -r /tmp/manuale-staff-upload/* /opt/manuale-staff/"
Write-Host "  sudo chown -R ubuntu:ubuntu /opt/manuale-staff"
Write-Host "  cd /opt/manuale-staff && sudo bash deploy/setup-oracle.sh"
Write-Host ""

Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue
