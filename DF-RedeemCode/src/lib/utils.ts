export const getParams = (urlStr: string) => {
  try {
    const url = new URL(urlStr);
    return Object.fromEntries(url.searchParams.entries());
  } catch (e) {
    return {};
  }
};

export const unescapeFirebaseKey = (key: string) => {
  return key
    .replace(/%2E/g, '.')
    .replace(/%23/g, '#')
    .replace(/%24/g, '$')
    .replace(/%2F/g, '/')
    .replace(/%5B/g, '[')
    .replace(/%5D/g, ']');
};

export const escapeFirebaseKey = (key: string) => {
  return key
    .replace(/\./g, '%2E')
    .replace(/#/g, '%23')
    .replace(/\$/g, '%24')
    .replace(/\//g, '%2F')
    .replace(/\[/g, '%5B')
    .replace(/\]/g, '%5D');
};

export const parseInputCodes = (input: string) => {
    return Array.from(new Set(
        input.split(/\r?\n/)
        .map(line => line.replace(/["\u200b\u200c\u200d\uFEFF]/g, '').trim())
        .filter(code => code && code.length > 0)
    ));
};

export const processSyncData = (data: Record<string, any>, localKeys: Set<string>) => {
    const entries = Object.entries(data);
    return entries.map(([safeKey, val]) => {
        const value = Number(val);
        return {
            safeKey,
            cdkey: unescapeFirebaseKey(safeKey),
            ts: Math.floor(value / 10),
            statusDigit: value % 10
        };
    }).filter(item => item.statusDigit === 0 && !localKeys.has(item.cdkey));
};
