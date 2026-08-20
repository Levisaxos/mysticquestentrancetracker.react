// Map and sprite paths in our data files are absolute ('/images/maps/...').
// On GitHub Pages the app is served from a sub-path, so those need the base
// prefix or every image 404s. Everything that renders an image from data must
// go through here.
export function assetUrl(path) {
  if (!path) return path;
  if (/^(https?:)?\/\//.test(path) || path.startsWith('data:')) return path;

  const base = import.meta.env?.BASE_URL ?? '/';
  return base.replace(/\/$/, '') + (path.startsWith('/') ? path : `/${path}`);
}
