import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as path from 'path';

// We'll use the proto file from the main icecode project
const PROTO_PATH = path.resolve(__dirname, '../../../../../src/proto/icecode.proto');

export class GrpcClient {
  private client: any;
  private host: string;
  private port: number;

  constructor(host: string = 'localhost', port: number = 50051) {
    this.host = host;
    this.port = port;
    
    // Load the protobuf definition
    const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    
    const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as any;
    const IceCodeProto = protoDescriptor.IceCode.v1;
    
    // Create the gRPC client
    this.client = new IceCodeProto.AgentService(
      `${host}:${port}`,
      grpc.credentials.createInsecure()
    );
  }

  async chat(message: string, workingDirectory: string, model?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const call = this.client.Chat();
      
      let fullResponse = '';
      let sessionId = Date.now().toString();
      
      // Send initial request
      call.write({
        request: {
          message: message,
          working_directory: workingDirectory,
          model: model,
          session_id: sessionId
        }
      });
      
      // Handle server responses
      call.on('data', (response: any) => {
        if (response.text_chunk) {
          fullResponse += response.text_chunk.text;
        } else if (response.error) {
          reject(new Error(`gRPC Error: ${response.error.message}`));
        } else if (response.done) {
          fullResponse = response.done.full_text;
        }
      });
      
      call.on('end', () => {
        resolve(fullResponse);
      });
      
      call.on('error', (error: any) => {
        reject(error);
      });
    });
  }

  close() {
    // In a real implementation, we might need to clean up resources
    // For now, the gRPC connection is managed by the library
  }
}