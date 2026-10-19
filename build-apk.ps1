$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$version = '0.2.0'
$www = Join-Path $root 'android\app\src\main\assets\www'
$release = Join-Path $root 'release'

Write-Host '1/4  Sync web assets...' -ForegroundColor Cyan
if (Test-Path -LiteralPath $www) { Remove-Item -LiteralPath $www -Recurse -Force }
New-Item -ItemType Directory -Force -Path $www | Out-Null
Copy-Item -LiteralPath (Join-Path $root 'index.html') -Destination $www
Copy-Item -LiteralPath (Join-Path $root 'css') -Destination $www -Recurse
Copy-Item -LiteralPath (Join-Path $root 'js') -Destination $www -Recurse
Copy-Item -LiteralPath (Join-Path $root 'assets') -Destination $www -Recurse

$signingFile = Join-Path $root 'android\keystore.properties'
if (-not (Test-Path -LiteralPath $signingFile)) { throw 'Missing android/keystore.properties. Copy android/keystore.properties.example and add your signing key (never commit it).' }

$env:JAVA_HOME = 'D:\dsh\tools\jdk21\jdk-21.0.6+7'
$env:ANDROID_HOME = 'D:\dsh\android-sdk'
$env:PATH = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:PATH"
$gradle = 'D:\dsh\tools\gradle-8.11.1\bin\gradle.bat'

Write-Host '2/4  Build signed release APK...' -ForegroundColor Cyan
Push-Location (Join-Path $root 'android')
try {
    & $gradle ':app:assembleRelease' --no-daemon --console=plain
} finally {
    Pop-Location
}

$built = Join-Path $root 'android\app\build\outputs\apk\release\app-release.apk'
if (-not (Test-Path -LiteralPath $built)) { throw 'APK was not produced.' }

Write-Host '3/4  Copy to release...' -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $release | Out-Null
$apk = Join-Path $release "Mianyu-$version.apk"
Copy-Item -LiteralPath $built -Destination $apk -Force

Write-Host '4/4  Verify...' -ForegroundColor Cyan
$buildTools = Join-Path $env:ANDROID_HOME 'build-tools\35.0.0'
& (Join-Path $buildTools 'apksigner.bat') verify --verbose $apk
$hash = (Get-FileHash -LiteralPath $apk -Algorithm SHA256).Hash
$size = (Get-Item -LiteralPath $apk).Length
Write-Host "APK: $apk" -ForegroundColor Green
Write-Host "Size: $size bytes" -ForegroundColor Green
Write-Host "SHA-256: $hash" -ForegroundColor Green
