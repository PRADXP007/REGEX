import { NextRequest, NextResponse } from "next/server";

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

/**
 * Strips markdown fences defensively from string
 */
function cleanJsonOutput(raw: string): string {
  let cleaned = raw.trim();
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

/**
 * Calls Gemini REST API generateContent endpoint with JSON response mode
 */
async function callGemini(promptText: string, apiKey: string): Promise<string> {
  const modelEndpoints = [
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
  ];

  let lastError: Error | null = null;

  for (const endpoint of modelEndpoints) {
    try {
      const res = await fetch(`${endpoint}?key=${apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: promptText }],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
          },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 404 || data?.error?.message?.includes("not found")) {
          // Model not found on this endpoint, try next candidate
          continue;
        }
        throw new Error(data?.error?.message || `Gemini API error: ${res.statusText}`);
      }

      const generatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (generatedText) {
        return generatedText;
      }
    } catch (err: any) {
      lastError = err;
    }
  }

  throw lastError || new Error("Failed to generate content from Gemini API.");
}

function buildPrompt(
  matchExamples: string[],
  noMatchExamples: string[],
  failures?: string[]
): string {
  let prompt = `You are a regex generation engine. Given a list of strings that must match and a list that must not match, output ONLY valid JSON with this exact shape:
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
Do not include markdown fences or any text outside the JSON object.

Strings that MUST match:
${matchExamples.map((s, idx) => `${idx + 1}. "${s}"`).join("\n")}

Strings that must NOT match:
${noMatchExamples.map((s, idx) => `${idx + 1}. "${s}"`).join("\n")}`;

  if (failures && failures.length > 0) {
    prompt += `\n\nYour previous pattern failed on these cases:
${failures.map((f) => `- ${f}`).join("\n")}

Fix the pattern and return the same JSON shape.`;
  } else {
    prompt += `\n\nGenerate a JavaScript RegExp that precisely matches all the positive examples and none of the negative examples.`;
  }

  return prompt;
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

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Missing GEMINI_API_KEY environment variable. Please set it in .env.local.",
        },
        { status: 500 }
      );
    }

    // Step 1: Initial call to Gemini
    const initialPrompt = buildPrompt(matchExamples, noMatchExamples);
    let rawResponse = await callGemini(initialPrompt, apiKey);

    let parsedResult: RegexGenerationResponse;
    try {
      parsedResult = JSON.parse(cleanJsonOutput(rawResponse));
    } catch {
      return NextResponse.json(
        {
          error:
            "Couldn't generate a valid pattern — try simplifying your examples",
        },
        { status: 502 }
      );
    }

    // Step 2: Server-side validation
    let validation = validateRegex(
      parsedResult.pattern,
      parsedResult.flags || "",
      matchExamples,
      noMatchExamples
    );

    let retried = false;

    // Step 3: Automatic retry loop if any test case fails
    if (!validation.isValid) {
      retried = true;
      try {
        const retryPrompt = buildPrompt(
          matchExamples,
          noMatchExamples,
          validation.failures
        );
        const retryRawResponse = await callGemini(retryPrompt, apiKey);
        const retryParsed: RegexGenerationResponse = JSON.parse(
          cleanJsonOutput(retryRawResponse)
        );

        parsedResult = retryParsed;
        validation = validateRegex(
          parsedResult.pattern,
          parsedResult.flags || "",
          matchExamples,
          noMatchExamples
        );
      } catch (retryError) {
        console.error("Gemini retry error:", retryError);
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
