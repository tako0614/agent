// Note: This service is deprecated
// Use OAuth 2.1 authentication via /auth/* endpoints instead

export type AccountProvider = 'email' | 'google' | 'line';

export interface AccountRecord {
  id: string;
  email: string;
  name: string;
  provider: AccountProvider;
  password?: string;
  picture?: string;
  createdAt: string;
}

export class AccountError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// Deprecated: Use OAuth 2.1 tokens instead
// const authService = createAuthService({...});

const accountsById = new Map<string, AccountRecord>();
const accountsByEmail = new Map<string, AccountRecord>();

function sanitizeAccount(account: AccountRecord) {
  const { password, ...rest } = account;
  return rest;
}

// Deprecated: Use OAuth 2.1 access tokens instead
function createSessionToken(_account: AccountRecord): string {
  throw new Error('Deprecated: Use OAuth 2.1 /auth/login instead');
}

// Deprecated: Use OAuth 2.1 token validation instead
function resolveAccountFromSession(_token: string): AccountRecord | null {
  throw new Error('Deprecated: Use OAuth 2.1 tokens instead');
}

export async function registerAccount(input: {
  email?: string;
  name?: string;
  password?: string;
  provider?: AccountProvider;
  providerId?: string;
}) {
  const email = input.email?.trim();
  const name = input.name?.trim();

  if (!email || !name) {
    throw new AccountError('Email and name are required', 400);
  }

  if (accountsByEmail.has(email)) {
    throw new AccountError('Account already exists for this email', 409);
  }

  const id = input.providerId || `user_${Date.now()}`;
  const now = new Date().toISOString();
  const account: AccountRecord = {
    id,
    email,
    name,
    provider: input.provider || 'email',
    password: input.password,
    createdAt: now,
  };

  accountsById.set(id, account);
  accountsByEmail.set(email, account);

  const sessionToken = createSessionToken(account);

  return {
    message: 'Account created successfully',
    sessionToken,
    account: sanitizeAccount(account),
  };
}

export async function loginAccount(input: { email?: string; password?: string }) {
  const email = input.email?.trim();
  const password = input.password;

  if (!email || !password) {
    throw new AccountError('Email and password are required', 400);
  }

  const account = accountsByEmail.get(email);
  if (!account || account.password !== password) {
    throw new AccountError('Invalid credentials', 401);
  }

  const sessionToken = createSessionToken(account);

  return {
    message: 'Login successful',
    sessionToken,
    account: sanitizeAccount(account),
  };
}

export async function getAccountProfile(token: string) {
  const account = resolveAccountFromSession(token);
  if (!account) {
    throw new AccountError('Invalid or expired session', 401);
  }

  return sanitizeAccount(account);
}

export async function updateAccount(token: string, updates: { name?: string; email?: string }) {
  const account = resolveAccountFromSession(token);
  if (!account) {
    throw new AccountError('Invalid or expired session', 401);
  }

  const storedAccount = accountsById.get(account.id);

  if (updates.email && updates.email !== account.email) {
    const normalizedEmail = updates.email.trim();
    if (accountsByEmail.has(normalizedEmail)) {
      throw new AccountError('Another account already uses this email', 409);
    }

    if (storedAccount) {
      accountsByEmail.delete(account.email);
      storedAccount.email = normalizedEmail;
      accountsByEmail.set(normalizedEmail, storedAccount);
    }

    account.email = normalizedEmail;
  }

  if (updates.name) {
    const normalizedName = updates.name.trim();
    if (storedAccount) {
      storedAccount.name = normalizedName;
    }
    account.name = normalizedName;
  }

  accountsById.set(account.id, {
    ...account,
    password: storedAccount?.password,
  });

  const sessionToken = createSessionToken(account);

  return {
    message: 'Account updated successfully',
    account: sanitizeAccount(account),
    sessionToken,
  };
}

export async function deleteAccount(token: string) {
  const account = resolveAccountFromSession(token);
  if (!account) {
    throw new AccountError('Invalid or expired session', 401);
  }

  accountsById.delete(account.id);
  accountsByEmail.delete(account.email);

  return {
    message: 'Account deleted successfully',
  };
}

export async function logoutAccount() {
  return {
    message: 'Logout successful',
  };
}

export function extractSessionTokenFromAuthHeader(header?: string | null) {
  if (!header) return null;
  if (!header.toLowerCase().startsWith('bearer ')) return null;
  return header.slice(7).trim();
}
