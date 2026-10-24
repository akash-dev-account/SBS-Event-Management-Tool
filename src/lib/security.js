const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export const sanitizeText = (value, fallback = '') => {
  if (typeof value !== 'string') return fallback;
  return value.replace(/[<>]/g, '').trim();
};

export const sanitizeNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

export const isValidImageDataUrl = (value) => {
  if (typeof value !== 'string' || !value.startsWith('data:image/')) return false;
  const match = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return false;

  const [, mimeType, base64] = match;
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(mimeType)) return false;

  const bytes = Math.ceil((base64.length * 3) / 4);
  return bytes <= MAX_IMAGE_BYTES;
};

export const isSafeHttpUrl = (value) => {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
};

export const safeFileName = (name = 'upload') => {
  const cleaned = String(name)
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);

  return cleaned || 'upload';
};
