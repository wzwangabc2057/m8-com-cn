import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CMS_API_URL = 'https://cloudflare-sites-cms.pages.dev';
const CMS_API_KEY = '55870e65072308e6644c999e1b0f4294dc57a5a789c310a291beed2ae585de7c';

async function main() {
  const mappingPath = path.join(__dirname, '../seo-audit/audit-mapping.txt');
  if (!fs.existsSync(mappingPath)) {
    console.error('audit-mapping.txt not found');
    process.exit(1);
  }

  const sites = fs.readFileSync(mappingPath, 'utf8')
    .split('\n')
    .filter(l => l.trim())
    .map(l => l.split('\t')[0].trim())
    .filter(Boolean);

  console.log(`Found ${sites.length} sites to check and fix...`);

  for (const siteId of sites) {
    console.log(`\n--- Processing ${siteId} ---`);
    let configUpdated = false;
    let postUpdated = false;

    try {
      // 1. Check and fix Global Config Description
      const configRes = await fetch(`${CMS_API_URL}/api/config?siteId=${siteId}`, {
        headers: { Authorization: `Bearer ${CMS_API_KEY}` }
      });
      if (!configRes.ok) {
        console.error(`Failed to fetch config for ${siteId}: ${configRes.status}`);
        continue;
      }
      
      const configData = await configRes.json();
      const config = configData.config;

      if (!config) {
        console.error(`No config found for ${siteId}`);
        continue;
      }

      if (!config.description || config.description.trim().length < 5) {
        const title = config.home?.title || config.name || siteId;
        config.description = `Welcome to ${title}. Your trusted destination for the latest news, updates, and comprehensive information. Explore our premium content today.`;
        console.log(`  [Config] Generated description: "${config.description}"`);
        configUpdated = true;
      }

      if (configUpdated) {
        const updateRes = await fetch(`${CMS_API_URL}/api/config?siteId=${siteId}`, {
          method: 'PUT',
          headers: { 
            Authorization: `Bearer ${CMS_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(config)
        });
        if (updateRes.ok) {
          console.log(`  [Config] Successfully updated global config.`);
        } else {
          console.error(`  [Config] Failed to update: ${updateRes.status}`);
        }
      } else {
        console.log(`  [Config] Description already exists.`);
      }

      // 2. Check and fix Index Page HTML Accessibility (Buttons & Links)
      const postRes = await fetch(`${CMS_API_URL}/api/posts/index?siteId=${siteId}`, {
        headers: { Authorization: `Bearer ${CMS_API_KEY}` }
      });
      
      if (!postRes.ok && postRes.status !== 404) {
        console.error(`Failed to fetch index page for ${siteId}: ${postRes.status}`);
        continue;
      }
      
      if (postRes.ok) {
        const postData = await postRes.json();
        const post = postData.post;
        
        if (post && post.content) {
          let originalContent = post.content;
          let newContent = originalContent;

          // Fix empty buttons
          newContent = newContent.replace(/<button([^>]*)>([\s\S]*?)<\/button>/gi, (match: string, attrs: string, inner: string) => {
            if (!/aria-label=/i.test(attrs)) {
              if (inner.replace(/<[^>]*>/g, '').trim().length === 0) {
                // Insert aria-label just before the closing >
                return `<button aria-label="Action button"${attrs}>${inner}</button>`;
              }
            }
            return match;
          });

          // Fix empty links
          newContent = newContent.replace(/<a([^>]*)>([\s\S]*?)<\/a>/gi, (match: string, attrs: string, inner: string) => {
            if (!/aria-label=/i.test(attrs) && !/title=/i.test(attrs)) {
              if (inner.replace(/<[^>]*>/g, '').trim().length === 0) {
                return `<a aria-label="Link"${attrs}>${inner}</a>`;
              }
            }
            return match;
          });

          if (newContent !== originalContent) {
            console.log(`  [Page] Accessibility fixes applied to HTML content.`);
            post.content = newContent;
            postUpdated = true;
          }

          if (postUpdated) {
            const saveRes = await fetch(`${CMS_API_URL}/api/posts/index?siteId=${siteId}`, {
              method: 'PUT',
              headers: { 
                Authorization: `Bearer ${CMS_API_KEY}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(post)
            });
            if (saveRes.ok) {
              console.log(`  [Page] Successfully updated index page.`);
            } else {
              console.error(`  [Page] Failed to update page: ${saveRes.status}`);
            }
          } else {
             console.log(`  [Page] No accessibility fixes needed for HTML.`);
          }
        }
      }
    } catch (e: any) {
      console.error(`Error processing ${siteId}: ${e.message}`);
    }
  }
  
  console.log('\nAll done!');
}

main();