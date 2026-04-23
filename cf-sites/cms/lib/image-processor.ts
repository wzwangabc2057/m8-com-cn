

export async function processContentImages(
  content: string,
  siteId: string,
  bucket: any
): Promise<string> {
  if (!content) return content;

  // 1. Convert CMS proxy URLs to public URLs (for published site)
  // /api/proxy?key=sites%2F{siteId}%2Fassets%2F2026%2F02%2Ffile.webp -> /site-assets/2026/02/file.webp
  const proxyRegex = /\/api\/proxy\?key=([^"'\s&]+)/g;
  let newContent = content.replace(proxyRegex, (_, encodedKey) => {
    try {
      const key = decodeURIComponent(encodedKey);
      const prefix = `sites/${siteId}/assets/`;
      if (key.startsWith(prefix)) {
        const path = key.slice(prefix.length);
        return `/site-assets/${path}`;
      }
    } catch (_) {}
    return `/api/proxy?key=${encodedKey}`;
  });

  // 2. Process external http/https URLs: download, upload to R2, replace with /site-assets/uploads/...
  const urlRegex = /src=["'](https?:\/\/[^"']+)["']/g;
  const matches = [...newContent.matchAll(urlRegex)];
  
  if (matches.length === 0) return newContent;

  // Deduplicate URLs to avoid downloading same image twice
  const uniqueUrls = [...new Set(matches.map(m => m[1]))];
  
  // Map of Old URL -> New URL
  const urlMap = new Map<string, string>();

  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const uploadDir = `sites/${siteId}/assets/uploads/${year}/${month}`;

  // Process in parallel
  await Promise.all(uniqueUrls.map(async (url) => {
    try {
      // Check if already internal (simple check)
      if (url.includes(`/sites/${siteId}/assets/`)) return;
      if (url.includes(`/site-assets/`)) return; // Logic for proxied assets

      console.log(`Downloading external image: ${url}`);
      
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`Failed to fetch ${url}: ${res.status}`);
        return;
      }

      const contentType = res.headers.get('content-type') || 'image/jpeg';
      const buffer = await res.arrayBuffer();
      
      // Determine extension
      let ext = 'jpg';
      if (contentType.includes('png')) ext = 'png';
      else if (contentType.includes('webp')) ext = 'webp';
      else if (contentType.includes('gif')) ext = 'gif';
      else if (contentType.includes('svg')) ext = 'svg';
      else {
        // Try to infer from URL
        const urlExt = url.split('.').pop()?.split('?')[0];
        if (urlExt && urlExt.length <= 4) ext = urlExt;
      }

      // Determine Filename
      // Try to get name from URL
      const urlFilename = url.split('/').pop()?.split('?')[0] || 'image';
      const cleanName = urlFilename.replace(/[^a-zA-Z0-9-_]/g, '_').replace(/^_+|_+$/g, '');
      const hash = crypto.randomUUID().split('-')[0];
      const filename = `${cleanName}-${hash}.${ext}`;
      
      const key = `${uploadDir}/${filename}`;
      
      // Upload to R2
      await bucket.put(key, buffer, {
        httpMetadata: { contentType }
      });

      // Construct new URL
      // The public URL depends on how assets are served.
      // Usually /site-assets/uploads/YYYY/MM/filename
      // But we need to make sure the renderer handles this path.
      // Renderer handles /site-assets/* -> sites/{siteId}/assets/*
      // So if we save to sites/{siteId}/assets/uploads/..., 
      // The public URL should be /site-assets/uploads/...
      
      const newUrl = `/site-assets/uploads/${year}/${month}/${filename}`;
      urlMap.set(url, newUrl);
      console.log(`Replaced ${url} -> ${newUrl}`);

    } catch (e) {
      console.error(`Error processing image ${url}:`, e);
    }
  }));

  // Replace all occurrences
  for (const [oldUrl, newUrl] of urlMap.entries()) {
    newContent = newContent.split(oldUrl).join(newUrl);
  }

  return newContent;
}

/**
 * Process images in content from Article Writing Job API.
 * Downloads images using X-API-Key auth, uploads to R2, replaces with /site-assets/...
 */
