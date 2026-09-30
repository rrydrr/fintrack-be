import { Elysia } from "elysia";
import { jwtPlugin } from "./auth.guard";
import { inviteController } from "./controllers/invite.controller";
import { sessionController } from "./controllers/session.controller";
import { emailController } from "./controllers/email.controller";
import { userController } from "./controllers/user.controller";

// Re-export guards, plugins, and helpers for backward compatibility
export {
  authRateLimiter,
  jwtPlugin,
  parseExpToSeconds,
  setAuthCookies,
  clearAuthCookies,
  verifyAuth,
  verifyRole,
  requireRole,
  authPlugin,
  rolePlugin,
  type SafeUser,
} from "./auth.guard";

// Re-export subcontrollers
export { inviteController } from "./controllers/invite.controller";
export { sessionController } from "./controllers/session.controller";
export { emailController } from "./controllers/email.controller";
export { userController } from "./controllers/user.controller";

/**
 * Main Auth Controller composition root.
 * Mounts all auth domain subcontrollers under the /auth prefix.
 */
export const authController = new Elysia({ prefix: "/auth" })
  .use(jwtPlugin)
  .use(inviteController)
  .use(sessionController)
  .use(emailController)
  .use(userController);
