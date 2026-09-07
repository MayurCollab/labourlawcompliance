/**
 * Base HTML layout every email is wrapped in.
 * Placeholders: {{appName}}, {{content}}, {{year}}
 */
const layout = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="background-color:#18181b;padding:20px 32px;">
                <span style="color:#ffffff;font-size:18px;font-weight:bold;">{{appName}}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;color:#27272a;font-size:14px;line-height:1.6;">
                {{content}}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px;border-top:1px solid #e4e4e7;color:#a1a1aa;font-size:12px;">
                &copy; {{year}} {{appName}}. If you didn't request this email, you can safely ignore it.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

export default layout;
