import { t } from "elysia";

export const ReceiptItemModel = t.Object({
  description: t.Nullable(t.String()),
  quantity: t.Nullable(t.Number()),
  unit_price: t.Nullable(t.Number()),
  total_price: t.Nullable(t.Number()),
});

export const ReceiptMerchantModel = t.Object({
  name: t.Nullable(t.String()),
  address: t.Nullable(t.String()),
  phone: t.Nullable(t.String()),
});

export const ReceiptTransactionModel = t.Object({
  date: t.Nullable(t.String()),
  time: t.Nullable(t.String()),
  invoice_number: t.Nullable(t.String()),
  payment_method: t.Nullable(t.String()),
  currency: t.Nullable(t.String()),
});

export const ReceiptFinancialsModel = t.Object({
  subtotal: t.Nullable(t.Number()),
  tax: t.Nullable(t.Number()),
  service_charge: t.Nullable(t.Number()),
  discount: t.Nullable(t.Number()),
  total: t.Nullable(t.Number()),
});

export const ReceiptDataModel = t.Object({
  merchant: ReceiptMerchantModel,
  transaction: ReceiptTransactionModel,
  items: t.Array(ReceiptItemModel),
  financials: ReceiptFinancialsModel,
});

export const ExtractReceiptBodyModel = t.Object({
  image: t.Union([
    t.File({
      description: "Receipt image file (JPEG, PNG, WEBP)",
    }),
    t.String({
      description: "Base64 data URL or raw base64 string",
    }),
  ]),
  apiKey: t.Optional(
    t.String({
      description: "Optional API Key override. If omitted, uses ROUTER_API_KEY from .env",
    })
  ),
});

export const ExtractReceiptResponseModel = t.Object({
  success: t.Boolean(),
  data: t.Optional(ReceiptDataModel),
  error: t.Optional(t.Any()),
});
