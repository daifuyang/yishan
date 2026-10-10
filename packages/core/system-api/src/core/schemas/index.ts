import fp from "fastify-plugin";
import registerUser from "./user.js";
import registerCommon from "./common.js";
import registerAuth from "./auth.js";
import registerSystem from "./system.js";
import registerRole from "./role.js";
import registerDepartment from "./department.js";
import registerPosition from "./position.js";
import registerMenu from "./menu.js";
import registerDict from "./dict.js";
import registerAttachment from "./attachment.js";
import registerLoginLog from "./login-log.js";
import { registerApiToken } from "./api-token.js";
import registerPermission from './permission.js';

// Schema插件，定义共享的Schema引用
export default fp(async (fastify, opts) => {
  registerCommon(fastify);
  registerUser(fastify);
  registerAuth(fastify);
  registerSystem(fastify);
  registerRole(fastify);
  registerDepartment(fastify);
  registerPosition(fastify);
  registerMenu(fastify);
  registerDict(fastify);
  registerAttachment(fastify);
  registerLoginLog(fastify);
  registerApiToken(fastify);
  registerPermission(fastify);
});
