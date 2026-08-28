import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Regex From Examples | REGEX PROOF-SHEET",
  description:
    "Experimental Brutalist Proof-Sheet for JavaScript Regular Expressions synthesized from positive and negative examples.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen flex flex-col bg-background text-paper font-body-sm antialiased selection:bg-paper selection:text-background">
        {children}
      </body>
    </html>
  );
}
