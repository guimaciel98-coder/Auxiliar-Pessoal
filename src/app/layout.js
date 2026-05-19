import "./globals.css";
import { Outfit, JetBrains_Mono } from "next/font/google";

const outfitFont = Outfit({ 
  subsets: ["latin"], 
  variable: "--font-sans", 
  display: "swap", 
  weight: ["300", "400", "500", "600", "700", "800", "900"] 
});

const jbMono = JetBrains_Mono({ 
  subsets: ["latin"], 
  variable: "--font-mono", 
  display: "swap", 
  weight: ["300", "400", "500"] 
});

export const metadata = {
  title: "Daily · Guida",
  description: "Tarefas do dia",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Daily" },
  other: { "mobile-web-app-capable": "yes" },
};

export const viewport = { themeColor: "#0a0d14", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className={`${outfitFont.variable} ${jbMono.variable}`}>
      <head><link rel="apple-touch-icon" href="/icon-192.png" /></head>
      <body>{children}</body>
    </html>
  );
}
