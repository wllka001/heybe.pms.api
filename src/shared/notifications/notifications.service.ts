import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly transporter: any;

  constructor(private readonly configService: ConfigService) {
    const user = this.configService.get<string>('SMTP_USER', '');
    const pass = this.configService.get<string>('SMTP_PASS', '');
    const host = this.configService.get<string>('SMTP_HOST', 'smtp.gmail.com');
    const port = this.configService.get<number>('SMTP_PORT', 587);

    this.transporter =
      user && pass
        ? nodemailer.createTransport({
          host,
          port,
          secure: Number(port) === 465,
          auth: {
            user,
            pass,
          },
        })
        : null;
  }

  async sendEmail(to: string, subject: string, template: string, data: Record<string, unknown>): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(`SMTP not configured. Skipping email -> to:${to} subject:${subject}`);
      return;
    }

    const appName = this.configService.get<string>('APP_NAME', 'PMS');
    const fromAddress = this.configService.get<string>('SMTP_USER', '');
    const otp = String(data.otp || '');
    const expiresInMinutes = String(data.expiresInMinutes || '');
    const firstName = String(data.firstName || 'User');
    const brandInitial = appName.trim().charAt(0).toUpperCase() || 'P';

    const html = `
      <div style="margin:0; padding:32px 16px; background-color:#f4f7fb; font-family:'Segoe UI', Arial, sans-serif; color:#0f172a;">
        <div style="max-width:600px; margin:0 auto;">
          <div style="text-align:center; margin-bottom:20px;">
            <div style="width:64px; height:64px; margin:0 auto 14px; border-radius:18px; background:linear-gradient(135deg, #0f766e 0%, #164e63 100%); color:#ffffff; font-size:28px; font-weight:700; line-height:64px; text-align:center; box-shadow:0 14px 30px rgba(15, 118, 110, 0.28);">
              ${brandInitial}
            </div>
            <div style="font-size:20px; font-weight:700; letter-spacing:0.3px; color:#0f172a;">${appName}</div>
            <div style="margin-top:6px; font-size:13px; color:#64748b;">Secure sign-in verification</div>
          </div>

          <div style="background:#ffffff; border-radius:24px; overflow:hidden; box-shadow:0 18px 50px rgba(15, 23, 42, 0.08); border:1px solid #e2e8f0;">
            <div style="padding:28px 32px; background:linear-gradient(135deg, #ecfeff 0%, #f8fafc 55%, #eff6ff 100%); border-bottom:1px solid #e2e8f0;">
              <div style="display:inline-block; padding:6px 12px; border-radius:999px; background:#dbeafe; color:#1d4ed8; font-size:12px; font-weight:700; letter-spacing:0.4px; text-transform:uppercase;">
                Login Protection
              </div>
              <h2 style="margin:16px 0 10px; font-size:28px; line-height:1.2; color:#0f172a;">Verify your login</h2>
              <p style="margin:0; font-size:15px; line-height:1.7; color:#475569;">
                Hello ${firstName}, use the one-time password below to complete your sign-in securely.
              </p>
            </div>

            <div style="padding:32px;">
              <div style="margin-bottom:14px; font-size:13px; color:#64748b; text-transform:uppercase; letter-spacing:0.35px;">
                Your verification code
              </div>
              <div style="padding:22px 24px; border-radius:20px; background:linear-gradient(135deg, #0f172a 0%, #1e293b 100%); text-align:center; box-shadow:inset 0 1px 0 rgba(255,255,255,0.06);">
                <div style="font-size:34px; line-height:1; letter-spacing:10px; font-weight:800; color:#ffffff;">
                  ${otp}
                </div>
              </div>

              <div style="margin-top:18px; padding:16px 18px; border-radius:16px; background:#f8fafc; border:1px solid #e2e8f0; color:#334155; font-size:14px; line-height:1.7;">
                This OTP expires in <strong>${expiresInMinutes} minute(s)</strong>. For your security, do not share this code with anyone.
              </div>

              <div style="margin-top:24px; font-size:14px; line-height:1.8; color:#475569;">
                If you did not attempt to sign in, you can safely ignore this email. Your account will remain protected.
              </div>
            </div>
          </div>

          <div style="padding-top:18px; text-align:center; font-size:12px; line-height:1.7; color:#94a3b8;">
            This is an automated security email from ${appName}. Please do not reply directly to this message.
          </div>
        </div>
      </div>
    `;

    const text = `
${appName} - Login Verification

Hello ${firstName},

Use the following one-time password to complete your login:

${otp}

This OTP expires in ${expiresInMinutes} minute(s).

If you did not try to sign in, you can ignore this email.
    `.trim();

    await this.transporter.sendMail({
      from: `"${appName}" <${fromAddress}>`,
      to,
      subject,
      html,
      text,
    });
  }

  async sendSms(to: string, message: string): Promise<void> {
    this.logger.log(`SMS queued -> to:${to} message:${message}`);
  }
}
