import { treaty } from "@elysiajs/eden";
import type { App } from "./index";

export type { App };

/**
 * Creates a pre-configured FinTrack Eden Treaty API client.
 *
 * Automatically includes credentials ('include') so HttpOnly session cookies
 * (accessToken and refreshToken) are seamlessly preserved across requests.
 *
 * @param baseUrl Base URL of the FinTrack Elysia backend (default: "http://localhost:3000")
 * @param config Optional additional treaty configuration or custom headers
 */
export const createFinTrackClient = (
  baseUrl: string = "http://localhost:3000",
  config?: Parameters<typeof treaty<App>>[1]
) => {
  return treaty<App>(baseUrl, {
    ...config,
    fetch: {
      credentials: "include",
      ...config?.fetch,
    },
  });
};

export type FinTrackClient = ReturnType<typeof createFinTrackClient>;
