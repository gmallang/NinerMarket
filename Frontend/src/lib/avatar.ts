export function avatarUrl(name: string, size = 80): string {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=${size}&background=1a7a3c&color=fff`;
}
