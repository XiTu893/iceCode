# Compare IceCode and OpenClaude src directories

$openClaudeFiles = Get-Content "F:\temp\openclaude_src_files.txt"
$iceCodePath = "f:\project\AI\iceCode\src"

# Get IceCode files (relative paths)
$iceCodeFiles = Get-ChildItem -Path $iceCodePath -Recurse -File | 
    ForEach-Object { 
        $relative = $_.FullName.Substring($iceCodePath.Length + 1).Replace("\", "/")
        "src/$relative"
    }

Write-Host "OpenClaude total files: $($openClaudeFiles.Count)" -ForegroundColor Cyan
Write-Host "IceCode total files: $($iceCodeFiles.Count)" -ForegroundColor Cyan
Write-Host ""

# Get top-level directories
$openClaudeTopDirs = $openClaudeFiles | ForEach-Object { 
    if ($_ -match '^src/([^/]+)') { $matches[1] } 
} | Sort-Object -Unique

$iceCodeTopDirs = $iceCodeFiles | ForEach-Object { 
    if ($_ -match '^src/([^/]+)') { $matches[1] } 
} | Sort-Object -Unique

Write-Host "=== OpenClaude top-level dirs ===" -ForegroundColor Yellow
$openClaudeTopDirs | ForEach-Object { Write-Host "  $_" }
Write-Host ""

Write-Host "=== IceCode top-level dirs ===" -ForegroundColor Yellow
$iceCodeTopDirs | ForEach-Object { Write-Host "  $_" }
Write-Host ""

# Find unique to IceCode
$uniqueToIceCode = $iceCodeTopDirs | Where-Object { $openClaudeTopDirs -notcontains $_ }

Write-Host "=== Directories UNIQUE to IceCode ===" -ForegroundColor Green
$uniqueToIceCode | ForEach-Object {
    $dir = "src/$_"
    $count = ($iceCodeFiles | Where-Object { $_.StartsWith($dir + "/") }).Count
    Write-Host "  $_ ($count files)"
}
Write-Host ""
