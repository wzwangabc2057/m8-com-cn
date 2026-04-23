/**
 * Generate GSC "Users and permissions" URLs for all migrate/sites.
 * Use with RPA: for each URL → open → click "Add user" → fill email → Add.
 *
 * Run: npx tsx scripts/gsc-add-user-urls.ts
 */

import * as fs from "fs";
import * as path from "path";

const SITES_DIR = path.join(__dirname, "../migrate/sites");
const GSC_USERS_BASE =
  "https://search.google.com/u/1/search-console/users?resource_id=";
const SERVICE_ACCOUNT_EMAIL =
  "gsc-178@poised-lens-472416-d2.iam.gserviceaccount.com";

function toGscResourceId(domain: string): string {
  const d = domain.trim().toLowerCase();
  if (d.startsWith("http://") || d.startsWith("https://")) {
    const u = new URL(d);
    return `https%3A%2F%2F${u.hostname}%2F`;
  }
  return `https%3A%2F%2F${d}%2F`;
}

function main() {
  const dirs = fs.readdirSync(SITES_DIR, { withFileTypes: true });
  const domains = dirs
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  console.log("# GSC Users page URLs – add user:", SERVICE_ACCOUNT_EMAIL);
  console.log("# Total sites:", domains.length);
  console.log("");

  const outPath = path.join(__dirname, "gsc-users-urls.txt");
  const lines = [
    `# GSC Users page URLs – add user: ${SERVICE_ACCOUNT_EMAIL}`,
    `# Total: ${domains.length}`,
    "",
    ...domains.map((domain) => {
      const resourceId = toGscResourceId(domain);
      return `${GSC_USERS_BASE}${resourceId}`;
    }),
  ];
  fs.writeFileSync(outPath, lines.join("\n"), "utf8");
  console.log("Wrote", outPath);
  console.log("RPA flow per URL: open URL → Add user → email → Add");
}

main();
