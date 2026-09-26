import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Minimal Cloudflare config: no ISR/R2 incremental cache wired up yet since
// this app's pages are all dynamic (client-fetched data), not statically
// regenerated. Add an incrementalCache override here later if you introduce
// ISR routes — see https://opennext.js.org/cloudflare/caching.
export default defineCloudflareConfig({});
