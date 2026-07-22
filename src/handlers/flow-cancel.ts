import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";

const composer = new Composer<Ctx>();

composer.callbackQuery("flow:cancel", async (ctx) => {
  await ctx.answerCallbackQuery();

  const currentStep = ctx.session.step;
  if (!currentStep || currentStep === "idle" || currentStep === "done") {
    await ctx.reply("Nothing to cancel. Tap /start to begin.", {
      reply_markup: inlineKeyboard([
        [inlineButton("Start", "qualify:start")],
      ]),
    });
    return;
  }

  // Reset qualification session
  ctx.session.step = "idle";
  ctx.session.history = [];
  ctx.session.company = undefined;
  ctx.session.contact = undefined;
  ctx.session.email = undefined;
  ctx.session.phone = undefined;
  ctx.session.budget = undefined;
  ctx.session.notes = undefined;
  ctx.session.expiresAt = undefined;

  await ctx.editMessageText(
    "Qualification cancelled.\n\nNo data was saved. Tap /start to begin again.",
    { reply_markup: inlineKeyboard([
      [inlineButton("Back to menu", "menu:main")],
    ]) },
  );
});

export default composer;
