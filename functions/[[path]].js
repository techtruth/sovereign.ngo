const REALM = 'Sovereign Demo';
const PROTECTED_PATH_PREFIXES = ['/demo/bedcount'];
const PROTECTED_EXACT_PATHS = new Set();

function text(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function parseBasicAuthorization(headerValue) {
  const normalized = text(headerValue);
  if (!normalized.startsWith('Basic ')) {
    return null;
  }

  const encoded = normalized.slice(6).trim();
  if (!encoded) {
    return null;
  }

  let decoded = '';
  try {
    decoded = atob(encoded);
  } catch {
    return null;
  }

  const separator = decoded.indexOf(':');
  if (separator < 0) {
    return null;
  }

  return {
    username: decoded.slice(0, separator),
    password: decoded.slice(separator + 1)
  };
}

function timingSafeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string' || left.length !== right.length) {
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < left.length; i += 1) {
    mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return mismatch === 0;
}

function basicAuthChallenge() {
  return new Response('Authentication required.', {
    status: 401,
    headers: {
      'WWW-Authenticate': `Basic realm="${REALM}", charset="UTF-8"`,
      'Cache-Control': 'no-store'
    }
  });
}

function misconfiguredResponse() {
  return new Response('Basic auth is not configured.', {
    status: 500,
    headers: {
      'Cache-Control': 'no-store'
    }
  });
}

function shouldProtectPath(pathname) {
  const normalized = text(pathname).toLowerCase();
  if (!normalized) {
    return false;
  }

  const canonical = normalized === '/' ? '/' : normalized.replace(/\/+$/, '');
  if (PROTECTED_EXACT_PATHS.has(canonical)) {
    return true;
  }

  return PROTECTED_PATH_PREFIXES.some((prefix) => canonical === prefix || canonical.startsWith(`${prefix}/`));
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (!shouldProtectPath(url.pathname)) {
    return context.next();
  }

  const expectedUsername = text(context.env.BASIC_AUTH_USER);
  const expectedPassword = text(context.env.BASIC_AUTH_PASS);
  if (!expectedUsername || !expectedPassword) {
    return misconfiguredResponse();
  }

  const parsed = parseBasicAuthorization(context.request.headers.get('authorization'));
  const valid =
    parsed &&
    timingSafeEqual(parsed.username, expectedUsername) &&
    timingSafeEqual(parsed.password, expectedPassword);

  if (!valid) {
    return basicAuthChallenge();
  }

  const response = await context.next();
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
