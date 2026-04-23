import type { SiteConfig } from '../types.js';
import { getCustomPartial } from './content.js';

/**
 * Load custom header/footer partials from R2 if configured.
 * Returns a Record that can be passed to renderer as `customPartials`.
 */
export async function loadCustomPartials(
  bucket: R2Bucket,
  siteId: string,
  config: SiteConfig,
  sourceId?: string,
): Promise<Record<string, string>> {
  const customPartials: Record<string, string> = {};

  const loads: Promise<void>[] = [];

  if (config.header?.customHtml) {
    loads.push(
      getCustomPartial(bucket, siteId, 'header', sourceId).then((html) => {
        if (html) customPartials.header = html;
      }),
    );
  }

  if (config.footer?.customHtml) {
    loads.push(
      getCustomPartial(bucket, siteId, 'footer', sourceId).then((html) => {
        if (html) customPartials.footer = html;
      }),
    );
  }

  await Promise.all(loads);
  return customPartials;
}
