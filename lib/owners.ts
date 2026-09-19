export const MASTER_EMAIL = (process.env.ALLOWED_EMAIL ?? "awad@apixis.dev").toLowerCase();

export function isMasterEmail(email: string | undefined | null) {
  return (email ?? "").trim().toLowerCase() === MASTER_EMAIL;
}
