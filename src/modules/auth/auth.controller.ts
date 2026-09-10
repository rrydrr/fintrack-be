import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { config } from "../../config/env";
import { UserRole } from "../../db/schema";
import {
  RegisterBodyModel,
  RegisterResponseModel,
  LoginBodyModel,
  AuthResponseModel,
  MeResponseModel,
} from "./auth.model";
import { authService, SafeUser } from "./auth.service";

/**
 * Shared JWT plugin instance configured with FinTrack settings.
 */
export const jwtPlugin = new Elysia({ name: "jwt-auth" }).use(
  jwt({
    name: "jwt",
    secret: config.jwtSecret,
    exp: config.jwtExp,
  })
);

/**
 * Helper to verify Bearer JWT from headers and resolve the authenticated user.
 * Throws 401 if token is missing, invalid, or expired.
 */
export async function verifyAuth(
  headers: Record<string, string | undefined>,
  jwtInstance: any
): Promise<SafeUser> {
  const authHeader = headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    const err: any = new Error("Unauthorized: Missing or invalid Bearer token");
    err.status = 401;
    throw err;
  }

  const rawToken = authHeader.replace(/^Bearer\s+/i, "").trim();
  const payload = await jwtInstance.verify(rawToken);

  if (!payload || !payload.sub) {
    const err: any = new Error("Unauthorized: Invalid or expired token");
    err.status = 401;
    throw err;
  }

  return await authService.findById(payload.sub as string);
}

/**
 * Helper to verify Bearer JWT and validate that the user has one of the allowed roles.
 * Throws 401 if unauthenticated, or 403 if role is not permitted.
 */
export async function verifyRole(
  headers: Record<string, string | undefined>,
  jwtInstance: any,
  allowedRoles: UserRole[]
): Promise<SafeUser> {
  const user = await verifyAuth(headers, jwtInstance);
  if (!allowedRoles.includes(user.role)) {
    const err: any = new Error("Forbidden: Insufficient permissions");
    err.status = 403;
    throw err;
  }
  return user;
}

/**
 * Reusable guard hook configuration requiring specified roles.
 * Usage: .guard(requireRole("admin"), (app) => ...)
 */
export const requireRole = (...allowedRoles: UserRole[]) => ({
  beforeHandle: async ({ headers, jwt, set }: any) => {
    try {
      await verifyRole(headers, jwt, allowedRoles);
    } catch (err: any) {
      set.status = err.status || 401;
      return {
        success: false,
        error: err.message || "Unauthorized",
      };
    }
  },
});

/**
 * Role-based access control plugin providing macro support.
 * Usage: .use(rolePlugin).get('/admin-route', handler, { roles: ['admin'] })
 */
export const rolePlugin = new Elysia({ name: "role-auth" })
  .use(jwtPlugin)
  .macro({
    roles: (allowedRoles: UserRole[]) => ({
      beforeHandle: async ({ headers, jwt, set }: any) => {
        try {
          await verifyRole(headers, jwt, allowedRoles);
        } catch (err: any) {
          set.status = err.status || 401;
          return {
            success: false,
            error: err.message || "Unauthorized",
          };
        }
      },
    }),
  });

export const authController = new Elysia({ prefix: "/auth" })
  .use(jwtPlugin)
  .post(
    "/register",
    async ({ body, jwt, set }) => {
      try {
        const user = await authService.register(body);
        const token = await jwt.sign({
          sub: user.id,
          email: user.email,
          role: user.role,
        });

        set.status = 201;
        return {
          success: true,
          data: {
            token,
            email: user.email,
          },
        };
      } catch (err: any) {
        set.status = err.status || 500;
        return {
          success: false,
          error: err.message || "Registration failed",
        };
      }
    },
    {
      body: RegisterBodyModel,
      response: RegisterResponseModel,
      detail: {
        summary: "Register a new user account",
        tags: ["Auth"],
      },
    }
  )
  .post(
    "/login",
    async ({ body, jwt, set }) => {
      try {
        const user = await authService.login(body);
        const token = await jwt.sign({
          sub: user.id,
          email: user.email,
          role: user.role,
        });

        return {
          success: true,
          data: {
            token,
            email: user.email,
          },
        };
      } catch (err: any) {
        set.status = err.status || 401;
        return {
          success: false,
          error: err.message || "Authentication failed",
        };
      }
    },
    {
      body: LoginBodyModel,
      response: AuthResponseModel,
      detail: {
        summary: "Log in with email and password",
        tags: ["Auth"],
      },
    }
  )
  .get(
    "/me",
    async ({ headers, jwt, set }) => {
      try {
        const user = await verifyAuth(headers, jwt);
        return {
          success: true,
          data: user,
        };
      } catch (err: any) {
        set.status = err.status || 401;
        return {
          success: false,
          error: err.message || "Unauthorized",
        };
      }
    },
    {
      response: MeResponseModel,
      detail: {
        summary: "Get current authenticated user profile",
        tags: ["Auth"],
        security: [{ bearerAuth: [] }],
      },
    }
  );
