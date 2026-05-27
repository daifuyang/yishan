import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import type { CliSession } from './types.js'

const SESSION_FILE = join(homedir(), '.yishan-cli', 'session.json')

const defaultSession: CliSession = {
  baseUrl: process.env.YISHAN_API_BASE_URL || 'http://127.0.0.1:3000'
}

export async function readSession(): Promise<CliSession> {
  try {
    const text = await readFile(SESSION_FILE, 'utf-8')
    const parsed = JSON.parse(text) as CliSession
    return {
      ...defaultSession,
      ...parsed
    }
  } catch {
    return { ...defaultSession }
  }
}

export async function saveSession(session: CliSession): Promise<void> {
  await mkdir(dirname(SESSION_FILE), { recursive: true })
  await writeFile(SESSION_FILE, `${JSON.stringify(session, null, 2)}\n`, 'utf-8')
}

export async function clearSession(): Promise<void> {
  const session = await readSession()
  await saveSession({ baseUrl: session.baseUrl })
}
