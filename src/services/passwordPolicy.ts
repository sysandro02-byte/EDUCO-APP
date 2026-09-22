export const NEW_PASSWORD_MIN_LENGTH = 12;

const hasLower = (value: string) => /[a-z]/.test(value);
const hasUpper = (value: string) => /[A-Z]/.test(value);
const hasDigit = (value: string) => /[0-9]/.test(value);
const hasSymbol = (value: string) => /[^A-Za-z0-9]/.test(value);

export const getNewPasswordError = (value: unknown): string | null => {
  const password = String(value || '');
  if (password.length < NEW_PASSWORD_MIN_LENGTH) {
    return `Le mot de passe doit contenir au moins ${NEW_PASSWORD_MIN_LENGTH} caractères.`;
  }
  if (!hasLower(password) || !hasUpper(password) || !hasDigit(password) || !hasSymbol(password)) {
    return 'Le mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un symbole.';
  }
  return null;
};

export const isStrongNewPassword = (value: unknown) => getNewPasswordError(value) === null;

export const generateStrongPassword = (length = 18): string => {
  const size = Math.max(length, NEW_PASSWORD_MIN_LENGTH);
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const symbols = '!@#$%*-_+';
  const all = lower + upper + digits + symbols;
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) throw new Error('Générateur cryptographique indisponible.');

  const pick = (alphabet: string) => {
    const b = new Uint32Array(1);
    cryptoApi.getRandomValues(b);
    return alphabet[b[0] % alphabet.length];
  };

  const chars = [pick(lower), pick(upper), pick(digits), pick(symbols)];
  while (chars.length < size) chars.push(pick(all));

  const shuffle = new Uint32Array(chars.length);
  cryptoApi.getRandomValues(shuffle);
  return chars
    .map((char, index) => ({ char, order: shuffle[index] }))
    .sort((a, b) => a.order - b.order)
    .map(item => item.char)
    .join('');
};
