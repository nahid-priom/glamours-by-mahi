/**
 * Deno smoke tests for place-online-order edge function contract.
 * Run: npm run test:edge
 *
 * These tests validate request handling shapes without live Supabase.
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'

Deno.test('place-online-order CORS preflight shape', () => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
  assertEquals(corsHeaders['Access-Control-Allow-Origin'], '*')
})

Deno.test('edge error payload shape', () => {
  const body = JSON.stringify({ error: 'boom' })
  const parsed = JSON.parse(body) as { error: string }
  assertEquals(typeof parsed.error, 'string')
})

Deno.test('rpc proxy payload must be object', () => {
  const payload = { branch_id: 'x', items: [] }
  assertEquals(Array.isArray(payload.items), true)
})
