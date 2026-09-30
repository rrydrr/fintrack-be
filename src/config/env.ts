export const config = {
  // Server & Client Configuration
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || "local",
  isLocal: (process.env.NODE_ENV || "local").toLowerCase() === "local",
  frontendUrl: (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/+$/, ""),
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173,http://localhost:3000",

  // Database
  databaseUrl: process.env.DATABASE_URL || "",

  // Database Seeding / Defaults
  seedAdminEmail: process.env.SEED_ADMIN_EMAIL || process.env.ADMIN_EMAIL || "admin@fintrack.local",
  seedAdminPassword:
    process.env.SEED_ADMIN_PASSWORD ||
    process.env.ADMIN_DEFAULT_PASSWORD ||
    process.env.ADMIN_PASSWORD ||
    "ChangeMe123!",
  seedDemoEmail: process.env.SEED_DEMO_EMAIL || process.env.DEMO_EMAIL || "demo@fintrack.local",
  seedDemoPassword:
    process.env.SEED_DEMO_PASSWORD ||
    process.env.DEMO_DEFAULT_PASSWORD ||
    process.env.DEMO_PASSWORD ||
    "ChangeMe123!",

  // Authentication & JWT
  jwtSecret: process.env.JWT_SECRET || "fintrack-dev-secret-change-in-production",
  jwtAccessExp: process.env.JWT_ACCESS_EXP || "15m",
  jwtRefreshExpDays: Number(process.env.JWT_REFRESH_EXP_DAYS) || 7,

  // Upstream AI Router
  routerEndpoint: process.env.ROUTER_ENDPOINT || "",
  routerApiKey: (process.env.ROUTER_API_KEY || "")
    .replace(/^Bearer\s+/i, "")
    .trim(),

  // Brevo Transactional Email Service
  brevoApiKey: (process.env.BREVO_API_KEY || "").trim(),
  brevoSenderName: process.env.BREVO_SENDER_NAME || "FinTrack",
  brevoSenderEmail: process.env.BREVO_SENDER_EMAIL || "no-reply@yourdomain.com",
};

