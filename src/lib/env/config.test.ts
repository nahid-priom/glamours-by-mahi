import { describe, expect, it } from 'vitest'
import { getPublicEnvIssues, validatePublicEnv } from './config'

describe('public env validation', () => {
  it('reports missing required variables without exposing secret values', () => {
    const issues = validatePublicEnv()
    if (issues.length === 0) {
      expect(getPublicEnvIssues()).toEqual([])
      return
    }

    for (const issue of issues) {
      expect(issue.message).not.toMatch(/eyJ|supabase\.co\/project\/[a-z0-9-]+/i)
      expect(issue.name.startsWith('VITE_')).toBe(true)
    }
  })
})
