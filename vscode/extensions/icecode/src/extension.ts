import * as vscode from 'vscode';
import * as path from 'path';
import * as cp from 'child_process';

let grpcServerProcess: cp.ChildProcessWithoutNullStreams | null = null;
const GRPC_PORT = 50051;

export function activate(context: vscode.ExtensionContext) {
  console.log('IceCode extension is now active!');

  // Auto-start gRPC server on activation
  startGrpcServer(context);

  // Register chat participant
  const participant = vscode.chat.createChatParticipant('icecode', async (request, context, token) => {
    return handleChatRequest(request, context, token);
  });

  participant.iconPath = new vscode.ThemeIcon('sparkle');

  // Register commands
  const chatCommand = vscode.commands.registerCommand('icecode.chat', () => {
    vscode.commands.executeCommand('workbench.action.chat.open', '@icecode');
  });

  const explainCommand = vscode.commands.registerCommand('icecode.explainCode', async () => {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const selectedText = editor.document.getText(editor.selection);
      if (selectedText) {
        vscode.commands.executeCommand('workbench.action.chat.open', `@icecode 请解释这段代码：\n${selectedText}`);
      }
    }
  });

  const fixCommand = vscode.commands.registerCommand('icecode.fixCode', async () => {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const selectedText = editor.document.getText(editor.selection);
      if (selectedText) {
        vscode.commands.executeCommand('workbench.action.chat.open', `@icecode 请修复这段代码：\n${selectedText}`);
      }
    }
  });

  const refactorCommand = vscode.commands.registerCommand('icecode.refactorCode', async () => {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const selectedText = editor.document.getText(editor.selection);
      if (selectedText) {
        vscode.commands.executeCommand('workbench.action.chat.open', `@icecode 请重构这段代码：\n${selectedText}`);
      }
    }
  });

  context.subscriptions.push(chatCommand, explainCommand, fixCommand, refactorCommand);
}

function startGrpcServer(context: vscode.ExtensionContext) {
  const iceCodeRoot = path.resolve(__dirname, '../../../../..');
  console.log(`Starting IceCode gRPC server from: ${iceCodeRoot}`);

  try {
    // Set environment variables
    const env = {
      ...process.env,
      GRPC_PORT: GRPC_PORT.toString(),
      GRPC_HOST: 'localhost',
    };

    // Check if API URL is configured in VSCode settings
    const config = vscode.workspace.getConfiguration('icecode');
    const apiUrl = config.get<string>('apiUrl');
    const apiKey = config.get<string>('apiKey');
    
    if (apiUrl) {
      // If API URL is set, pass it as env var (we'll need to check what env var IceCode uses)
      // For now, let's just log it
      console.log(`Using custom API URL: ${apiUrl}`);
    }

    // Start gRPC server
    grpcServerProcess = cp.spawn(
      'node',
      [path.join(iceCodeRoot, 'scripts', 'start-grpc.ts')],
      {
        cwd: iceCodeRoot,
        env: env,
      }
    );

    grpcServerProcess.stdout.on('data', (data) => {
      console.log(`IceCode gRPC Server: ${data}`);
    });

    grpcServerProcess.stderr.on('data', (data) => {
      console.error(`IceCode gRPC Server Error: ${data}`);
    });

    grpcServerProcess.on('close', (code) => {
      console.log(`IceCode gRPC Server exited with code ${code}`);
      grpcServerProcess = null;
    });

    vscode.window.showInformationMessage('IceCode AI 已启动！');
  } catch (error) {
    console.error('Failed to start gRPC server:', error);
    vscode.window.showErrorMessage('启动 IceCode AI 失败，请检查 Node.js 是否正确安装');
  }
}

async function handleChatRequest(
  request: vscode.ChatRequest,
  context: vscode.ChatContext,
  token: vscode.CancellationToken
): Promise<vscode.ChatResult> {
  const response = new vscode.ChatResponseStream();

  try {
    // Check if gRPC server is running
    if (!grpcServerProcess) {
      response.markdown('⚠️ IceCode AI 服务未运行，请稍候重试');
      return { metadata: {} };
    }

    // Get current working directory
    let workingDirectory = process.cwd();
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
      workingDirectory = vscode.workspace.workspaceFolders[0].uri.fsPath;
    }

    // Get model from config
    const config = vscode.workspace.getConfiguration('icecode');
    const model = config.get<string>('model');

    response.markdown('🤖 **IceCode AI Assistant**\n\n');
    response.markdown('正在处理您的请求...\n\n');

    // For now, let's just show a message since we haven't fully integrated the gRPC client yet
    // TODO: Implement actual gRPC client communication
    response.markdown('⚠️ **注意**：完整的 gRPC 集成功能仍在开发中。\n\n');
    response.markdown('当前版本可以演示基本的 AI 助手交互界面。\n\n');

  } catch (error) {
    response.markdown(`\n\n❌ 发生错误: ${error}`);
    console.error(error);
  }

  return { metadata: {} };
}

export function deactivate() {
  if (grpcServerProcess) {
    console.log('Shutting down IceCode gRPC server...');
    grpcServerProcess.kill();
    grpcServerProcess = null;
  }
  console.log('IceCode extension is now deactivated!');
}
