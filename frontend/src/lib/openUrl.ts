/**
 * Open a URL in a stable named browser window called "personal-external" so
 * repeated clicks reuse the same tab instead of spawning a new one every time.
 *
 * Automatically prepends "https://" when the url has no protocol.
 */
export async function openUrl(rawUrl: string): Promise<void> {
  if (!rawUrl) return;

  const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  window.open(url, "personal-external");
}
