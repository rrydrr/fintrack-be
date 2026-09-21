import { t } from "elysia";

/**
 * Reusable TypeBox query parameters model for optional pagination.
 * If page or limit are omitted, endpoints return all matching records unpaginated.
 */
export const PaginationQueryModel = t.Object({
  page: t.Optional(
    t.Numeric({
      minimum: 1,
      description: "Page number (1-indexed). Optional; if omitted, returns all records unpaginated.",
    })
  ),
  limit: t.Optional(
    t.Numeric({
      minimum: 1,
      maximum: 100,
      description: "Number of items per page. Optional.",
    })
  ),
});

export type PaginationQuery = typeof PaginationQueryModel.static;

/**
 * Reusable pagination metadata schema returned when pagination is active.
 */
export const PaginationMetaModel = t.Object({
  page: t.Number({ description: "Current page number" }),
  limit: t.Number({ description: "Items per page" }),
  total: t.Number({ description: "Total number of items matching filter" }),
  totalPages: t.Number({ description: "Total number of pages" }),
});

export type PaginationMeta = typeof PaginationMetaModel.static;

/**
 * In-memory or slice-based pagination helper for arrays.
 */
export function paginateArray<T>(
  items: T[],
  params?: { page?: number; limit?: number }
): { data: T[]; pagination?: PaginationMeta } {
  if (!params?.page && !params?.limit) {
    return { data: items };
  }

  const page = Math.max(1, Number(params.page || 1));
  const limit = Math.max(1, Math.min(100, Number(params.limit || 20)));
  const total = items.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const offset = (page - 1) * limit;
  const pagedData = items.slice(offset, offset + limit);

  return {
    data: pagedData,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
}
