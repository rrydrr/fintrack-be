import { Elysia, t } from "elysia";
import { authPlugin } from "../auth/auth.controller";
import { ExtractReceiptBodyModel } from "./receipt.model";
import { receiptService } from "./receipt.service";

export const receiptController = new Elysia({ prefix: "/receipts" })
  .use(authPlugin)
  .post(
    "/extract",
    async ({ body, headers, user, set }) => {
      const xApiKey = headers["x-api-key"];
      const cleanKey = xApiKey ? xApiKey.replace(/^Bearer\s+/i, "").trim() : undefined;

      try {
        const data = await receiptService.extractReceipt(body.image, user.id, cleanKey);
        return {
          success: true,
          data,
        };
      } catch (err: any) {
        set.status = err.status || 500;
        return {
          success: false,
          error: err.data || err.message || "An unexpected error occurred",
        };
      }
    },
    {
      parse: "formdata",
      body: ExtractReceiptBodyModel,
      detail: {
        summary: "Extract receipt",
        tags: ["Receipts"],
        security: [{ cookieAuth: [] }],
      },
    }
  )
  .get(
    "/",
    async ({ query, user }) => {
      const page = Math.max(1, Number(query.page) || 1);
      const limit = Math.max(1, Math.min(100, Number(query.limit) || 10));

      const result = await receiptService.getReceipts({
        userId: user.id,
        isAdmin: user.role === "admin",
        page,
        limit,
      });

      return {
        success: true,
        data: result.items,
        pagination: result.pagination,
      };
    },
    {
      query: t.Object({
        page: t.Optional(
          t.Numeric({ default: 1, description: "Page number" })
        ),
        limit: t.Optional(
          t.Numeric({ default: 10, description: "Items per page" })
        ),
      }),
      detail: {
        summary: "List receipts",
        tags: ["Receipts"],
        security: [{ cookieAuth: [] }],
      },
    }
  )
  .get(
    "/:id",
    async ({ params, user, set }) => {
      const receipt = await receiptService.getReceiptById(
        params.id,
        user.id,
        user.role === "admin"
      );

      if (!receipt) {
        set.status = 404;
        return {
          success: false,
          error: "Receipt not found",
        };
      }

      return {
        success: true,
        data: receipt,
      };
    },
    {
      params: t.Object({
        id: t.String({ description: "Receipt ID" }),
      }),
      detail: {
        summary: "Get receipt",
        tags: ["Receipts"],
        security: [{ cookieAuth: [] }],
      },
    }
  );

