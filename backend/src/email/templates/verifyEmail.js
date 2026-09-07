/**
 * Email-verification email.
 * Placeholders: {{name}}, {{verificationUrl}}, {{expiryHours}}
 */
export const subject = 'Verify your email address';

export const content = `
<h2 style="margin:0 0 16px;font-size:20px;color:#18181b;">Welcome, {{name}}!</h2>
<p>Thanks for signing up. Please confirm your email address to activate your account.</p>
<p style="margin:24px 0;">
  <a href="{{verificationUrl}}"
     style="background-color:#18181b;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:bold;display:inline-block;">
    Verify Email
  </a>
</p>
<p>Or copy this link into your browser:</p>
<p style="word-break:break-all;color:#2563eb;">{{verificationUrl}}</p>
<p style="color:#71717a;">This link expires in {{expiryHours}} hour(s).</p>
`;
