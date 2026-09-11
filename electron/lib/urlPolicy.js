function parseUrl(value, label) {
    const raw = typeof value === 'string' ? value.trim() : '';
    if (!raw) throw new Error(`${label} is required`);

    let parsed;
    try {
        parsed = new URL(raw);
    } catch {
        throw new Error(`${label} must be a valid URL`);
    }

    if (parsed.username || parsed.password) {
        throw new Error(`${label} must not include embedded credentials`);
    }

    return parsed;
}

function normalizeHostname(hostname) {
    return String(hostname || '').toLowerCase().replace(/^\[/, '').replace(/\]$/, '');
}

function parseIpv4(hostname) {
    const parts = normalizeHostname(hostname).split('.');
    if (parts.length !== 4) return null;
    if (!parts.every((p) => /^\d{1,3}$/.test(p))) return null;
    const nums = parts.map(Number);
    if (nums.some((n) => n < 0 || n > 255)) return null;
    return nums;
}

function isLocalWan2gpHost(hostname) {
    const host = normalizeHostname(hostname);
    if (host === 'localhost' || host.endsWith('.local')) return true;
    if (host === '::1') return true;

    const ip = parseIpv4(host);
    if (!ip) return false;

    const [a, b] = ip;
    if (a === 127) return true;
    if (a === 10) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    return false;
}

function isBlockedLinkLocalHost(hostname) {
    const ip = parseIpv4(hostname);
    return Boolean(ip && ip[0] === 169 && ip[1] === 254);
}

function normalizeWan2gpBaseUrl(value) {
    const parsed = parseUrl(value, 'Wan2GP server URL');

    if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('Wan2GP server URL must use http:// or https://');
    }
    if (parsed.search || parsed.hash) {
        throw new Error('Wan2GP server URL must not include a query string or fragment');
    }
    if (isBlockedLinkLocalHost(parsed.hostname)) {
        throw new Error('Wan2GP server URL must not target an IPv4 link-local address');
    }
    if (parsed.protocol === 'http:' && !isLocalWan2gpHost(parsed.hostname)) {
        throw new Error('Public Wan2GP endpoints must use HTTPS; HTTP is limited to localhost or private LAN hosts');
    }

    const pathname = parsed.pathname.replace(/\/+$/, '');
    return `${parsed.protocol}//${parsed.host}${pathname === '/' ? '' : pathname}`;
}

function isAllowedExternalUrl(value) {
    let parsed;
    try {
        parsed = parseUrl(value, 'External URL');
    } catch {
        return false;
    }
    return ['http:', 'https:'].includes(parsed.protocol);
}

module.exports = {
    isAllowedExternalUrl,
    isLocalWan2gpHost,
    normalizeWan2gpBaseUrl,
};
