import { Elysia } from "elysia";
import {
  MeResponseModel,
  UpdateCurrencyBodyModel,
  UpdateCurrencyResponseModel,
} from "../auth.model";
import { userService } from "../services/user.service";
import { jwtPlugin, verifyAuth } from "../auth.guard";

export const userController = new Elysia()
  .use(jwtPlugin)
  .get(
    "/me",
    async ({ headers, cookie, jwt, set }) => {
      try {
        const tokenUser = await verifyAuth(headers, jwt, cookie);
        // Query fresh user profile from DB for /me endpoint
        const freshUser = await userService.findById(tokenUser.id);
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
        const updated = await userService.updateDefaultCurrency(tokenUser.id, body.currency);
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
