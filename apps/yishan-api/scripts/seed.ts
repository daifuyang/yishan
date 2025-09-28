import { createConnection, Connection } from "mysql2/promise";
import { scryptHash } from "../src/plugins/app/password-manager";
import { randomBytes } from "node:crypto";

interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

interface UserSeed {
  username: string;
  email: string;
  phone?: string | null;
  password: string;
  real_name: string;
  avatar?: string | null;
  gender?: number;
  birth_date?: string | null;
  status?: number;
}

const REQUIRED_ENV_VARS = [
  "MYSQL_HOST",
  "MYSQL_PORT",
  "MYSQL_DATABASE",
  "MYSQL_USER",
  "MYSQL_PASSWORD",
];

if (Number(process.env.CAN_SEED_DATABASE) !== 1) {
  console.error("🚫 Database seeding is disabled.");
  console.error("   Set CAN_SEED_DATABASE=1 to enable seeding.");
  process.exit(1);
}

const getDatabaseConfig = (): DatabaseConfig => {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error("❌ 缺少必需的环境变量:");
    missing.forEach((key) => console.error(`   - ${key}`));
    process.exit(1);
  }

  return {
    host: process.env.MYSQL_HOST!,
    port: parseInt(process.env.MYSQL_PORT!, 10),
    database: process.env.MYSQL_DATABASE!,
    user: process.env.MYSQL_USER!,
    password: process.env.MYSQL_PASSWORD!,
  };
};

const createDatabaseConnection = async (
  config: DatabaseConfig
): Promise<Connection> => {
  try {
    return await createConnection({
      ...config,
      multipleStatements: true,
    });
  } catch (error) {
    console.error("❌ 数据库连接失败:", error);
    process.exit(1);
  }
};

const truncateAllTables = async (connection: Connection): Promise<void> => {
  console.log("🧹 清理所有表数据...");

  try {
    await connection.query("SET FOREIGN_KEY_CHECKS = 0");

    // 检查表是否存在再清理
    const [tables] = (await connection.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME IN ('tasks', 'sys_user')
    `)) as any[];

    for (const table of tables) {
      await connection.query(`TRUNCATE TABLE ${table.TABLE_NAME}`);
      console.log(`   ✅ 清理表 ${table.TABLE_NAME}`);
    }

    await connection.query("SET FOREIGN_KEY_CHECKS = 1");
    console.log("   ✅ 所有表数据清理成功");
  } catch (error) {
    await connection.query("SET FOREIGN_KEY_CHECKS = 1");
    throw error;
  }
};

const seedUsers = async (connection: Connection): Promise<void> => {
  console.log("👤 创建管理员用户...");

  // 生成随机salt (8位)
  const salt = randomBytes(4).toString("hex");

  // 将salt拼接到密码中，然后进行hash
  const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD;

  if (!defaultPassword) {
    throw new Error("DEFAULT_ADMIN_PASSWORD 环境变量未设置");
  }

  const passwordWithSalt = defaultPassword + salt;
  const passwordHash = await scryptHash(passwordWithSalt);

  const adminUser: UserSeed = {
    username: "admin",
    email: "admin@yishan.com",
    phone: "13800138000",
    password: defaultPassword,
    real_name: "系统管理员",
    avatar: null,
    gender: 0,
    birth_date: null,
    status: 1,
  };

  try {
    const insertQuery = `
      INSERT INTO sys_user (
        username, email, phone, password_hash, salt, real_name, 
        avatar, gender, birth_date, status, login_count, 
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;

    // 存储hash和salt
    await connection.query(insertQuery, [
      adminUser.username,
      adminUser.email,
      adminUser.phone,
      passwordHash, // scryptHash处理过的 "passwordWithSalt"
      salt, // 原始salt值，用于后续验证时重新拼接
      adminUser.real_name,
      adminUser.avatar,
      adminUser.gender,
      adminUser.birth_date,
      adminUser.status,
      0, // login_count
    ]);

    console.log(
      `   ✅ 管理员用户创建成功: ${adminUser.username} (${adminUser.email})`
    );
    console.log(`   🔐 使用了自定义salt: ${salt.substring(0, 8)}...`);
  } catch (error) {
    console.error("   ❌ 创建管理员用户失败:", error);
    throw error;
  }
};

const main = async (): Promise<void> => {
  let connection: Connection | null = null;

  try {
    console.log("🌱 开始数据库种子数据初始化...");
    console.log("=".repeat(50));

    // 获取数据库配置
    const config = getDatabaseConfig();
    console.log(`📊 数据库: ${config.database}@${config.host}:${config.port}`);

    // 创建数据库连接
    connection = await createDatabaseConnection(config);
    console.log("🔗 数据库连接成功");

    // 清理现有数据
    await truncateAllTables(connection);

    // 创建管理员用户
    await seedUsers(connection);

    console.log("=".repeat(50));
    console.log("🎉 数据库种子数据初始化完成!");
    console.log("");
    console.log("默认管理员账户:");
    console.log("  用户名: admin");
    console.log("  邮箱: admin@yishan.com");
  } catch (error) {
    console.error("❌ 数据库种子数据初始化失败:", error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log("🔌 数据库连接已关闭");
    }
  }
};

main().catch(console.error);
