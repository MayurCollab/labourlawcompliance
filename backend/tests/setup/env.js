/**
 * Must run before any app module imports (Jest setupFiles).
 * Config fails fast without these required vars.
 */
process.env.NODE_ENV = 'test';
process.env.PORT = '5000';
process.env.MONGO_URI =
  process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/blueprint_mern_test';
process.env.JWT_SECRET = 'test-jwt-secret-phase8';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-phase8';
process.env.JWT_EXPIRY = '15m';
process.env.JWT_REFRESH_EXPIRY = '7d';
process.env.CLIENT_URL = 'http://localhost:5190';
process.env.BCRYPT_SALT_ROUNDS = '4';
process.env.RATE_LIMIT_WINDOW = '900000';
process.env.RATE_LIMIT_MAX = '10000';
process.env.SMTP_HOST = 'smtp.example.com';
process.env.SMTP_PORT = '587';
process.env.SMTP_USER = 'test';
process.env.SMTP_PASS = 'test';
process.env.EMAIL_FROM = 'ACC Labour Law Compliance <test@example.com>';
process.env.STORAGE_DRIVER = 'local';
process.env.ENABLE_SWAGGER = 'false';
