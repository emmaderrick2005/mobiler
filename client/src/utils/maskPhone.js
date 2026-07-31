export function maskPhone(phone) {
  if (!phone || phone.length < 4) return phone;
  return phone.slice(0, 3) + "*".repeat(phone.length - 5) + phone.slice(-2);
}
