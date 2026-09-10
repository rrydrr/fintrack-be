import { Elysia, t } from "elysia";
import { jwtPlugin, verifyAuth } from "../auth/auth.controller";
import { ExtractReceiptBodyModel } from "./receipt.model";
import { receiptService } from "./receipt.service";

export const receiptController = new Elysia({ prefix: "/receipts" })
  .use(jwtPlugin)
  .guard(
    {
      beforeHandle: async ({ headers, jwt, set }) => {
        try {
          await verifyAuth(headers, jwt);
        } catch (err: any) {
          set.status = err.status || 401;
          return {
            success: false,
            error: err.message || "Unauthorized",
          };
        }
      },
    },
    (app) =>
      app
        .post(
          "/extract",
          async ({ body, headers, jwt, set }) => {
            const user = await verifyAuth(headers, jwt);
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
            body: ExtractReceiptBodyModel,
            detail: {
              summary: "Extract structured data from receipt image and save with ownership",
              tags: ["Receipts"],
              security: [{ bearerAuth: [] }],
            },
          }
        )
        .get(
          "/:id?",
          async ({ params, query, headers, jwt, set }) => {
            const user = await verifyAuth(headers, jwt);
            const targetId = params.id || query.id;

            // If ID is provided, retrieve single receipt
            if (targetId) {
              const receipt = await receiptService.getReceiptById(
                targetId,
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
            }

            // Otherwise, return paginated list
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
            params: t.Object({
              id: t.Optional(t.String({ description: "Optional Receipt UUID in path" })),
            }),
            query: t.Object({
              id: t.Optional(t.String({ description: "Optional Receipt UUID in query" })),
              page: t.Optional(
                t.Numeric({ default: 1, description: "Page number (min: 1)" })
              ),
              limit: t.Optional(
                t.Numeric({ default: 10, description: "Items per page (max: 100)" })
              ),
            }),
            detail: {
              summary: "List receipts with pagination, or get single receipt by optional ID parameter",
              tags: ["Receipts"],
              security: [{ bearerAuth: [] }],
            },
          }
        )
  );
