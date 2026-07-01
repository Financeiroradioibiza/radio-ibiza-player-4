# Radio Ibiza Player — ACL ProgramData para todos os utilizadores Windows (modo TI).
# SIDs fixos (independentes de PT/EN): Users S-1-5-32-545, Authenticated Users S-1-5-11.
$ErrorActionPreference = 'SilentlyContinue'
$p = Join-Path $env:ProgramData 'RadioIbizaPlayer'
$sub = @('chromium-profile', 'chromium-cache', 'pending-executions', 'audio')
New-Item -ItemType Directory -Force -Path $p | Out-Null
foreach ($s in $sub) { New-Item -ItemType Directory -Force -Path (Join-Path $p $s) | Out-Null }
$acl = Get-Acl -LiteralPath $p
$inherit = [System.Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [System.Security.AccessControl.InheritanceFlags]::ObjectInherit
foreach ($sid in @('S-1-5-32-545', 'S-1-5-11')) {
  $id = New-Object System.Security.Principal.SecurityIdentifier($sid)
  $rule = New-Object System.Security.AccessControl.FileSystemAccessRule($id, 'Modify', $inherit, 'None', 'Allow')
  [void]$acl.AddAccessRule($rule)
}
$acl.SetAccessRuleProtection($false, $true)
Set-Acl -LiteralPath $p $acl
exit 0
