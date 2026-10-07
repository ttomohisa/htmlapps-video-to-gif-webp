param(
  [switch]$ForceDownload,
  [switch]$SkipSelfExtract,
  [string]$OutputPath = "",
  [string]$LocalFfmpegDist = ""
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
Set-StrictMode -Version Latest
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$TemplatePath = Join-Path $Root "src\index.template.html"
$AppConfigPath = Join-Path $Root "app.config.json"
$FfmpegConfigPath = Join-Path $Root "ffmpeg.config.json"
$VerifyPath = Join-Path $Root "scripts\verify-standalone.ps1"
$SelfExtractBuilderPath = Join-Path $Root "scripts\build-self-extract.ps1"
$CacheRoot = Join-Path $Root ".cache"
$DistRoot = Join-Path $Root "dist"

$OutputPathWasSpecified = -not [string]::IsNullOrWhiteSpace($OutputPath)
if ($OutputPathWasSpecified -and -not [System.IO.Path]::IsPathRooted($OutputPath)) {
  $OutputPath = Join-Path $Root $OutputPath
}

New-Item -ItemType Directory -Force -Path $CacheRoot, $DistRoot | Out-Null

function Write-Step([string]$Message) {
  Write-Host "[Video GIF/WebP] $Message" -ForegroundColor Cyan
}

function Get-Json([string]$Path) {
  if (-not (Test-Path $Path)) { throw "Required file not found: $Path" }
  return Get-Content -Raw -Encoding UTF8 $Path | ConvertFrom-Json
}

function Get-Sha256FileHex([string]$Path) {
  if (-not (Test-Path $Path)) { throw "File not found for SHA-256: $Path" }
  $stream = [System.IO.File]::OpenRead($Path)
  $algorithm = [System.Security.Cryptography.SHA256]::Create()
  try {
    $hashBytes = $algorithm.ComputeHash($stream)
    return (($hashBytes | ForEach-Object { $_.ToString("x2") }) -join "")
  } finally {
    $algorithm.Dispose()
    $stream.Dispose()
  }
}

function ConvertTo-SafeJson([object]$Value, [int]$Depth = 30) {
  return ($Value | ConvertTo-Json -Compress -Depth $Depth).Replace("<", "\u003c").Replace(">", "\u003e").Replace("&", "\u0026")
}

function Download-File([string]$Url, [string]$Destination) {
  $partial = "$Destination.part"
  Remove-Item -Force -ErrorAction SilentlyContinue $partial
  Invoke-WebRequest -Uri $Url -OutFile $partial -UseBasicParsing -Headers @{ "User-Agent" = "htmlapps-video-to-gif-webp/1.0.1" }
  Move-Item -Force $partial $Destination
}

function Read-ChecksumMap([string]$Path) {
  $map = @{}
  foreach ($line in (Get-Content -Encoding UTF8 $Path)) {
    if ($line -match '^\s*([0-9a-fA-F]{64})\s+\*?(.+?)\s*$') {
      $map[[string]$Matches[2]] = ([string]$Matches[1]).ToLowerInvariant()
    }
  }
  return $map
}

function Get-LocalProfile([object]$Profile, [string]$LocalDist) {
  $profileId = [string]$Profile.id
  $profileRoot = Join-Path $LocalDist $profileId
  if (-not (Test-Path $profileRoot)) { throw "Local FFmpeg profile not found: $profileRoot" }
  $required = @("ffmpeg.js.gz", "ffmpeg.wasm.gz", "manifest.json")
  foreach ($name in $required) {
    $requiredPath = Join-Path $profileRoot $name
    if (-not (Test-Path $requiredPath)) { throw "Local profile $profileId is missing required file: $name" }
  }
  return [ordered]@{
    Id = $profileId
    Root = $profileRoot
    Archive = ""
    ArchiveName = "local:$profileId"
    ArchiveSha256 = "local-build"
    OutputMime = [string]$Profile.outputMime
    License = [string]$Profile.license
  }
}

function Get-ReleaseProfile([object]$FfmpegConfig, [object]$Profile, [hashtable]$ChecksumMap) {
  $version = [string]$FfmpegConfig.version
  $profileId = [string]$Profile.id
  $archiveName = [string]$Profile.archive
  $releaseBaseUrl = ([string]$FfmpegConfig.releaseBaseUrl).TrimEnd('/')
  $profileRoot = Join-Path $CacheRoot ("ffmpeg-wasm-builder-v" + $version)
  $archivePath = Join-Path $profileRoot $archiveName
  $extractPath = Join-Path $profileRoot $profileId

  New-Item -ItemType Directory -Force -Path $profileRoot | Out-Null
  if ($ForceDownload) {
    Remove-Item -Force -ErrorAction SilentlyContinue $archivePath
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $extractPath
  }

  if (-not $ChecksumMap.ContainsKey($archiveName)) {
    throw "Release checksum file does not contain $archiveName"
  }
  $expectedHash = [string]$ChecksumMap[$archiveName]

  if (-not (Test-Path $archivePath)) {
    Write-Step "Downloading FFmpeg profile $profileId (v$version)"
    Download-File "$releaseBaseUrl/$archiveName" $archivePath
  } else {
    Write-Step "Using cached FFmpeg profile $profileId (v$version)"
  }

  $actualHash = Get-Sha256FileHex $archivePath
  if ($actualHash -ne $expectedHash) {
    Remove-Item -Force -ErrorAction SilentlyContinue $archivePath
    throw "SHA-256 mismatch for $archiveName. Expected $expectedHash, got $actualHash. The bad cache file was removed; run the build again."
  }

  if (-not (Test-Path $extractPath)) {
    New-Item -ItemType Directory -Force -Path $extractPath | Out-Null
    Write-Step "Extracting $archiveName"
    & tar.exe -xf $archivePath -C $extractPath
    if ($LASTEXITCODE -ne 0) { throw "tar.exe failed while extracting $archiveName" }
  }

  $required = @("ffmpeg.js.gz", "ffmpeg.wasm.gz", "browser-ffmpeg.js", "manifest.json", "BUILDINFO.txt")
  foreach ($name in $required) {
    $requiredPath = Join-Path $extractPath $name
    if (-not (Test-Path $requiredPath)) { throw "$archiveName is missing required file: $name" }
  }

  return [ordered]@{
    Id = $profileId
    Root = $extractPath
    Archive = $archivePath
    ArchiveName = $archiveName
    ArchiveSha256 = $actualHash
    OutputMime = [string]$Profile.outputMime
    License = [string]$Profile.license
  }
}

if ([string]::IsNullOrWhiteSpace($LocalFfmpegDist) -and -not (Get-Command tar.exe -ErrorAction SilentlyContinue)) {
  throw "tar.exe was not found. Use a current Windows 10/11 environment, or install bsdtar and expose it as tar.exe."
}
if (-not [string]::IsNullOrWhiteSpace($LocalFfmpegDist)) {
  if (-not [System.IO.Path]::IsPathRooted($LocalFfmpegDist)) { $LocalFfmpegDist = Join-Path $Root $LocalFfmpegDist }
  $LocalFfmpegDist = [System.IO.Path]::GetFullPath($LocalFfmpegDist)
}

$appConfig = Get-Json $AppConfigPath
$ffmpegConfig = Get-Json $FfmpegConfigPath
if (-not $OutputPathWasSpecified) {
  $configuredOutput = [string]$appConfig.build.output
  if ([string]::IsNullOrWhiteSpace($configuredOutput)) { $configuredOutput = "dist/index.html" }
  $OutputPath = if ([System.IO.Path]::IsPathRooted($configuredOutput)) { $configuredOutput } else { Join-Path $Root $configuredOutput }
}

$profiles = @{}
if (-not [string]::IsNullOrWhiteSpace($LocalFfmpegDist)) {
  Write-Step "Using local FFmpeg Builder dist: $LocalFfmpegDist"
  foreach ($profile in @($ffmpegConfig.profiles)) {
    $resolved = Get-LocalProfile $profile $LocalFfmpegDist
    $profiles[$resolved.Id] = $resolved
  }
} else {
  $ffmpegCacheRoot = Join-Path $CacheRoot ("ffmpeg-wasm-builder-v" + [string]$ffmpegConfig.version)
  New-Item -ItemType Directory -Force -Path $ffmpegCacheRoot | Out-Null
  $checksumPath = Join-Path $ffmpegCacheRoot ([string]$ffmpegConfig.checksumAsset)
  if ($ForceDownload) { Remove-Item -Force -ErrorAction SilentlyContinue $checksumPath }
  if (-not (Test-Path $checksumPath)) {
    Write-Step "Downloading release checksums for FFmpeg WASM Builder v$($ffmpegConfig.version)"
    Download-File (([string]$ffmpegConfig.releaseBaseUrl).TrimEnd('/') + "/" + [string]$ffmpegConfig.checksumAsset) $checksumPath
  } else {
    Write-Step "Using cached FFmpeg release checksums"
  }
  $checksumMap = Read-ChecksumMap $checksumPath
  foreach ($profile in @($ffmpegConfig.profiles)) {
    $resolved = Get-ReleaseProfile $ffmpegConfig $profile $checksumMap
    $profiles[$resolved.Id] = $resolved
  }
}
if (-not $profiles.ContainsKey("video-to-gif") -or -not $profiles.ContainsKey("video-to-webp")) {
  throw "ffmpeg.config.json must contain video-to-gif and video-to-webp profiles."
}

$gif = $profiles["video-to-gif"]
$webp = $profiles["video-to-webp"]
if (-not [string]::IsNullOrWhiteSpace($LocalFfmpegDist)) {
  $localBuilderRoot = Split-Path -Parent $LocalFfmpegDist
  $localRuntimePath = Join-Path $localBuilderRoot "runtime\browser-ffmpeg.js"
  if (-not (Test-Path $localRuntimePath)) { throw "Local Builder runtime not found: $localRuntimePath" }
  $gifRuntime = [System.IO.File]::ReadAllText($localRuntimePath, [System.Text.Encoding]::UTF8)
  $webpRuntime = $gifRuntime
} else {
  $gifRuntime = [System.IO.File]::ReadAllText((Join-Path $gif.Root "browser-ffmpeg.js"), [System.Text.Encoding]::UTF8)
  $webpRuntime = [System.IO.File]::ReadAllText((Join-Path $webp.Root "browser-ffmpeg.js"), [System.Text.Encoding]::UTF8)
  if ($gifRuntime -ne $webpRuntime) {
    throw "The GIF and WebP release bundles contain different browser-ffmpeg.js runtimes. Refuse to mix incompatible profile bundles."
  }
}

$buildProfiles = @()
foreach ($resolved in @($gif, $webp)) {
  $jsGz = Join-Path $resolved.Root "ffmpeg.js.gz"
  $wasmGz = Join-Path $resolved.Root "ffmpeg.wasm.gz"
  $manifestPath = Join-Path $resolved.Root "manifest.json"
  $buildProfiles += [ordered]@{
    id = $resolved.Id
    archive = $resolved.ArchiveName
    archiveSha256 = $resolved.ArchiveSha256
    outputMime = $resolved.OutputMime
    license = $resolved.License
    ffmpegJsGzipBytes = (Get-Item $jsGz).Length
    ffmpegJsGzipSha256 = Get-Sha256FileHex $jsGz
    ffmpegWasmGzipBytes = (Get-Item $wasmGz).Length
    ffmpegWasmGzipSha256 = Get-Sha256FileHex $wasmGz
    upstreamManifest = (Get-Content -Raw -Encoding UTF8 $manifestPath | ConvertFrom-Json)
  }
}

$manifest = [ordered]@{
  schemaVersion = 1
  builder = "htmlapps-video-to-gif-webp/1.0"
  generatedAtUtc = [DateTime]::UtcNow.ToString("o")
  app = [ordered]@{
    name = [string]$appConfig.name
    slug = [string]$appConfig.slug
    version = [string]$appConfig.version
  }
  dependencies = @()
  ffmpeg = [ordered]@{
    repository = [string]$ffmpegConfig.repository
    version = [string]$ffmpegConfig.version
    profiles = $buildProfiles
  }
}

Write-Step "Generating standalone HTML"
$template = [System.IO.File]::ReadAllText($TemplatePath, [System.Text.Encoding]::UTF8)
$replacements = [ordered]@{
  "__APP_CONFIG_JSON__" = ConvertTo-SafeJson $appConfig 20
  "__BUILD_MANIFEST_JSON__" = ConvertTo-SafeJson $manifest 60
  "__FFMPEG_GIF_JS_GZIP_BASE64__" = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes((Join-Path $gif.Root "ffmpeg.js.gz")))
  "__FFMPEG_GIF_WASM_GZIP_BASE64__" = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes((Join-Path $gif.Root "ffmpeg.wasm.gz")))
  "__FFMPEG_WEBP_JS_GZIP_BASE64__" = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes((Join-Path $webp.Root "ffmpeg.js.gz")))
  "__FFMPEG_WEBP_WASM_GZIP_BASE64__" = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes((Join-Path $webp.Root "ffmpeg.wasm.gz")))
  "__FFMPEG_RUNTIME__" = $gifRuntime
}

