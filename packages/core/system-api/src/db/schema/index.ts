// Generated from drizzle/*.sql. Do not edit manually.
export * from './tables'
export * from './relations'

import * as tablesModule from './tables'
import * as relationsModule from './relations'

export const schema = {
  ...tablesModule,
  ...relationsModule,
}
