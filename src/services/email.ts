import nodemailer from "nodemailer";

export interface LeadData {
  company: string;
  contact: string;
  email: string;
  phone: string;
  budget: string;
  notes?: string;
  source?: string;
  submittedAt: string;
}

const SALES_EMAIL = "sales@company.com";

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

function formatLeadEmail(lead: LeadData): string {
  const lines = [
    "New B2B Lead Submission",
    "=======================",
    "",
    `Company: ${lead.company}`,
    `Contact: ${lead.contact}`,
    `Email: ${lead.email}`,
    `Phone: ${lead.phone}`,
    `Budget: ${lead.budget}`,
  ];

  if (lead.notes) {
    lines.push(`Notes: ${lead.notes}`);
  }

  if (lead.source) {
    lines.push(`Source: ${lead.source}`);
  }

  lines.push(
    "",
    `Submitted: ${lead.submittedAt}`,
    "",
    "This lead was submitted via the Telegram B2B Lead Qualifier bot.",
  );

  return lines.join("\n");
}

export async function sendLeadNotification(lead: LeadData): Promise<boolean> {
  const transporter = createTransport();

  if (!transporter) {
    console.warn(
      "[email] SMTP not configured — logging lead to console instead",
    );
    console.log("[email] Lead data:", JSON.stringify(lead, null, 2));
    return true;
  }

  try {
    await transporter.sendMail({
      from: `"B2B Lead Bot" <${process.env.SMTP_USER}>`,
      to: SALES_EMAIL,
      subject: `New B2B Lead: ${lead.company} — ${lead.contact}`,
      text: formatLeadEmail(lead),
    });
    return true;
  } catch (error) {
    console.error("[email] Failed to send lead notification:", error);
    return false;
  }
}
