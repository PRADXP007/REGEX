import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export interface RegexToken {
  text: string;
  explanation: string;
}

export interface RegexGenerationResponse {
  pattern: string;
  flags: string;
  tokens: RegexToken[];
  gotchas: string[];
  retried?: boolean;
  serverValidationPassed?: boolean;
  failingCases?: string[];
}

const SYSTEM_PROMPT = `You are a regex generation engine. Given a list of strings that must match and a list that must not match, output ONLY valid JSON with this exact shape:
{
  "pattern": string,
  "flags": string,
  "tokens": [
    {
      "text": string,
      "explanation": string
    }
  ],
  "gotchas": string[]
}
The regex must be JavaScript-compatible (no lookbehind assumptions beyond ES2018).
Do not include markdown fences or any text outside the JSON object.`;

/**
 * Strips markdown fences defensively from string
 */
function cleanJsonOutput(raw: string): string {
  let cleaned = raw.trim();
  // Remove markdown code fences if present
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "");
    cleaned = cleaned.replace(/```\s*$/i, "");
  }
  return cleaned.trim();
}

/**
 * Validates a regex pattern and flags against positive and negative examples
 */
function validateRegex(
  pattern: string,
  flags: string,
  matchExamples: string[],
  noMatchExamples: string[]
): { isValid: boolean; failures: string[] } {
  try {
    // Note: global flag 'g' causes stateful lastIndex issues on .test() in loops,
    // so we strip 'g' and 'y' for individual string validation or reset lastIndex
    const sanitizedFlags = flags.replace(/[gy]/g, "");
    const regex = new RegExp(pattern, sanitizedFlags);
    const failures: string[] = [];

    for (const example of matchExamples) {
      if (!regex.test(example)) {
        failures.push(
          `Should Match violation: "${example}" was NOT matched by /${pattern}/${flags}`
        );
      }
    }

    for (const example of noMatchExamples) {
      if (regex.test(example)) {
        failures.push(
          `Should NOT Match violation: "${example}" was INCORRECTLY matched by /${pattern}/${flags}`
        );
      }
    }

    return {
      isValid: failures.length === 0,
      failures,
    };
  } catch (err: any) {
    return {
      isValid: false,
      failures: [`Invalid RegExp syntax: ${err?.message || "Syntax error"}`],
    };
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { matchExamples, noMatchExamples } = body as {
      matchExamples?: string[];
      noMatchExamples?: string[];
    };

    if (
      !Array.isArray(matchExamples) ||
      !Array.isArray(noMatchExamples) ||
      matchExamples.length === 0 ||
      noMatchExamples.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "Please provide at least one 'Should Match' and one 'Should NOT Match' example.",
        },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Missing ANTHROPIC_API_KEY environment variable. Please set it in .env.local.",
        },
        { status: 500 }
      );
    }

    const anthropic = new Anthropic({ apiKey });

    const userPrompt = `Strings that MUST match:
${matchExamples.map((s, idx) => `${idx + 1}. "${s}"`).join("\n")}

Strings that must NOT match:
${noMatchExamples.map((s, idx) => `${idx + 1}. "${s}"`).join("\n")}

Generate a JavaScript RegExp that precisely matches all the positive examples and none of the negative examples.`;

    // Messages history for potential retry loop
    const messages: Anthropic.MessageParam[] = [
      {
        role: "user",
        content: userPrompt,
      },
    ];

    // Attempt primary call with claude-sonnet-4-6 (or fallback if model name unavailable)
    const modelCandidates = [
      "claude-sonnet-4-6",
      "claude-3-7-sonnet-20250219",
      "claude-3-5-sonnet-20241022",
      "claude-3-5-sonnet-latest",
    ];

    let firstAttemptText = "";
    let usedModel = modelCandidates[0];

    for (const model of modelCandidates) {
      try {
        const response = await anthropic.messages.create({
          model,
          system: SYSTEM_PROMPT,
          messages,
          max_tokens: 2000,
          temperature: 0.1,
        });

        const textBlock = response.content.find((b) => b.type === "text");
        if (textBlock && textBlock.type === "text") {
          firstAttemptText = textBlock.text;
          usedModel = model;
          break;
        }
      } catch (err: any) {
        // If it's a 404/model not found error, try next candidate
        if (
          err?.status === 404 ||
          err?.message?.includes("model") ||
          err?.error?.type === "not_found_error"
        ) {
          continue;
        }
        throw err;
      }
    }

    if (!firstAttemptText) {
      return NextResponse.json(
        {
          error:
            "Couldn't generate a valid pattern — try simplifying your examples",
        },
        { status: 502 }
      );
    }

    let parsedResult: RegexGenerationResponse;
    try {
      parsedResult = JSON.parse(cleanJsonOutput(firstAttemptText));
    } catch {
      return NextResponse.json(
        {
          error:
            "Couldn't generate a valid pattern — try simplifying your examples",
        },
        { status: 502 }
      );
    }

    // Server-side validation
    let validation = validateRegex(
      parsedResult.pattern,
      parsedResult.flags || "",
      matchExamples,
      noMatchExamples
    );

    let retried = false;

    // Auto-retry once if any example fails
    if (!validation.isValid) {
      retried = true;
      messages.push({
        role: "assistant",
        content: firstAttemptText,
      });

      const retryUserMessage = `Your previous pattern failed on these cases:\n${validation.failures
        .map((f) => `- ${f}`)
        .join("\n")}\n\nFix the pattern and return the same JSON shape.`;

      messages.push({
        role: "user",
        content: retryUserMessage,
      });

      try {
        const retryResponse = await anthropic.messages.create({
          model: usedModel,
          system: SYSTEM_PROMPT,
          messages,
          max_tokens: 2000,
          temperature: 0.1,
        });

        const retryTextBlock = retryResponse.content.find(
          (b) => b.type === "text"
        );
        if (retryTextBlock && retryTextBlock.type === "text") {
          const secondParsed: RegexGenerationResponse = JSON.parse(
            cleanJsonOutput(retryTextBlock.text)
          );
          parsedResult = secondParsed;

          // Re-validate second attempt
          validation = validateRegex(
            parsedResult.pattern,
            parsedResult.flags || "",
            matchExamples,
            noMatchExamples
          );
        }
      } catch (retryError) {
        console.error("Retry attempt error:", retryError);
        // If retry fails parsing/calling, we still return the first parsed result with failure markers
      }
    }

    return NextResponse.json({
      pattern: parsedResult.pattern || "",
      flags: parsedResult.flags || "",
      tokens: Array.isArray(parsedResult.tokens) ? parsedResult.tokens : [],
      gotchas: Array.isArray(parsedResult.gotchas) ? parsedResult.gotchas : [],
      retried,
      serverValidationPassed: validation.isValid,
      failingCases: validation.failures,
    });
  } catch (error: any) {
    console.error("Generate regex error:", error);
    return NextResponse.json(
      {
        error:
          error?.message ||
          "Couldn't generate a valid pattern — try simplifying your examples",
      },
      { status: 500 }
    );
  }
}
