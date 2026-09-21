import { t } from "elysia";
import { PaginationMetaModel, PaginationQueryModel } from "../../utils/pagination";

export const CurrencyModel = t.Object({
  id: t.String({ description: "Currency ID" }),
  userId: t.Nullable(t.String({ description: "User ID if custom currency, null if system" })),
  code: t.String({ description: "Currency ticker code (e.g. 'IDR', 'USD', 'BTC')" }),
  name: t.String({ description: "Currency display name" }),
  symbol: t.String({ description: "Currency symbol (e.g. 'Rp', '$', '₿')" }),
  symbolPosition: t.String({ description: "Symbol position ('prefix' or 'suffix')" }),
  decimalDigits: t.Number({ description: "Decimal digits precision" }),
  isBase: t.Boolean({ description: "Whether this is the system base currency" }),
  isSystem: t.Boolean({ description: "Whether this is a universal system currency" }),
  isActive: t.Boolean({ description: "Whether the currency is active" }),
  createdAt: t.String({ description: "Creation timestamp" }),
  updatedAt: t.String({ description: "Last update timestamp" }),
});

export const CreateCurrencyBodyModel = t.Object({
  code: t.String({ minLength: 2, maxLength: 10, description: "Currency ticker code (e.g. 'BTC')" }),
  name: t.String({ minLength: 1, maxLength: 100, description: "Currency display name" }),
  symbol: t.String({ minLength: 1, maxLength: 10, description: "Currency symbol (e.g. '₿', 'Rp')" }),
  symbolPosition: t.Optional(t.Union([t.Literal("prefix"), t.Literal("suffix")])),
  decimalDigits: t.Optional(t.Number({ minimum: 0, maximum: 18, default: 0 })),
  isBase: t.Optional(t.Boolean({ description: "Admin only: set as base currency" })),
  isSystem: t.Optional(t.Boolean({ description: "Admin only: create as universal system currency" })),
});

export const UpdateCurrencyBodyModel = t.Object({
  name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
  symbol: t.Optional(t.String({ minLength: 1, maxLength: 10 })),
  symbolPosition: t.Optional(t.Union([t.Literal("prefix"), t.Literal("suffix")])),
  decimalDigits: t.Optional(t.Number({ minimum: 0, maximum: 18 })),
  isActive: t.Optional(t.Boolean()),
});

export const ListCurrenciesQueryModel = t.Object({
  ...PaginationQueryModel.properties,
  search: t.Optional(t.String({ description: "Search by code or name" })),
  isActive: t.Optional(t.BooleanString({ description: "Filter by active status" })),
});

export const ListCurrenciesResponseModel = t.Object({
  success: t.Boolean(),
  data: t.Optional(t.Array(CurrencyModel)),
  pagination: t.Optional(PaginationMetaModel),
  error: t.Optional(t.String()),
});

export const CurrencyDetailResponseModel = t.Object({
  success: t.Boolean(),
  data: t.Optional(CurrencyModel),
  error: t.Optional(t.String()),
});

// --- Exchange Rates Models ---

export const ExchangeRateModel = t.Object({
  id: t.String({ description: "Exchange rate unique ID" }),
  userId: t.Nullable(t.String({ description: "User ID if custom rate, null if system" })),
  fromCurrency: t.String({ description: "Source currency code" }),
  toCurrency: t.String({ description: "Target currency code (defaults to 'IDR')" }),
  rate: t.String({ description: "Exchange rate as numeric string" }),
  effectiveDate: t.String({ description: "Effective timestamp" }),
  createdAt: t.String({ description: "Creation timestamp" }),
  updatedAt: t.String({ description: "Update timestamp" }),
});

export const CreateExchangeRateBodyModel = t.Object({
  fromCurrency: t.String({ minLength: 2, maxLength: 10 }),
  toCurrency: t.Optional(t.String({ minLength: 2, maxLength: 10, default: "IDR" })),
  rate: t.Number({ minimum: 0.00000001, description: "Exchange rate (e.g. 1 USD = 16000 IDR)" }),
  effectiveDate: t.Optional(t.String({ description: "Optional effective ISO timestamp" })),
  isSystem: t.Optional(t.Boolean({ description: "Admin only: set as universal system rate" })),
});

export const ListRatesQueryModel = t.Object({
  ...PaginationQueryModel.properties,
  fromCurrency: t.Optional(t.String()),
  toCurrency: t.Optional(t.String()),
});

export const ListRatesResponseModel = t.Object({
  success: t.Boolean(),
  data: t.Optional(t.Array(ExchangeRateModel)),
  pagination: t.Optional(PaginationMetaModel),
  error: t.Optional(t.String()),
});

export const ExchangeRateDetailResponseModel = t.Object({
  success: t.Boolean(),
  data: t.Optional(ExchangeRateModel),
  error: t.Optional(t.String()),
});

export const ActionSuccessResponseModel = t.Object({
  success: t.Boolean(),
  message: t.Optional(t.String()),
  error: t.Optional(t.String()),
});
