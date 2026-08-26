export type PasswordResetAccountType = "admin" | "user";

export type PasswordResetRequestResult =
  | { success: true }
  | { success: false; error: string };

export type PasswordResetTokenStatus =
  | { valid: true }
  | { valid: false; error: string };

export type PasswordResetResult =
  | { success: true; accountType: PasswordResetAccountType }
  | { success: false; error: string };
