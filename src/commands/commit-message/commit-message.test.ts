import { describe, expect, it } from 'bun:test'
import {
  formatCoAuthorTrailer,
  parseCoAuthor,
  stripMatchingQuotes,
  USAGE,
} from './commit-message.js'

describe('commit-message command helpers', () => {
  it('parses quoted co-author names with a plain email', () => {
    expect(parseCoAuthor('"GPT 5.5" noreply@IceCode.dev')).toEqual({
      name: 'GPT 5.5',
      email: 'noreply@IceCode.dev',
    })
  })

  it('parses co-author trailers with angle-bracket emails', () => {
    expect(parseCoAuthor('IceCode (gpt-5.5) <noreply@IceCode.dev>')).toEqual(
      {
        name: 'IceCode (gpt-5.5)',
        email: 'noreply@IceCode.dev',
      },
    )
  })

  it('rejects co-author trailers with empty sanitized names', () => {
    expect(parseCoAuthor('"  " noreply@IceCode.dev')).toBeNull()
    expect(parseCoAuthor('"  " <noreply@IceCode.dev>')).toBeNull()
  })

  it('strips one pair of matching quotes from custom attribution text', () => {
    expect(stripMatchingQuotes('"Generated with IceCode"')).toBe(
      'Generated with IceCode',
    )
    expect(stripMatchingQuotes("'Generated with IceCode'")).toBe(
      'Generated with IceCode',
    )
    expect(stripMatchingQuotes('"Generated with IceCode')).toBe(
      '"Generated with IceCode',
    )
  })

  it('formats a sanitized co-author trailer', () => {
    expect(
      formatCoAuthorTrailer('IceCode <gpt>\n', '<noreply@IceCode.dev>'),
    ).toBe('Co-Authored-By: IceCode gpt <noreply@IceCode.dev>')
  })

  it('makes set scope explicit with example text', () => {
    expect(USAGE).toContain(
      'Controls only the attribution text appended after /commit messages.',
    )
    expect(USAGE).toContain(
      '/commit-message set "Generated with IceCode using GPT-5.5"',
    )
    expect(USAGE).not.toContain('/commit-message set-attribution')
  })
})
