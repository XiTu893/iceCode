// Backend entry point for portable distribution
// This file bundles the gRPC server startup logic

import { GrpcServer } from '../src/grpc/server.ts'
import { init } from '../src/entrypoints/init.ts'

// Polyfill MACRO which is normally injected by the bundler
Object.assign(globalThis, {
  MACRO: {
    VERSION: '0.1.7',
    DISPLAY_VERSION: '0.1.7',
    PACKAGE_URL: '@gitlawb/openclaude',
  }
})

async function main() {
  console.log('[IceCode Backend] Starting OpenClaude gRPC Server...')
  
  try {
    await init()

    // Mirror CLI bootstrap: hydrate secure tokens and resolve provider profile
    const { enableConfigs } = await import('../src/utils/config.js')
    enableConfigs()
    const { applySafeConfigEnvironmentVariables } = await import('../src/utils/managedEnv.js')
    applySafeConfigEnvironmentVariables()
    const { hydrateGeminiAccessTokenFromSecureStorage } = await import('../src/utils/geminiCredentials.js')
    hydrateGeminiAccessTokenFromSecureStorage()
    const { hydrateGithubModelsTokenFromSecureStorage } = await import('../src/utils/githubModelsCredentials.js')
    hydrateGithubModelsTokenFromSecureStorage()

    const { buildStartupEnvFromProfile, applyProfileEnvToProcessEnv } = await import('../src/utils/providerProfile.js')
    const { getProviderValidationError, validateProviderEnvOrExit } = await import('../src/utils/providerValidation.js')
    const startupEnv = await buildStartupEnvFromProfile({ processEnv: process.env })
    if (startupEnv !== process.env) {
      const startupProfileError = await getProviderValidationError(startupEnv)
      if (startupProfileError) {
        console.warn(`[IceCode Backend] Warning: ignoring saved provider profile. ${startupProfileError}`)
      } else {
        applyProfileEnvToProcessEnv(process.env, startupEnv)
      }
    }
    await validateProviderEnvOrExit()

    const port = process.env.GRPC_PORT ? parseInt(process.env.GRPC_PORT, 10) : 50051
    const host = process.env.GRPC_HOST || 'localhost'
    
    console.log(`[IceCode Backend] Starting gRPC server on ${host}:${port}...`)
    const server = new GrpcServer()
    server.start(port, host)
    
    console.log('[IceCode Backend] gRPC server started successfully')
  } catch (error) {
    console.error('[IceCode Backend] Fatal error starting gRPC server:', error)
    process.exit(1)
  }
}

main()
