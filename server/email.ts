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
              +91 99679 69850
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

    <p style="color:#566573;margin:0;">Need help? Reply to this email or call <strong>+91 99679 69850</strong></p>
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

    <p style="color:#566573;margin:0;">Questions? Call us at <strong>+91 99679 69850</strong> or visit <a href="https://crm.icaweb.in" style="color:#2e86c1;">crm.icaweb.in</a></p>
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

export async function sendPaymentLinkEmail(
  to: string, name: string, plan: string, amount: number, paymentUrl: string
): Promise<void> {
  await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `ICA CRM — Complete Your ${plan} Plan Payment`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;padding:20px">
        <div style="background:#1e3a5f;padding:24px;border-radius:8px 8px 0 0;text-align:center">
          <h1 style="color:white;margin:0;font-size:24px">ICA CRM</h1>
          <p style="color:#94a3b8;margin:4px 0 0">Innovation, Consulting & Automation</p>
        </div>
        <div style="background:white;padding:32px;border-radius:0 0 8px 8px">
          <h2 style="color:#1e3a5f">Hello ${name},</h2>
          <p style="color:#475569">Your <strong>${plan} Plan</strong> payment of <strong>Rs.${amount.toLocaleString()}/month</strong> is ready.</p>
          <div style="background:#f1f5f9;border-radius:8px;padding:16px;margin:20px 0">
            <p style="margin:0;color:#475569"><strong>Plan:</strong> ${plan}</p>
            <p style="margin:8px 0 0;color:#475569"><strong>Amount:</strong> Rs.${amount.toLocaleString()}/month</p>
          </div>
          <a href="${paymentUrl}" style="display:inline-block;background:#1e3a5f;color:white;padding:12px 32px;border-radius:6px;text-decoration:none;font-weight:bold;margin:16px 0">
            Complete Payment Now
          </a>
          <p style="color:#94a3b8;font-size:12px;margin-top:24px">Link expires in 24 hours. Need help? Contact support@icaweb.in</p>
        </div>
      </div>
    `,
  });
}

export async function sendPaymentSuccessEmail(
  to: string, name: string, plan: string, amount: number, paymentId: string
): Promise<void> {
  await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `ICA CRM — Payment Successful! ${plan} Plan Activated`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;padding:20px">
        <div style="background:#1e3a5f;padding:24px;border-radius:8px 8px 0 0;text-align:center">
          <h1 style="color:white;margin:0;font-size:24px">ICA CRM</h1>
          <p style="color:#94a3b8;margin:4px 0 0">Innovation, Consulting & Automation</p>
        </div>
        <div style="background:white;padding:32px;border-radius:0 0 8px 8px;text-align:center">
          <div style="background:#dcfce7;border-radius:50%;width:64px;height:64px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px">
            <span style="font-size:32px">&#10003;</span>
          </div>
          <h2 style="color:#16a34a">Payment Successful!</h2>
          <p style="color:#475569">Your <strong>${plan} Plan</strong> is now active.</p>
          <div style="background:#f1f5f9;border-radius:8px;padding:16px;margin:20px 0;text-align:left">
            <p style="margin:0;color:#475569"><strong>Plan:</strong> ${plan}</p>
            <p style="margin:8px 0 0;color:#475569"><strong>Amount Paid:</strong> Rs.${amount.toLocaleString()}</p>
            <p style="margin:8px 0 0;color:#475569"><strong>Payment ID:</strong> ${paymentId}</p>
          </div>
          <a href="https://crm.icaweb.in" style="display:inline-block;background:#1e3a5f;color:white;padding:12px 32px;border-radius:6px;text-decoration:none;font-weight:bold;">
            Go to Dashboard
          </a>
          <p style="color:#94a3b8;font-size:12px;margin-top:24px">Save this email as your receipt. Need help? support@icaweb.in</p>
        </div>
      </div>
    `,
  });
}

