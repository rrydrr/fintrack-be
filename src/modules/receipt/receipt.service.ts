import { desc } from "drizzle-orm";
import { config } from "../../config/env";
import { RECEIPT_SYSTEM_PROMPT, RECEIPT_USER_PROMPT } from "../../constants/prompts";
import { db } from "../../db";
import { receipts } from "../../db/schema";
import { formatImageUrl } from "../../utils/image";
import { logger } from "../../utils/logger";

export class ReceiptService {
  /**
   * Forwards receipt image to AI endpoint and returns parsed JSON.
   */
  public async extractReceipt(
    imageInput: File | Blob | string,
    customApiKey?: string
  ) {
    const apiKey = customApiKey || config.routerApiKey;
    if (!apiKey) {
      const error: any = new Error(
        "Missing API Key. Please configure ROUTER_API_KEY in .env or supply it in the request."
      );
      error.status = 401;
      throw error;
    }

    const endpoint = config.routerEndpoint;
    if (!endpoint) {
      const error: any = new Error("ROUTER_ENDPOINT is not configured in .env");
      error.status = 500;
      throw error;
    }

    const imageUrl = await formatImageUrl(imageInput);

    logger.info("Forwarding receipt image to AI router...");

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        model: "Hermes",
        stream: false,
        temperature: 0.1,
        response_format: {
          type: "json_object",
        },
        messages: [
          {
            role: "system",
            content: RECEIPT_SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: RECEIPT_USER_PROMPT,
              },
              {
                type: "image_url",
                image_url: {
                  url: imageUrl,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData: any = errorText;
      try {
        errorData = JSON.parse(errorText);
      } catch {}

      logger.error(`AI router error (${response.status})`, errorData);
      const error: any = new Error(
        typeof errorData === "object" ? JSON.stringify(errorData) : errorData
      );
      error.status = response.status;
      error.data = errorData;
      throw error;
    }

    const completion = await response.json();

    // Log raw payload to rotating files & summary to terminal
    logger.raw("Receipt Extraction Completion", completion);

    // Parse assistant's JSON response
    const rawContent = completion?.choices?.[0]?.message?.content;
    let receiptData = null;

    if (rawContent) {
      try {
        receiptData = JSON.parse(rawContent);
      } catch {
        receiptData = rawContent;
      }
    }

    logger.success("Receipt parsed successfully", {
      merchant: receiptData?.merchant?.name || "Unknown",
      total: receiptData?.financials?.total ?? null,
    });

    // 5. Store parsed data and raw AI response in database
    let savedId: string | undefined;
    try {
      const [inserted] = await db
        .insert(receipts)
        .values({
          merchantName: receiptData?.merchant?.name || null,
          transactionDate: receiptData?.transaction?.date || null,
          totalAmount:
            receiptData?.financials?.total != null
              ? String(receiptData.financials.total)
              : null,
          currency: receiptData?.transaction?.currency || null,
          parsedData: receiptData,
          rawResponse: completion,
        })
        .returning();

      if (inserted) {
        savedId = inserted.id;
        logger.success("Saved receipt & raw AI response to DB", { id: inserted.id });
      }
    } catch (dbErr: any) {
      logger.error("Failed to store receipt in DB", dbErr.message || dbErr);
    }

    return {
      id: savedId,
      ...receiptData,
    };
  }

  /**
   * Retrieves all receipts stored in the database.
   */
  public async getReceipts() {
    return await db.select().from(receipts).orderBy(desc(receipts.createdAt));
  }

  /**
   * Retrieves a single receipt by ID from the database.
   */
  public async getReceiptById(id: string) {
    const results = await db.select().from(receipts).where(desc(receipts.createdAt));
    return results.find((r) => r.id === id) || null;
  }
}

export const receiptService = new ReceiptService();
