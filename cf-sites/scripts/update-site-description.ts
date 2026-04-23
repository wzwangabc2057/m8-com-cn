const CMS_API_URL = 'https://cloudflare-sites-cms.pages.dev';
const CMS_API_KEY = '55870e65072308e6644c999e1b0f4294dc57a5a789c310a291beed2ae585de7c';
const siteId = process.argv[2];
const newDescription = process.argv[3];

if (!siteId || !newDescription) {
  console.error('Usage: tsx update-site-description.ts <siteId> "<description>"');
  process.exit(1);
}

async function main() {
  const res = await fetch(`${CMS_API_URL}/api/config?siteId=${siteId}`, {
    headers: { Authorization: `Bearer ${CMS_API_KEY}` }
  });
  if (!res.ok) {
    console.error(`Error fetching config: ${res.status}`);
    process.exit(1);
  }
  const data = await res.json();
  const config = data.config || {};
  
  config.description = newDescription;

  const putRes = await fetch(`${CMS_API_URL}/api/config?siteId=${siteId}`, {
    method: 'PUT',
    headers: { 
      Authorization: `Bearer ${CMS_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(config)
  });

  if (!putRes.ok) {
    console.error(`Error saving config: ${putRes.status}`);
    process.exit(1);
  }
  console.log(`Success! Updated ${siteId} description to: ${newDescription}`);
}

main();