foreach ($entry in $replacements.GetEnumerator()) {
  $count = ([regex]::Matches($template, [regex]::Escape($entry.Key))).Count
  if ($count -ne 1) { throw "Template placeholder $($entry.Key) must occur exactly once; found $count." }
  $template = $template.Replace($entry.Key, [string]$entry.Value)
}

$outputDirectory = Split-Path -Parent $OutputPath
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
[System.IO.File]::WriteAllText($OutputPath, $template, (New-Object System.Text.UTF8Encoding($false)))
[System.IO.File]::WriteAllText((Join-Path $outputDirectory "dependency-manifest.json"), ($manifest | ConvertTo-Json -Depth 60), (New-Object System.Text.UTF8Encoding($false)))
[System.IO.File]::WriteAllText((Join-Path $outputDirectory ".nojekyll"), "", (New-Object System.Text.UTF8Encoding($false)))

& $VerifyPath `
  -Path $OutputPath `
  -RequireNetworkBlock ([bool]$appConfig.build.blockRuntimeNetwork) `
  -ForbiddenPlaceholders @($replacements.Keys)

$selfExtractEnabled = $false
$selfExtractOutputPath = ""
if (-not $SkipSelfExtract -and ($appConfig.build.PSObject.Properties.Name -contains "selfExtract")) {
  $selfExtractConfig = $appConfig.build.selfExtract
  if ($selfExtractConfig -and ($selfExtractConfig.PSObject.Properties.Name -contains "enabled")) {
    $selfExtractEnabled = [bool]$selfExtractConfig.enabled
  }
  if ($selfExtractEnabled) {
    if (-not ($selfExtractConfig.PSObject.Properties.Name -contains "output")) {
      throw "app.config.json: build.selfExtract.output is required when self-extract output is enabled."
    }
    if ($OutputPathWasSpecified) {
      $customDirectory = Split-Path -Parent $OutputPath
      $customBaseName = [System.IO.Path]::GetFileNameWithoutExtension($OutputPath)
      $selfExtractOutputPath = Join-Path $customDirectory ($customBaseName + ".self-extract.html")
    } else {
      $configuredSelfExtractOutput = [string]$selfExtractConfig.output
      if ([string]::IsNullOrWhiteSpace($configuredSelfExtractOutput)) { throw "app.config.json: build.selfExtract.output cannot be empty." }
      $selfExtractOutputPath = if ([System.IO.Path]::IsPathRooted($configuredSelfExtractOutput)) { $configuredSelfExtractOutput } else { Join-Path $Root $configuredSelfExtractOutput }
    }

    Write-Step "Generating self-extracting HTML"
    & $SelfExtractBuilderPath `
      -InputPath $OutputPath `
      -OutputPath $selfExtractOutputPath `
      -AppName ([string]$appConfig.name) `
      -AppNameJa ([string]$appConfig.nameJa)
  }
}

# The catalog consumes this tracked filename; custom-output builds must not overwrite it.
if (-not $OutputPathWasSpecified) {
  $catalogPath = Join-Path $Root "video-to-gif-webp.html"
  Copy-Item -LiteralPath $OutputPath -Destination $catalogPath -Force
}

$outputHash = Get-Sha256FileHex $OutputPath
$outputSizeMb = [Math]::Round((Get-Item $OutputPath).Length / 1MB, 2)
Write-Host ""
Write-Host "[OK] Standalone HTML: $OutputPath" -ForegroundColor Green
Write-Host "[OK] Size: $outputSizeMb MB"
Write-Host "[OK] SHA-256: $outputHash"
Write-Host "[OK] Runtime network access is blocked by CSP."
Write-Host "[OK] FFmpeg WASM Builder: v$($ffmpegConfig.version) (release assets verified by SHA-256)."
if ($selfExtractEnabled) { Write-Host "[OK] Self-extracting HTML: $selfExtractOutputPath" -ForegroundColor Green }
