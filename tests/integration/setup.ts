/**
 * Loaded before integration tests (tsx --import). Points everything at the
 * test database and local test doubles. Requires TEST_DATABASE_URL (or the
 * default local test DB) with migrations applied: npm run test:db:prepare
 */
import os from "os";
import path from "path";
const url = process.env.TEST_DATABASE_URL || "postgresql://postgres@localhost:5433/soundwave_test";
Object.assign(process.env, {
  NODE_ENV: "test",
  DATABASE_URL: url,
  DIRECT_URL: url,
  APP_SECRET: "integration-test-secret-integration-test-secret",
  NEXT_PUBLIC_APP_URL: "http://localhost:3999",
  PAYMENTS_PROVIDER: "fake",
  FULFILLMENT_PROVIDER: "mock",
  EMAIL_PROVIDER: "file",
  STORAGE_DRIVER: "local",
  STORAGE_LOCAL_DIR: path.join(os.tmpdir(), `sw-it-${process.pid}`),
  LOG_LEVEL: "error",
});
