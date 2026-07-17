/* Genera apple-touch-icons multi-tamaño y splash screens de iOS a partir de public/icons/icon.svg.
   Correr manualmente cuando cambie el ícono base: node scripts/generate-pwa-assets.mjs */
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ICON_SVG = path.join(ROOT, "public", "icons", "icon.svg");
const ICONS_DIR = path.join(ROOT, "public", "icons");
const SPLASH_DIR = path.join(ROOT, "public", "splash");
const BACKGROUND = "#f7f4ee"; // theme_color / background_color del manifest

const APPLE_TOUCH_ICONS = [
  { size: 152, file: "apple-touch-icon-152.png" }, // iPad
  { size: 167, file: "apple-touch-icon-167.png" }, // iPad Pro
  { size: 180, file: "apple-touch-icon.png" }, // iPhone (nombre existente, se sobreescribe)
];

// Tabla estándar de breakpoints de apple-touch-startup-image (puntos CSS + escala → píxeles físicos).
// Cubre el line-up actual de iPhone y iPad. Si Mafer usa un modelo no listado, Safari cae de vuelta
// a un splash generado automáticamente a partir del ícono/theme_color (degradación aceptable).
const SPLASH_SCREENS = [
  { name: "iphone-se", widthPt: 375, heightPt: 667, scale: 2 },
  { name: "iphone-12-14", widthPt: 390, heightPt: 844, scale: 3 },
  { name: "iphone-15-16", widthPt: 393, heightPt: 852, scale: 3 },
  { name: "iphone-12-14-pro-max", widthPt: 428, heightPt: 926, scale: 3 },
  { name: "iphone-15-16-pro-max", widthPt: 430, heightPt: 932, scale: 3 },
  { name: "ipad-10-9", widthPt: 820, heightPt: 1180, scale: 2 },
  { name: "ipad-pro-11", widthPt: 834, heightPt: 1194, scale: 2 },
  { name: "ipad-pro-12-9", widthPt: 1024, heightPt: 1366, scale: 2 },
];

async function generateAppleTouchIcons() {
  fs.mkdirSync(ICONS_DIR, { recursive: true });
  for (const { size, file } of APPLE_TOUCH_ICONS) {
    const dest = path.join(ICONS_DIR, file);
    await sharp(ICON_SVG).resize(size, size).png().toFile(dest);
    console.log(`icon: ${file} (${size}x${size})`);
  }
}

async function generateSplashScreens() {
  fs.mkdirSync(SPLASH_DIR, { recursive: true });
  const iconBuffer = await sharp(ICON_SVG).resize(512, 512).png().toBuffer();

  for (const { name, widthPt, heightPt, scale } of SPLASH_SCREENS) {
    const width = widthPt * scale;
    const height = heightPt * scale;
    const iconSize = Math.round(Math.min(width, height) * 0.28);
    const icon = await sharp(iconBuffer).resize(iconSize, iconSize).toBuffer();
    const dest = path.join(SPLASH_DIR, `${name}.png`);

    await sharp({
      create: { width, height, channels: 4, background: BACKGROUND },
    })
      .composite([{ input: icon, gravity: "center" }])
      .png()
      .toFile(dest);

    console.log(`splash: ${name}.png (${width}x${height})`);
  }
}

await generateAppleTouchIcons();
await generateSplashScreens();
console.log("Listo. Revisa public/icons/ y public/splash/, luego actualiza layout.tsx si cambiaron nombres.");
