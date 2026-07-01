# Radio Ibiza Player — ACL ProgramData + ficheiros iniciais (modo TI).
# SIDs fixos: Users S-1-5-32-545, Authenticated Users S-1-5-11.
$ErrorActionPreference = 'SilentlyContinue'
$p = Join-Path $env:ProgramData 'RadioIbizaPlayer'
$sub = @('chromium-profile', 'chromium-cache', 'pending-executions', 'audio')
New-Item -ItemType Directory -Force -Path $p | Out-Null
foreach ($s in $sub) { New-Item -ItemType Directory -Force -Path (Join-Path $p $s) | Out-Null }

function Grant-ModifyInherit {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) { return }
  $acl = Get-Acl -LiteralPath $Path
  $inherit = [System.Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [System.Security.AccessControl.InheritanceFlags]::ObjectInherit
  foreach ($sid in @('S-1-5-32-545', 'S-1-5-11')) {
    $id = New-Object System.Security.Principal.SecurityIdentifier($sid)
    $rule = New-Object System.Security.AccessControl.FileSystemAccessRule($id, 'Modify', $inherit, 'None', 'Allow')
    [void]$acl.AddAccessRule($rule)
  }
  $acl.SetAccessRuleProtection($false, $true)
  Set-Acl -LiteralPath $Path $acl
}

Grant-ModifyInherit $p
Get-ChildItem -LiteralPath $p -Recurse -Force -ErrorAction SilentlyContinue | ForEach-Object {
  Grant-ModifyInherit $_.FullName
}

$icacls = Join-Path $env:WINDIR 'System32\icacls.exe'
if (Test-Path -LiteralPath $icacls) {
  & $icacls $p /grant '*S-1-5-32-545:(OI)(CI)M' /T /C | Out-Null
  & $icacls $p /grant '*S-1-5-11:(OI)(CI)M' /T /C | Out-Null
}

# Templates ao lado deste script (resources/ no instalador).
$tplDir = $PSScriptRoot
$sessaoPath = Join-Path $p 'sessao.json'
$configsPath = Join-Path $p 'configs.json'
$machinePath = Join-Path $p 'machine_device_id.txt'

if (-not (Test-Path -LiteralPath $sessaoPath)) {
  $tpl = Join-Path $tplDir 'programdata-sessao-inicial.json'
  if (Test-Path -LiteralPath $tpl) {
    Copy-Item -LiteralPath $tpl -Destination $sessaoPath -Force
  } else {
    @'
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
'@ | Set-Content -LiteralPath $sessaoPath -Encoding UTF8
  }
}

if (-not (Test-Path -LiteralPath $configsPath)) {
  $tpl = Join-Path $tplDir 'programdata-configs-inicial.json'
  if (Test-Path -LiteralPath $tpl) {
    Copy-Item -LiteralPath $tpl -Destination $configsPath -Force
  } else {
    '{"id":1,"restart_player":false,"time_restart_player":""}' | Set-Content -LiteralPath $configsPath -Encoding UTF8
  }
}

if (-not (Test-Path -LiteralPath $machinePath)) {
  [guid]::NewGuid().ToString() | Set-Content -LiteralPath $machinePath -Encoding UTF8 -NoNewline
}

# Alinha install_device_id da sessao ao ID da maquina.
try {
  $mid = (Get-Content -LiteralPath $machinePath -Raw).Trim()
  if ($mid.Length -ge 8) {
    $j = Get-Content -LiteralPath $sessaoPath -Raw | ConvertFrom-Json
    if (-not $j.install_device_id) {
      $j.install_device_id = $mid
      $j | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $sessaoPath -Encoding UTF8
    }
  }
} catch {
  #
}

exit 0
