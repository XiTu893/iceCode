import * as vscode from 'vscode';
import * as path from 'path';
import * as cp from 'child_process';

let iceCodeProcess: cp.ChildProcessWithoutNullStreams | null = null;

export function activate(context: vscode.ExtensionContext) {
  console.log('IceCode extension is now active!');

  startIceCodeServer(context);

  const participant = vscode.chat.createChatParticipant('icecode', async (request, context, token) => {
    return handleChatRequest(request, context, token);
  });

  participant.iconPath = new vscode.ThemeIcon('sparkle');

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

function startIceCodeServer(context: vscode.ExtensionContext) {
  const iceCodeRoot = path.resolve(__dirname, '../../../../..');
  console.log(`Starting IceCode from: ${iceCodeRoot}`);

  try {
    const config = vscode.workspace.getConfiguration('icecode');
    const apiUrl = config.get<string>('apiUrl');
    const apiKey = config.get<string>('apiKey');
    
    const env = {
      ...process.env,
    };

    if (apiUrl) {
      env.ICECODE_API_URL = apiUrl;
      console.log(`Using custom API URL: ${apiUrl}`);
    }

    if (apiKey) {
      env.ICECODE_API_KEY = apiKey;
    }

    const cliPath = path.join(iceCodeRoot, 'dist', 'cli.mjs');
    
    iceCodeProcess = cp.spawn(
      'node',
      [cliPath, 'serve', '--port', '5173'],
      {
        cwd: iceCodeRoot,
        env: env,
      }
    );

    iceCodeProcess.stdout.on('data', (data) => {
      console.log(`IceCode Server: ${data}`);
    });

    iceCodeProcess.stderr.on('data', (data) => {
      console.error(`IceCode Server Error: ${data}`);
    });

    iceCodeProcess.on('close', (code) => {
      console.log(`IceCode Server exited with code ${code}`);
      iceCodeProcess = null;
    });

    vscode.window.showInformationMessage('IceCode AI 已启动！');
  } catch (error) {
    console.error('Failed to start IceCode server:', error);
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
    if (!iceCodeProcess) {
      response.markdown('⚠️ IceCode AI 服务未运行，请稍候重试');
      return { metadata: {} };
    }

    const config = vscode.workspace.getConfiguration('icecode');
    const model = config.get<string>('model');

    response.markdown('🤖 **IceCode AI Assistant**\n\n');
    response.markdown('正在处理您的请求...\n\n');

    response.markdown('当前版本可以演示基本的 AI 助手交互界面。\n\n');
    response.markdown('**配置说明**:\n');
    response.markdown('- API Key: 在设置中配置 icecode.apiKey\n');
    response.markdown('- API URL: 在设置中配置 icecode.apiUrl（可选）\n');
    response.markdown('- Model: 在设置中配置 icecode.model\n\n');

  } catch (error) {
    response.markdown(`\n\n❌ 发生错误: ${error}`);
    console.error(error);
  }

  return { metadata: {} };
}

export function deactivate() {
  if (iceCodeProcess) {
    console.log('Shutting down IceCode server...');
    iceCodeProcess.kill();
    iceCodeProcess = null;
  }
  console.log('IceCode extension is now deactivated!');
}