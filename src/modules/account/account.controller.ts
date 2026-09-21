import { Elysia, t } from "elysia";
import { authPlugin } from "../auth/auth.controller";
import {
  AccountModel,
  AccountDetailResponseModel,
  ListAccountsResponseModel,
  ListAccountsQueryModel,
  CreateAccountBodyModel,
  UpdateAccountBodyModel,
  NetWorthSummaryResponseModel,
  AccountActionResponseModel,
} from "./account.model";
import { accountService } from "./account.service";
import { AccountNature } from "../../db/schema";

export const accountController = new Elysia({ name: "accounts", prefix: "/accounts" })
  .use(authPlugin)
  // Summary route defined before /:id parameter
  .get(
    "/summary",
    async ({ user, query }) => {
      const summary = await accountService.getNetWorthSummary(user, query?.currency);
      return {
        success: true,
        data: summary,
      };
    },
    {
      query: t.Object({
        currency: t.Optional(
          t.String({ description: "Target currency for Net Worth aggregation (defaults to user default currency)" })
        ),
      }),
      response: NetWorthSummaryResponseModel,
      detail: {
        summary: "Calculate aggregated Net Worth and balance summary across all user accounts in target currency",
        tags: ["Accounts"],
        security: [{ cookieAuth: [] }],
      },
    }
  )
  .get(
    "/",
    async ({ user, query }) => {
      const result = await accountService.listAccounts(user, {
        accountTypeId: query?.accountTypeId,
        nature: query?.nature as AccountNature,
        currencyCode: query?.currencyCode,
        includeArchived: query?.includeArchived !== undefined ? Boolean(query.includeArchived) : undefined,
        page: query?.page ? Number(query.page) : undefined,
        limit: query?.limit ? Number(query.limit) : undefined,
      });

      return {
        success: true,
        data: result.data,
        pagination: result.pagination,
      };
    },
    {
      query: ListAccountsQueryModel,
      response: ListAccountsResponseModel,
      detail: {
        summary: "List all financial accounts owned by the user (optional pagination)",
        tags: ["Accounts"],
        security: [{ cookieAuth: [] }],
      },
    }
  )
  .post(
    "/",
    async ({ user, body, set }) => {
      try {
        const item = await accountService.createAccount(user, body);
        set.status = 201;
        return {
          success: true,
          data: item,
        };
      } catch (err: any) {
        set.status = err.status || 500;
        return {
          success: false,
          error: err.message || "Failed to create account",
        };
      }
    },
    {
      body: CreateAccountBodyModel,
      response: AccountDetailResponseModel,
      detail: {
        summary: "Create a new financial account (defaults to user preferred currency if omitted)",
        tags: ["Accounts"],
        security: [{ cookieAuth: [] }],
      },
    }
  )
  .get(
    "/:id",
    async ({ user, params, set }) => {
      try {
        const item = await accountService.getAccountById(user, params.id);
        return {
          success: true,
          data: item,
        };
      } catch (err: any) {
        set.status = err.status || 500;
        return {
          success: false,
          error: err.message || "Failed to get account",
        };
      }
    },
    {
      params: t.Object({ id: t.String({ description: "Account unique ID" }) }),
      response: AccountDetailResponseModel,
      detail: {
        summary: "Get single financial account details by ID",
        tags: ["Accounts"],
        security: [{ cookieAuth: [] }],
      },
    }
  )
  .patch(
    "/:id",
    async ({ user, params, body, set }) => {
      try {
        const updated = await accountService.updateAccount(user, params.id, body);
        return {
          success: true,
          data: updated,
        };
      } catch (err: any) {
        set.status = err.status || 500;
        return {
          success: false,
          error: err.message || "Failed to update account",
        };
      }
    },
    {
      params: t.Object({ id: t.String({ description: "Account unique ID" }) }),
      body: UpdateAccountBodyModel,
      response: AccountDetailResponseModel,
      detail: {
        summary: "Update financial account details",
        tags: ["Accounts"],
        security: [{ cookieAuth: [] }],
      },
    }
  )
  .delete(
    "/:id",
    async ({ user, params, set }) => {
      try {
        const result = await accountService.deleteAccount(user, params.id);
        return result;
      } catch (err: any) {
        set.status = err.status || 500;
        return {
          success: false,
          error: err.message || "Failed to delete account",
        };
      }
    },
    {
      params: t.Object({ id: t.String({ description: "Account unique ID" }) }),
      response: AccountActionResponseModel,
      detail: {
        summary: "Delete financial account",
        tags: ["Accounts"],
        security: [{ cookieAuth: [] }],
      },
    }
  );
