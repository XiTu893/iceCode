# IceCode重命名批量替换脚本
# 将所有OpenClaude/openclaude/OPENCLAUDE替换为IceCode/icecode/ICECODE

$rootPath = "f:\project\AI\openclaude-main"

Write-Host "开始批量替换..." -ForegroundColor Green

# 定义替换规则（按顺序执行，先处理长的字符串）
$patterns = @(
    @{Pattern='OpenClaude'; Replacement='IceCode'},
    @{Pattern='openclaude'; Replacement='icecode'},
    @{Pattern='OPENCLAUDE'; Replacement='ICECODE'},
    @{Pattern='Gitlawb'; Replacement='XiTu893'},
    @{Pattern='gitlawb'; Replacement='xitu893'}
)

# 获取所有需要处理的文件
$files = Get-ChildItem -Path "$rootPath\src" -Recurse -Include *.ts,*.tsx,*.js,*.jsx -File

$totalFiles = $files.Count
$processedFiles = 0
$modifiedFiles = 0

foreach ($file in $files) {
    $processedFiles++
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    $originalContent = $content
    
    # 应用所有替换规则
    foreach ($rule in $patterns) {
        $content = $content -replace [regex]::Escape($rule.Pattern), $rule.Replacement
    }
    
    # 如果内容有变化，写回文件
    if ($content -ne $originalContent) {
        Set-Content -Path $file.FullName -Value $content -Encoding UTF8 -NoNewline
        $modifiedFiles++
        Write-Host "已修改: $($file.FullName)" -ForegroundColor Yellow
    }
    
    # 显示进度
    if ($processedFiles % 100 -eq 0) {
        Write-Host "处理进度: $processedFiles / $totalFiles" -ForegroundColor Cyan
    }
}

Write-Host "`n替换完成!" -ForegroundColor Green
Write-Host "总文件数: $totalFiles" -ForegroundColor Cyan
Write-Host "已处理: $processedFiles" -ForegroundColor Cyan
Write-Host "已修改: $modifiedFiles" -ForegroundColor Green
