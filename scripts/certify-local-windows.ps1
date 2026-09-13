param(
    [switch]$SkipNpmCi,
    [switch]$PackageWindows,
    [switch]$AllowDirty,
    [string]$ReportRoot = "$env:USERPROFILE\ORBI-Certification"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

function Invoke-Native {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $false)][string[]]$Arguments = @()
    )

    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$FilePath exited with code $LASTEXITCODE"
    }
}

$results = New-Object System.Collections.Generic.List[object]

function Invoke-CertStep {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][scriptblock]$Action
    )

    $started = Get-Date
    Write-Host ""
    Write-Host "=== $Name ==="

    try {
        & $Action
        $finished = Get-Date
        $results.Add([pscustomobject]@{
            name = $Name
            status = 'PASS'
            startedAt = $started.ToUniversalTime().ToString('o')
            finishedAt = $finished.ToUniversalTime().ToString('o')
            durationSeconds = [math]::Round(($finished - $started).TotalSeconds, 3)
            error = $null
        })
    }
    catch {
        $finished = Get-Date
        $results.Add([pscustomobject]@{
            name = $Name
            status = 'FAIL'
            startedAt = $started.ToUniversalTime().ToString('o')
            finishedAt = $finished.ToUniversalTime().ToString('o')
            durationSeconds = [math]::Round(($finished - $started).TotalSeconds, 3)
            error = $_.Exception.Message
        })
        throw
    }
}

function Get-NativeText {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $false)][string[]]$Arguments = @()
    )

    $output = & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$FilePath exited with code $LASTEXITCODE"
    }
    return (($output | Out-String).Trim())
}

$git = Get-Command git -ErrorAction Stop
$node = Get-Command node -ErrorAction Stop
$npm = Get-Command npm.cmd -ErrorAction Stop
$npx = Get-Command npx.cmd -ErrorAction Stop

$sourceCommit = Get-NativeText $git.Source @('rev-parse', 'HEAD')
if ($sourceCommit -notmatch '^[0-9a-fA-F]{40}$') {
    throw 'Unable to resolve exact 40-character Git commit SHA'
}
$sourceCommit = $sourceCommit.ToLowerInvariant()

$branchName = Get-NativeText $git.Source @('branch', '--show-current')
if ([string]::IsNullOrWhiteSpace($branchName)) {
    $branchName = '(detached)'
}

$porcelain = Get-NativeText $git.Source @('status', '--porcelain=v1', '--untracked-files=all')
$dirty = -not [string]::IsNullOrWhiteSpace($porcelain)
if ($dirty -and -not $AllowDirty) {
    throw "Working tree is not clean. Commit/stash changes or rerun with -AllowDirty for non-certifying diagnostics only."
}

$nodeVersion = Get-NativeText $node.Source @('--version')
$npmVersion = Get-NativeText $npm.Source @('--version')
$gitVersion = Get-NativeText $git.Source @('--version')

$startedAt = Get-Date
$stamp = $startedAt.ToUniversalTime().ToString('yyyyMMdd-HHmmss')
$reportDir = Join-Path $ReportRoot "$stamp-$($sourceCommit.Substring(0,12))"
New-Item -ItemType Directory -Force -Path $reportDir | Out-Null

$overallStatus = 'PASS'
$failureMessage = $null

