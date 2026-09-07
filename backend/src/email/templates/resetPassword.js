/**
 * Password-reset email.
 * Placeholders: {{name}}, {{resetUrl}}, {{expiryMinutes}}
 */
export const subject = 'Reset your password';

export const content = `
<h2 style="margin:0 0 16px;font-size:20px;color:#18181b;">Hi {{name}},</h2>
<p>We received a request to reset your password. Click the button below to choose a new one.</p>
<p style="margin:24px 0;">
  <a href="{{resetUrl}}"
     style="background-color:#18181b;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:bold;display:inline-block;">
    Reset Password
  </a>
</p>
<p>Or copy this link into your browser:</p>
<p style="word-break:break-all;color:#2563eb;">{{resetUrl}}</p>
<p style="color:#71717a;">This link expires in {{expiryMinutes}} minute(s). If you didn't request a reset, no action is needed.</p>
`;
