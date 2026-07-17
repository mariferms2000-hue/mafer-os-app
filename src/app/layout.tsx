import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Breakpoints estándar de apple-touch-startup-image (puntos CSS + escala).
// Deben coincidir con los archivos generados por scripts/generate-pwa-assets.mjs.
const APPLE_SPLASH_SCREENS = [
  { file: "iphone-se", widthPt: 375, heightPt: 667, scale: 2 },
  { file: "iphone-12-14", widthPt: 390, heightPt: 844, scale: 3 },
  { file: "iphone-15-16", widthPt: 393, heightPt: 852, scale: 3 },
  { file: "iphone-12-14-pro-max", widthPt: 428, heightPt: 926, scale: 3 },
  { file: "iphone-15-16-pro-max", widthPt: 430, heightPt: 932, scale: 3 },
  { file: "ipad-10-9", widthPt: 820, heightPt: 1180, scale: 2 },
  { file: "ipad-pro-11", widthPt: 834, heightPt: 1194, scale: 2 },
  { file: "ipad-pro-12-9", widthPt: 1024, heightPt: 1366, scale: 2 },
];

export const metadata: Metadata = {
  title: { default: "Mafer OS", template: "%s · Mafer OS" },
  description: "El sistema operativo personal de Mafer",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Mafer OS",
    statusBarStyle: "default",
    startupImage: APPLE_SPLASH_SCREENS.map(({ file, widthPt, heightPt, scale }) => ({
      url: `/splash/${file}.png`,
      media: `(device-width: ${widthPt}px) and (device-height: ${heightPt}px) and (-webkit-device-pixel-ratio: ${scale}) and (orientation: portrait)`,
    })),
  },
  icons: {
    icon: "/icons/icon.svg",
    apple: [
      { url: "/icons/apple-touch-icon-152.png", sizes: "152x152", type: "image/png" },
      { url: "/icons/apple-touch-icon-167.png", sizes: "167x167", type: "image/png" },
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#f7f4ee",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

import { THEME_INIT_SCRIPT } from "@/components/shell/theme-script";
import { ThemeWatcher } from "@/components/shell/theme";

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${fraunces.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <ThemeWatcher />
        {children}
      </body>
    </html>
  );
}
