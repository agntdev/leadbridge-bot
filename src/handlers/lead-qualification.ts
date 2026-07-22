import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import {
  inlineButton,
  inlineKeyboard,
  registerMainMenuItem,
} from "../toolkit/index.js";
import { sendLeadNotification } from "../services/email.js";
import {
  saveLead,
  generateLeadId,
  type StoredLead,
} from "../storage/leads.js";

// Budget range presets
const BUDGET_RANGES = [
  { label: "Under $5k", data: "budget:under_5k" },
  { label: "$5k–$20k", data: "budget:5k_20k" },
  { label: "$20k–$50k", data: "budget:20k_50k" },
  { label: "$50k–$100k", data: "budget:50k_100k" },
  { label: "Over $100k", data: "budget:over_100k" },
];

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Phone validation regex (basic international format)
const PHONE_REGEX = /^\+?[\d\s\-()]{7,20}$/;

// Flow timeout (5 minutes)
const FLOW_TIMEOUT_MS = 5 * 60 * 1000;

// Register main menu item
registerMainMenuItem({
  label: "📝 Qualify lead",
  data: "qualify:start",
  order: 10,
});

function flowKeyboard(step: string) {
  return inlineKeyboard([
    [inlineButton("Cancel", "flow:cancel")],
    ...(step !== "awaiting_consent"
      ? [[inlineButton("Back", "flow:back")]]
      : []),
  ]);
}

function budgetKeyboard() {
  return inlineKeyboard(
    BUDGET_RANGES.map((r) => [inlineButton(r.label, r.data)]),
  );
}

function summaryKeyboard() {
  return inlineKeyboard([
    [inlineButton("Confirm", "qualify:confirm")],
    [inlineButton("Edit company", "qualify:edit:company")],
    [inlineButton("Edit contact", "qualify:edit:contact")],
    [inlineButton("Edit email", "qualify:edit:email")],
    [inlineButton("Edit phone", "qualify:edit:phone")],
    [inlineButton("Edit budget", "qualify:edit:budget")],
    [inlineButton("Edit notes", "qualify:edit:notes")],
    [inlineButton("Cancel", "flow:cancel")],
  ]);
}

function formatSummary(ctx: Ctx): string {
  const s = ctx.session;
  const lines = [
    "Lead Summary",
    "============",
    "",
    `Company: ${s.company || "—"}`,
    `Contact: ${s.contact || "—"}`,
    `Email: ${s.email || "—"}`,
    `Phone: ${s.phone || "—"}`,
    `Budget: ${s.budget || "—"}`,
    `Notes: ${s.notes || "—"}`,
    "",
    "Review the details above. Tap Confirm to submit, or edit any field.",
  ];
  return lines.join("\n");
}

const composer = new Composer<Ctx>();

// Start qualification flow from main menu
composer.callbackQuery("qualify:start", async (ctx) => {
  await ctx.answerCallbackQuery();

  ctx.session.step = "awaiting_consent";
  ctx.session.history = [];
  ctx.session.expiresAt = Date.now() + FLOW_TIMEOUT_MS;

  await ctx.editMessageText(
    "This bot collects B2B lead information for our sales team.\n\n" +
      "We'll ask for your company name, contact details, and budget range. " +
      "This takes about 2 minutes.\n\n" +
      "Ready to start?",
    { reply_markup: inlineKeyboard([
      [inlineButton("Yes, continue", "qualify:consent:yes")],
      [inlineButton("Cancel", "flow:cancel")],
    ]) },
  );
});

// Handle consent
composer.callbackQuery("qualify:consent:yes", async (ctx) => {
  await ctx.answerCallbackQuery();

  ctx.session.step = "awaiting_company";
  ctx.session.history.push("awaiting_consent");
  ctx.session.expiresAt = Date.now() + FLOW_TIMEOUT_MS;

  await ctx.editMessageText("What's your company name?", {
    reply_markup: flowKeyboard("awaiting_company"),
  });
});

// Handle company name input
composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "awaiting_company") return next();

  const text = ctx.message.text.trim();
  if (text.length < 1) {
    await ctx.reply("Please enter a company name.", {
      reply_markup: flowKeyboard("awaiting_company"),
    });
    return;
  }

  ctx.session.company = text;
  ctx.session.step = "awaiting_contact";
  ctx.session.history.push("awaiting_company");
  ctx.session.expiresAt = Date.now() + FLOW_TIMEOUT_MS;

  await ctx.reply("Who's the main contact person?", {
    reply_markup: flowKeyboard("awaiting_contact"),
  });
});

// Handle contact person input
composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "awaiting_contact") return next();

  const text = ctx.message.text.trim();
  if (text.length < 1) {
    await ctx.reply("Please enter a contact name.", {
      reply_markup: flowKeyboard("awaiting_contact"),
    });
    return;
  }

  ctx.session.contact = text;
  ctx.session.step = "awaiting_email";
  ctx.session.history.push("awaiting_contact");
  ctx.session.expiresAt = Date.now() + FLOW_TIMEOUT_MS;

  await ctx.reply("What's their email address?", {
    reply_markup: flowKeyboard("awaiting_email"),
  });
});

// Handle email input
composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "awaiting_email") return next();

  const text = ctx.message.text.trim();
  if (!EMAIL_REGEX.test(text)) {
    await ctx.reply(
      "That doesn't look like a valid email. Please check and try again.",
      { reply_markup: flowKeyboard("awaiting_email") },
    );
    return;
  }

  ctx.session.email = text;
  ctx.session.step = "awaiting_phone";
  ctx.session.history.push("awaiting_email");
  ctx.session.expiresAt = Date.now() + FLOW_TIMEOUT_MS;

  await ctx.reply("What's their phone number?", {
    reply_markup: flowKeyboard("awaiting_phone"),
  });
});

