import { Elysia } from "elysia";
import {
  RegisterBodyModel,
  RegisterResponseModel,
  LoginBodyModel,
  AuthResponseModel,
  RefreshTokenResponseModel,
  LogoutResponseModel,
} from "../auth.model";
import { authService } from "../auth.service";
import { tokenService } from "../services/token.service";
import {
  jwtPlugin,
  authRateLimiter,
  setAuthCookies,
  clearAuthCookies,
  verifyAuth,
} from "../auth.guard";
import { logger } from "../../../utils/logger";

export const sessionController = new Elysia()
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
        const refreshToken = await tokenService.createRefreshToken(user.id);

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
        const refreshToken = await tokenService.createRefreshToken(user.id);

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

        const { user, newRefreshToken } = await tokenService.rotateRefreshToken(rawToken);
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
        await tokenService.revokeRefreshToken(tokenToRevoke);
      } else {
        try {
          const user = await verifyAuth(headers, jwt, cookie);
          await tokenService.revokeAllUserTokens(user.id);
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
  );
