const REALM = 'Sovereign Demo';
const DEFAULT_USERNAME = 'demo';
const DEFAULT_PASSWORD = 'sovereign';

function unauthorizedResponse() {
  return new Response('Authentication required.', {
    status: 401,
    headers: {
      'WWW-Authenticate': `Basic realm="${REALM}", charset="UTF-8"`,
      'Cache-Control': 'no-store'
    }
  });
}

function parseBasicAuthorization(headerValue) {
  if (!headerValue || !headerValue.startsWith('Basic ')) {
    return null;
  }

  const encoded = headerValue.slice(6).trim();
  if (!encoded) {
    return null;
  }

  let decoded;
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

export async function onRequest(context) {
  const expectedUsername = context.env.BASIC_AUTH_USER || DEFAULT_USERNAME;
  const expectedPassword = context.env.BASIC_AUTH_PASS || DEFAULT_PASSWORD;

  const parsed = parseBasicAuthorization(context.request.headers.get('Authorization'));
  const valid =
    parsed &&
    timingSafeEqual(parsed.username, expectedUsername) &&
    timingSafeEqual(parsed.password, expectedPassword);

  if (!valid) {
    return unauthorizedResponse();
  }

  const response = await context.next();
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
