import bcrypt from 'bcryptjs';

const ADMIN_USERNAME = process.env.DASHBOARD_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.DASHBOARD_PASSWORD || 'Prayagkaushik4';

export function validateCredentials(username: string, password: string): boolean {
  if (username !== ADMIN_USERNAME) return false;
  return password === ADMIN_PASSWORD;
}

export function isAuthenticated(req: any, res: any, next: any): void {
  if (req.session && req.session.authenticated) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized' });
}
