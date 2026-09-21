import { t } from "elysia";
import { PaginationMetaModel, PaginationQueryModel } from "../../utils/pagination";

export const AccountNatureModel = t.Union([t.Literal("asset"), t.Literal("liability")], {
  description: "Account classification ('asset' = owned positive balance, 'liability' = debt/owed)",
});

export const AccountTypeModel = t.Object({
  id: t.String({ description: "Account type unique ID" }),
  userId: t.String({ description: "Owning user ID" }),
  templateId: t.Nullable(t.String({ description: "Source template ID if originated from a master template" })),
  name: t.String({ description: "Display name (e.g. 'Cash', 'Tabungan', 'Kartu Kredit')" }),
  code: t.String({ description: "Slug code (e.g. 'cash', 'savings', 'credit_card')" }),
  nature: AccountNatureModel,
  description: t.Nullable(t.String()),
  icon: t.Nullable(t.String()),
  color: t.Nullable(t.String()),
  displayOrder: t.Number(),
  isArchived: t.Boolean(),
  createdAt: t.String(),
  updatedAt: t.String(),
});

export const AccountTypeTemplateModel = t.Object({
  id: t.String({ description: "Template unique ID" }),
  name: t.String(),
  code: t.String(),
  nature: AccountNatureModel,
  description: t.Nullable(t.String()),
  icon: t.Nullable(t.String()),
  color: t.Nullable(t.String()),
  displayOrder: t.Number(),
  isActive: t.Boolean(),
  createdAt: t.String(),
  updatedAt: t.String(),
});

export const CreateAccountTypeBodyModel = t.Object({
  name: t.String({ minLength: 1, maxLength: 100 }),
  code: t.String({ minLength: 1, maxLength: 50 }),
  nature: AccountNatureModel,
  description: t.Optional(t.String()),
  icon: t.Optional(t.String()),
  color: t.Optional(t.String()),
  displayOrder: t.Optional(t.Number({ default: 0 })),
  isTemplate: t.Optional(t.Boolean({ description: "Admin only: create as master seeder template" })),
});

export const UpdateAccountTypeBodyModel = t.Object({
  name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
  nature: t.Optional(AccountNatureModel),
  description: t.Optional(t.String()),
  icon: t.Optional(t.String()),
  color: t.Optional(t.String()),
  displayOrder: t.Optional(t.Number()),
  isArchived: t.Optional(t.Boolean()),
  isActive: t.Optional(t.Boolean({ description: "Admin only: toggle template active status" })),
});

export const ListAccountTypesQueryModel = t.Object({
  ...PaginationQueryModel.properties,
  nature: t.Optional(AccountNatureModel),
  includeArchived: t.Optional(t.BooleanString()),
  isTemplate: t.Optional(t.BooleanString({ description: "Admin only: list master seeder templates" })),
});

export const ListAccountTypesResponseModel = t.Object({
  success: t.Boolean(),
  data: t.Optional(t.Array(t.Any())),
  pagination: t.Optional(PaginationMetaModel),
  error: t.Optional(t.String()),
});

export const AccountTypeDetailResponseModel = t.Object({
  success: t.Boolean(),
  data: t.Optional(t.Any()),
  error: t.Optional(t.String()),
});

export const SyncTemplatesResponseModel = t.Object({
  success: t.Boolean(),
  message: t.Optional(t.String()),
  syncedCount: t.Optional(t.Number()),
  data: t.Optional(t.Array(AccountTypeModel)),
  error: t.Optional(t.String()),
});

export const AccountTypeActionResponseModel = t.Object({
  success: t.Boolean(),
  message: t.Optional(t.String()),
  error: t.Optional(t.String()),
});
