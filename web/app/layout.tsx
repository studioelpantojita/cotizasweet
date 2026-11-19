import type { Metadata } from "next";
import localFont from "next/font/local";
import { connection } from "next/server";
import "./globals.css";
import "./sweet.css";
import "./sweet-collections.css";
import "./quote-services.css";
import "./brand.css";

const dmSans = localFont({
  src: "./fonts/DM-Sans-Variable.ttf",
  weight: "100 1000",
  display: "swap",
  variable: "--eacotiza-dm-sans",
});

export const metadata: Metadata = {
  title: {
    default: "E&A Cotiza · Cotizaciones de pastelería",
    template: "%s | E&A Cotiza",
  },
  description: "Cotizaciones visuales para pasteleros y reposteros independientes. Propuestas para celebraciones, regalos corporativos y experiencias de marca. Packs, adicionales y ficha de insumos en PDF.",
  icons: {
    icon: { url: "/favicon.svg", type: "image/svg+xml", sizes: "any" },
    apple: { url: "/brand/eacotiza-avatar.png", sizes: "512x512" },
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await connection();

  return (
    <html lang="es" className={dmSans.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
