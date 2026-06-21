export function toFetchUrl(absoluteUrl: string): string {
  if (!import.meta.env.DEV) return absoluteUrl
  try {
    const u = new URL(absoluteUrl)
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
      return u.pathname + u.search + u.hash
    }
  } catch {}
  return absoluteUrl
}
