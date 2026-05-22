import * as vscode from 'vscode';
import * as path from 'path';
import * as cp from 'child_process';

let iceCodeProcess: cp.ChildProcessWithoutNullStreams | null = null;
let grpcClient: any = null;

export function activate(context: vscode.ExtensionContext) {
  console.log('IceCode extension is now active!');

  startIceCodeGrpcServer(context);

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

async function startIceCodeGrpcServer(context: vscode.ExtensionContext) {
  const iceCodeRoot = path.resolve(__dirname, '../../../../..');
  console.log(`Starting IceCode gRPC server from: ${iceCodeRoot}`);

  try {
    const config = vscode.workspace.getConfiguration('icecode');
    const apiUrl = config.get<string>('apiUrl');
    const apiKey = config.get<string>('apiKey');
    
    const env = {
      ...process.env,
      GRPC_PORT: '50051',
      GRPC_HOST: 'localhost',
    };

    if (apiUrl) {
      env.ICECODE_API_URL = apiUrl;
      console.log(`Using custom API URL: ${apiUrl}`);
    }

    if (apiKey) {
      env.ICECODE_API_KEY = apiKey;
    }

    const startGrpcPath = path.join(iceCodeRoot, 'scripts', 'start-grpc.ts');
    
    iceCodeProcess = cp.spawn(
      'npx',
      ['tsx', startGrpcPath],
      {
        cwd: iceCodeRoot,
        env: env,
      }
    );

    iceCodeProcess.stdout.on('data', (data) => {
      console.log(`IceCode gRPC Server: ${data}`);
      if (data.toString().includes('Server started')) {
        initializeGrpcClient();
      }
    });

    iceCodeProcess.stderr.on('data', (data) => {
      console.error(`IceCode gRPC Server Error: ${data}`);
    });

    iceCodeProcess.on('close', (code) => {
      console.log(`IceCode gRPC Server exited with code ${code}`);
      iceCodeProcess = null;
      grpcClient = null;
    });

    vscode.window.showInformationMessage('IceCode AI gRPC 服务已启动！');
  } catch (error) {
    console.error('Failed to start IceCode gRPC server:', error);
    vscode.window.showErrorMessage('启动 IceCode AI 失败，请检查 Node.js 和依赖是否正确安装');
  }
}

async function initializeGrpcClient() {
  try {
    const { loadPackageDefinition } = await import('@grpc/proto-loader');
    const grpc = await import('@grpc/grpc-js');
    
    const PROTO_PATH = path.join(__dirname, '../../../../src/proto/icecode.proto');
    const packageDefinition = await loadPackageDefinition(PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    
    const proto = grpc.loadPackageDefinition(packageDefinition);
    grpcClient = new proto.IceCode.v1.AgentService('localhost:50051', grpc.credentials.createInsecure());
    
    console.log('IceCode gRPC client initialized');
  } catch (error) {
    console.error('Failed to initialize gRPC client:', error);
    grpcClient = null;
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
    const model = config.get<string>('model') || 'claude-3-5-sonnet-20241022';

    response.markdown('🤖 **IceCode AI Assistant**\n\n');

    let workingDirectory = process.cwd();
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
      workingDirectory = vscode.workspace.workspaceFolders[0].uri.fsPath;
    }

    if (grpcClient) {
      response.markdown('✅ gRPC 连接已建立\n\n');
      await sendGrpcRequest(response, request.prompt, workingDirectory, model);
    } else {
      response.markdown('⌛ 正在建立 gRPC 连接...\n\n');
      response.markdown('**配置说明**:\n');
      response.markdown('- API Key: 在设置中配置 icecode.apiKey\n');
      response.markdown('- API URL: 在设置中配置 icecode.apiUrl（可选）\n');
      response.markdown('- Model: 在设置中配置 icecode.model\n\n');
      response.markdown(`**工作目录**: ${workingDirectory}\n\n`);
    }

  } catch (error) {
    response.markdown(`\n\n❌ 发生错误: ${error}`);
    console.error(error);
  }

  return { metadata: {} };
}

async function sendGrpcRequest(response: vscode.ChatResponseStream, prompt: string, workingDirectory: string, model: string) {
  if (!grpcClient) {
    response.markdown('❌ gRPC 客户端未初始化');
    return;
  }

  return new Promise<void>((resolve) => {
    const call = grpcClient.Chat();
    
    call.on('data', (serverMessage: any) => {
      if (serverMessage.event) {
        if (serverMessage.event.textChunk) {
          response.markdown(serverMessage.event.textChunk.text);
        } else if (serverMessage.event.toolStart) {
          response.markdown(`\n\n🔧 **工具调用**: ${serverMessage.event.toolStart.tool_name}\n`);
          response.markdown(`参数: ${serverMessage.event.toolStart.arguments_json}\n\n`);
        } else if (serverMessage.event.toolResult) {
          const result = serverMessage.event.toolResult;
          response.markdown(`\n\n📊 **工具结果**: ${result.tool_name}\n`);
          response.markdown(result.is_error ? `❌ 错误: ${result.output}` : `输出: ${result.output}`);
          response.markdown('\n\n');
        } else if (serverMessage.event.actionRequired) {
          const action = serverMessage.event.actionRequired;
          response.markdown(`\n\n⚠️ **需要确认**: ${action.question}\n`);
          response.markdown(`提示ID: ${action.prompt_id}\n\n`);
        } else if (serverMessage.event.done) {
          const done = serverMessage.event.done;
          response.markdown(`\n\n✅ **完成**\n`);
          response.markdown(`Token使用: 提示 ${done.prompt_tokens} | 生成 ${done.completion_tokens}\n\n`);
        } else if (serverMessage.event.error) {
          const error = serverMessage.event.error;
          response.markdown(`\n\n❌ **错误**: ${error.message}\n`);
          response.markdown(`错误代码: ${error.code}\n\n`);
        }
      }
    });

    call.on('end', () => {
      resolve();
    });

    call.on('error', (error: any) => {
      response.markdown(`\n\n❌ gRPC 错误: ${error.message}\n`);
      resolve();
    });

    const chatRequest = {
      request: {
        message: prompt,
        working_directory: workingDirectory,
        model: model,
        session_id: `vscode-${Date.now()}`
      }
    };

    call.write(chatRequest);
  });
}

export function deactivate() {
  if (iceCodeProcess) {
    console.log('Shutting down IceCode gRPC server...');
    iceCodeProcess.kill();
    iceCodeProcess = null;
  }
  grpcClient = null;
  console.log('IceCode extension is now deactivated!');
}