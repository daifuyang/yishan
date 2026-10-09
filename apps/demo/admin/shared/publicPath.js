export const normalizePublicPath = (rawPath) => {
    const value = (rawPath || '/').trim();
    return `/${value.replace(/^\/+|\/+$/g, '')}/`.replace('//', '/');
};
export const isValidPublicPath = (value) => {
    if (value === '/')
        return true;
    return /^\/.*\/$/.test(value);
};
export const getBasePrefixFromPublicPath = (rawPath) => {
    const normalized = normalizePublicPath(rawPath);
    return normalized === '/' ? '' : normalized.replace(/\/+$/, '');
};
export const stripBasePrefix = (pathname, basePrefix) => {
    if (!basePrefix)
        return pathname;
    if (pathname.startsWith(basePrefix)) {
        return pathname.slice(basePrefix.length) || '/';
    }
    return pathname;
};