export async function sendSubscriptionReminderEmail(
  agencyName: string,
  to: string,
  fullName: string,
  plan: string,
  daysLeft: number,
  expiresAt: Date
): Promise<boolean> {
  try {
    const expiryStr = expiresAt.toLocaleDateString("en-IN", {
      day: "numeric", month: "long", year: "numeric",
    });
    const urgencyColor = daysLeft <= 1 ? "#dc2626" : "#d97706";
    const subject =
      daysLeft <= 1
        ? `⚠️ Your ICA CRM subscription expires TOMORROW — Renew now`
        : `⚠️ Your ICA CRM subscription expires in 7 days — Renew now`;

    await resend.emails.send({
      from: "ICA CRM <support@icaweb.in>",
      to,
      subject,
      html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0;background:#f8fafc;">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
<tr><td style="background:#1e3a5f;padding:28px 40px;">
  <span style="color:#fff;font-size:22px;font-weight:700;">ICA CRM</span>&nbsp;
  <span style="background:${urgencyColor};color:#fff;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;margin-left:8px;">
    ${daysLeft <= 1 ? "EXPIRES TOMORROW" : "EXPIRING IN 7 DAYS"}
  </span>
</td></tr>
<tr><td style="padding:36px 40px;">
  <p style="color:#374151;font-size:15px;margin:0 0 12px;">Dear ${fullName},</p>
  <p style="color:#374151;font-size:15px;line-height:1.6;">
    Your <strong>${plan} plan</strong> for <strong>${agencyName}</strong> expires on
    <strong style="color:${urgencyColor};">${expiryStr}</strong>.
  </p>
  <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:18px;margin:24px 0;">
    <p style="margin:0;color:#92400e;font-size:14px;font-weight:600;">If you don't renew, your team will lose CRM access. Your data stays safe.</p>
  </div>
  <table cellpadding="0" cellspacing="0"><tr>
    <td style="background:#1e3a5f;border-radius:8px;padding:12px 24px;">
      <a href="https://wa.me/919967969850?text=Hi%2C+I+want+to+renew+ICA+CRM+for+${encodeURIComponent(agencyName)}"
         style="color:#fff;text-decoration:none;font-size:14px;font-weight:600;">📲 WhatsApp to Renew</a>
    </td>
    <td width="12"></td>
    <td style="border:2px solid #1e3a5f;border-radius:8px;padding:10px 20px;">
      <a href="mailto:support@icaweb.in"
         style="color:#1e3a5f;text-decoration:none;font-size:14px;font-weight:600;">✉️ Email Support</a>
    </td>
  </tr></table>
  <p style="color:#9ca3af;font-size:12px;margin-top:28px;border-top:1px solid #e5e7eb;padding-top:16px;">
    Agency: ${agencyName} | Plan: ${plan} | support@icaweb.in | +91 99679 69850
  </p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`,
    });
    return true;
  } catch (err) {
    console.error("sendSubscriptionReminderEmail error:", err);
    return false;
  }
}

export async function sendSubscriptionExpiredEmail(
  agencyName: string,
  to: string,
  fullName: string,
  plan: string
): Promise<boolean> {
  try {
    await resend.emails.send({
      from: "ICA CRM <support@icaweb.in>",
      to,
      subject: `🔴 Your ICA CRM subscription has expired — ${agencyName}`,
      html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0;background:#f8fafc;">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
<tr><td style="background:#7f1d1d;padding:28px 40px;">
  <span style="color:#fff;font-size:22px;font-weight:700;">ICA CRM</span>&nbsp;
  <span style="color:#fca5a5;font-size:13px;margin-left:8px;">Subscription Expired</span>
</td></tr>
<tr><td style="padding:36px 40px;">
  <p style="color:#374151;font-size:15px;margin:0 0 12px;">Dear ${fullName},</p>
  <p style="color:#374151;font-size:15px;line-height:1.6;">
    Your <strong>${plan} plan</strong> for <strong>${agencyName}</strong> has
    <strong style="color:#dc2626;">expired</strong>. Your account has been deactivated.
  </p>
  <div style="background:#fee2e2;border:1px solid #fca5a5;border-radius:8px;padding:18px;margin:24px 0;">
    <p style="margin:0;color:#991b1b;font-size:14px;">
      <strong>Your data is safe.</strong> All leads and history are preserved.
      Renew within 30 days to restore access immediately.
    </p>
  </div>
  <table cellpadding="0" cellspacing="0"><tr>
    <td style="background:#dc2626;border-radius:8px;padding:12px 24px;">
      <a href="https://wa.me/919967969850?text=Hi%2C+my+ICA+CRM+expired.+Agency%3A+${encodeURIComponent(agencyName)}"
         style="color:#fff;text-decoration:none;font-size:14px;font-weight:600;">📲 Renew Now on WhatsApp</a>
    </td>
  </tr></table>
  <p style="color:#9ca3af;font-size:12px;margin-top:28px;border-top:1px solid #e5e7eb;padding-top:16px;">
    Agency: ${agencyName} | Expired Plan: ${plan} | support@icaweb.in | +91 99679 69850
  </p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`,
    });
    return true;
  } catch (err) {
    console.error("sendSubscriptionExpiredEmail error:", err);
    return false;
  }
}
