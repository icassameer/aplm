import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.FROM_EMAIL || "support@icaweb.in";
const FROM_NAME = "ICA CRM";

// ── Helper ────────────────────────────────────────────────────────────────────
async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set — skipping email");
    return false;
  }
  try {
    const { error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM}>`,
      to,
      subject,
      html,
    });
    if (error) { console.error("Resend error:", error); return false; }
    return true;
  } catch (err: any) {
    console.error("Email send failed:", err.message);
    return false;
  }
}

// ── Base Template ─────────────────────────────────────────────────────────────
function baseTemplate(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ICA CRM</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:30px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1a5276,#2e86c1);padding:30px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:bold;letter-spacing:1px;">ICA CRM</h1>
            <p style="margin:6px 0 0;color:#aed6f1;font-size:13px;">Innovation, Consulting & Automation</p>
          </td>
        </tr>
        <!-- Content -->
        <tr>
          <td style="padding:35px 40px;">
            ${content}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8f9fa;padding:20px 40px;border-top:1px solid #e9ecef;text-align:center;">
            <p style="margin:0;color:#6c757d;font-size:12px;">
              ICA — Innovation, Consulting & Automation<br>
              <a href="https://crm.icaweb.in" style="color:#2e86c1;">crm.icaweb.in</a> &nbsp;|&nbsp;
              <a href="mailto:support@icaweb.in" style="color:#2e86c1;">support@icaweb.in</a> &nbsp;|&nbsp;
              +91 99879 69850
            </p>
            <p style="margin:8px 0 0;color:#adb5bd;font-size:11px;">
              By using ICA CRM you agree to our 
              <a href="https://crm.icaweb.in/privacy-policy" style="color:#2e86c1;">Terms & Privacy Policy</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Plan colors ───────────────────────────────────────────────────────────────
const planColors: Record<string, string> = {
  BASIC: "#2e86c1",
  PRO: "#117a65",
  ENTERPRISE: "#6c3483",
};

const planPrices: Record<string, string> = {
  BASIC: "₹2,500/month",
  PRO: "₹5,500/month",
  ENTERPRISE: "₹15,000/month",
};

const planFeatures: Record<string, string[]> = {
  BASIC: ["500 leads", "5 users", "WhatsApp integration", "Basic reports", "Email support"],
  PRO: ["1,000 leads", "10 users", "AI Meeting Analysis — 10/month", "RC Vehicle Lookup — 100/month", "Advanced reports", "Email + Chat support"],
  ENTERPRISE: ["Unlimited leads & users", "Unlimited AI Meeting Analysis", "Unlimited RC Lookup", "Full analytics dashboard", "Dedicated Account Manager", "Priority support (Email + Chat + Phone)"],
};

// ── 1. Welcome Email ─────────────────────────────────────────────────────────
export async function sendWelcomeEmail(
  to: string,
  fullName: string,
  username: string,
  plan: string,
  agencyName: string
): Promise<boolean> {
  const color = planColors[plan] || "#1a5276";
  const price = planPrices[plan] || "";
  const features = planFeatures[plan] || [];

  const content = `
    <h2 style="color:#1a252f;margin:0 0 8px;">Welcome to ICA CRM, ${fullName}! 🎉</h2>
    <p style="color:#566573;margin:0 0 24px;">Your <strong>${plan}</strong> plan is now active for <strong>${agencyName}</strong>.</p>

    <div style="background:${color};border-radius:6px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0;color:#ffffff;font-size:18px;font-weight:bold;">${plan} PLAN — ${price}</p>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;border-radius:6px;padding:20px;margin-bottom:24px;">
      <tr><td style="padding:6px 0;"><strong style="color:#1a5276;">🌐 CRM Access:</strong> <a href="https://crm.icaweb.in" style="color:#2e86c1;">https://crm.icaweb.in</a></td></tr>
      <tr><td style="padding:6px 0;"><strong style="color:#1a5276;">👤 Username:</strong> ${username}</td></tr>
      <tr><td style="padding:6px 0;"><strong style="color:#e74c3c;">🔑 Please change your password after first login</strong></td></tr>
    </table>

    <h3 style="color:#1a5276;margin:0 0 12px;">What's included in your ${plan} plan:</h3>
    <ul style="margin:0 0 24px;padding-left:20px;color:#34495e;">
      ${features.map(f => `<li style="margin-bottom:6px;">${f}</li>`).join("")}
    </ul>

    <div style="background:#eaf4fb;border-left:4px solid #2e86c1;padding:14px 16px;border-radius:0 6px 6px 0;margin-bottom:24px;">
      <p style="margin:0;color:#1a5276;font-size:13px;">
        <strong>📋 Terms & Conditions:</strong> By using ICA CRM, you agree to our 
        <a href="https://crm.icaweb.in/privacy-policy" style="color:#2e86c1;">Privacy Policy & Terms of Service</a>. 
        Replying to this email confirms your acceptance.
      </p>
    </div>

    <p style="color:#566573;margin:0;">Need help? Reply to this email or call <strong>+91 99879 69850</strong></p>
    <p style="color:#566573;margin:8px 0 0;">Best regards,<br><strong>Sameer | ICA Team</strong></p>
  `;

  return sendEmail(to, `Welcome to ICA CRM — Your ${plan} Plan is Active!`, baseTemplate(content));
}

// ── 2. Prospect Inquiry Email ─────────────────────────────────────────────────
export async function sendProspectEmail(to: string, name: string): Promise<boolean> {
  const content = `
    <h2 style="color:#1a252f;margin:0 0 8px;">Hello ${name}! 👋</h2>
    <p style="color:#566573;margin:0 0 24px;">Thank you for your interest in <strong>ICA CRM</strong> — your complete insurance agency management platform.</p>

    ${["BASIC", "PRO", "ENTERPRISE"].map(plan => `
    <div style="border:1px solid #e9ecef;border-radius:8px;overflow:hidden;margin-bottom:16px;">
      <div style="background:${planColors[plan]};padding:12px 20px;">
        <h3 style="margin:0;color:#ffffff;font-size:16px;">${plan} PLAN — ${planPrices[plan]}</h3>
      </div>
      <div style="padding:14px 20px;">
        <ul style="margin:0;padding-left:18px;color:#34495e;">
          ${planFeatures[plan].map(f => `<li style="margin-bottom:4px;font-size:13px;">${f}</li>`).join("")}
        </ul>
      </div>
    </div>`).join("")}

    <div style="background:#eaf4fb;border-radius:6px;padding:16px 20px;margin:24px 0;text-align:center;">
      <p style="margin:0 0 8px;color:#1a5276;font-weight:bold;">Ready to get started?</p>
      <p style="margin:0;color:#566573;font-size:13px;">Simply reply to this email with your preferred plan and we'll activate your account within 24 hours!</p>
    </div>

    <p style="color:#566573;margin:0;">Questions? Call us at <strong>+91 99879 69850</strong> or visit <a href="https://crm.icaweb.in" style="color:#2e86c1;">crm.icaweb.in</a></p>
    <p style="color:#566573;margin:8px 0 0;">Best regards,<br><strong>Sameer | ICA Team</strong></p>
  `;

  return sendEmail(to, "Introducing ICA CRM — Powerful Lead Management for Your Insurance Agency", baseTemplate(content));
}

// ── 3. Password Reset Email ───────────────────────────────────────────────────
export async function sendPasswordResetEmail(to: string, fullName: string, newPassword: string): Promise<boolean> {
  const content = `
    <h2 style="color:#1a252f;margin:0 0 8px;">Password Reset</h2>
    <p style="color:#566573;margin:0 0 24px;">Hello ${fullName}, your ICA CRM password has been reset.</p>

    <div style="background:#f8f9fa;border-radius:6px;padding:20px;margin-bottom:24px;text-align:center;">
      <p style="margin:0 0 8px;color:#566573;font-size:13px;">Your new temporary password:</p>
      <p style="margin:0;font-size:24px;font-weight:bold;color:#1a5276;letter-spacing:2px;">${newPassword}</p>
    </div>

    <div style="background:#fef9e7;border-left:4px solid #f39c12;padding:14px 16px;border-radius:0 6px 6px 0;margin-bottom:24px;">
      <p style="margin:0;color:#7d6608;font-size:13px;">⚠️ Please login and change your password immediately for security.</p>
    </div>

    <p style="color:#566573;margin:0;"><a href="https://crm.icaweb.in" style="color:#2e86c1;">Login to ICA CRM →</a></p>
    <p style="color:#566573;margin:8px 0 0;">Best regards,<br><strong>ICA Team</strong></p>
  `;

  return sendEmail(to, "ICA CRM — Password Reset", baseTemplate(content));
}

// ── 4. Plan Upgrade Email ─────────────────────────────────────────────────────
export async function sendPlanUpgradeEmail(
  to: string,
  fullName: string,
  oldPlan: string,
  newPlan: string
): Promise<boolean> {
  const color = planColors[newPlan] || "#1a5276";
  const features = planFeatures[newPlan] || [];

  const content = `
    <h2 style="color:#1a252f;margin:0 0 8px;">Plan Upgraded Successfully! 🚀</h2>
    <p style="color:#566573;margin:0 0 24px;">Hello ${fullName}, your ICA CRM plan has been upgraded.</p>

    <div style="display:flex;gap:12px;margin-bottom:24px;">
      <div style="background:#e9ecef;border-radius:6px;padding:12px 20px;flex:1;text-align:center;">
        <p style="margin:0;color:#6c757d;font-size:12px;">Previous Plan</p>
        <p style="margin:4px 0 0;font-weight:bold;color:#495057;">${oldPlan}</p>
      </div>
      <div style="background:${color};border-radius:6px;padding:12px 20px;flex:1;text-align:center;">
        <p style="margin:0;color:rgba(255,255,255,0.8);font-size:12px;">New Plan</p>
        <p style="margin:4px 0 0;font-weight:bold;color:#ffffff;">${newPlan} ✓</p>
      </div>
    </div>

    <h3 style="color:#1a5276;margin:0 0 12px;">Your new ${newPlan} features:</h3>
    <ul style="margin:0 0 24px;padding-left:20px;color:#34495e;">
      ${features.map(f => `<li style="margin-bottom:6px;">${f}</li>`).join("")}
    </ul>

    <p style="color:#566573;margin:0;"><a href="https://crm.icaweb.in" style="color:#2e86c1;">Login to explore your new features →</a></p>
    <p style="color:#566573;margin:8px 0 0;">Best regards,<br><strong>ICA Team</strong></p>
  `;

  return sendEmail(to, `ICA CRM — Plan Upgraded to ${newPlan}!`, baseTemplate(content));
}
