import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { config } from "../../config/env";
import { UserRole } from "../../db/schema";
import { createRateLimiter } from "../../utils/rate-limiter";

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  defaultCurrency: string;
  emailVerified: boolean;
  emailVerifiedAt: string | null;
}

/**
 * Rate limiter for sensitive authentication routes:
 * Allows max 5 attempts per minute per IP address.
 */
export const authRateLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 5,
  message: "Too many attempts. Please try again after 1 minute.",
});

/**
 * Shared JWT plugin instance configured with FinTrack settings.
 */
export const jwtPlugin = new Elysia({ name: "jwt-auth" }).use(
  jwt({
    name: "jwt",
    secret: config.jwtSecret,
    exp: config.jwtAccessExp,
  })
);

/**
 * Parse time expression like '15m', '1h', '7d', or number of seconds into integer seconds.
 */
export function parseExpToSeconds(exp: string | number, fallbackSeconds = 900): number {
  if (typeof exp === "number") return exp;
  const match = exp.trim().match(/^(\d+)([smhd])?$/);
  if (!match) return fallbackSeconds;
  const val = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case "s":
      return val;
    case "m":
      return val * 60;
    case "h":
      return val * 3600;
    case "d":
      return val * 86400;
    default:
      return val;
  }
}

/**
 * Helper to set HTTP-only authentication cookies for accessToken and refreshToken.
 */
export function setAuthCookies(
  cookie: Record<string, any>,
  accessToken: string,
  refreshToken: string
) {
  const isProd = config.nodeEnv === "production";
  const accessMaxAge = parseExpToSeconds(config.jwtAccessExp, 900);
  const refreshMaxAge = config.jwtRefreshExpDays * 86400;

  cookie.accessToken?.set({
    value: accessToken,
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/",
    maxAge: accessMaxAge,
  });

  cookie.refreshToken?.set({
    value: refreshToken,
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/",
    maxAge: refreshMaxAge,
  });
}

/**
 * Helper to clear authentication cookies on logout.
 */
export function clearAuthCookies(cookie: Record<string, any>) {
  const isProd = config.nodeEnv === "production";

  cookie.accessToken?.set({
    value: "",
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/",
    maxAge: 0,
  });

  cookie.refreshToken?.set({
    value: "",
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Helper to verify Bearer JWT from headers or accessToken cookie, and resolve the authenticated user statelessly.
 * Throws 401 if token is missing, invalid, or expired.
 */
export async function verifyAuth(
  headers: Record<string, string | undefined>,
  jwtInstance: any,
  cookie?: Record<string, any>
): Promise<SafeUser> {
  let rawToken: string | undefined = cookie?.accessToken?.value;
  if (!rawToken && headers["authorization"]?.startsWith("Bearer ")) {
    rawToken = headers["authorization"].replace(/^Bearer\s+/i, "").trim();
  }

  if (!rawToken) {
    const err: any = new Error("Unauthorized: Missing or invalid session cookie");
    err.status = 401;
    throw err;
  }

  const payload = await jwtInstance.verify(rawToken);

  if (!payload || !payload.sub) {
    const err: any = new Error("Unauthorized: Invalid or expired token");
    err.status = 401;
    throw err;
  }

  return {
    id: payload.sub as string,
    name: (payload.name as string) || "",
    email: (payload.email as string) || "",
    role: (payload.role as UserRole) || "user",
    defaultCurrency: (payload.defaultCurrency as string) || "IDR",
    emailVerified: Boolean(payload.emailVerified),
    emailVerifiedAt: (payload.emailVerifiedAt as string) || null,
  };
}

/**
 * Helper to verify JWT from headers or cookies and validate allowed roles.
 * Throws 401 if unauthenticated, or 403 if role is not permitted.
 */
export async function verifyRole(
  headers: Record<string, string | undefined>,
  jwtInstance: any,
  allowedRoles: UserRole[],
  cookie?: Record<string, any>
): Promise<SafeUser> {
  const user = await verifyAuth(headers, jwtInstance, cookie);
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
  beforeHandle: async ({ user, set }: any) => {
    if (!user || !allowedRoles.includes(user.role)) {
      set.status = 403;
      return {
        success: false,
        error: "Forbidden: Insufficient permissions",
      };
    }
  },
});

/**
 * Scoped authentication guard plugin.
 * Derives authenticated { user } once into route context without duplicate DB queries.
 * Provides .macro({ roles: [...] }) for role-based authorization.
 */
export const authPlugin = new Elysia({ name: "auth-guard" })
  .use(jwtPlugin)
  .derive({ as: "scoped" }, async ({ headers, cookie, jwt }) => {
    const user = await verifyAuth(headers, jwt, cookie);
    return { user };
  })
  .onError({ as: "scoped" }, ({ error, set }) => {
    const status = (error as any).status;
    if (status === 401 || status === 403) {
      set.status = status;
      const errorMessage =
        "message" in error && typeof error.message === "string"
          ? error.message
          : "Unauthorized";
      return {
        success: false,
        error: errorMessage,
      };
    }
  })
  .macro({
    roles: (allowedRoles: UserRole[]) => ({
      beforeHandle: ({ user, set }: any) => {
        if (!user || !allowedRoles.includes(user.role)) {
          set.status = 403;
          return {
            success: false,
            error: "Forbidden: Insufficient permissions",
          };
        }
      },
    }),
  });

/**
 * Role-based access control plugin providing macro support (alias to authPlugin).
 */
export const rolePlugin = authPlugin;
