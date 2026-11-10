import type { Metadata } from "next";
import "./globals.css";
import "./sweet.css";
import "./sweet-collections.css";
import "./quote-services.css";

export const metadata: Metadata = {
  title: "E&A Cotiza · Pastelería | Menú de Alta Vitrina",
  description: "Cotizaciones visuales para pasteleros y reposteros independientes. Propuestas para celebraciones, regalos corporativos y experiencias de marca. Packs, adicionales y ficha de insumos en PDF.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
