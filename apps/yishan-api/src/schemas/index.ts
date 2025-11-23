import fp from "fastify-plugin";
import registerUser from "./user.js";
import registerCommon from "./common.js";
import registerAuth from "./auth.js";
import registerSystem from "./system.js";
import registerRole from "./role.js";
import registerDepartment from "./department.js";
import registerPost from "./post.js";
import registerMenu from "./menu.js";
import registerDict from "./dict.js";
import registerArticleSchemas from "./article.js";
import registerPageSchemas from "./page.js";

// Schema插件，定义共享的Schema引用
export default fp(async (fastify, opts) => {
  registerCommon(fastify);
  registerUser(fastify);
  registerAuth(fastify);
  registerSystem(fastify);
  registerRole(fastify);
  registerDepartment(fastify);
  registerPost(fastify);
  registerMenu(fastify);
  registerDict(fastify);
  registerArticleSchemas(fastify);
  registerPageSchemas(fastify);
});
