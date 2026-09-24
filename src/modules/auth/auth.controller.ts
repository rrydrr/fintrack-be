import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { config } from "../../config/env";
import { UserRole } from "../../db/schema";
import {
  RegisterBodyModel,
  RegisterResponseModel,
  LoginBodyModel,
  AuthResponseModel,
  MeResponseModel,
  RefreshTokenResponseModel,
  LogoutResponseModel,
  CreateInviteBodyModel,
  CreateInviteResponseModel,
  ListInvitesResponseModel,
  RevokeInviteResponseModel,
  VerifyEmailBodyModel,
  VerifyEmailResponseModel,
  ResendVerificationBodyModel,
  ResendVerificationResponseModel,
  UpdateCurrencyBodyModel,
  UpdateCurrencyResponseModel,
} from "./auth.model";


import { authService, SafeUser } from "./auth.service";
import { logger } from "../../utils/logger";
import { createRateLimiter } from "../../utils/rate-limiter";

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
function parseExpToSeconds(exp: string | number, fallbackSeconds = 900): number {
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

export const authController = new Elysia({ prefix: "/auth" })
  .use(jwtPlugin)
  .post(
    "/register",
    async ({ body, cookie, jwt, set }) => {
      try {
        const user = await authService.register(body);
        const accessToken = await jwt.sign({
          sub: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          defaultCurrency: user.defaultCurrency,
          emailVerified: user.emailVerified,
          emailVerifiedAt: user.emailVerifiedAt,
        });
        const refreshToken = await authService.createRefreshToken(user.id);

        // Automatically set HTTP-only cookies
        setAuthCookies(cookie, accessToken, refreshToken);

        set.status = 201;
        return {
          success: true,
          data: user,
        };
      } catch (err: any) {
        if (err.status) {
          set.status = err.status;
          return {
            success: false,
            error: err.message || "Registration failed",
          };
        }
        logger.error("Unexpected error during registration", err);
        set.status = 500;
        return {
          success: false,
          error: "An unexpected error occurred during registration",
        };
      }
    },
    {
      beforeHandle: authRateLimiter.beforeHandle,
      body: RegisterBodyModel,
      response: RegisterResponseModel,
      detail: {
        summary: "Register",
        tags: ["Auth"],
      },
    }
  )
  .post(
    "/login",
    async ({ body, cookie, jwt, set }) => {
      try {
        const user = await authService.login(body);
        const accessToken = await jwt.sign({
          sub: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          defaultCurrency: user.defaultCurrency,
          emailVerified: user.emailVerified,
          emailVerifiedAt: user.emailVerifiedAt,
        });
        const refreshToken = await authService.createRefreshToken(user.id);

        // Automatically set HTTP-only cookies
        setAuthCookies(cookie, accessToken, refreshToken);

        return {
          success: true,
          data: user,
        };
      } catch (err: any) {
        if (err.status) {
          set.status = err.status;
          return {
            success: false,
            error: err.message || "Authentication failed",
          };
        }
        logger.error("Unexpected error during login", err);
        set.status = 500;
        return {
          success: false,
          error: "An unexpected error occurred during authentication",
        };
      }
    },
    {
      beforeHandle: authRateLimiter.beforeHandle,
      body: LoginBodyModel,
      response: AuthResponseModel,
      detail: {
        summary: "Login",
        tags: ["Auth"],
      },
    }
  )
  .post(
    "/refresh",
    async ({ cookie, jwt, set }) => {
      try {
        const rawToken =
          typeof cookie?.refreshToken?.value === "string" && cookie.refreshToken.value.length > 0
            ? cookie.refreshToken.value
            : undefined;

        if (!rawToken) {
          set.status = 400;
          return {
            success: false,
            error: "Refresh token is missing or invalid in session cookie",
          };
        }

        const { user, newRefreshToken } = await authService.rotateRefreshToken(
          rawToken
        );
        const accessToken = await jwt.sign({
          sub: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          defaultCurrency: user.defaultCurrency,
          emailVerified: user.emailVerified,
          emailVerifiedAt: user.emailVerifiedAt,
        });

        // Automatically update cookies with the new rotated pair
        setAuthCookies(cookie, accessToken, newRefreshToken);

        return {
          success: true,
          message: "Token refreshed successfully",
        };
      } catch (err: any) {
        if (err.status) {
          set.status = err.status;
          return {
            success: false,
            error: err.message || "Failed to refresh token",
          };
        }
        logger.error("Unexpected error during token refresh", err);
        set.status = 500;
        return {
          success: false,
          error: "An unexpected error occurred while refreshing session",
        };
      }
    },
    {
      response: RefreshTokenResponseModel,
      detail: {
        summary: "Refresh token",
        tags: ["Auth"],
        security: [{ cookieAuth: [] }],
      },
    }
  )
  .post(
    "/logout",
    async ({ cookie, headers, jwt }) => {
      const tokenToRevoke =
        typeof cookie?.refreshToken?.value === "string" && cookie.refreshToken.value.length > 0
          ? cookie.refreshToken.value
          : undefined;

      if (tokenToRevoke) {
        await authService.revokeRefreshToken(tokenToRevoke);
      } else {
        try {
          const user = await verifyAuth(headers, jwt, cookie);
          await authService.revokeAllUserTokens(user.id);
        } catch {
          // Ignore unauthenticated requests during general logout
        }
      }

      // Automatically clear HTTP-only cookies
      clearAuthCookies(cookie);

      return {
        success: true,
        message: "Logged out successfully",
      };
    },
    {
      response: LogoutResponseModel,
      detail: {
        summary: "Logout",
        tags: ["Auth"],
        security: [{ cookieAuth: [] }],
      },
    }
  )
  .post(
    "/verify-email",
    async ({ body, set }) => {
      try {
        const verifiedUser = await authService.verifyEmail(body.token);
        return {
          success: true,
          message: "Email verified successfully",
          data: verifiedUser,
        };
      } catch (err: any) {
        set.status = err.status || 500;
        return {
          success: false,
          error: err.message || "Failed to verify email",
        };
      }
    },
    {
      beforeHandle: authRateLimiter.beforeHandle,
      body: VerifyEmailBodyModel,
      response: VerifyEmailResponseModel,
      detail: {
        summary: "Verify email",
        tags: ["Auth"],
      },
    }
  )
  .get(
    "/verify-email/:token",
    async ({ params, set }) => {
      try {
        const verifiedUser = await authService.verifyEmail(params.token);
        return {
          success: true,
          message: "Email verified successfully",
          data: verifiedUser,
        };
      } catch (err: any) {
        set.status = err.status || 500;
        return {
          success: false,
          error: err.message || "Failed to verify email",
        };
      }
    },
    {
      beforeHandle: authRateLimiter.beforeHandle,
      params: t.Object({
        token: t.String({ description: "Verification token" }),
      }),
      response: VerifyEmailResponseModel,
      detail: {
        summary: "Verify email via link",
        tags: ["Auth"],
      },
    }
  )
  .post(
    "/resend-verification",
    async ({ body, set }) => {
      try {
        await authService.resendVerificationEmail(body.email);
        return {
          success: true,
          message: "Verification email sent successfully. Please check your inbox.",
        };
      } catch (err: any) {
        set.status = err.status || 500;
        return {
          success: false,
          error: err.message || "Failed to resend verification email",
        };
      }
    },
    {
      beforeHandle: authRateLimiter.beforeHandle,
      body: ResendVerificationBodyModel,
      response: ResendVerificationResponseModel,
      detail: {
        summary: "Resend verification email",
        tags: ["Auth"],
      },
    }
  )
  .get(
    "/me",
    async ({ headers, cookie, jwt, set }) => {
      try {
        const tokenUser = await verifyAuth(headers, jwt, cookie);
        // Query fresh user profile from DB for /me endpoint
        const freshUser = await authService.findById(tokenUser.id);
        return {
          success: true,
          data: freshUser,
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
        summary: "Get current user",
        tags: ["Auth"],
        security: [{ cookieAuth: [] }],
      },
    }
  )
  .patch(
    "/me/currency",
    async ({ headers, cookie, jwt, body, set }) => {
      try {
        const tokenUser = await verifyAuth(headers, jwt, cookie);
        const updated = await authService.updateDefaultCurrency(tokenUser.id, body.currency);
        return {
          success: true,
          message: `Default currency updated to ${updated.defaultCurrency}`,
          data: updated,
        };
      } catch (err: any) {
        set.status = err.status || 500;
        return {
          success: false,
          error: err.message || "Failed to update default currency",
        };
      }
    },
    {
      body: UpdateCurrencyBodyModel,
      response: UpdateCurrencyResponseModel,
      detail: {
        summary: "Update default currency",
        tags: ["Auth"],
        security: [{ cookieAuth: [] }],
      },
    }
  );

/**
 * Admin invite code management controller.
 * Mounted at /auth/invites.
 */
export const inviteController = new Elysia({ prefix: "/invites" })
  .use(authPlugin)
  .post(
    "/",
    async ({ body, user }) => {
      const expiresInDays = body?.expiresInDays ? Number(body.expiresInDays) : 7;
      const invite = await authService.createInviteCode(user.id, expiresInDays);
      return {
        success: true,
        data: invite,
      };
    },
    {
      roles: ["admin"],
      body: CreateInviteBodyModel,
      response: CreateInviteResponseModel,
      detail: {
        summary: "Create invite code",
        tags: ["Auth"],
        security: [{ cookieAuth: [] }],
      },
    }
  )
  .get(
    "/",
    async () => {
      const invites = await authService.listInviteCodes();
      return {
        success: true,
        data: invites,
      };
    },
    {
      roles: ["admin"],
      response: ListInvitesResponseModel,
      detail: {
        summary: "List invite codes",
        tags: ["Auth"],
        security: [{ cookieAuth: [] }],
      },
    }
  )
  .delete(
    "/:id",
    async ({ params }) => {
      await authService.revokeInviteCode(params.id);
      return {
        success: true,
        message: "Invite code revoked successfully",
      };
    },
    {
      roles: ["admin"],
      params: t.Object({
        id: t.String({ description: "Invite unique ID" }),
      }),
      response: RevokeInviteResponseModel,
      detail: {
        summary: "Revoke invite code",
        tags: ["Auth"],
        security: [{ cookieAuth: [] }],
      },
    }
  );

// Mount inviteController onto authController
authController.use(inviteController);



