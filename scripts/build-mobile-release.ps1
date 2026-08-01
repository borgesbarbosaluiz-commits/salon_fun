param(
    [ValidateSet("apk", "appbundle")]
    [string]$Artifact = "appbundle",
    [string]$EnvironmentFile = "apps/mobile/.env.production",
    [string]$BuildName,
    [int]$BuildNumber,
    [switch]$AllowDebugSigningForRelease
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$mobileDir = Join-Path $repoRoot "apps/mobile"
$resolvedEnvironmentFile = Join-Path $repoRoot $EnvironmentFile
$androidDir = Join-Path $mobileDir "android"
$keyPropertiesPath = Join-Path $androidDir "key.properties"
$androidLocalPropertiesPath = Join-Path $androidDir "local.properties"
$safeDartDefineFile = $null

$dartDefineAllowedKeys = @(
    "PUBLIC_WEB_BASE_URL",
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "AUTH_BRIDGE_URL",
    "ENABLE_FACEBOOK_SIGN_IN",
    "FIREBASE_API_KEY",
    "FIREBASE_PROJECT_ID",
    "FIREBASE_MESSAGING_SENDER_ID",
    "FIREBASE_AUTH_DOMAIN",
    "FIREBASE_STORAGE_BUCKET",
    "FIREBASE_ANDROID_APP_ID",
    "FIREBASE_IOS_APP_ID",
    "FIREBASE_APP_ID",
    "GOOGLE_SERVER_CLIENT_ID",
    "FIREBASE_WEB_APP_ID",
    "FIREBASE_IOS_BUNDLE_ID",
    "DEFAULT_SALON_JOIN_CODE",
    "FACEBOOK_APP_ID",
    "FACEBOOK_CLIENT_TOKEN",
    "FACEBOOK_DISPLAY_NAME",
    "FACEBOOK_LOGIN_PROTOCOL_SCHEME",
    "ENABLE_ADMOB_ADS",
    "ADMOB_BANNER_AD_UNIT_ID"
)

if (-not (Test-Path (Join-Path $mobileDir "pubspec.yaml"))) {
    throw "Projeto Flutter nao encontrado em apps/mobile."
}

if (-not (Test-Path $resolvedEnvironmentFile)) {
    throw "Arquivo de ambiente nao encontrado: $resolvedEnvironmentFile"
}

function Get-KeyProperties {
    param([string]$Path)

    if (-not (Test-Path $Path)) {
        return @{}
    }

    $content = Get-Content -Path $Path -ErrorAction Stop
    $properties = @{}
    foreach ($line in $content) {
        $trimmed = $line.Trim()
        if ([string]::IsNullOrWhiteSpace($trimmed) -or $trimmed.StartsWith("#")) {
            continue
        }

        $parts = $trimmed.Split("=", 2)
        if ($parts.Count -ne 2) {
            continue
        }

        $properties[$parts[0].Trim()] = $parts[1].Trim()
    }

    return $properties
}

function Get-JavaProperties {
    param([string]$Path)

    if (-not (Test-Path $Path)) {
        return @{}
    }

    $content = Get-Content -Path $Path -ErrorAction Stop
    $properties = @{}
    foreach ($line in $content) {
        $trimmed = $line.Trim()
        if ([string]::IsNullOrWhiteSpace($trimmed) -or $trimmed.StartsWith("#")) {
            continue
        }

        $parts = $trimmed.Split("=", 2)
        if ($parts.Count -ne 2) {
            continue
        }

        $key = $parts[0].Trim()
        $value = $parts[1].Trim() -replace "\\\\", "\"
        $properties[$key] = $value
    }

    return $properties
}

function New-SafeDartDefineFile {
    param(
        [string]$SourcePath,
        [string[]]$AllowedKeys
    )

    $allowedLookup = @{}
    foreach ($key in $AllowedKeys) {
        $allowedLookup[$key] = $true
    }

    $safeLines = New-Object System.Collections.Generic.List[string]
    $strippedKeys = New-Object System.Collections.Generic.List[string]
    $content = Get-Content -Path $SourcePath -ErrorAction Stop

    foreach ($line in $content) {
        $trimmed = $line.Trim()

        if ([string]::IsNullOrWhiteSpace($trimmed) -or $trimmed.StartsWith("#")) {
            continue
        }

        $parts = $line.Split("=", 2)
        if ($parts.Count -ne 2) {
            continue
        }

        $key = $parts[0].Trim()
        if ($allowedLookup.ContainsKey($key)) {
            $safeLines.Add($line)
        } else {
            $strippedKeys.Add($key)
        }
    }

    $targetPath = Join-Path ([System.IO.Path]::GetTempPath()) ("mobile-dart-defines-" + [System.Guid]::NewGuid().ToString("N") + ".env")
    Set-Content -Path $targetPath -Value $safeLines -Encoding UTF8

    return @{
        Path = $targetPath
        StrippedKeys = $strippedKeys
    }
}

$keyProperties = Get-KeyProperties -Path $keyPropertiesPath
$storeFileValue = $keyProperties["storeFile"]
$releaseKeystorePath =
    if ($storeFileValue) {
        Join-Path $androidDir $storeFileValue
    } else {
        $null
    }
$hasReleaseSigning =
    $storeFileValue -and
    (Test-Path $releaseKeystorePath) -and
    $keyProperties["storePassword"] -and
    $keyProperties["keyAlias"] -and
    $keyProperties["keyPassword"]

if ($AllowDebugSigningForRelease -and $Artifact -eq "appbundle") {
    throw "Smoke test com assinatura debug deve gerar APK. Para Play Store, configure android/key.properties e gere appbundle com assinatura real."
}

if (-not $hasReleaseSigning -and -not $AllowDebugSigningForRelease) {
    throw "Assinatura release nao configurada. Revise apps/mobile/android/key.properties ou use -AllowDebugSigningForRelease apenas para APK local."
}

$signingMode =
    if ($hasReleaseSigning) {
        "release-real"
    } else {
        "smoke-test-debug"
    }

$androidLocalProperties = Get-JavaProperties -Path $androidLocalPropertiesPath
$flutterSdkPath = $androidLocalProperties["flutter.sdk"]
$flutterEngineVersionPath =
    if ($flutterSdkPath) {
        Join-Path $flutterSdkPath "bin/internal/engine.version"
    } else {
        $null
    }

$safeDartDefineResult = New-SafeDartDefineFile -SourcePath $resolvedEnvironmentFile -AllowedKeys $dartDefineAllowedKeys
$safeDartDefineFile = $safeDartDefineResult["Path"]

$arguments = @(
    "--no-version-check",
    "build",
    $Artifact,
    "--release",
    "--dart-define-from-file=$safeDartDefineFile"
)

if ($BuildName) {
    $arguments += "--build-name=$BuildName"
}

if ($BuildNumber -gt 0) {
    $arguments += "--build-number=$BuildNumber"
}

if ($AllowDebugSigningForRelease) {
    $arguments += "--android-project-arg=allowDebugSigningForRelease=true"
}

Push-Location $mobileDir
try {
    Write-Host "Modo de assinatura: $signingMode"
    if ($hasReleaseSigning) {
        Write-Host "Keystore release encontrada em: $releaseKeystorePath"
    } else {
        Write-Host "Keystore release ausente. O artefato sera apenas para teste local."
    }
    if ($flutterEngineVersionPath -and (Test-Path $flutterEngineVersionPath)) {
        $env:FLUTTER_PREBUILT_ENGINE_VERSION =
            (Get-Content -Path $flutterEngineVersionPath -ErrorAction Stop | Select-Object -First 1).Trim()
        Write-Host "FLUTTER_PREBUILT_ENGINE_VERSION configurado para evitar fallback no git local."
    }
    if ($safeDartDefineResult["StrippedKeys"].Count -gt 0) {
        Write-Host "Segredos removidos do dart-define: $(([string[]]$safeDartDefineResult["StrippedKeys"] | Sort-Object -Unique) -join ', ')"
    }
    Write-Host "Executando: flutter $($arguments -join ' ')"
    & flutter @arguments

    if ($LASTEXITCODE -ne 0) {
        throw "Build falhou com codigo $LASTEXITCODE."
    }

    $outputPath =
        if ($Artifact -eq "apk") {
            Join-Path $mobileDir "build/app/outputs/flutter-apk/app-release.apk"
        } else {
            Join-Path $mobileDir "build/app/outputs/bundle/release/app-release.aab"
        }

    Write-Host ""
    Write-Host "Build concluido."
    Write-Host "Artefato esperado em: $outputPath"
    Write-Host "Modo final: $signingMode"
} finally {
    if ($safeDartDefineFile -and (Test-Path $safeDartDefineFile)) {
        Remove-Item -LiteralPath $safeDartDefineFile -Force -ErrorAction SilentlyContinue
    }
    Pop-Location
}
