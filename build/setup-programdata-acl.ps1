# Radio Ibiza Player — ProgramData partilhado (modo TI per-machine).
# Concede FullControl ao Built-in Users (BU, SID S-1-5-32-545) + Modify a Authenticated Users.
# Equivalente funcional a NSIS AccessControl::GrantOnFolder "(BU)" "FullAccess".
$ErrorActionPreference = 'SilentlyContinue'

function Write-Utf8NoBom {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Content
  )
  [System.IO.File]::WriteAllText($Path, $Content, [System.Text.UTF8Encoding]::new($false))
}

$p = Join-Path $env:ProgramData 'RadioIbizaPlayer'
$sub = @('chromium-profile', 'chromium-cache', 'pending-executions', 'audio')
New-Item -ItemType Directory -Force -Path $p | Out-Null
foreach ($s in $sub) { New-Item -ItemType Directory -Force -Path (Join-Path $p $s) | Out-Null }

# Prova de que o INSTALADOR novo correu (como admin). Se este ficheiro nao existir
# depois de instalar, o instalador usado e ANTIGO.
$buildId = '2026-07-02-programdata-v8'
Write-Utf8NoBom -Path (Join-Path $p 'build-stamp.txt') -Content "build_id=$buildId`ninstalado_por=$env:USERNAME`ndata=$(Get-Date -Format o)`norigem=instalador-nsis"

function Grant-FolderAccess {
  param(
    [string]$Path,
    [string]$Sid,
    [string]$Rights = 'FullControl'
  )
  if (-not (Test-Path -LiteralPath $Path)) { return }
  $acl = Get-Acl -LiteralPath $Path
  $inherit = [System.Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [System.Security.AccessControl.InheritanceFlags]::ObjectInherit
  $id = New-Object System.Security.Principal.SecurityIdentifier($Sid)
  $rule = New-Object System.Security.AccessControl.FileSystemAccessRule($id, $Rights, $inherit, 'None', 'Allow')
  [void]$acl.AddAccessRule($rule)
  $acl.SetAccessRuleProtection($false, $true)
  Set-Acl -LiteralPath $Path $acl
}

Grant-FolderAccess $p 'S-1-5-32-545' 'FullControl'
Get-ChildItem -LiteralPath $p -Recurse -Force -ErrorAction SilentlyContinue | ForEach-Object {
  Grant-FolderAccess $_.FullName 'S-1-5-32-545' 'FullControl'
}

$icacls = Join-Path $env:WINDIR 'System32\icacls.exe'
if (Test-Path -LiteralPath $icacls) {
  & $icacls $p /grant '*S-1-5-32-545:(OI)(CI)F' /T /C | Out-Null
  & $icacls $p /grant '*S-1-5-11:(OI)(CI)M' /T /C | Out-Null
}

# Ficheiros iniciais (sessao vazia — login preenche token depois)
$sessaoPath = Join-Path $p 'sessao.json'
$configsPath = Join-Path $p 'configs.json'
$machinePath = Join-Path $p 'machine_device_id.txt'
$tplDir = $PSScriptRoot

if (-not (Test-Path -LiteralPath $sessaoPath)) {
  $tpl = Join-Path $tplDir 'programdata-sessao-inicial.json'
  if (Test-Path -LiteralPath $tpl) {
    Copy-Item -LiteralPath $tpl -Destination $sessaoPath -Force
  } else {
    $sessaoFallback = @'
{
  "id": 1,
  "token": null,
  "cliente_id": null,
  "cliente": null,
  "pdv": null,
  "playlists_data": null,
  "agendas_data": null,
  "ping_times": 0,
  "last_update": null,
  "primeiro_acesso": true,
  "install_device_id": null,
  "install_serial": null,
  "programacao_pendente_playlist": null,
  "programacao_pendente_agendas": null
}
'@
    Write-Utf8NoBom -Path $sessaoPath -Content $sessaoFallback
  }
}

if (-not (Test-Path -LiteralPath $configsPath)) {
  $tpl = Join-Path $tplDir 'programdata-configs-inicial.json'
  if (Test-Path -LiteralPath $tpl) {
    Copy-Item -LiteralPath $tpl -Destination $configsPath -Force
  } else {
    Write-Utf8NoBom -Path $configsPath -Content '{"id":1,"restart_player":false,"time_restart_player":""}'
  }
}

if (-not (Test-Path -LiteralPath $machinePath)) {
  Write-Utf8NoBom -Path $machinePath -Content ([guid]::NewGuid().ToString())
}

try {
  $mid = (Get-Content -LiteralPath $machinePath -Raw).Trim()
  if ($mid.Length -ge 8) {
    $j = Get-Content -LiteralPath $sessaoPath -Raw | ConvertFrom-Json
    if (-not $j.install_device_id) {
      $j.install_device_id = $mid
      Write-Utf8NoBom -Path $sessaoPath -Content ($j | ConvertTo-Json -Depth 20)
    }
  }
} catch {
  #
}

exit 0
