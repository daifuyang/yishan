import fp from "fastify-plugin";
import registerUser from "./user.js";
import registerCommon from "./common.js";

// Schema插件，定义共享的Schema引用
export default fp(async (fastify, opts) => {
  registerCommon(fastify);
  registerUser(fastify);
});