// Handle phone input
composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "awaiting_phone") return next();

  const text = ctx.message.text.trim();
  if (!PHONE_REGEX.test(text)) {
    await ctx.reply(
      "That doesn't look like a valid phone number. Include country code if international.",
      { reply_markup: flowKeyboard("awaiting_phone") },
    );
    return;
  }

  ctx.session.phone = text;
  ctx.session.step = "awaiting_budget";
  ctx.session.history.push("awaiting_phone");
  ctx.session.expiresAt = Date.now() + FLOW_TIMEOUT_MS;

  await ctx.reply("What's the estimated budget range?", {
    reply_markup: budgetKeyboard(),
  });
});

// Handle budget selection
composer.callbackQuery(/^budget:/, async (ctx) => {
  await ctx.answerCallbackQuery();

  const data = ctx.callbackQuery.data;
  const budgetRange = BUDGET_RANGES.find((r) => r.data === data);
  if (!budgetRange) {
    await ctx.reply("Please select a budget range from the options.");
    return;
  }

  ctx.session.budget = budgetRange.label;
  ctx.session.step = "awaiting_notes";
  ctx.session.history.push("awaiting_budget");
  ctx.session.expiresAt = Date.now() + FLOW_TIMEOUT_MS;

  await ctx.editMessageText("Any additional notes? (Optional — tap Skip to continue)", {
    reply_markup: inlineKeyboard([
      [inlineButton("Skip", "qualify:notes:skip")],
      [inlineButton("Cancel", "flow:cancel")],
      [inlineButton("Back", "flow:back")],
    ]),
  });
});

// Handle notes input or skip
composer.callbackQuery("qualify:notes:skip", async (ctx) => {
  await ctx.answerCallbackQuery();

  ctx.session.notes = undefined;
  ctx.session.step = "confirming";
  ctx.session.history.push("awaiting_notes");
  ctx.session.expiresAt = Date.now() + FLOW_TIMEOUT_MS;

  await ctx.editMessageText(formatSummary(ctx), {
    reply_markup: summaryKeyboard(),
  });
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "awaiting_notes") return next();

  ctx.session.notes = ctx.message.text.trim() || undefined;
  ctx.session.step = "confirming";
  ctx.session.history.push("awaiting_notes");
  ctx.session.expiresAt = Date.now() + FLOW_TIMEOUT_MS;

  await ctx.reply(formatSummary(ctx), {
    reply_markup: summaryKeyboard(),
  });
});

// Handle confirmation
composer.callbackQuery("qualify:confirm", async (ctx) => {
  await ctx.answerCallbackQuery();

  const s = ctx.session;
  if (!s.company || !s.contact || !s.email || !s.phone || !s.budget) {
    await ctx.reply("Some required fields are missing. Please review and try again.", {
      reply_markup: summaryKeyboard(),
    });
    return;
  }

  const lead: StoredLead = {
    id: generateLeadId(),
    company: s.company,
    contact: s.contact,
    email: s.email,
    phone: s.phone,
    budget: s.budget,
    notes: s.notes,
    source: "telegram_bot",
    submittedAt: new Date().toISOString(),
    userId: ctx.from?.id ?? 0,
  };

  // Save lead to persistent storage
  await saveLead(lead);

  // Send email notification
  const emailSent = await sendLeadNotification({
    company: lead.company,
    contact: lead.contact,
    email: lead.email,
    phone: lead.phone,
    budget: lead.budget,
    notes: lead.notes,
    source: lead.source,
    submittedAt: lead.submittedAt,
  });

  // Reset session
  ctx.session.step = "done";
  ctx.session.history = [];

  const confirmationMessage = emailSent
    ? "Lead submitted successfully!\n\n" +
      "Our sales team will review your information and reach out within 48 hours.\n\n" +
      "Thank you for your interest."
    : "Lead submitted successfully!\n\n" +
      "Our sales team will review your information and reach out within 48 hours.\n\n" +
      "Thank you for your interest.";

  await ctx.editMessageText(confirmationMessage, {
    reply_markup: inlineKeyboard([
      [inlineButton("Back to menu", "menu:main")],
    ]),
  });
});

// Handle edit requests from summary
composer.callbackQuery(/^qualify:edit:(\w+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();

  const field = ctx.match[1];
  const stepMap: Record<string, string> = {
    company: "awaiting_company",
    contact: "awaiting_contact",
    email: "awaiting_email",
    phone: "awaiting_phone",
    budget: "awaiting_budget",
    notes: "awaiting_notes",
  };

  const targetStep = stepMap[field];
  if (!targetStep) return;

  ctx.session.step = targetStep as Ctx["session"]["step"];
  ctx.session.history.push("confirming");
  ctx.session.expiresAt = Date.now() + FLOW_TIMEOUT_MS;

  const prompts: Record<string, string> = {
    company: "What's your company name?",
    contact: "Who's the main contact person?",
    email: "What's their email address?",
    phone: "What's their phone number?",
    budget: "What's the estimated budget range?",
    notes: "Any additional notes? (Optional — tap Skip to continue)",
  };

  if (field === "budget") {
    await ctx.editMessageText(prompts[field], {
      reply_markup: budgetKeyboard(),
    });
  } else if (field === "notes") {
    await ctx.editMessageText(prompts[field], {
      reply_markup: inlineKeyboard([
        [inlineButton("Skip", "qualify:notes:skip")],
        [inlineButton("Cancel", "flow:cancel")],
        [inlineButton("Back", "flow:back")],
      ]),
    });
  } else {
    await ctx.editMessageText(prompts[field], {
      reply_markup: flowKeyboard(targetStep),
    });
  }
});

export default composer;
