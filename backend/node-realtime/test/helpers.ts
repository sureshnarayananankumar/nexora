import jwt from 'jsonwebtoken';

export const SECRET = 'test-secret-test-secret-test-secret-123456';

export function token(sub: number, org: number, name = `User ${sub}`, opts: { secret?: string; expiresIn?: number; perms?: string[] } = {}) {
  return jwt.sign({ org, email: `u${sub}@t.dev`, name, role: 'MEMBER', perms: opts.perms ?? ['TASK_WRITE'] }, opts.secret ?? SECRET, {
    algorithm: 'HS256', subject: String(sub), issuer: 'nexora', audience: 'nexora-clients', expiresIn: opts.expiresIn ?? 900,
  });
}
