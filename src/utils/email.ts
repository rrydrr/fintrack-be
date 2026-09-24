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
 * Base email layout wrapper with FinTrack light mode styling
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
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;color:#334155;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#f8fafc;padding:48px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:540px;background-color:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05),0 10px 15px -3px rgba(0,0,0,0.04);">
          <!-- Top Accent Line -->
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,#2563eb 0%,#3b82f6 50%,#60a5fa 100%);"></td>
          </tr>
          <!-- Header -->
          <tr>
            <td style="padding:28px 36px 20px 36px;border-bottom:1px solid #f1f5f9;">
              <table border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="vertical-align:middle;padding-right:12px;">
                    <div style="width:36px;height:36px;background:linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%);border-radius:10px;text-align:center;line-height:36px;box-shadow:0 2px 6px rgba(37,99,235,0.25);">
                      <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:18px;font-weight:800;color:#ffffff;display:inline-block;line-height:36px;">F</span>
                    </div>
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:18px;font-weight:700;letter-spacing:-0.5px;color:#0f172a;line-height:1.2;">FinTrack</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px;font-size:15px;line-height:1.6;color:#334155;">
              ${contentHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 36px;background-color:#f8fafc;border-top:1px solid #f1f5f9;text-align:center;font-size:12px;color:#94a3b8;line-height:1.6;">
              <p style="margin:0 0 6px 0;color:#64748b;font-weight:500;">FinTrack &bull; Smart Financial &amp; Receipt Tracking</p>
              <p style="margin:0 0 4px 0;">This is an automated notification. Replies to this email are not monitored.</p>
              <p style="margin:0;">&copy; ${new Date().getFullYear()} FinTrack. All rights reserved.</p>
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
  registerUrl?: string;
}): Promise<SendEmailResult> {
  const inviterText = options.inviterName ? `<strong>${options.inviterName}</strong> has invited you` : "You have been invited";
  const registerLink = options.registerUrl || `${config.frontendUrl}/register`;

  const contentHtml = `
    <h2 style="margin:0 0 16px 0;color:#0f172a;font-size:22px;font-weight:700;letter-spacing:-0.5px;line-height:1.3;">You're Invited to FinTrack!</h2>
    <p style="margin:0 0 20px 0;font-size:15px;line-height:1.6;color:#334155;">${inviterText} to join the FinTrack workspace to scan receipts and manage finances with AI assistance.</p>
    
    <div style="margin:28px 0;padding:24px 20px;background-color:#eff6ff;border-radius:12px;border:1.5px dashed #93c5fd;text-align:center;">
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:600;color:#2563eb;margin-bottom:8px;">Your Invitation Code</div>
      <div style="font-size:28px;font-weight:700;letter-spacing:4px;color:#1e40af;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;">${options.inviteCode}</div>
    </div>

    <p style="margin:0 0 28px 0;font-size:14px;color:#64748b;line-height:1.5;text-align:center;">Use this code when creating your account to unlock instant access.</p>

    <div style="text-align:center;margin-bottom:16px;">
      <a href="${registerLink}?code=${encodeURIComponent(options.inviteCode)}" target="_blank" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%);color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;letter-spacing:0.2px;box-shadow:0 4px 12px rgba(37,99,235,0.25);">
        Create Your Account &rarr;
      </a>
    </div>
  `;

  return sendEmail({
    to: options.to,
    subject: "You've been invited to FinTrack",
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
    <h2 style="margin:0 0 16px 0;color:#0f172a;font-size:22px;font-weight:700;letter-spacing:-0.5px;line-height:1.3;">${greeting}</h2>
    <p style="margin:0 0 20px 0;font-size:15px;line-height:1.6;color:#334155;">Your account is ready. FinTrack makes it effortless to capture receipts, automatically organize expenses, and see your financial health in real time.</p>

    <div style="margin:24px 0;padding:20px 24px;background-color:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;">
      <div style="color:#0f172a;font-weight:600;font-size:14px;margin-bottom:12px;">
        ✨ Quick Start Guide:
      </div>
      <table border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="padding-bottom:10px;font-size:14px;line-height:1.5;color:#475569;">
            <strong style="color:#0f172a;">1. Snap or Upload:</strong> Take a photo of any receipt or bill.
          </td>
        </tr>
        <tr>
          <td style="padding-bottom:10px;font-size:14px;line-height:1.5;color:#475569;">
            <strong style="color:#0f172a;">2. AI Processing:</strong> Line items, totals, and categories are parsed instantly.
          </td>
        </tr>
        <tr>
          <td style="font-size:14px;line-height:1.5;color:#475569;">
            <strong style="color:#0f172a;">3. Track &amp; Optimize:</strong> Monitor budgets and net worth across multiple currencies.
          </td>
        </tr>
      </table>
    </div>

    <div style="text-align:center;margin:32px 0 16px 0;">
      <a href="${dashboardLink}" target="_blank" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%);color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;letter-spacing:0.2px;box-shadow:0 4px 12px rgba(37,99,235,0.25);">
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
    <h2 style="margin:0 0 16px 0;color:#0f172a;font-size:22px;font-weight:700;letter-spacing:-0.5px;line-height:1.3;">Verify Your Email Address</h2>
    <p style="margin:0 0 12px 0;font-size:15px;line-height:1.6;color:#334155;">${greeting}</p>
    <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#334155;">Thank you for signing up for FinTrack! Please confirm your email address by clicking the button below:</p>

    <div style="text-align:center;margin:32px 0;">
      <a href="${verificationLink}" target="_blank" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%);color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;letter-spacing:0.2px;box-shadow:0 4px 12px rgba(37,99,235,0.25);">
        Verify Email &rarr;
      </a>
    </div>

    <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin:28px 0 24px 0;">
      <p style="margin:0;font-size:13px;line-height:1.5;color:#64748b;">
        <strong style="color:#334155;">Security Notice:</strong> If you did not request this verification, you can safely ignore this email.
      </p>
    </div>

    <div style="border-top:1px solid #f1f5f9;padding-top:20px;margin-top:20px;">
      <p style="margin:0 0 8px 0;font-size:12px;color:#94a3b8;line-height:1.5;">Or copy and paste this link into your browser:</p>
      <div style="padding:10px 14px;background-color:#f8fafc;border-radius:8px;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:12px;color:#2563eb;word-break:break-all;border:1px solid #e2e8f0;">
        <a href="${verificationLink}" style="color:#2563eb;text-decoration:none;">${verificationLink}</a>
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
