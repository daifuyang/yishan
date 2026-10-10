import { eq } from 'drizzle-orm'
import type { AppDb } from '@yishan/core-system-api/database'
import type { UserLifecycleEvent } from '@yishan/core-contracts'
import { demoUserProfile } from './user-profile.schema'

export class DemoUserProfiles {
  constructor(private readonly db: AppDb) {}

  async find(userId: number) {
    const [profile] = await this.db.select().from(demoUserProfile).where(eq(demoUserProfile.userId, userId)).limit(1)
    return profile ?? null
  }

  async recordEvent(event: UserLifecycleEvent): Promise<void> {
    await this.db.insert(demoUserProfile).values({ userId: event.user.id, lastEvent: event.type })
      .onDuplicateKeyUpdate({ set: { lastEvent: event.type, updatedAt: new Date() } })
  }
}
