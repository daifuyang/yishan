import { createConnection, Connection } from 'mysql2/promise'
import { scryptHash } from '../src/plugins/app/password-manager'

interface DatabaseConfig {
  host: string
  port: number
  database: string
  user: string
  password: string
}

interface UserSeed {
  email: string
  username: string
  password: string
}

interface TaskSeed {
  title: string
  description: string
  status: 'pending' | 'in_progress' | 'completed'
  priority: 'low' | 'medium' | 'high'
}

interface SeedingContext {
  connection: Connection
}

const REQUIRED_ENV_VARS = ['MYSQL_HOST', 'MYSQL_PORT', 'MYSQL_DATABASE', 'MYSQL_USER', 'MYSQL_PASSWORD']

if (Number(process.env.CAN_SEED_DATABASE) !== 1) {
  console.error('🚫 Database seeding is disabled.')
  console.error('   Set CAN_SEED_DATABASE=1 to enable seeding.')
  process.exit(1)
}

const validateEnvironment = (): DatabaseConfig => {
  const missing = REQUIRED_ENV_VARS.filter(key => !process.env[key])
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:')
    missing.forEach(key => console.error(`   - ${key}`))
    process.exit(1)
  }

  return {
    host: process.env.MYSQL_HOST!,
    port: parseInt(process.env.MYSQL_PORT!, 10),
    database: process.env.MYSQL_DATABASE!,
    user: process.env.MYSQL_USER!,
    password: process.env.MYSQL_PASSWORD!
  }
}

const createDatabaseConnection = async (config: DatabaseConfig): Promise<Connection> => {
  try {
    return await createConnection({
      ...config,
      multipleStatements: true
    })
  } catch (error) {
    console.error('Failed to connect to database:', error)
    process.exit(1)
  }
}

const truncateAllTables = async (connection: Connection): Promise<void> => {
  console.log('Cleaning all tables...')
  
  try {
    await connection.query('SET FOREIGN_KEY_CHECKS = 0')
    await connection.query('TRUNCATE TABLE tasks')
    await connection.query('TRUNCATE TABLE users')
    await connection.query('SET FOREIGN_KEY_CHECKS = 1')
    console.log('   All tables cleaned successfully')
  } catch (error) {
    await connection.query('SET FOREIGN_KEY_CHECKS = 1')
    throw error
  }
}

const seedUsers = async (ctx: SeedingContext, users: UserSeed[]): Promise<number[]> => {
  console.log('👤 Seeding users...')
  
  const hashedUsers = await Promise.all(
    users.map(async (user) => ({
      ...user,
      password: await scryptHash(user.password)
    }))
  )

  const userIds: number[] = []
  for (const user of hashedUsers) {
    const [result] = await ctx.connection.execute(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [user.username, user.email, user.password]
    )
    userIds.push((result as { insertId: number }).insertId)
  }

  console.log(`   ✅ ${userIds.length} users seeded`)
  return userIds
}

const seedTasks = async (ctx: SeedingContext, tasks: TaskSeed[]): Promise<number[]> => {
  console.log('📋 Seeding tasks...')
  
  const taskIds: number[] = []
  for (const task of tasks) {
    const [result] = await ctx.connection.execute(
      'INSERT INTO tasks (title, description, status, priority) VALUES (?, ?, ?, ?)',
      [task.title, task.description, task.status, task.priority]
    )
    taskIds.push((result as { insertId: number }).insertId)
  }

  console.log(`   ✅ ${taskIds.length} tasks seeded`)
  return taskIds
}

const seedData = {
  users: [
    { email: 'alice@example.com', username: 'Alice Johnson', password: 'password123' },
    { email: 'bob@example.com', username: 'Bob Smith', password: 'password123' },
    { email: 'charlie@example.com', username: 'Charlie Brown', password: 'password123' },
    { email: 'diana@example.com', username: 'Diana Prince', password: 'password123' },
    { email: 'eve@example.com', username: 'Eve Wilson', password: 'password123' }
  ] as UserSeed[],
  tasks: [
    { title: 'Complete project documentation', description: 'Write API documentation and usage instructions', status: 'pending' as const, priority: 'high' as const },
    { title: 'Code review', description: 'Review team code submissions', status: 'in_progress' as const, priority: 'medium' as const },
    { title: 'Fix bugs', description: 'Fix login issues reported by users', status: 'completed' as const, priority: 'high' as const },
    { title: 'Performance optimization', description: 'Optimize database query performance', status: 'pending' as const, priority: 'low' as const },
    { title: 'Unit tests', description: 'Write unit tests for new features', status: 'in_progress' as const, priority: 'medium' as const }
  ] as TaskSeed[]
}

const main = async (): Promise<void> => {
  console.log('🌱 Starting database seeding...\n')
  
  const config = validateEnvironment()
  const connection = await createDatabaseConnection(config)
  
  const ctx: SeedingContext = { connection }

  try {
    await truncateAllTables(connection)
    
    const userIds = await seedUsers(ctx, seedData.users)
    const taskIds = await seedTasks(ctx, seedData.tasks)
    
    console.log('\n✅ Database seeding completed successfully!')
    console.log('\n📊 Test data summary:')
    console.log(`- Users: ${seedData.users.map(u => `${u.username} (${u.email})`).join(', ')}`)
    console.log(`- Tasks: ${seedData.tasks.map(t => t.title).join(', ')}`)

  } catch (error) {
    console.error('\n❌ Error during seeding:', error)
    process.exit(1)
  } finally {
    await connection.end()
  }
}

main().catch(console.error)