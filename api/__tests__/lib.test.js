import { describe, expect, it } from 'vitest'
import { cleanString, normalizeUrl, validatePublicUrl } from '../_lib.js'

describe('cleanString', () => {
  it('trims whitespace', () => {
    expect(cleanString('  hello  ')).toBe('hello')
  })

  it('truncates to maxLength', () => {
    expect(cleanString('abcdef', 3)).toBe('abc')
  })

  it('handles null/undefined gracefully', () => {
    expect(cleanString(null)).toBe('')
    expect(cleanString(undefined)).toBe('')
  })
})

describe('normalizeUrl', () => {
  it('passes through existing https URLs unchanged', () => {
    expect(normalizeUrl('https://example.com')).toBe('https://example.com')
  })

  it('prepends https:// to bare domains', () => {
    expect(normalizeUrl('example.com')).toBe('https://example.com')
  })

  it('keeps http:// URLs as-is', () => {
    expect(normalizeUrl('http://example.com')).toBe('http://example.com')
  })

  it('returns empty string for empty input', () => {
    expect(normalizeUrl('')).toBe('')
    expect(normalizeUrl(null)).toBe('')
  })
})

describe('validatePublicUrl', () => {
  it('accepts a normal public URL', () => {
    expect(validatePublicUrl('https://myapp.vercel.app').valid).toBe(true)
  })

  it('rejects localhost', () => {
    expect(validatePublicUrl('http://localhost:3000').valid).toBe(false)
  })

  it('rejects 127.0.0.1', () => {
    expect(validatePublicUrl('http://127.0.0.1').valid).toBe(false)
  })

  it('rejects 192.168.x.x', () => {
    expect(validatePublicUrl('http://192.168.1.1').valid).toBe(false)
  })

  it('rejects 10.x.x.x', () => {
    expect(validatePublicUrl('http://10.0.0.1').valid).toBe(false)
  })

  it('rejects 172.16-31.x.x', () => {
    expect(validatePublicUrl('http://172.16.0.1').valid).toBe(false)
    expect(validatePublicUrl('http://172.31.255.255').valid).toBe(false)
    expect(validatePublicUrl('http://172.32.0.1').valid).toBe(true)
  })

  it('rejects .local hostnames', () => {
    expect(validatePublicUrl('http://myserver.local').valid).toBe(false)
  })

  it('rejects .internal hostnames', () => {
    expect(validatePublicUrl('http://api.internal').valid).toBe(false)
  })

  it('rejects empty input', () => {
    expect(validatePublicUrl('').valid).toBe(false)
  })

  it('returns the normalized URL on success', () => {
    const result = validatePublicUrl('myapp.vercel.app')
    expect(result.valid).toBe(true)
    expect(result.url).toBe('https://myapp.vercel.app')
  })
})
