export const getParams = (urlStr: string) => {
  try {
    const url = new URL(urlStr);
    return Object.fromEntries(url.searchParams.entries());
  } catch {
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
    const rawLines = input.split(/\r?\n/);
    const cleanedCodes: string[] = [];
    const seenUppers = new Set<string>();

    for (const line of rawLines) {
        // Step 1: Clean special chars and trim, then split by whitespace/tabs like index.js
        const cleaned = line
            .replace(/["]|[\u200b]|[\u200c]|[\u200d]|[\uFEFF]/g, '')
            .trim()
            .split(/[\s\t]+/)[0];

        if (cleaned && cleaned.length > 0) {
            const upper = cleaned.toUpperCase();
            if (!seenUppers.has(upper)) {
                seenUppers.add(upper);
                cleanedCodes.push(cleaned);
            }
        }
    }
    return cleanedCodes;
};

export const processSyncData = (data: Record<string, unknown>, localKeys: Set<string>) => {
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
