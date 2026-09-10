import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { config } from "./config/env";
import { logger } from "./utils/logger";
import { receiptController } from "./modules/receipt/receipt.controller";
import { authController } from "./modules/auth/auth.controller";

export const app = new Elysia()
  // Global Middlewares
  .use(
    cors({
      origin: config.corsOrigin.includes(",")
        ? config.corsOrigin.split(",").map((s) => s.trim())
        : config.corsOrigin,
      credentials: true,
    })
  )
  .use(
    swagger({
      documentation: {
        info: {
          title: "FinTrack Receipt & Financial API",
          version: "1.0.0",
          description: "AI-powered receipt data extraction and financial tracking service using ElysiaJS and Bun",
        },
        tags: [
          { name: "Auth", description: "User authentication & profile endpoints" },
          { name: "Receipts", description: "Receipt extraction endpoints" },
        ],
        components: {
          securitySchemes: {
            cookieAuth: {
              type: "apiKey",
              in: "cookie",
              name: "accessToken",
              description: "Session access token automatically set in HttpOnly cookie upon login or registration",
            },
          },
        },
      },
      path: "/swagger",
    })
  )

  // Global Error Handling
  .onError(({ code, error, set }) => {
    if (code === "VALIDATION") {
      set.status = 400;

      const allErrors: any[] = (error as any).all || [];

      // Filter out redundant TypeBox union errors when property is missing
      const cleaned = allErrors
        .filter((err: any) => {
          if (err.message === "Expected union value" || err.type === 62) {
            return !allErrors.some(
              (other: any) => other.path === err.path && other.type !== 62
            );
          }
          return true;
        })
        .map((err: any) => ({
          field: (err.path || "").replace(/^\//, "") || "root",
          message: err.summary || err.message,
        }));

      // Deduplicate entries
      const details = cleaned.filter(
        (item: any, index: number, self: any[]) =>
          index ===
          self.findIndex(
            (t: any) => t.field === item.field && t.message === item.message
          )
      );

      return {
        success: false,
        error: details[0]?.message || "Validation failed",
        details: details.length > 0 ? details : undefined,
      };
    }

    if (code === "NOT_FOUND") {
      set.status = 404;
      return {
        success: false,
        error: "Endpoint not found",
      };
    }

    const errorMessage =
      "message" in error && typeof error.message === "string"
        ? error.message
        : "Internal Server Error";

    set.status = (error as any).status || 500;
    return {
      success: false,
      error: errorMessage,
    };
  })

  // Modules & Controllers
  .use(authController)
  .use(receiptController)

  // Start Server
  .listen(config.port);

logger.success(`🚀 Server running at http://${app.server?.hostname}:${app.server?.port}`);
logger.info(`📚 Swagger docs available at http://${app.server?.hostname}:${app.server?.port}/swagger`);
