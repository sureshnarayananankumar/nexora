import jwt from 'jsonwebtoken';

/** Mirrors the claims issued by the Spring Boot API (JwtService). */
export interface SocketUser {
  id: number;
  orgId: number;
  email: string;
  name: string;
  role: string;
  permissions: string[];
  exp: number;
}

export function verifyAccessToken(token: string | undefined, secret: string): SocketUser {
  if (!token) throw new Error('Missing token');
  const claims = jwt.verify(token, secret, {
    algorithms: ['HS256'],
    issuer: 'nexora',
    audience: 'nexora-clients',
  }) as jwt.JwtPayload;
  const id = Number(claims.sub);
  const orgId = Number(claims.org);
  if (!Number.isFinite(id) || !Number.isFinite(orgId)) throw new Error('Malformed token');
  return {
    id,
    orgId,
    email: String(claims.email ?? ''),
    name: String(claims.name ?? ''),
    role: String(claims.role ?? ''),
    permissions: Array.isArray(claims.perms) ? claims.perms.map(String) : [],
    exp: Number(claims.exp ?? 0),
  };
}
