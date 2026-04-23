import 'dotenv/config';

export const CMS_API_URL = process.env.CMS_API_URL?.replace(/\/$/, "") || "";
export const CMS_API_KEY = process.env.CMS_API_KEY || "";
export const DEFAULT_SITE_ID = process.env.DEFAULT_SITE_ID || "aiball.world";

if (!CMS_API_URL || !CMS_API_KEY) {
  console.error("Error: CMS_API_URL and CMS_API_KEY are required in .env");
  process.exit(1);
}
