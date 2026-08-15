const MIN_LENGTH = 10;

// Returns an error message if the password doesn't meet requirements, or
// null if it's valid. Client-side validation (client/src/utils/
// validatePassword.js) mirrors these same rules for immediate feedback,
// but this is the version that actually gets enforced.
function validatePassword(password) {
  if (typeof password !== "string" || password.length < MIN_LENGTH) {
    return `Password must be at least ${MIN_LENGTH} characters`;
  }
  if (!/[a-z]/.test(password)) return "Password must include a lowercase letter";
  if (!/[A-Z]/.test(password)) return "Password must include an uppercase letter";
  if (!/\d/.test(password)) return "Password must include a digit";
  if (!/[^A-Za-z0-9]/.test(password)) return "Password must include a symbol";
  return null;
}

module.exports = { validatePassword, MIN_LENGTH };
