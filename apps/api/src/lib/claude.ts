import Anthropic from "@anthropic-ai/sdk";

if (!process.env["ANTHROPIC_API_KEY"]) {
  console.warn("[claude] ANTHROPIC_API_KEY not set — AI endpoints will return 503");
}

export const anthropic = new Anthropic({
  apiKey: process.env["ANTHROPIC_API_KEY"] ?? "missing",
});
