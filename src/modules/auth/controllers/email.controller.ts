import { Elysia, t } from "elysia";
import {
  VerifyEmailBodyModel,
  VerifyEmailResponseModel,
  ResendVerificationBodyModel,
  ResendVerificationResponseModel,
} from "../auth.model";
import { emailVerificationService } from "../services/email-verification.service";
import { authRateLimiter } from "../auth.guard";

export const emailController = new Elysia()
  .post(
    "/verify-email",
    async ({ body, set }) => {
      try {
        const verifiedUser = await emailVerificationService.verifyEmail(body.token);
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
        const verifiedUser = await emailVerificationService.verifyEmail(params.token);
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
        await emailVerificationService.resendVerificationEmail(body.email);
        return {
          success: true,
          message:
            "If your email is registered, a verification link has been sent. Please check your inbox.",
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
  );
