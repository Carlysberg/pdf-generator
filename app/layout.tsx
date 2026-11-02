import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PDF Generator",
  description: "Enter a name and upload two photos to generate a one-page A4 PDF.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
