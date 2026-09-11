[CmdletBinding()]
param(
    [ValidateLength(16, 512)]
    [string] $PairingCode
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not $PairingCode) {
    $secureCode = Read-Host 'Enter a new or existing 16+ character pairing code' -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureCode)
    try {
        $PairingCode = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
}

if ($PairingCode.Length -lt 16) {
    throw 'The pairing code must be at least 16 characters long.'
}

$python = Get-Command python.exe -ErrorAction SilentlyContinue
if (-not $python) {
    throw 'Python was not found. Install Python 3.10+ and select Add Python to PATH, then install requirements.txt.'
}

$env:TUFFY_PAIR_CODE = $PairingCode
try {
    & $python.Source (Join-Path $PSScriptRoot 'streamer.py')
}
finally {
    Remove-Item Env:TUFFY_PAIR_CODE -ErrorAction SilentlyContinue
}
