export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_HINT =
  "At least 10 characters, with an uppercase letter, a lowercase letter, a digit, and a symbol.";

// Mirrors server/src/utils/password.js — this is just for immediate
// feedback before submitting; the server enforces the real rule.
export function validatePassword(password) {
  if (!password || password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  }
  if (!/[a-z]/.test(password)) return "Password must include a lowercase letter";
  if (!/[A-Z]/.test(password)) return "Password must include an uppercase letter";
  if (!/\d/.test(password)) return "Password must include a digit";
  if (!/[^A-Za-z0-9]/.test(password)) return "Password must include a symbol";
  return null;
}
