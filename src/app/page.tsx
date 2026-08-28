"use client";

import React, { useState, useMemo, useEffect } from "react";

interface RegexToken {
  text: string;
  explanation: string;
}

interface GenerateResponse {
  pattern: string;
  flags: string;
  tokens: RegexToken[];
  gotchas: string[];
  retried?: boolean;
  serverValidationPassed?: boolean;
  failingCases?: string[];
  error?: string;
}

interface ExampleValidationResult {
  type: "match" | "noMatch";
  text: string;
  passed: boolean;
  reason: string;
  rotation: string;
}

const PRESETS = [
  {
    name: "User Handles",
    match: ["johndoe_92", "admin_01", "user_123"],
    noMatch: ["johndoe", "admin_0", "user123_"],
  },
  {
    name: "Email Address",
    match: ["user@example.com", "first.last@domain.co", "dev_123@tech.io"],
    noMatch: ["plainaddress", "@missinguser.com", "user@.invalid", "spaces in@mail.com"],
  },
  {
    name: "Semantic Version",
    match: ["1.0.0", "v2.14.3", "0.0.1-alpha.1"],
    noMatch: ["1", "v1.2", "1.2.3.4", "v01.2.3"],
  },
];

export default function Home() {
  const [matchLines, setMatchLines] = useState<string[]>([
    "johndoe_92",
    "admin_01",
    "user_123",
    "",
  ]);
  const [noMatchLines, setNoMatchLines] = useState<string[]>([
    "johndoe",
    "admin_0",
    "user123_",
    "",
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [displayedRegex, setDisplayedRegex] = useState<string>("");
  const [stamped, setStamped] = useState(false);
  const [copied, setCopied] = useState(false);
  const [extraTest, setExtraTest] = useState("");

  const matchExamples = useMemo(
    () => matchLines.map((s) => s.trim()).filter(Boolean),
    [matchLines]
  );
  const noMatchExamples = useMemo(
    () => noMatchLines.map((s) => s.trim()).filter(Boolean),
    [noMatchLines]
  );

  const isFormValid = matchExamples.length > 0 && noMatchExamples.length > 0;

  // Handle Match input changes
  const handleMatchChange = (index: number, value: string) => {
    const next = [...matchLines];
    next[index] = value;
    // If user types in the last row, add a new empty row
    if (index === next.length - 1 && value.trim() !== "") {
      next.push("");
    }
    setMatchLines(next);
  };

  // Handle No-Match input changes
  const handleNoMatchChange = (index: number, value: string) => {
    const next = [...noMatchLines];
    next[index] = value;
    if (index === next.length - 1 && value.trim() !== "") {
      next.push("");
    }
    setNoMatchLines(next);
  };

  const handleApplyPreset = (preset: (typeof PRESETS)[0]) => {
    setMatchLines([...preset.match, ""]);
    setNoMatchLines([...preset.noMatch, ""]);
    setError(null);
  };

  // Client-side live validation of examples against current regex
  const clientValidation = useMemo<ExampleValidationResult[]>(() => {
    if (!result?.pattern) return [];

    try {
      const safeFlags = (result.flags || "").replace(/[gy]/g, "");
      const regex = new RegExp(result.pattern, safeFlags);

      const rotations = ["3deg", "2deg", "4deg", "-2deg", "-3deg", "-1deg", "1.5deg"];

      const matches: ExampleValidationResult[] = matchExamples.map((str, i) => {
        const pass = regex.test(str);
        return {
          type: "match",
          text: str,
          passed: pass,
          reason: pass ? "Matched expected constraint" : "Expected to match, but failed",
          rotation: rotations[i % rotations.length],
        };
      });

      const noMatches: ExampleValidationResult[] = noMatchExamples.map((str, i) => {
        const pass = !regex.test(str);
        return {
          type: "noMatch",
          text: str,
          passed: pass,
          reason: pass ? "Correctly rejected constraint" : "Expected NOT to match, but matched",
          rotation: rotations[(i + 3) % rotations.length],
        };
      });

      return [...matches, ...noMatches];
    } catch {
      return [];
    }
  }, [result, matchExamples, noMatchExamples]);

  // Typewriter effect when new regex arrives
  useEffect(() => {
    if (!result?.pattern) return;

    const fullStr = `/${result.pattern}/${result.flags || ""}`;
    setDisplayedRegex("");
    setStamped(false);

    let idx = 0;
    const interval = setInterval(() => {
      if (idx < fullStr.length) {
        setDisplayedRegex((prev) => prev + fullStr.charAt(idx));
        idx++;
      } else {
        clearInterval(interval);
        setTimeout(() => {
          setStamped(true);
        }, 200);
      }
    }, 30);

    return () => clearInterval(interval);
  }, [result]);

  const handleGenerate = async () => {
    if (!isFormValid || loading) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/generate-regex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchExamples,
          noMatchExamples,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Couldn't generate a valid pattern — try simplifying your examples"
        );
      }

      setResult(data);
    } catch (err: any) {
      console.error(err);
      setError(
        err.message ||
          "Couldn't generate a valid pattern — try simplifying your examples"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    const full = `/${result.pattern}/${result.flags || ""}`;
    navigator.clipboard.writeText(full);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const extraTestResult = useMemo(() => {
    if (!result?.pattern || !extraTest) return null;
    try {
      const safeFlags = (result.flags || "").replace(/[gy]/g, "");
      const regex = new RegExp(result.pattern, safeFlags);
      return regex.test(extraTest);
    } catch {
      return null;
    }
  }, [result, extraTest]);

  const matchResults = clientValidation.filter((v) => v.type === "match");
  const noMatchResults = clientValidation.filter((v) => v.type === "noMatch");

  return (
    <div className="min-h-screen flex flex-col p-6 md:p-16 bg-background text-paper font-body-sm">
      {/* Top AppBar */}
      <header className="docked full-width top-0 bg-background text-paper border-b border-paper flex justify-between items-center py-4 w-full mb-12 md:mb-16">
        <nav className="flex flex-wrap gap-4 md:gap-8 items-center w-full">
          <span
            className="font-display-lg text-display-lg text-paper tracking-tighter uppercase"
            style={{ fontSize: "24px" }}
          >
            REGEX PROOF-SHEET
          </span>

          <div className="flex flex-wrap gap-4 md:gap-6 ml-auto items-center">
            <span className="text-on-surface-variant font-label-caps text-[11px] hidden sm:inline">
              PRESETS:
            </span>
            {PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => handleApplyPreset(p)}
                className="text-paper font-label-caps text-[11px] hover:bg-paper hover:text-background transition-colors duration-100 px-2 py-1 uppercase"
              >
                {p.name}
              </button>
            ))}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!isFormValid || loading}
              className="font-label-caps text-label-caps cursor-pointer hover:bg-paper hover:text-background transition-colors duration-100 px-4 py-2 border border-paper uppercase disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "[ GENERATING... ]" : "[ GENERATE ]"}
            </button>
          </div>
        </nav>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow flex flex-col max-w-5xl mx-auto w-full">
        {/* Page Title */}
        <div className="mb-12 md:mb-16 border-b border-paper pb-8">
          <h1 className="font-display-lg text-display-lg uppercase tracking-tight">
            Regex From Examples
          </h1>
          <p className="font-body-sm text-on-surface-variant mt-2 text-xs md:text-sm">
            EXPERIMENTAL PROOF-SHEET — DEFINE POSITIVE AND NEGATIVE LOGIC CONSTRAINTS TO SYNTHESIZE JAVASCRIPT REGEX.
          </p>
        </div>

        {/* Inputs Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 mb-12">
          {/* Should Match Column */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-label-caps text-label-caps uppercase text-brass">
                Should Match ({matchExamples.length})
              </h2>
            </div>
            <div className="flex flex-col gap-3 font-code-block text-code-block">
              {matchLines.map((line, idx) => (
                <input
                  key={idx}
                  type="text"
                  value={line}
                  onChange={(e) => handleMatchChange(idx, e.target.value)}
                  placeholder={idx === matchLines.length - 1 ? "Add example..." : `Example ${idx + 1}`}
                  className="font-code-block text-code-block"
                />
              ))}
            </div>
          </div>

          {/* Should Not Match Column */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-label-caps text-label-caps uppercase text-rust">
                Should Not Match ({noMatchExamples.length})
              </h2>
            </div>
            <div className="flex flex-col gap-3 font-code-block text-code-block">
              {noMatchLines.map((line, idx) => (
                <input
                  key={idx}
                  type="text"
                  value={line}
                  onChange={(e) => handleNoMatchChange(idx, e.target.value)}
                  placeholder={idx === noMatchLines.length - 1 ? "Add example..." : `Example ${idx + 1}`}
                  className="font-code-block text-code-block"
                />
              ))}
            </div>
          </div>
        </div>

        {/* Action Row */}
        <div className="flex flex-col items-center justify-center mb-16 gap-3">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!isFormValid || loading}
            id="generate-btn"
            className="font-body-lg text-body-lg uppercase hover:underline underline-offset-8 cursor-pointer py-3 px-8 transition-all hover:bg-paper hover:text-background border border-paper disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "[ GENERATING & VALIDATING... ]" : "[ GENERATE ]"}
          </button>
          {!isFormValid && (
            <span className="font-label-caps text-[11px] text-on-surface-variant uppercase">
              * Provide at least one example in both columns
            </span>
          )}
        </div>

        {/* Inline Error Notice */}
        {error && (
          <div className="mb-12 p-4 border border-rust text-rust font-code-block text-xs uppercase">
            [ ERROR ]: {error}
          </div>
        )}

        {/* Results & Proof Section (rendered once generated) */}
        {result && (
          <div className="flex flex-col transition-opacity duration-700" id="results-section">
            {/* The Pattern Tape */}
            <div className="w-full bg-paper text-background py-12 md:py-16 px-6 md:px-8 mb-16 flex flex-col md:flex-row justify-between items-center overflow-x-auto border-t border-b border-background gap-6">
              <div className="flex items-center gap-2">
                <span
                  className="font-code-block text-code-block text-2xl md:text-4xl font-bold tracking-tight select-all break-all text-center md:text-left"
                >
                  {displayedRegex || `/${result.pattern}/${result.flags}`}
                </span>
              </div>

              <div className="flex items-center gap-4 shrink-0">
                {result.retried && (
                  <span className="font-label-caps text-[10px] uppercase border border-background px-2 py-1">
                    AUTO-RETRIED
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleCopy}
                  className="font-label-caps text-label-caps uppercase border border-background px-4 py-2 hover:bg-background hover:text-paper transition-colors"
                >
                  {copied ? "[ COPIED ]" : "[ COPY REGEX ]"}
                </button>
              </div>
            </div>

            {/* Live Interactive Extra Tester */}
            <div className="flex flex-col sm:flex-row items-baseline gap-4 mb-16 pb-8 border-b border-paper border-opacity-40">
              <span className="font-label-caps text-label-caps uppercase shrink-0 text-on-surface-variant">
                LIVE PROOF TESTER:
              </span>
              <input
                type="text"
                value={extraTest}
                onChange={(e) => setExtraTest(e.target.value)}
                placeholder="Type arbitrary string to verify against /pattern/..."
                className="flex-1 font-code-block text-sm"
              />
              {extraTest && extraTestResult !== null && (
                <span
                  className={`font-label-caps text-xs font-bold uppercase px-3 py-1 ${
                    extraTestResult ? "text-brass" : "text-rust"
                  }`}
                >
                  {extraTestResult ? "✓ MATCHES PATTERN" : "✗ REJECTED"}
                </span>
              )}
            </div>

            {/* The Proof (Side-by-side validation columns) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 mb-20">
              {/* Matches Proof */}
              <div className="flex flex-col">
                <h3 className="font-label-caps text-label-caps mb-8 border-b border-paper pb-2 uppercase text-brass">
                  Matches Proof ({matchResults.filter((m) => m.passed).length}/{matchResults.length})
                </h3>
                <ul className="flex flex-col gap-4 font-code-block text-code-block">
                  {matchResults.map((item, idx) => (
                    <li
                      key={idx}
                      className="flex items-center gap-4 py-2 border-b border-paper border-opacity-30"
                    >
                      <span
                        className={`stamp font-bold text-lg ${stamped ? "stamped" : ""} ${
                          item.passed ? "pass" : "fail"
                        }`}
                        style={
                          {
                            "--target-rotation": `rotate(${item.rotation})`,
                          } as React.CSSProperties
                        }
                      >
                        {item.passed ? "✓" : "✗"}
                      </span>
                      <span className="break-all">{item.text}</span>
                      {!item.passed && (
                        <span className="ml-auto text-[10px] text-rust font-sans uppercase">
                          Failed
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Fails Proof */}
              <div className="flex flex-col">
                <h3 className="font-label-caps text-label-caps mb-8 border-b border-paper pb-2 uppercase text-rust">
                  Fails Proof ({noMatchResults.filter((m) => m.passed).length}/{noMatchResults.length})
                </h3>
                <ul className="flex flex-col gap-4 font-code-block text-code-block">
                  {noMatchResults.map((item, idx) => (
                    <li
                      key={idx}
                      className="flex items-center gap-4 py-2 border-b border-paper border-opacity-30"
                    >
                      <span
                        className={`stamp font-bold text-lg ${stamped ? "stamped" : ""} ${
                          item.passed ? "fail" : "pass"
                        }`}
                        style={
                          {
                            "--target-rotation": `rotate(${item.rotation})`,
                          } as React.CSSProperties
                        }
                      >
                        {item.passed ? "✗" : "✓"}
                      </span>
                      <span className="break-all">{item.text}</span>
                      {!item.passed && (
                        <span className="ml-auto text-[10px] text-rust font-sans uppercase">
                          Incorrect Match
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Marginalia (Token Breakdown) */}
            <div className="flex flex-col mb-16 border-t border-paper pt-8">
              <h3 className="font-label-caps text-label-caps mb-8 uppercase">
                Marginalia: Pattern Breakdown
              </h3>
              <div className="flex flex-col">
                {result.tokens && result.tokens.length > 0 ? (
                  result.tokens.map((tok, idx) => (
                    <div
                      key={idx}
                      className="flex items-baseline py-3 border-b border-paper border-opacity-30 flex-wrap sm:flex-nowrap gap-2"
                    >
                      <span className="font-code-block text-code-block text-paper font-semibold shrink-0">
                        {tok.text}
                      </span>
                      <div className="leader-line hidden sm:block"></div>
                      <span className="font-body-sm text-body-sm text-on-surface-variant">
                        {tok.explanation}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="py-3 text-xs text-on-surface-variant font-code-block">
                    [ NO TOKEN BREAKDOWN DATA ]
                  </div>
                )}
              </div>
            </div>

            {/* Gotchas & Edge Cases (if any) */}
            {result.gotchas && result.gotchas.length > 0 && (
              <div className="flex flex-col mb-16 border-t border-paper pt-8">
                <h3 className="font-label-caps text-label-caps mb-6 uppercase text-on-surface-variant">
                  Marginalia: Technical Caveats & Gotchas
                </h3>
                <div className="flex flex-col gap-3">
                  {result.gotchas.map((gotcha, idx) => (
                    <div
                      key={idx}
                      className="flex items-baseline py-2 border-b border-paper border-opacity-20 text-xs font-code-block text-on-surface-variant"
                    >
                      <span className="text-paper mr-3">§ {idx + 1}</span>
                      <span>{gotcha}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="docked full-width bottom-0 bg-background text-on-surface-variant border-t border-paper flex flex-col sm:flex-row justify-between items-center py-6 w-full mt-16 gap-4">
        <span className="font-label-caps text-label-caps text-paper text-[11px] text-center sm:text-left">
          © 2024 REGEX PROOF-SHEET. ALL LOGIC STAMPED PERMANENTLY.
        </span>
        <div className="flex gap-6">
          <a
            className="font-label-caps text-label-caps text-on-surface-variant hover:text-paper transition-colors underline-offset-4 hover:underline text-[11px]"
            href="#"
          >
            TERMS
          </a>
          <a
            className="font-label-caps text-label-caps text-on-surface-variant hover:text-paper transition-colors underline-offset-4 hover:underline text-[11px]"
            href="#"
          >
            PRIVACY
          </a>
          <a
            className="font-label-caps text-label-caps text-on-surface-variant hover:text-paper transition-colors underline-offset-4 hover:underline text-[11px]"
            href="#"
          >
            SOURCE
          </a>
        </div>
      </footer>
    </div>
  );
}
