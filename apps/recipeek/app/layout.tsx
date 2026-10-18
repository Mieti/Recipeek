import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {width:'device-width',initialScale:1,viewportFit:'cover',interactiveWidget:'resizes-content'};

export const metadata: Metadata = {
  title: "Recipeek · La tua cucina personale",
  description: "Raccogli, organizza e cucina le ricette che ami. Il tuo ricettario personale, un passaggio alla volta.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Recipeek" },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body className="antialiased">{children}</body>
    </html>
  );
}
