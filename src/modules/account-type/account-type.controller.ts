import { Elysia, t } from "elysia";
import { authPlugin } from "../auth/auth.controller";
import {
  AccountTypeDetailResponseModel,
  ListAccountTypesResponseModel,
  ListAccountTypesQueryModel,
  CreateAccountTypeBodyModel,
  UpdateAccountTypeBodyModel,
  SyncTemplatesResponseModel,
  AccountTypeActionResponseModel,
} from "./account-type.model";
import { accountTypeService } from "./account-type.service";
import { AccountNature } from "../../db/schema";

export const accountTypeController = new Elysia({
  name: "account-types",
  prefix: "/account-types",
})
  .use(authPlugin)
  .post(
    "/sync",
    async ({ user }) => {
      const result = await accountTypeService.syncTemplatesForUser(user);
      return {
        success: true,
        message: `Synced ${result.syncedCount} new account type(s)`,
        syncedCount: result.syncedCount,
        data: result.data,
      };
    },
    {
      response: SyncTemplatesResponseModel,
      detail: {
        summary: "Sync missing admin master templates into the authenticated user's account types",
        tags: ["Account Types"],
        security: [{ cookieAuth: [] }],
      },
    }
  )
  .get(
    "/",
    async ({ user, query }) => {
      const result = await accountTypeService.listAccountTypes(user, {
        nature: query?.nature as AccountNature,
        includeArchived: query?.includeArchived !== undefined ? Boolean(query.includeArchived) : undefined,
        isTemplate: query?.isTemplate !== undefined ? Boolean(query.isTemplate) : undefined,
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
      query: ListAccountTypesQueryModel,
      response: ListAccountTypesResponseModel,
      detail: {
        summary: "List account types (or master templates if isTemplate=true and Admin, optional pagination)",
        tags: ["Account Types"],
        security: [{ cookieAuth: [] }],
      },
    }
  )
  .post(
    "/",
    async ({ user, body, set }) => {
      try {
        const item = await accountTypeService.createAccountType(user, {
          name: body.name,
          code: body.code,
          nature: body.nature,
          description: body.description,
          icon: body.icon,
          color: body.color,
          displayOrder: body.displayOrder,
          isTemplate: body.isTemplate,
        });
        set.status = 201;
        return {
          success: true,
          data: item,
        };
      } catch (err: any) {
        set.status = err.status || 500;
        return {
          success: false,
          error: err.message || "Failed to create account type",
        };
      }
    },
    {
      body: CreateAccountTypeBodyModel,
      response: AccountTypeDetailResponseModel,
      detail: {
        summary: "Create account type (Admin creates master template if isTemplate=true; user creates personal custom type)",
        tags: ["Account Types"],
        security: [{ cookieAuth: [] }],
      },
    }
  )
  .get(
    "/:id",
    async ({ user, params, set }) => {
      try {
        const item = await accountTypeService.getAccountTypeById(user, params.id);
        return {
          success: true,
          data: item,
        };
      } catch (err: any) {
        set.status = err.status || 500;
        return {
          success: false,
          error: err.message || "Failed to get account type",
        };
      }
    },
    {
      params: t.Object({ id: t.String({ description: "Account type unique ID" }) }),
      response: AccountTypeDetailResponseModel,
      detail: {
        summary: "Get account type details by ID",
        tags: ["Account Types"],
        security: [{ cookieAuth: [] }],
      },
    }
  )
  .patch(
    "/:id",
    async ({ user, params, body, set }) => {
      try {
        const updated = await accountTypeService.updateAccountType(user, params.id, body);
        return {
          success: true,
          data: updated,
        };
      } catch (err: any) {
        set.status = err.status || 500;
        return {
          success: false,
          error: err.message || "Failed to update account type",
        };
      }
    },
    {
      params: t.Object({ id: t.String({ description: "Account type unique ID" }) }),
      body: UpdateAccountTypeBodyModel,
      response: AccountTypeDetailResponseModel,
      detail: {
        summary: "Update account type or master template (Permissions evaluated via JWT)",
        tags: ["Account Types"],
        security: [{ cookieAuth: [] }],
      },
    }
  )
  .delete(
    "/:id",
    async ({ user, params, set }) => {
      try {
        const result = await accountTypeService.deleteAccountType(user, params.id);
        return result;
      } catch (err: any) {
        set.status = err.status || 500;
        return {
          success: false,
          error: err.message || "Failed to delete account type",
        };
      }
    },
    {
      params: t.Object({ id: t.String({ description: "Account type unique ID" }) }),
      response: AccountTypeActionResponseModel,
      detail: {
        summary: "Delete account type or master template (Permissions evaluated via JWT)",
        tags: ["Account Types"],
        security: [{ cookieAuth: [] }],
      },
    }
  );
