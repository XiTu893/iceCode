import { afterEach, describe, expect, mock, test } from 'bun:test'
import * as fsPromises from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'

const originalEnv = { ...process.env }
const originalArgv = [...process.argv]

async function importFreshEnvUtils() {
  return import(`./envUtils.ts?ts=${Date.now()}-${Math.random()}`)
}

async function importFreshSettings() {
  return import(`./settings/settings.ts?ts=${Date.now()}-${Math.random()}`)
}

async function importFreshLocalInstaller() {
  return import(`./localInstaller.ts?ts=${Date.now()}-${Math.random()}`)
}

async function importFreshPlans() {
  return import(`./plans.ts?ts=${Date.now()}-${Math.random()}`)
}

afterEach(() => {
  process.env = { ...originalEnv }
  process.argv = [...originalArgv]
  mock.restore()
})

describe('IceCode paths', () => {
  test('defaults user config home to ~/.IceCode', async () => {
    delete process.env.CLAUDE_CONFIG_DIR
    const { resolveClaudeConfigHomeDir } = await importFreshEnvUtils()

    expect(
      resolveClaudeConfigHomeDir({
        homeDir: homedir(),
        IceCodeExists: true,
        legacyClaudeExists: false,
      }),
    ).toBe(join(homedir(), '.IceCode'))
  })

  test('falls back to ~/.claude when legacy config exists and ~/.IceCode does not', async () => {
    delete process.env.CLAUDE_CONFIG_DIR
    const { resolveClaudeConfigHomeDir } = await importFreshEnvUtils()

    expect(
      resolveClaudeConfigHomeDir({
        homeDir: homedir(),
        IceCodeExists: false,
        legacyClaudeExists: true,
      }),
    ).toBe(join(homedir(), '.claude'))
  })

  test('default plans directory uses ~/.IceCode/plans', async () => {
    delete process.env.CLAUDE_CONFIG_DIR
    const { getDefaultPlansDirectory } = await importFreshPlans()

    expect(getDefaultPlansDirectory({ homeDir: homedir() })).toBe(
      join(homedir(), '.IceCode', 'plans'),
    )
  })

  test('default plans directory respects explicit CLAUDE_CONFIG_DIR', async () => {
    const { getDefaultPlansDirectory } = await importFreshPlans()

    expect(
      getDefaultPlansDirectory({ configDirEnv: '/tmp/custom-IceCode' }),
    ).toBe(join('/tmp/custom-IceCode', 'plans'))
  })

  test('default plans directory normalizes generated path to NFC', async () => {
    const { getDefaultPlansDirectory } = await importFreshPlans()

    expect(
      getDefaultPlansDirectory({ homeDir: '/tmp/cafe\u0301' }),
    ).toBe(join('/tmp/caf\u00e9', '.IceCode', 'plans'))
  })

  test('default plans directory normalizes explicit CLAUDE_CONFIG_DIR to NFC', async () => {
    const { getDefaultPlansDirectory } = await importFreshPlans()

    expect(
      getDefaultPlansDirectory({ configDirEnv: '/tmp/cafe\u0301-IceCode' }),
    ).toBe(join('/tmp/caf\u00e9-IceCode', 'plans'))
  })

  test('uses CLAUDE_CONFIG_DIR override when provided', async () => {
    process.env.CLAUDE_CONFIG_DIR = '/tmp/custom-IceCode'
    const { getClaudeConfigHomeDir, resolveClaudeConfigHomeDir } =
      await importFreshEnvUtils()

    expect(getClaudeConfigHomeDir()).toBe('/tmp/custom-IceCode')
    expect(
      resolveClaudeConfigHomeDir({
        configDirEnv: '/tmp/custom-IceCode',
      }),
    ).toBe('/tmp/custom-IceCode')
  })

  test('project and local settings paths use .IceCode', async () => {
    const { getRelativeSettingsFilePathForSource } = await importFreshSettings()

    expect(getRelativeSettingsFilePathForSource('projectSettings')).toBe(
      '.IceCode/settings.json',
    )
    expect(getRelativeSettingsFilePathForSource('localSettings')).toBe(
      '.IceCode/settings.local.json',
    )
  })

  test('local installer uses IceCode wrapper path', async () => {
    // Force .IceCode config home so the test doesn't fall back to
    // ~/.claude when ~/.IceCode doesn't exist on this machine.
    process.env.CLAUDE_CONFIG_DIR = join(homedir(), '.IceCode')
    const { getLocalClaudePath } = await importFreshLocalInstaller()

    expect(getLocalClaudePath()).toBe(
      join(homedir(), '.IceCode', 'local', 'IceCode'),
    )
  })

  test('local installation detection matches .IceCode path', async () => {
    const { isManagedLocalInstallationPath } =
      await importFreshLocalInstaller()

    expect(
      isManagedLocalInstallationPath(
        `${join(homedir(), '.IceCode', 'local')}/node_modules/.bin/IceCode`,
      ),
    ).toBe(true)
  })

  test('local installation detection still matches legacy .claude path', async () => {
    const { isManagedLocalInstallationPath } =
      await importFreshLocalInstaller()

    expect(
      isManagedLocalInstallationPath(
        `${join(homedir(), '.claude', 'local')}/node_modules/.bin/IceCode`,
      ),
    ).toBe(true)
  })

  test('candidate local install dirs include both IceCode and legacy claude paths', async () => {
    const { getCandidateLocalInstallDirs } = await importFreshLocalInstaller()

    expect(
      getCandidateLocalInstallDirs({
        configHomeDir: join(homedir(), '.IceCode'),
        homeDir: homedir(),
      }),
    ).toEqual([
      join(homedir(), '.IceCode', 'local'),
      join(homedir(), '.claude', 'local'),
    ])
  })

  test('legacy local installs are detected when they still expose the claude binary', async () => {
    mock.module('fs/promises', () => ({
      ...fsPromises,
      access: async (path: string) => {
        if (
          path === join(homedir(), '.claude', 'local', 'node_modules', '.bin', 'claude')
        ) {
          return
        }
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      },
    }))

    const { getDetectedLocalInstallDir, localInstallationExists } =
      await importFreshLocalInstaller()

    expect(await localInstallationExists()).toBe(true)
    expect(await getDetectedLocalInstallDir()).toBe(
      join(homedir(), '.claude', 'local'),
    )
  })
})
