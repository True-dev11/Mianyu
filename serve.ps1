Set-Location -LiteralPath $PSScriptRoot
Write-Host "眠屿预览已启动： http://127.0.0.1:4180/" -ForegroundColor Cyan
Write-Host "同一 Wi-Fi 下，用手机访问本机局域网 IP:4180" -ForegroundColor DarkGray
python -m http.server 4180 --bind 0.0.0.0
