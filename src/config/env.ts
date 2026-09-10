export const config = {
  port: Number(process.env.PORT) || 3000,
  routerEndpoint: process.env.ROUTER_ENDPOINT || "",
  routerApiKey: (process.env.ROUTER_API_KEY || "")
    .replace(/^Bearer\s+/i, "")
    .trim(),
  databaseUrl: process.env.DATABASE_URL || "",
  nodeEnv: process.env.NODE_ENV || "development",
  jwtSecret: process.env.JWT_SECRET || "fintrack-dev-secret-change-in-production",
  jwtAccessExp: process.env.JWT_ACCESS_EXP || "15m",
  jwtRefreshExpDays: Number(process.env.JWT_REFRESH_EXP_DAYS) || 7,
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173,http://localhost:3000",
};

