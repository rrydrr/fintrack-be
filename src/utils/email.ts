import { config } from "../config/env";
import { logger } from "./logger";

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface SendEmailOptions {
  to: string | EmailRecipient | (string | EmailRecipient)[];
  subject: string;
  htmlContent: string;
  textContent?: string;
  sender?: {
    name?: string;
    email?: string;
  };
  replyTo?: {
    name?: string;
    email: string;
  };
  params?: Record<string, unknown>;
  tags?: string[];
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

/**
 * Normalizes input recipients into standard Brevo recipient objects
 */
function normalizeRecipients(
  recipients: string | EmailRecipient | (string | EmailRecipient)[]
): EmailRecipient[] {
  const list = Array.isArray(recipients) ? recipients : [recipients];
  return list.map((item) =>
    typeof item === "string" ? { email: item.trim() } : { email: item.email.trim(), name: item.name?.trim() }
  );
}

/**
 * Send an email using Brevo's Transactional Email API (v3)
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const apiKey = config.brevoApiKey;

  if (!apiKey) {
    const errorMsg = "Brevo API key is not configured. Email was not sent.";
    logger.warn(errorMsg);
    return { success: false, error: errorMsg };
  }

  const recipients = normalizeRecipients(options.to);
  if (recipients.length === 0) {
    const errorMsg = "No valid recipient email provided.";
    logger.warn(errorMsg);
    return { success: false, error: errorMsg };
  }

  const senderName = options.sender?.name || config.brevoSenderName;
  const senderEmail = options.sender?.email || config.brevoSenderEmail;

  const payload: Record<string, unknown> = {
    sender: {
      name: senderName,
      email: senderEmail,
    },
    to: recipients,
    subject: options.subject,
    htmlContent: options.htmlContent,
  };

  if (options.textContent) {
    payload.textContent = options.textContent;
  }

  if (options.replyTo) {
    payload.replyTo = options.replyTo;
  }

  if (options.params) {
    payload.params = options.params;
  }

  if (options.tags && options.tags.length > 0) {
    payload.tags = options.tags;
  }

  try {
    const response = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as { messageId?: string; message?: string; code?: string };

    if (!response.ok) {
      const errorDetail = data.message || `Brevo returned HTTP ${response.status}`;
      logger.error(`Failed to send email to ${recipients.map((r) => r.email).join(", ")}: ${errorDetail}`);
      return {
        success: false,
        error: errorDetail,
      };
    }

    logger.success(
      `Email successfully sent to ${recipients.map((r) => r.email).join(", ")} (Message ID: ${data.messageId || "N/A"})`
    );

    return {
      success: true,
      messageId: data.messageId,
    };
  } catch (error: any) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Exception while sending email via Brevo: ${message}`);
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Helper to render the brand logo in emails using the public R2 hosted asset.
 */
function renderBrandLogo(): string {
  const logoUrl =
    config.emailLogoUrl || "https://r2-forwarder.rrydrr.my.id/public/logo.png";

  return `
    <img
      src="${logoUrl}"
      alt="FinTrack"
      width="38"
      height="38"
      style="display:block;width:38px;height:38px;border-radius:10px;box-shadow:0 2px 6px rgba(0,0,0,0.18);border:0;outline:none;"
    />
  `.trim();
}

/**
 * Base email layout wrapper with FinTrack modern frontend design system (Emerald, Cyan, Zinc, Obsidian)
 */
function renderBaseTemplate(title: string, contentHtml: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;color:#3f3f46;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#fafafa;padding:48px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#ffffff;border-radius:20px;border:1px solid #e4e4e7;overflow:hidden;box-shadow:0 10px 25px -5px rgba(0,0,0,0.05),0 8px 10px -6px rgba(0,0,0,0.03);">
          <!-- Top Accent Line (Signature Emerald-to-Cyan Gradient) -->
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,#059669 0%,#10b981 50%,#06b6d4 100%);"></td>
          </tr>
          <!-- Header -->
          <tr>
            <td style="padding:28px 36px 22px 36px;border-bottom:1px solid #f4f4f5;">
              <table border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="vertical-align:middle;padding-right:12px;">
                    ${renderBrandLogo()}
                  </td>
                  <td style="vertical-align:middle;">
                    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:19px;font-weight:700;letter-spacing:-0.5px;color:#09090b;line-height:1.2;">FinTrack</div>
                    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;color:#71717a;letter-spacing:0.1px;margin-top:2px;">Intelligent financial &amp; receipt tracking</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px;font-size:15px;line-height:1.6;color:#3f3f46;">
              ${contentHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 36px;background-color:#fafafa;border-top:1px solid #f4f4f5;text-align:center;font-size:12px;color:#71717a;line-height:1.6;">
              <p style="margin:0 0 6px 0;color:#52525b;font-weight:600;">FinTrack &bull; Modern Personal Finance &amp; Asset Management</p>
              <p style="margin:0 0 4px 0;color:#a1a1aa;">This is an automated notification. Replies to this email are not monitored.</p>
              <p style="margin:0;color:#a1a1aa;">&copy; ${new Date().getFullYear()} FinTrack. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Send an invitation email containing an invite code
 */
export async function sendInviteEmail(options: {
  to: string;
  inviteCode: string;
  inviterName?: string;
  recipientName?: string;
  registerUrl?: string;
}): Promise<SendEmailResult> {
  const inviterText = options.inviterName
    ? `<strong style="color:#09090b;">${options.inviterName}</strong> has invited you`
    : "You have been invited";
  const greeting = options.recipientName ? `Hello ${options.recipientName},` : "Hello,";
  const registerLink = options.registerUrl || `${config.frontendUrl}/register`;
  const registerWithCode = `${registerLink}?code=${encodeURIComponent(options.inviteCode)}`;

  const contentHtml = `
    <div style="margin-bottom:8px;">
      <span style="display:inline-block;padding:4px 10px;background-color:#ecfdf5;border:1px solid #a7f3d0;border-radius:9999px;font-size:11px;font-weight:600;letter-spacing:0.5px;color:#059669;text-transform:uppercase;">
        Exclusive Invitation
      </span>
    </div>
    <h2 style="margin:8px 0 16px 0;color:#09090b;font-size:24px;font-weight:700;letter-spacing:-0.5px;line-height:1.3;">Join FinTrack Workspace</h2>
    <p style="margin:0 0 8px 0;font-size:15px;line-height:1.6;color:#3f3f46;">${greeting}</p>
    <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#52525b;">${inviterText} to create an account on <strong>FinTrack</strong> — an intelligent dashboard designed to track wealth, monitor multi-currency accounts, and itemize receipts with AI assistance.</p>
    
    <!-- Voucher / Invitation Code Box matching frontend styling -->
    <div style="margin:28px 0;padding:24px 20px;background-color:#f0fdf4;border-radius:16px;border:1.5px dashed #6ee7b7;text-align:center;">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;color:#059669;margin-bottom:8px;">
        Your Personal Invite Code
      </div>
      <div style="font-size:30px;font-weight:800;letter-spacing:5px;color:#065f46;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;margin-bottom:6px;">
        ${options.inviteCode}
      </div>
      <div style="font-size:12px;color:#047857;font-weight:500;">
        One-time registration code &bull; Valid for 7 days
      </div>
    </div>

    <!-- Call To Action Button matching frontend emerald style -->
    <div style="text-align:center;margin:32px 0 24px 0;">
      <a href="${registerWithCode}" target="_blank" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#059669 0%,#10b981 100%);background-color:#059669;color:#ffffff;text-decoration:none;border-radius:12px;font-weight:600;font-size:15px;letter-spacing:0.2px;box-shadow:0 4px 14px rgba(16,185,129,0.35);text-align:center;">
        Create Your Account &rarr;
      </a>
    </div>

    <!-- Feature highlights container matching frontend cards -->
    <div style="margin:28px 0;padding:20px;background-color:#fafafa;border-radius:14px;border:1px solid #f4f4f5;">
      <div style="color:#09090b;font-weight:600;font-size:13px;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.5px;">
        What you get with FinTrack:
      </div>
      <table border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="padding-bottom:10px;font-size:13px;line-height:1.5;color:#52525b;">
            <strong style="color:#09090b;">🧾 Smart AI Receipt Extraction</strong><br>
            Instantly map photos of receipts into itemized transactions and taxes.
          </td>
        </tr>
        <tr>
          <td style="padding-bottom:10px;font-size:13px;line-height:1.5;color:#52525b;">
            <strong style="color:#09090b;">📊 Real-Time Wealth &amp; Net Worth</strong><br>
            Aggregate balances across banks, investments, and liabilities in your base currency.
          </td>
        </tr>
        <tr>
          <td style="font-size:13px;line-height:1.5;color:#52525b;">
            <strong style="color:#09090b;">💱 Multi-Currency Architecture</strong><br>
            Live exchange rate conversions across global currencies.
          </td>
        </tr>
      </table>
    </div>

    <!-- Direct Link Fallback -->
    <div style="border-top:1px solid #f4f4f5;padding-top:20px;margin-top:20px;">
      <p style="margin:0 0 8px 0;font-size:12px;color:#71717a;line-height:1.5;">Button not working? Copy and paste this link into your browser:</p>
      <div style="padding:10px 14px;background-color:#fafafa;border-radius:8px;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:12px;color:#059669;word-break:break-all;border:1px solid #e4e4e7;">
        <a href="${registerWithCode}" style="color:#059669;text-decoration:none;">${registerWithCode}</a>
      </div>
    </div>
  `;

  return sendEmail({
    to: options.to,
    subject: "You've been invited to FinTrack! 🎉",
    htmlContent: renderBaseTemplate("FinTrack Invitation", contentHtml),
    tags: ["invite", "onboarding"],
  });
}

/**
 * Send a welcome email to a newly registered user
 */
export async function sendWelcomeEmail(options: {
  to: string;
  name?: string;
  dashboardUrl?: string;
}): Promise<SendEmailResult> {
  const greeting = options.name ? `Welcome aboard, ${options.name}!` : "Welcome to FinTrack!";
  const dashboardLink = options.dashboardUrl || `${config.frontendUrl}/dashboard`;

  const contentHtml = `
    <h2 style="margin:0 0 16px 0;color:#09090b;font-size:24px;font-weight:700;letter-spacing:-0.5px;line-height:1.3;">${greeting}</h2>
    <p style="margin:0 0 20px 0;font-size:15px;line-height:1.6;color:#3f3f46;">Your account is ready. FinTrack makes it effortless to capture receipts, automatically organize expenses, and see your financial health in real time.</p>

    <div style="margin:24px 0;padding:20px 24px;background-color:#fafafa;border-radius:14px;border:1px solid #f4f4f5;">
      <div style="color:#09090b;font-weight:600;font-size:14px;margin-bottom:12px;">
        ✨ Quick Start Guide:
      </div>
      <table border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="padding-bottom:10px;font-size:14px;line-height:1.5;color:#52525b;">
            <strong style="color:#09090b;">1. Snap or Upload:</strong> Take a photo of any receipt or bill.
          </td>
        </tr>
        <tr>
          <td style="padding-bottom:10px;font-size:14px;line-height:1.5;color:#52525b;">
            <strong style="color:#09090b;">2. AI Processing:</strong> Line items, totals, and categories are parsed instantly.
          </td>
        </tr>
        <tr>
          <td style="font-size:14px;line-height:1.5;color:#52525b;">
            <strong style="color:#09090b;">3. Track &amp; Optimize:</strong> Monitor budgets and net worth across multiple currencies.
          </td>
        </tr>
      </table>
    </div>

    <div style="text-align:center;margin:32px 0 16px 0;">
      <a href="${dashboardLink}" target="_blank" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#059669 0%,#10b981 100%);background-color:#059669;color:#ffffff;text-decoration:none;border-radius:12px;font-weight:600;font-size:15px;letter-spacing:0.2px;box-shadow:0 4px 14px rgba(16,185,129,0.35);">
        Go to Dashboard &rarr;
      </a>
    </div>
  `;

  return sendEmail({
    to: options.to,
    subject: "Welcome to FinTrack! 🎉",
    htmlContent: renderBaseTemplate("Welcome to FinTrack", contentHtml),
    tags: ["welcome", "onboarding"],
  });
}

/**
 * Send an email verification link to a user
 */
export async function sendVerificationEmail(options: {
  to: string;
  token: string;
  name?: string;
  verifyUrl?: string;
}): Promise<SendEmailResult> {
  const greeting = options.name ? `Hello ${options.name},` : "Hello,";
  const verificationLink =
    options.verifyUrl || `${config.frontendUrl}/verify/${encodeURIComponent(options.token)}`;

  const contentHtml = `
    <h2 style="margin:0 0 16px 0;color:#09090b;font-size:24px;font-weight:700;letter-spacing:-0.5px;line-height:1.3;">Verify Your Email Address</h2>
    <p style="margin:0 0 12px 0;font-size:15px;line-height:1.6;color:#3f3f46;">${greeting}</p>
    <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#52525b;">Thank you for signing up for FinTrack! Please confirm your email address by clicking the button below:</p>

    <div style="text-align:center;margin:32px 0;">
      <a href="${verificationLink}" target="_blank" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#059669 0%,#10b981 100%);background-color:#059669;color:#ffffff;text-decoration:none;border-radius:12px;font-weight:600;font-size:15px;letter-spacing:0.2px;box-shadow:0 4px 14px rgba(16,185,129,0.35);">
        Verify Email &rarr;
      </a>
    </div>

    <div style="background-color:#fafafa;border:1px solid #f4f4f5;border-radius:12px;padding:16px;margin:28px 0 24px 0;">
      <p style="margin:0;font-size:13px;line-height:1.5;color:#71717a;">
        <strong style="color:#09090b;">Security Notice:</strong> If you did not request this verification, you can safely ignore this email.
      </p>
    </div>

    <div style="border-top:1px solid #f4f4f5;padding-top:20px;margin-top:20px;">
      <p style="margin:0 0 8px 0;font-size:12px;color:#71717a;line-height:1.5;">Or copy and paste this link into your browser:</p>
      <div style="padding:10px 14px;background-color:#fafafa;border-radius:8px;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:12px;color:#059669;word-break:break-all;border:1px solid #e4e4e7;">
        <a href="${verificationLink}" style="color:#059669;text-decoration:none;">${verificationLink}</a>
      </div>
    </div>
  `;

  return sendEmail({
    to: options.to,
    subject: "Verify your FinTrack email address",
    htmlContent: renderBaseTemplate("Verify Your Email", contentHtml),
    tags: ["auth", "verification"],
  });
}
