$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
npm install
if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
npm run setup
if ($LASTEXITCODE -ne 0) { throw 'Database setup failed.' }
Write-Output 'Ready. Run: npm run dev'
