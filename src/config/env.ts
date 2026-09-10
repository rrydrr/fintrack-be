export const config = {
  port: Number(process.env.PORT) || 3000,
  routerEndpoint: process.env.ROUTER_ENDPOINT || "",
  routerApiKey: (process.env.ROUTER_API_KEY || "")
    .replace(/^Bearer\s+/i, "")
    .trim(),
  databaseUrl: process.env.DATABASE_URL || "",
  nodeEnv: process.env.NODE_ENV || "development",
  jwtSecret: process.env.JWT_SECRET || "fintrack-dev-secret-change-in-production",
  jwtExp: process.env.JWT_EXP || "7d",
};
