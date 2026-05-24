import "dotenv/config";
import { defineConfig, env } from "prisma/config";

const url = `mysql://${env("DATABASE_USER")}:${env("DATABASE_PASSWORD")}@${env("DATABASE_HOST")}:3306/${env("DATABASE_NAME")}`;

export default defineConfig({
  schema: "prisma/schema",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url,
  },
});
