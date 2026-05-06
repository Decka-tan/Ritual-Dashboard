import { describe, expect, it } from 'vitest'
import { parseCsv, rowsToOfficialApps } from '../sync-sheet.js'

describe('parseCsv', () => {
  it('parses a basic two-column CSV', () => {
    const result = parseCsv('name,url\nFoo,https://foo.com\nBar,https://bar.com')
    expect(result).toEqual([
      ['name', 'url'],
      ['Foo', 'https://foo.com'],
      ['Bar', 'https://bar.com'],
    ])
  })

  it('handles quoted fields containing commas', () => {
    const result = parseCsv('name,url\n"Foo, Inc",https://foo.com')
    expect(result[1][0]).toBe('Foo, Inc')
    expect(result[1][1]).toBe('https://foo.com')
  })

  it('handles escaped double-quotes inside quoted fields', () => {
    const result = parseCsv('name,url\n"He said ""hello""",https://foo.com')
    expect(result[1][0]).toBe('He said "hello"')
  })

  it('strips Windows-style carriage returns', () => {
    const result = parseCsv('name,url\r\nFoo,https://foo.com\r\n')
    expect(result).toHaveLength(2)
    expect(result[1][1]).toBe('https://foo.com')
  })

  it('filters out fully empty rows', () => {
    const result = parseCsv('name,url\nFoo,https://foo.com\n\n')
    expect(result).toHaveLength(2)
  })
})

describe('rowsToOfficialApps', () => {
  it('returns empty array for fewer than 2 rows', () => {
    expect(rowsToOfficialApps([])).toEqual([])
    expect(rowsToOfficialApps([['name', 'url']])).toEqual([])
  })

  it('maps name and url columns correctly', () => {
    const rows = [
      ['name', 'url'],
      ['My App', 'https://myapp.vercel.app'],
    ]
    const apps = rowsToOfficialApps(rows)
    expect(apps).toHaveLength(1)
    expect(apps[0].name).toBe('My App')
    expect(apps[0].url).toBe('https://myapp.vercel.app')
  })

  it('auto-numbers site_number sequentially', () => {
    const rows = [
      ['name', 'url'],
      ['App A', 'https://a.com'],
      ['App B', 'https://b.com'],
      ['App C', 'https://c.com'],
    ]
    const apps = rowsToOfficialApps(rows)
    expect(apps.map((a) => a.site_number)).toEqual([1, 2, 3])
  })

  it('skips rows with no name or no valid URL', () => {
    const rows = [
      ['name', 'url'],
      ['', 'https://valid.com'],
      ['Valid App', 'not-a-url'],
      ['Real App', 'https://real.com'],
    ]
    const apps = rowsToOfficialApps(rows)
    expect(apps).toHaveLength(1)
    expect(apps[0].name).toBe('Real App')
  })

  it('deduplicates rows with the same name+url', () => {
    const rows = [
      ['name', 'url'],
      ['App', 'https://app.com'],
      ['App', 'https://app.com'],
    ]
    const apps = rowsToOfficialApps(rows)
    expect(apps).toHaveLength(1)
  })

  it('uses column header aliases (app, link, builder)', () => {
    const rows = [
      ['app', 'link', 'builder'],
      ['Cool dApp', 'https://cool.xyz', 'Alice'],
    ]
    const apps = rowsToOfficialApps(rows)
    expect(apps[0].name).toBe('Cool dApp')
    expect(apps[0].url).toBe('https://cool.xyz')
    expect(apps[0].creator_name).toBe('Alice')
  })

  it('throws when neither name nor url column can be detected', () => {
    const rows = [
      ['foo', 'bar'],
      ['x', 'y'],
    ]
    expect(() => rowsToOfficialApps(rows)).toThrow(/unable to detect/i)
  })
})
