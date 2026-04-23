const CMS_API_URL = 'https://cloudflare-sites-cms.pages.dev';
const CMS_API_KEY = '55870e65072308e6644c999e1b0f4294dc57a5a789c310a291beed2ae585de7c';
const siteId = process.argv[2];

if (!siteId) {
  console.error('Missing siteId');
  process.exit(1);
}

async function main() {
  const res = await fetch(`${CMS_API_URL}/api/config?siteId=${siteId}`, {
    headers: { Authorization: `Bearer ${CMS_API_KEY}` }
  });
  if (!res.ok) {
    console.error(`Error: ${res.status}`);
    process.exit(1);
  }
  const data = await res.json();
  const config = data.config || {};
  console.log(JSON.stringify({
    name: config.name,
    language: config.language,
    homeTitle: config.home?.title,
    homeSubtitle: config.home?.subtitle,
    currentDescription: config.description
  }, null, 2));
}

main();