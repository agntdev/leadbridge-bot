import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";

const composer = new Composer<Ctx>();

// Budget range presets (must match lead-qualification.ts)
const BUDGET_RANGES = [
  { label: "Under $5k", data: "budget:under_5k" },
  { label: "$5k–$20k", data: "budget:5k_20k" },
  { label: "$20k–$50k", data: "budget:20k_50k" },
  { label: "$50k–$100k", data: "budget:50k_100k" },
  { label: "Over $100k", data: "budget:over_100k" },
];

function budgetKeyboard() {
  return inlineKeyboard(
    BUDGET_RANGES.map((r) => [inlineButton(r.label, r.data)]),
  );
}

function flowKeyboard(step: string) {
  return inlineKeyboard([
    [inlineButton("Cancel", "flow:cancel")],
    ...(step !== "awaiting_consent"
      ? [[inlineButton("Back", "flow:back")]]
      : []),
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

composer.callbackQuery("flow:back", async (ctx) => {
  await ctx.answerCallbackQuery();

  const currentStep = ctx.session.step;
  if (!currentStep || currentStep === "idle" || currentStep === "done") {
    await ctx.reply("Nothing to go back to. Tap /start to begin.", {
      reply_markup: inlineKeyboard([
        [inlineButton("Start", "qualify:start")],
      ]),
    });
    return;
  }

  // Pop the previous step from history
  const prevStep = ctx.session.history.pop();
  if (!prevStep) {
    await ctx.reply("Already at the beginning. Tap Cancel to exit.", {
      reply_markup: inlineKeyboard([
        [inlineButton("Cancel", "flow:cancel")],
      ]),
    });
    return;
  }

  ctx.session.step = prevStep as Ctx["session"]["step"];

  // Re-render the previous step's UI
  switch (prevStep) {
    case "awaiting_consent":
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
      break;

    case "awaiting_company":
      await ctx.editMessageText("What's your company name?", {
        reply_markup: flowKeyboard("awaiting_company"),
      });
      break;

    case "awaiting_contact":
      await ctx.editMessageText("Who's the main contact person?", {
        reply_markup: flowKeyboard("awaiting_contact"),
      });
      break;

    case "awaiting_email":
      await ctx.editMessageText("What's their email address?", {
        reply_markup: flowKeyboard("awaiting_email"),
      });
      break;

    case "awaiting_phone":
      await ctx.editMessageText("What's their phone number?", {
        reply_markup: flowKeyboard("awaiting_phone"),
      });
      break;

    case "awaiting_budget":
      await ctx.editMessageText("What's the estimated budget range?", {
        reply_markup: budgetKeyboard(),
      });
      break;

    case "awaiting_notes":
      await ctx.editMessageText(
        "Any additional notes? (Optional — tap Skip to continue)",
        {
          reply_markup: inlineKeyboard([
            [inlineButton("Skip", "qualify:notes:skip")],
            [inlineButton("Cancel", "flow:cancel")],
            [inlineButton("Back", "flow:back")],
          ]),
        },
      );
      break;

    case "confirming":
      await ctx.editMessageText(formatSummary(ctx), {
        reply_markup: summaryKeyboard(),
      });
      break;

    default:
      await ctx.reply("Something went wrong. Tap /start to begin again.", {
        reply_markup: inlineKeyboard([
          [inlineButton("Start", "qualify:start")],
        ]),
      });
  }
});

export default composer;
