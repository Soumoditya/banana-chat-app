$ts = Get-Date -Format 'yyyy-MM-dd_HH-mm'
$dest = "c:\Banana\project_backup_$ts.zip"
$items = Get-ChildItem 'c:\Banana' -Exclude 'node_modules','android','ios','.expo','.git','dist'
$filtered = $items | Where-Object { $_.Extension -ne '.zip' }
$filtered | Compress-Archive -DestinationPath $dest -Force
Write-Host "Backup created: $dest"
