# שרת קטן שמריץ את הנגן בכתובת http://127.0.0.1:8080 (רק על המחשב הזה)
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Parse('127.0.0.1'), 8080)
try { $listener.Start() } catch { Write-Host 'Port 8080 is busy - maybe the player is already running.'; Start-Process 'http://127.0.0.1:8080/'; Start-Sleep 3; exit }
Write-Host 'The player is running at http://127.0.0.1:8080  (close this window to stop it)'
Start-Process 'http://127.0.0.1:8080/'
$types = @{ '.html'='text/html; charset=utf-8'; '.js'='application/javascript'; '.css'='text/css'; '.ico'='image/x-icon' }
while ($true) {
  $client = $listener.AcceptTcpClient()
  try {
    $stream = $client.GetStream()
    $reader = New-Object System.IO.StreamReader($stream)
    $line = $reader.ReadLine()
    while (($h = $reader.ReadLine()) -ne $null -and $h -ne '') { }
    $path = '/'
    if ($line -match '^GET\s+(\S+)') { $path = ($Matches[1] -split '\?')[0] }
    if ($path -eq '/' ) { $rel = 'index.html' }
    elseif ($path -match '^/callback/?$') { $rel = 'callback\index.html' }
    else { $rel = $path.TrimStart('/').Replace('/', '\') }
    $file = Join-Path $root $rel
    if ($rel -notmatch '\.\.' -and (Test-Path $file -PathType Leaf)) {
      $body = [System.IO.File]::ReadAllBytes($file)
      $ct = $types[[System.IO.Path]::GetExtension($file)]; if (-not $ct) { $ct = 'application/octet-stream' }
      $head = "HTTP/1.1 200 OK`r`nContent-Type: $ct`r`nContent-Length: $($body.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
    } else {
      $body = [System.Text.Encoding]::UTF8.GetBytes('Not found')
      $head = "HTTP/1.1 404 Not Found`r`nContent-Type: text/plain`r`nContent-Length: $($body.Length)`r`nConnection: close`r`n`r`n"
    }
    $hb = [System.Text.Encoding]::ASCII.GetBytes($head)
    $stream.Write($hb, 0, $hb.Length); $stream.Write($body, 0, $body.Length); $stream.Flush()
  } catch { } finally { $client.Close() }
}
