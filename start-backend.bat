@echo off
REM IceCode - AI Backend Quick Start Script

echo ==========================================
echo   IceCode - Start AI Backend Service
echo ==========================================
echo.

cd .

if not exist "node_modules" (
    echo [信息] 首次运行，安装依赖...
    bun install
    
    if errorlevel 1 (
        echo [错误] 依赖安装失败
        pause
        exit /b 1
    )
)

echo [Start] IceCode gRPC Server...
echo.

REM 设置环境变量
set NODE_ENV=production
set PORT=50051

REM 启动gRPC服务器
bun run scripts/start-grpc.ts

if errorlevel 1 (
    echo.
    echo [错误] 服务启动失败
    echo.
    echo 请确保：
    echo 1. 已安装所有依赖
    echo 2. 端口50051未被占用
    echo 3. 已配置API密钥（如需要）
    echo.
    pause
    exit /b 1
)

pause
