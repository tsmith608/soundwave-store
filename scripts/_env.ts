/** Load .env / .env.local / .env.production exactly like Next.js does, for standalone scripts. */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
