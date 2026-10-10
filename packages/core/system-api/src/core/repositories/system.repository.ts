import { drizzleDb } from '../../db'

export class SystemRepository {
  static async probeDatabase(): Promise<void> {
    await drizzleDb.execute('SELECT 1')
  }
}
