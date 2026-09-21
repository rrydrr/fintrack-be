import { Elysia, t } from "elysia";
import { authPlugin } from "../auth/auth.controller";
import {
  CurrencyDetailResponseModel,
  ListCurrenciesResponseModel,
  ListCurrenciesQueryModel,
  CreateCurrencyBodyModel,
  UpdateCurrencyBodyModel,
  ListRatesResponseModel,
  ListRatesQueryModel,
  ExchangeRateDetailResponseModel,
  CreateExchangeRateBodyModel,
  ActionSuccessResponseModel,
} from "./currency.model";
import { currencyService } from "./currency.service";

export const currencyController = new Elysia({ name: "currencies", prefix: "/currencies" })
  .use(authPlugin)
  // --- Exchange Rates Routes (Defined before /:id parameter) ---
  .get(
    "/rates",
    async ({ user, query }) => {
      const result = await currencyService.listExchangeRates(user, {
        fromCurrency: query?.fromCurrency,
        toCurrency: query?.toCurrency,
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
      query: ListRatesQueryModel,
      response: ListRatesResponseModel,
      detail: {
        summary: "List exchange rates (universal system rates + user custom rates, optional pagination)",
        tags: ["Currencies & Rates"],
        security: [{ cookieAuth: [] }],
      },
    }
  )
  .get(
    "/rates/:id",
    async ({ user, params }) => {
      const rate = await currencyService.getExchangeRateById(user, params.id);
      return {
        success: true,
        data: rate,
      };
    },
    {
      params: t.Object({ id: t.String({ description: "Exchange rate unique ID" }) }),
      response: ExchangeRateDetailResponseModel,
      detail: {
        summary: "Get single exchange rate by ID",
        tags: ["Currencies & Rates"],
        security: [{ cookieAuth: [] }],
      },
    }
  )
  .post(
    "/rates",
    async ({ user, body, set }) => {
      try {
        const rate = await currencyService.createExchangeRate(user, {
          fromCurrency: body.fromCurrency,
          toCurrency: body.toCurrency,
          rate: body.rate,
          effectiveDate: body.effectiveDate,
          isSystem: body.isSystem,
        });
        set.status = 201;
        return {
          success: true,
          data: rate,
        };
      } catch (err: any) {
        set.status = err.status || 500;
        return {
          success: false,
          error: err.message || "Failed to create exchange rate",
        };
      }
    },
    {
      body: CreateExchangeRateBodyModel,
      response: ExchangeRateDetailResponseModel,
      detail: {
        summary: "Create exchange rate (Admin creates universal rates; users create custom rates based on JWT)",
        tags: ["Currencies & Rates"],
        security: [{ cookieAuth: [] }],
      },
    }
  )
  .delete(
    "/rates/:id",
    async ({ user, params, set }) => {
      try {
        const result = await currencyService.deleteExchangeRate(user, params.id);
        return result;
      } catch (err: any) {
        set.status = err.status || 500;
        return {
          success: false,
          error: err.message || "Failed to delete exchange rate",
        };
      }
    },
    {
      params: t.Object({ id: t.String({ description: "Exchange rate unique ID" }) }),
      response: ActionSuccessResponseModel,
      detail: {
        summary: "Delete exchange rate (Permissions evaluated via JWT)",
        tags: ["Currencies & Rates"],
        security: [{ cookieAuth: [] }],
      },
    }
  )

  // --- Currencies CRUD Routes ---
  .get(
    "/",
    async ({ user, query }) => {
      const result = await currencyService.listCurrencies(user, {
        search: query?.search,
        isActive: query?.isActive !== undefined ? Boolean(query.isActive) : undefined,
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
      query: ListCurrenciesQueryModel,
      response: ListCurrenciesResponseModel,
      detail: {
        summary: "List all active currencies (universal fiats + user custom currencies, optional pagination)",
        tags: ["Currencies & Rates"],
        security: [{ cookieAuth: [] }],
      },
    }
  )
  .post(
    "/",
    async ({ user, body, set }) => {
      try {
        const currency = await currencyService.createCurrency(user, body);
        set.status = 201;
        return {
          success: true,
          data: currency,
        };
      } catch (err: any) {
        set.status = err.status || 500;
        return {
          success: false,
          error: err.message || "Failed to create currency",
        };
      }
    },
    {
      body: CreateCurrencyBodyModel,
      response: CurrencyDetailResponseModel,
      detail: {
        summary: "Create currency (Admin creates universal system fiats; users create personal custom currencies/crypto)",
        tags: ["Currencies & Rates"],
        security: [{ cookieAuth: [] }],
      },
    }
  )
  .get(
    "/:id",
    async ({ user, params, set }) => {
      try {
        const currency = await currencyService.getCurrencyById(user, params.id);
        return {
          success: true,
          data: currency,
        };
      } catch (err: any) {
        set.status = err.status || 500;
        return {
          success: false,
          error: err.message || "Failed to get currency",
        };
      }
    },
    {
      params: t.Object({ id: t.String({ description: "Currency unique ID" }) }),
      response: CurrencyDetailResponseModel,
      detail: {
        summary: "Get currency metadata by ID",
        tags: ["Currencies & Rates"],
        security: [{ cookieAuth: [] }],
      },
    }
  )
  .patch(
    "/:id",
    async ({ user, params, body, set }) => {
      try {
        const updated = await currencyService.updateCurrency(user, params.id, body);
        return {
          success: true,
          data: updated,
        };
      } catch (err: any) {
        set.status = err.status || 500;
        return {
          success: false,
          error: err.message || "Failed to update currency",
        };
      }
    },
    {
      params: t.Object({ id: t.String({ description: "Currency unique ID" }) }),
      body: UpdateCurrencyBodyModel,
      response: CurrencyDetailResponseModel,
      detail: {
        summary: "Update currency metadata (Permissions evaluated via JWT)",
        tags: ["Currencies & Rates"],
        security: [{ cookieAuth: [] }],
      },
    }
  )
  .delete(
    "/:id",
    async ({ user, params, set }) => {
      try {
        const result = await currencyService.deleteCurrency(user, params.id);
        return result;
      } catch (err: any) {
        set.status = err.status || 500;
        return {
          success: false,
          error: err.message || "Failed to delete currency",
        };
      }
    },
    {
      params: t.Object({ id: t.String({ description: "Currency unique ID" }) }),
      response: ActionSuccessResponseModel,
      detail: {
        summary: "Delete currency (Permissions evaluated via JWT)",
        tags: ["Currencies & Rates"],
        security: [{ cookieAuth: [] }],
      },
    }
  );
