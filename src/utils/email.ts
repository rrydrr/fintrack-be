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
 * Base email layout wrapper with FinTrack styling
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
<body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f8fafc;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#0f172a;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:540px;background-color:#1e293b;border-radius:16px;border:1px solid #334155;overflow:hidden;box-shadow:0 10px 25px -5px rgba(0,0,0,0.4);">
          <!-- Header -->
          <tr>
            <td style="padding:32px 32px 20px 32px;border-bottom:1px solid #334155;background:linear-gradient(180deg,#1e293b 0%,#0f172a 100%);">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="display:inline-block;padding:8px 14px;background-color:#2563eb;color:#ffffff;border-radius:8px;font-weight:700;font-size:16px;letter-spacing:-0.5px;">
                      FinTrack
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;font-size:15px;line-height:1.6;color:#cbd5e1;">
              ${contentHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;background-color:#0f172a;border-top:1px solid #334155;text-align:center;font-size:12px;color:#64748b;">
              <p style="margin:0 0 8px 0;">This is an automated notification from FinTrack.</p>
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
    <h2 style="margin-top:0;color:#ffffff;font-size:22px;font-weight:600;">You're Invited to FinTrack!</h2>
    <p>${inviterText} to join the FinTrack workspace to scan receipts and manage finances with AI assistance.</p>
    
    <div style="margin:28px 0;padding:20px;background-color:#0f172a;border-radius:12px;border:1px dashed #3b82f6;text-align:center;">
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:8px;">Your Invitation Code</div>
      <div style="font-size:26px;font-weight:700;letter-spacing:3px;color:#60a5fa;font-family:Courier,monospace;">${options.inviteCode}</div>
    </div>

    <p style="margin-bottom:28px;">Use this code when creating your account to gain instant access.</p>

    <div style="text-align:center;margin-bottom:16px;">
      <a href="${registerLink}?code=${encodeURIComponent(options.inviteCode)}" style="display:inline-block;padding:12px 30px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;box-shadow:0 4px 12px rgba(37,99,235,0.3);">
        Register Account &rarr;
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
  const greeting = options.name ? `Welcome, ${options.name}!` : "Welcome to FinTrack!";
  const dashboardLink = options.dashboardUrl || `${config.frontendUrl}/dashboard`;

  const contentHtml = `
    <h2 style="margin-top:0;color:#ffffff;font-size:22px;font-weight:600;">${greeting}</h2>
    <p>Your account has been successfully created. You're all set to upload receipts, extract transaction data with AI, and track spending effortlessly.</p>

    <div style="margin:28px 0;padding:20px;background-color:#0f172a;border-radius:12px;border:1px solid #334155;">
      <div style="color:#38bdf8;font-weight:600;margin-bottom:6px;">🚀 Quick Start:</div>
      <ul style="margin:0;padding-left:20px;color:#94a3b8;font-size:14px;line-height:1.8;">
        <li>Snap or upload a photo of your receipt.</li>
        <li>Review auto-categorized line items and totals.</li>
        <li>Track your analytics and budget in real time.</li>
      </ul>
    </div>

    <div style="text-align:center;margin-top:24px;">
      <a href="${dashboardLink}" style="display:inline-block;padding:12px 30px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;box-shadow:0 4px 12px rgba(37,99,235,0.3);">
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
    <h2 style="margin-top:0;color:#ffffff;font-size:22px;font-weight:600;">Verify Your Email Address</h2>
    <p>${greeting}</p>
    <p>Thank you for signing up for FinTrack! Please confirm your email address by clicking the button below:</p>

    <div style="text-align:center;margin:32px 0;">
      <a href="${verificationLink}" style="display:inline-block;padding:12px 30px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;box-shadow:0 4px 12px rgba(37,99,235,0.3);">
        Verify Email &rarr;
      </a>
    </div>

    <p style="font-size:13px;color:#94a3b8;">If you did not request this verification, you can safely ignore this email.</p>
    <p style="font-size:12px;color:#64748b;word-break:break-all;">Or copy and paste this link into your browser:<br/><a href="${verificationLink}" style="color:#60a5fa;">${verificationLink}</a></p>
  `;

  return sendEmail({
    to: options.to,
    subject: "Verify your FinTrack email address",
    htmlContent: renderBaseTemplate("Verify Your Email", contentHtml),
    tags: ["auth", "verification"],
  });
}
