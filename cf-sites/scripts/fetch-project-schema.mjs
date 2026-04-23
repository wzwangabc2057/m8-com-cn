#!/usr/bin/env node
import 'dotenv/config';
const token = process.env.ARTICLE_WRITING_SYSTEM_API_TOKEN || process.env.ARTICLE_WRITING_API_KEY;
const res = await fetch('https://web-production-0084b.up.railway.app/api/v1/projects/schema', {
  headers: { 'X-API-Key': token, Accept: 'application/json' },
});
const d = await res.json();
if (d.detail) {
  console.log('Error:', d);
  process.exit(1);
}
const s = JSON.stringify(d);
['image', 'enable_images', 'generate_image'].forEach((k) => {
  const m = s.match(new RegExp(`[^"]{0,80}${k}[^"]{0,80}`, 'gi'));
  if (m) console.log(k + ':', m.slice(0, 5));
});
console.log('\nconfig_schema keys:', Object.keys(d.config_schema || {}));
console.log('template keys:', Object.keys(d.template || {}));
