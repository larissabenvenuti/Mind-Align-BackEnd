const passwordRequirements = [
  (password: string) => password.length >= 8,
  (password: string) => /[A-Z]/.test(password),
  (password: string) => /[a-z]/.test(password),
  (password: string) => /\d/.test(password),
  (password: string) => /[!@#$%^&*(),.?":{}|<>]/.test(password),
];

export function meetsPasswordPolicy(password: string): boolean {
  return passwordRequirements.every((requirement) =>
    requirement(password),
  );
}
