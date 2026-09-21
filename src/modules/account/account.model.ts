import { t } from "elysia";
import { PaginationMetaModel, PaginationQueryModel } from "../../utils/pagination";
import { AccountNatureModel } from "../account-type/account-type.model";

export const AccountModel = t.Object({
  id: t.String({ description: "Account unique ID" }),
  userId: t.String({ description: "Owner user ID" }),
  accountTypeId: t.String({ description: "Account type reference ID" }),
  accountType: t.Optional(
    t.Object({
      id: t.String(),
      name: t.String(),
      code: t.String(),
      nature: AccountNatureModel,
      icon: t.Nullable(t.String()),
      color: t.Nullable(t.String()),
    })
  ),
  currencyCode: t.String({ description: "Currency ticker code (e.g. 'IDR', 'USD', 'BTC')" }),
  name: t.String({ description: "Account display name (e.g. 'BCA Tabungan')" }),
  institutionName: t.Nullable(t.String({ description: "Bank or institution name" })),
  accountNumber: t.Nullable(t.String({ description: "Masked account number" })),
  currentBalance: t.String({ description: "Current balance as formatted numeric string" }),
  initialBalance: t.String({ description: "Initial balance" }),
  creditLimit: t.Nullable(t.String()),
  interestRate: t.Nullable(t.String()),
  paymentDate: t.Nullable(t.String({ description: "Payment date or recurring payment day (e.g. '10' or '2026-10-10')" })),
  dueDate: t.Nullable(t.String({ description: "Payment due date or recurring due day (e.g. '25' or '2026-10-25')" })),
  color: t.Nullable(t.String()),
  icon: t.Nullable(t.String()),
  notes: t.Nullable(t.String()),
  isExcludedFromNetWorth: t.Boolean(),
  isArchived: t.Boolean(),
  createdAt: t.String(),
  updatedAt: t.String(),
});

export const CreateAccountBodyModel = t.Object({
  name: t.String({ minLength: 1, maxLength: 100, description: "Account name" }),
  accountTypeId: t.String({ description: "Account type ID" }),
  currencyCode: t.Optional(
    t.String({ minLength: 2, maxLength: 10, description: "Currency code (defaults to user default currency)" })
  ),
  institutionName: t.Optional(t.String({ maxLength: 100 })),
  accountNumber: t.Optional(t.String({ maxLength: 50 })),
  initialBalance: t.Optional(t.Number({ default: 0, description: "Starting balance" })),
  currentBalance: t.Optional(t.Number({ description: "Current balance (defaults to initialBalance)" })),
  creditLimit: t.Optional(t.Number({ minimum: 0 })),
  interestRate: t.Optional(t.Number({ minimum: 0 })),
  paymentDate: t.Optional(t.String({ description: "Payment date or recurring day of month (e.g. '10' or '2026-10-10')" })),
  dueDate: t.Optional(t.String({ description: "Payment due date or recurring day of month (e.g. '25' or '2026-10-25')" })),
  color: t.Optional(t.String()),
  icon: t.Optional(t.String()),
  notes: t.Optional(t.String()),
  isExcludedFromNetWorth: t.Optional(t.Boolean({ default: false })),
});

export const UpdateAccountBodyModel = t.Object({
  name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
  accountTypeId: t.Optional(t.String()),
  currencyCode: t.Optional(t.String({ minLength: 2, maxLength: 10 })),
  institutionName: t.Optional(t.String({ maxLength: 100 })),
  accountNumber: t.Optional(t.String({ maxLength: 50 })),
  currentBalance: t.Optional(t.Number()),
  creditLimit: t.Optional(t.Number({ minimum: 0 })),
  interestRate: t.Optional(t.Number({ minimum: 0 })),
  paymentDate: t.Optional(t.String()),
  dueDate: t.Optional(t.String()),
  color: t.Optional(t.String()),
  icon: t.Optional(t.String()),
  notes: t.Optional(t.String()),
  isExcludedFromNetWorth: t.Optional(t.Boolean()),
  isArchived: t.Optional(t.Boolean()),
});

export const ListAccountsQueryModel = t.Object({
  ...PaginationQueryModel.properties,
  accountTypeId: t.Optional(t.String()),
  nature: t.Optional(AccountNatureModel),
  currencyCode: t.Optional(t.String()),
  includeArchived: t.Optional(t.BooleanString()),
});

export const ListAccountsResponseModel = t.Object({
  success: t.Boolean(),
  data: t.Optional(t.Array(AccountModel)),
  pagination: t.Optional(PaginationMetaModel),
  error: t.Optional(t.String()),
});

export const AccountDetailResponseModel = t.Object({
  success: t.Boolean(),
  data: t.Optional(AccountModel),
  error: t.Optional(t.String()),
});

export const CurrencyBreakdownModel = t.Object({
  currencyCode: t.String(),
  assets: t.String(),
  liabilities: t.String(),
  accountsCount: t.Number(),
});

export const NetWorthSummaryResponseModel = t.Object({
  success: t.Boolean(),
  data: t.Optional(
    t.Object({
      targetCurrency: t.String({ description: "Target currency of summary (e.g. 'IDR')" }),
      totalAssets: t.String({ description: "Aggregated assets converted to target currency" }),
      totalLiabilities: t.String({ description: "Aggregated liabilities converted to target currency" }),
      netWorth: t.String({ description: "Total Assets minus Total Liabilities" }),
      accountsCount: t.Number({ description: "Total number of accounts evaluated" }),
      byCurrency: t.Array(CurrencyBreakdownModel),
    })
  ),
  error: t.Optional(t.String()),
});

export const AccountActionResponseModel = t.Object({
  success: t.Boolean(),
  message: t.Optional(t.String()),
  error: t.Optional(t.String()),
});
