export const normalizePublicPath = (rawPath?: string): string => {
  const value = (rawPath || '/').trim();
  return `/${value.replace(/^\/+|\/+$/g, '')}/`.replace('//', '/');
};

export const getBasePrefixFromPublicPath = (rawPath?: string): string => {
  const normalized = normalizePublicPath(rawPath);
  return normalized === '/' ? '' : normalized.replace(/\/+$/, '');
};

export const stripBasePrefix = (pathname: string, basePrefix: string): string => {
  if (!basePrefix) return pathname;
  if (pathname.startsWith(basePrefix)) {
    return pathname.slice(basePrefix.length) || '/';
  }
  return pathname;
};
