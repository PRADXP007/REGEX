# 📜 Regex From Examples — Proof-Sheet

> **An experimental brutalist proof-sheet web tool that synthesizes, live-validates, auto-heals, and explains JavaScript regular expressions from positive and negative string constraints.**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Vercel-black?style=for-the-badge&logo=vercel)](https://regex-from-examples.vercel.app)
[![GitHub Repo](https://img.shields.io/badge/GitHub-PRADXP007%2FREGEX-181717?style=for-the-badge&logo=github)](https://github.com/PRADXP007/REGEX)
[![Next.js 14](https://img.shields.io/badge/Next.js-14.2-000000?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Gemini API](https://img.shields.io/badge/Google%20Gemini-2.5%20Flash-4285F4?style=for-the-badge&logo=google)](https://ai.google.dev/)

---

## 🌐 Live Website

- **Production URL**: [https://regex-from-examples.vercel.app](https://regex-from-examples.vercel.app) *(or deploy your own copy via Vercel with 1 click)*
- **GitHub Repository**: [https://github.com/PRADXP007/REGEX](https://github.com/PRADXP007/REGEX)

---

## ✨ Core Concept

Users define two sets of example strings:
1. **Should Match**: Positive strings the target pattern must match.
2. **Should NOT Match**: Negative strings the pattern must strictly reject.

The app prompts **Google Gemini 2.5 Flash** with strict JSON output requirements, executes server-side validation against all examples with Node's native `RegExp`, and **automatically retries once with mismatch diagnostics** if any constraint fails.

---

## 🎨 Design Philosophy: "Manuscript Logic & Brutalist Proof-Sheet"

The user interface rejects standard SaaS bubbles, cards, and rounded corners in favor of a technical manuscript proof-sheet:

- **Hard-Edged Flat Brutalism**: `0px` border radius everywhere.
- **Architectural Color Palette**:
  - **Ink (`#15181D`)**: The foundational deep black-blue void.
  - **Paper (`#EDE6D3`)**: Warm parchment tone for text, dividers, and the high-contrast Regex Tape.
  - **Brass (`#B4903E`)**: Indicator of success for passing constraint stamps (`✓`).
  - **Rust (`#9C4535`)**: Indicator of friction for non-match constraint stamps (`✗`).
- **Typography**:
  - **Newsreader** (Serif) for editorial display headers.
  - **JetBrains Mono** (Monospace) for all code blocks, inputs, labels, and tokens.
- **Dynamic Stamps**: Animated, slightly angled `✓` and `✗` stamps that punch onto the page.
- **Marginalia & Leader Lines**: Dotted leader lines (`····`) bridging tokens to plain-English explanations.

---

## 🚀 Features

- **⚡ Instant Synthesis**: Synthesizes clean JavaScript RegExp (`/pattern/flags`).
- **🔄 Server-Side Auto-Healing Loop**: Runs server-side validation against all examples. If any case fails, it automatically prompts Gemini a second time with the exact failed test cases to heal the pattern before responding.
- **🧪 Client-Side Live Validation Matrix**: Compares every string example against `new RegExp(pattern, flags)` directly in the browser with pass/fail status stamps.
- **🎯 Live Interactive Proof Tester**: Test any arbitrary string live in real-time as you type.
- **🧩 Token-by-Token Marginalia**: Plain-English breakdowns of each regex segment.
- **⚠️ Gotchas & Edge Cases Callout**: Flags critical edge cases (backtracking risks, Unicode, multiline matching).
- **📋 One-Click Copy**: Copies `/pattern/flags` directly to clipboard.
- **📱 Fully Responsive**: Seamlessly stacks on mobile devices (< 768px).

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 14](https://nextjs.org/) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **AI Engine**: [Google Gemini REST API](https://ai.google.dev/) (`gemini-2.5-flash`)
- **Fonts**: `Newsreader` & `JetBrains Mono`

---

## 📦 Project Structure

```
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── generate-regex/
│   │   │       └── route.ts        # Server route: Gemini call + validation retry loop
│   │   ├── globals.css             # Proof-sheet theme, stamp animations, custom scrollbars
│   │   ├── layout.tsx              # Root HTML shell & metadata
│   │   └── page.tsx                # Single-page client interface & live test matrix
├── tailwind.config.ts              # Design tokens (Ink, Paper, Brass, Rust, Newsreader, JetBrains)
├── tsconfig.json                   # TypeScript configuration
├── .env.example                    # Environment variable template
└── package.json                    # Dependencies & scripts
```

---

## ⚡ Getting Started Locally

### 1. Clone the repository
```bash
git clone https://github.com/PRADXP007/REGEX.git
cd REGEX
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure API Key
Create a `.env.local` file in the root directory:
```bash
cp .env.example .env.local
```
Add your **Google Gemini API key**:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```
*(Get your key from [Google AI Studio](https://aistudio.google.com/app/apikey) or Google Cloud Console with Generative Language API enabled).*

### 4. Run development server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) (or `http://localhost:3001`) in your browser.

### 5. Build for production
```bash
npm run build
npm start
```

---

## 🚢 Deployment to Vercel

1. Push your repository to GitHub.
2. Go to [Vercel](https://vercel.com/new) and import `PRADXP007/REGEX`.
3. In **Environment Variables**, add:
   - `GEMINI_API_KEY`: `your_gemini_api_key_here`
4. Click **Deploy**.

---

## 📄 License

MIT © [PRADXP007](https://github.com/PRADXP007)
