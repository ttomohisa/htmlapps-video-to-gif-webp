param(
  [switch]$ForceDownload,
  [string]$LocalFfmpegDist = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

$required = @(
  "AGENTS.md",
  "APP_SPEC.md",
  "app.config.json",
  "dependencies.json",
  "ffmpeg.config.json",
  "components\confirm-dialog.html",
  "components\mobile-bottom-bar.html",
  "docs\COMPONENTS.md",
  "docs\COMPONENTS.ja.md",
  "src\index.template.html",
  "build-standalone.ps1",
  "scripts\build-self-extract.ps1",
  "scripts\verify-standalone.ps1",
  "scripts\verify-self-extract.ps1",
  "README.md",
  "README.ja.md",
  "LICENSE",
  "THIRD_PARTY_NOTICES.md",
  "schemas\app-config.schema.json",
  "schemas\dependencies.schema.json"
)

foreach ($relative in $required) {
  $path = Join-Path $Root $relative
  if (-not (Test-Path $path)) { throw "Required repository file is missing: $relative" }
}

$mobileBottomBarPath = Join-Path $Root "components\mobile-bottom-bar.html"
$mobileBottomBarText = Get-Content -Raw -Encoding UTF8 $mobileBottomBarPath
$mobileBottomBarRequiredTokens = @(
  'position: fixed',
  'env(safe-area-inset-bottom)',
  'data-mobile-target',
  'data-mobile-action',
  'disabled',
  'window.AppMobileBottomBar'
)
foreach ($token in $mobileBottomBarRequiredTokens) {
  if (-not $mobileBottomBarText.Contains($token)) {
    throw "components\mobile-bottom-bar.html is missing required behavior marker: $token"
  }
}

$selfExtractBuilderPath = Join-Path $Root "scripts\build-self-extract.ps1"
$selfExtractBuilderBytes = [System.IO.File]::ReadAllBytes($selfExtractBuilderPath)
$selfExtractBuilderStart = 0
if (
  $selfExtractBuilderBytes.Length -ge 3 -and
  $selfExtractBuilderBytes[0] -eq 0xef -and
  $selfExtractBuilderBytes[1] -eq 0xbb -and
  $selfExtractBuilderBytes[2] -eq 0xbf
) {
  $selfExtractBuilderStart = 3
}
for ($index = $selfExtractBuilderStart; $index -lt $selfExtractBuilderBytes.Length; $index += 1) {
  if ($selfExtractBuilderBytes[$index] -gt 0x7f) {
    throw "scripts\build-self-extract.ps1 must contain ASCII text only so Windows PowerShell 5.1 cannot corrupt loader text."
  }
}

$buildCompatibilityFiles = @(
  "build-standalone.ps1",
  "scripts\build-self-extract.ps1",
  "scripts\verify-standalone.ps1",
  "scripts\verify-self-extract.ps1"
)
foreach ($relative in $buildCompatibilityFiles) {
  $compatibilityPath = Join-Path $Root $relative
  $compatibilityText = Get-Content -Raw -Encoding UTF8 $compatibilityPath
  if ($compatibilityText -match '(?i)\bGet-FileHash\b') {
    throw "$relative must not depend on Get-FileHash; use the .NET SHA-256 helper for broader Windows PowerShell compatibility."
  }
  if ($compatibilityText -match '::new\s*\(') {
    throw "$relative must not use ::new(); use New-Object or older-compatible .NET construction syntax."
  }
}

# Regression check: runtime identifiers like __APP_INTERNAL_STATE__ are not build placeholders.
$verifyPath = Join-Path $Root "scripts\verify-standalone.ps1"
$tempVerifyPath = Join-Path ([System.IO.Path]::GetTempPath()) ("single-html-template-verify-" + [Guid]::NewGuid().ToString("N") + ".html")
$syntheticHtml = @'
<!doctype html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; connect-src 'none'">
</head><body><script>const __APP_INTERNAL_STATE__ = 1;</script></body></html>
'@
try {
  [System.IO.File]::WriteAllText($tempVerifyPath, $syntheticHtml, (New-Object System.Text.UTF8Encoding($false)))
  & $verifyPath -Path $tempVerifyPath -RequireNetworkBlock $true
} finally {
  Remove-Item -Force -ErrorAction SilentlyContinue $tempVerifyPath
}


$ffmpegConfigPath = Join-Path $Root "ffmpeg.config.json"
$ffmpegConfig = Get-Content -Raw -Encoding UTF8 $ffmpegConfigPath | ConvertFrom-Json
if ([string]$ffmpegConfig.version -ne "1.10.1") { throw "ffmpeg.config.json must pin FFmpeg WASM Builder v1.10.1 for app v1.0.3." }
$profileIds = @($ffmpegConfig.profiles | ForEach-Object { [string]$_.id })
foreach ($requiredProfile in @("video-to-gif", "video-to-webp")) {
  if ($profileIds -notcontains $requiredProfile) { throw "ffmpeg.config.json is missing required profile: $requiredProfile" }
}

$templatePath = Join-Path $Root "src\index.template.html"
$templateText = Get-Content -Raw -Encoding UTF8 $templatePath
foreach ($token in @(
  "__FFMPEG_GIF_JS_GZIP_BASE64__",
  "__FFMPEG_GIF_WASM_GZIP_BASE64__",
  "__FFMPEG_WEBP_JS_GZIP_BASE64__",
  "__FFMPEG_WEBP_WASM_GZIP_BASE64__",
  "__FFMPEG_RUNTIME__",
  "BrowserFFmpeg.videoToGifArgs",
  "BrowserFFmpeg.videoToWebpArgs",
  "workerfs:true",
  "connect-src 'none'",
  "'wasm-unsafe-eval'",
  'id="videoPlayButton"',
  'id="customWidth"',
  'id="customFps"',
  'id="customWidthRange"',
  'id="customFpsRange"',
  'class="source-preview-area"',
  '#sourceSection .source-wrap.is-visible { display:contents; }',
  "selectedWidth()",
  "selectedFps()",
  'id="playSelection"',
  'data-fine-step="frame"',
  'data-nudge-target="start"',
  'id="widthSelect"',
  'id="fpsSelect"',
  'id="cropSelect"',
  'id="cropOverlay"',
  'name="crop"',
  'id="loopAnimation"',
  "applyLoopPreference",
  "video.addEventListener('click',togglePreviewPlayback)",
  "wasm-unsafe-eval"
)) {
  if (-not $templateText.Contains($token)) { throw "src\index.template.html is missing required app marker: $token" }
}
if ($templateText -match '<video id="videoPreview"[^>]*\scontrols(?:\s|=|>)') { throw "Source preview must not expose native video controls; seeking belongs to the trim timeline." }
if ($templateText.Contains("Single HTML App Starter")) { throw "Starter product copy remains in src\index.template.html" }

$app = Get-Content -Raw -Encoding UTF8 (Join-Path $Root "app.config.json") | ConvertFrom-Json
if ([string]::IsNullOrWhiteSpace([string]$app.name)) { throw "app.config.json: name is required" }
if ([string]::IsNullOrWhiteSpace([string]$app.slug)) { throw "app.config.json: slug is required" }
if ([string]::IsNullOrWhiteSpace([string]$app.version)) { throw "app.config.json: version is required" }

if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Node.js 22+ is required for repository regression tests." }
& node (Join-Path $Root "scripts\test-dialog-layout.cjs")
if ($LASTEXITCODE -ne 0) { throw "Dialog layout regression tests failed." }
& node (Join-Path $Root "scripts\test-support\timing-readers.test.cjs")
if ($LASTEXITCODE -ne 0) { throw "Timing reader regression tests failed." }
& node (Join-Path $Root "scripts\test-trim.cjs")
if ($LASTEXITCODE -ne 0) { throw "Trim regression tests failed." }

$buildArguments = @{}
if ($ForceDownload) { $buildArguments.ForceDownload = $true }
if (-not [string]::IsNullOrWhiteSpace($LocalFfmpegDist)) { $buildArguments.LocalFfmpegDist = $LocalFfmpegDist }
& (Join-Path $Root "build-standalone.ps1") @buildArguments

& node (Join-Path $Root "scripts\test-artifacts.cjs")
if ($LASTEXITCODE -ne 0) { throw "Artifact regression tests failed." }

& node (Join-Path $Root "scripts\test-runtime-timing.cjs")
if ($LASTEXITCODE -ne 0) { throw "Embedded runtime timing regressions failed." }

Write-Host "[OK] Repository check passed." -ForegroundColor Green
