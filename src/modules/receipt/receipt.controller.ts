import { Elysia } from "elysia";
import { ExtractReceiptBodyModel } from "./receipt.model";
import { receiptService } from "./receipt.service";

export const receiptController = new Elysia({ prefix: "/receipts" })
  .post(
    "/extract",
    async ({ body, headers, set }) => {
      const authHeader = headers["authorization"];
      const xApiKey = headers["x-api-key"];
      const rawKey = body.apiKey || xApiKey || authHeader;
      const cleanKey = rawKey ? rawKey.replace(/^Bearer\s+/i, "").trim() : undefined;

      try {
        const data = await receiptService.extractReceipt(body.image, cleanKey);
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
        summary: "Extract structured data from receipt image",
        tags: ["Receipts"],
      },
    }
  )
  .get(
    "/",
    async () => {
      const allReceipts = await receiptService.getReceipts();
      return {
        success: true,
        data: allReceipts,
      };
    },
    {
      detail: {
        summary: "List all receipts and raw AI responses from DB",
        tags: ["Receipts"],
      },
    }
  );
