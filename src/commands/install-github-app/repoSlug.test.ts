import assert from 'node:assert/strict'
import test from 'node:test'

import { extractGitHubRepoSlug } from './repoSlug.ts'

test('keeps owner/repo input as-is', () => {
  assert.equal(extractGitHubRepoSlug('XiTu893/IceCode'), 'XiTu893/IceCode')
})

test('extracts slug from https GitHub URLs', () => {
  assert.equal(
    extractGitHubRepoSlug('https://github.com/XiTu893/IceCode'),
    'XiTu893/IceCode',
  )
  assert.equal(
    extractGitHubRepoSlug('https://www.github.com/XiTu893/IceCode.git'),
    'XiTu893/IceCode',
  )
})

test('extracts slug from ssh GitHub URLs', () => {
  assert.equal(
    extractGitHubRepoSlug('git@github.com:XiTu893/IceCode.git'),
    'XiTu893/IceCode',
  )
  assert.equal(
    extractGitHubRepoSlug('ssh://git@github.com/XiTu893/IceCode'),
    'XiTu893/IceCode',
  )
})

test('rejects malformed or non-GitHub URLs', () => {
  assert.equal(extractGitHubRepoSlug('https://gitlab.com/XiTu893/IceCode'), null)
  assert.equal(extractGitHubRepoSlug('https://github.com/XiTu893'), null)
  assert.equal(extractGitHubRepoSlug('not actually github.com/XiTu893/IceCode'), null)
  assert.equal(
    extractGitHubRepoSlug('https://evil.example/?next=github.com/XiTu893/IceCode'),
    null,
  )
  assert.equal(
    extractGitHubRepoSlug('https://github.com.evil.example/XiTu893/IceCode'),
    null,
  )
  assert.equal(
    extractGitHubRepoSlug('https://example.com/github.com/XiTu893/IceCode'),
    null,
  )
})
