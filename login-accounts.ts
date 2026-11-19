export type LoginAccount = { password: string; role: "admin" | "member"; username?: string };

export function getLoginAccounts(): Record<string, LoginAccount> | null {
  try {
    const parsed: unknown = JSON.parse(process.env.DORM_LOGIN_ACCOUNTS_JSON ?? "");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, LoginAccount>;
  } catch {
    return null;
  }
}

export const studentEmail = (username: string) => `student-${username}@accounts.dorm511.invalid`;

export function accountUsername(studentId: string, account?: LoginAccount | null) {
  return account?.username?.trim() || studentId;
}

export function studentNumberFromEmail(email: string) {
  return /^student-(\d{11})@accounts\.dorm511\.invalid$/.exec(email)?.[1] ?? null;
}