try {
    Invoke-CertStep 'Git submodule state' {
        Invoke-Native $git.Source @('submodule', 'status', '--recursive')
    }

    if (-not $SkipNpmCi) {
        Invoke-CertStep 'Install exact dependency graph' {
            Invoke-Native $npm.Source @('ci')
        }
    }

    Invoke-CertStep 'Electron source syntax gate' {
        $electronFiles = @(Get-ChildItem -Path (Join-Path $repoRoot 'electron') -Recurse -File -Filter '*.js')
        if ($electronFiles.Count -eq 0) {
            throw 'No Electron JavaScript files found'
        }
        foreach ($file in $electronFiles) {
            Invoke-Native $node.Source @('--check', $file.FullName)
        }
    }

    Invoke-CertStep 'Deterministic lint gate' {
        Invoke-Native $npm.Source @('run', 'lint', '--', '--max-warnings', '10')
    }

    Invoke-CertStep 'Root tests' {
        $testFiles = @(Get-ChildItem -Path (Join-Path $repoRoot 'tests') -File -Filter '*.test.js' | Sort-Object FullName)
        if ($testFiles.Count -eq 0) {
            throw 'No root test files found'
        }
        $args = @('--test') + @($testFiles | ForEach-Object { $_.FullName })
        Invoke-Native $node.Source $args
    }

    Invoke-CertStep 'Build workspaces' {
        Invoke-Native $npm.Source @('run', 'build:packages')
    }

    Invoke-CertStep 'Build Next application' {
        Invoke-Native $npm.Source @('run', 'build')
    }

    Invoke-CertStep 'Build Electron renderer' {
        Invoke-Native $npm.Source @('run', 'vite:build')
    }

    Invoke-CertStep 'Production dependency security gate' {
        $auditPath = Join-Path $reportDir 'npm-audit-production.json'
        $auditOutput = & $npm.Source audit --omit=dev --json 2>&1
        $auditExit = $LASTEXITCODE
        ($auditOutput | Out-String) | Set-Content -Path $auditPath -Encoding utf8

        try {
            $audit = Get-Content -Raw -Path $auditPath | ConvertFrom-Json
        }
        catch {
            throw "npm audit did not produce parseable JSON (exit $auditExit)"
        }

        $critical = [int]($audit.metadata.vulnerabilities.critical)
        $high = [int]($audit.metadata.vulnerabilities.high)
        if ($critical -gt 0 -or $high -gt 0) {
            throw "Production dependency audit contains critical=$critical high=$high"
        }
    }

    if ($PackageWindows) {
        Invoke-CertStep 'Package Windows installer' {
            Invoke-Native $npx.Source @('electron-builder', '--win', '--publish', 'never')
            $installer = Get-ChildItem -Path (Join-Path $repoRoot 'release') -Filter 'Open Generative AI Setup *.exe' -File |
                Sort-Object LastWriteTimeUtc -Descending |
                Select-Object -First 1
            if (-not $installer) {
                throw 'Windows installer was not produced'
            }
            $hash = Get-FileHash -Algorithm SHA256 -Path $installer.FullName
            [pscustomobject]@{
                file = $installer.FullName
                sha256 = $hash.Hash.ToLowerInvariant()
                length = $installer.Length
            } | ConvertTo-Json -Depth 4 |
                Set-Content -Path (Join-Path $reportDir 'windows-package.json') -Encoding utf8
        }
    }
}
catch {
    $overallStatus = 'FAIL'
    $failureMessage = $_.Exception.Message
}
finally {
    $finishedAt = Get-Date
    $report = [ordered]@{
        schemaVersion = 1
        reportType = 'ORBI_LOCAL_WINDOWS_CERTIFICATION'
        status = $overallStatus
        certifying = (-not $dirty)
        sourceCommit = $sourceCommit
        branch = $branchName
        dirtyWorkingTree = $dirty
        packageWindows = [bool]$PackageWindows
        skipNpmCi = [bool]$SkipNpmCi
        startedAt = $startedAt.ToUniversalTime().ToString('o')
        finishedAt = $finishedAt.ToUniversalTime().ToString('o')
        durationSeconds = [math]::Round(($finishedAt - $startedAt).TotalSeconds, 3)
        environment = [ordered]@{
            os = [System.Environment]::OSVersion.VersionString
            powershell = $PSVersionTable.PSVersion.ToString()
            git = $gitVersion
            node = $nodeVersion
            npm = $npmVersion
            computerName = $env:COMPUTERNAME
        }
        failure = $failureMessage
        steps = @($results)
        boundaries = [ordered]@{
            hostedMatrixReplaced = $false
            cutoverAuthorized = $false
            executionAuthority = 'legacy-dispatcher-only'
        }
    }

    $reportPath = Join-Path $reportDir 'local-certification.json'
    $report | ConvertTo-Json -Depth 8 | Set-Content -Path $reportPath -Encoding utf8

    $digest = Get-FileHash -Algorithm SHA256 -Path $reportPath
    "$($digest.Hash.ToLowerInvariant())  local-certification.json" |
        Set-Content -Path (Join-Path $reportDir 'local-certification.sha256') -Encoding ascii

    Write-Host ""
    Write-Host "=== ORBI LOCAL CERTIFICATION RESULT ==="
    Write-Host "Status: $overallStatus"
    Write-Host "Commit: $sourceCommit"
    Write-Host "Branch: $branchName"
    Write-Host "Certifying clean tree: $(-not $dirty)"
    Write-Host "Report: $reportPath"
    Write-Host "SHA-256: $($digest.Hash.ToLowerInvariant())"
    Write-Host "Cutover authorized: NO"
    Write-Host "Execution authority: legacy-dispatcher-only"
}

if ($overallStatus -ne 'PASS') {
    exit 1
}
