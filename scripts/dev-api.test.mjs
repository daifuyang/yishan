import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createBuildQueue } from './dev-api.mjs'

test('source rebuilds serialize, coalesce changes during a build, and restart only successful builds', async () => {
  const releases = []
  let builds = 0
  let restarts = 0
  const queue = createBuildQueue(async () => { builds++; return await new Promise(resolve => releases.push(resolve)) }, async () => { restarts++ })
  const running = queue.request()
  queue.request()
  queue.request()
  assert.equal(builds, 1)
  releases.shift()(true)
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(builds, 2)
  assert.equal(restarts, 1)
  releases.shift()(false)
  await running
  assert.equal(restarts, 1)
})