export async function processWritingJobImages(
  content: string,
  siteId: string,
  bucket: R2Bucket,
  jobId: string,
  apiKey: string,
  baseUrl: string = 'https://web-production-0084b.up.railway.app'
): Promise<string> {
  if (!content) return content;

  const jobBase = `${baseUrl}/api/v1/jobs/${jobId}/files`;
  const urlPatterns = [
    /src=["']([^"']+)["']/g,
    /!\[[^\]]*\]\(([^)]+)\)/g,
  ];

  const urls = new Set<string>();
  for (const re of urlPatterns) {
    for (const m of content.matchAll(re)) {
      const u = m[1]?.trim();
      if (u) urls.add(u);
    }
  }

  // 1) Absolute URLs that point to job file API
  const absoluteJobUrls = [...urls].filter((u) => {
    if (!u.startsWith('http')) return false;
    return u.includes(`/api/v1/jobs/`) && u.includes('/files/');
  });
  // 2) Relative paths (e.g. images/header.webp) — resolve to job file API
  const relativePaths = [...urls].filter((u) => {
    if (u.startsWith('http') || u.startsWith('/site-assets/')) return false;
    const path = u.startsWith('/') ? u.slice(1) : u;
    // Match common image extensions including truncated ones (.web for .webp)
    return path.length > 0 && /\.(webp|web|png|jpg|jpeg|gif|svg|avif|bmp|ico|tif|tiff)(\?|$)/i.test(path);
  });
  const toProcess = [...absoluteJobUrls, ...relativePaths];
  if (toProcess.length === 0) return content;

  const urlMap = new Map<string, string>();
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const uploadDir = `sites/${siteId}/assets/uploads/${year}/${month}`;

  for (const urlOrPath of toProcess) {
    try {
      const pathPart = urlOrPath.replace(/^\//, '');
      const fullUrl = urlOrPath.startsWith('http')
        ? urlOrPath
        : `${jobBase}/${pathPart.split('/').map((s) => encodeURIComponent(s)).join('/')}`;
      if (!fullUrl.includes(jobBase) && !fullUrl.includes(`/jobs/${jobId}/`)) continue;
      if (urlOrPath.includes(`/site-assets/`)) continue;

      const res = await fetch(fullUrl, {
        headers: { 'X-API-Key': apiKey, Accept: '*/*' },
      });
      if (!res.ok) {
        console.warn(`Failed to fetch job image ${fullUrl}: ${res.status}`);
        continue;
      }

      const contentType = res.headers.get('content-type') || 'image/jpeg';
      const buffer = await res.arrayBuffer();
      let ext = 'jpg';
      if (contentType.includes('png')) ext = 'png';
      else if (contentType.includes('webp')) ext = 'webp';
      else if (contentType.includes('gif')) ext = 'gif';
      else if (contentType.includes('svg')) ext = 'svg';
      else if (contentType.includes('avif')) ext = 'avif';
      else {
        const urlExt = fullUrl.split('.').pop()?.split('?')[0]?.toLowerCase();
        // Fix truncated extensions: .web -> .webp
        if (urlExt === 'web') ext = 'webp';
        else if (urlExt && urlExt.length <= 5) ext = urlExt;
      }

      const urlFilename = fullUrl.split('/').pop()?.split('?')[0] || 'image';
      const cleanName = urlFilename.replace(/[^a-zA-Z0-9-_]/g, '_').replace(/^_+|_+$/g, '');
      const hash = crypto.randomUUID().split('-')[0];
      const filename = `${cleanName}-${hash}.${ext}`;
      const key = `${uploadDir}/${filename}`;
      await bucket.put(key, buffer, { httpMetadata: { contentType } });
      const newUrl = `/site-assets/uploads/${year}/${month}/${filename}`;
      urlMap.set(urlOrPath, newUrl);
    } catch (e) {
      console.error(`Error processing job image ${urlOrPath}:`, e);
    }
  }

  let newContent = content;
  for (const [oldUrl, newUrl] of urlMap.entries()) {
    newContent = newContent.split(oldUrl).join(newUrl);
  }
  return newContent;
}
