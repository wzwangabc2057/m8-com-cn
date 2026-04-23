import { NextResponse } from 'next/server';
import { SKILL_INDEX } from './skills-data';

export const runtime = 'edge';

const TOOL_URL = 'https://site-dev-tool.pages.dev/site-dev.cjs';

export async function GET(req: Request) {
  const origin = new URL(req.url).origin;

  const skillList = SKILL_INDEX.map(
    (s) => `- [${s.name}](${origin}/api/skills/${s.id}) — ${s.description}`,
  ).join('\n');

  const md = `---
title: CMS Skills & Tools
tool: ${TOOL_URL}
openapi: ${origin}/api/openapi.json
auth: "Authorization: Bearer <API_KEY>"
---

# CMS Skills & Tools

## Quick Start

\`\`\`bash
# 1. Download tool
curl -fsSL ${TOOL_URL} -o site-dev.cjs

# 2. Configure
echo 'CMS_BASE_URL=${origin}' > .env
echo 'CMS_API_KEY=<your-key>' >> .env

# 3. Install Tailwind
npm install -g @tailwindcss/cli

# 4. List sites
node site-dev.cjs list

# 5. Pull a site
node site-dev.cjs pull <siteId>

# 6. Local preview
node site-dev.cjs dev <siteId>

# 7. Push changes
node site-dev.cjs push <siteId>
\`\`\`

## Tool Download

\`\`\`
${TOOL_URL}
\`\`\`

Single file, Node.js 18+, no install needed.

## Skills

${skillList}

## API Reference

Full OpenAPI spec: [${origin}/api/openapi.json](${origin}/api/openapi.json)

Auth: \`Authorization: Bearer <API_KEY>\` (except /api/skills and /api/openapi.json)
`;

  return new NextResponse(md, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
}
