export function roleHome(role) {
  if (role === "AGENT") return "/agent";
  if (role === "ADMIN") return "/admin";
  return "/customer";
}
