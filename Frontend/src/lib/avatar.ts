export function avatarUrl(name: string, size = 80): string {
  const words = name.split(/\s+/).filter(Boolean);
  let initials = words
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
  if (initials.length < 2 && words[0]) {
    initials = words[0].slice(0, 2).toUpperCase();
  }
  if (!initials) initials = "?";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100"><rect width="100" height="100" rx="50" fill="#1a7a3c"/><text x="50" y="50" dy="0.35em" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="700" fill="#ffffff">${initials}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
