import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mafer OS",
    short_name: "Mafer OS",
    description: "El sistema operativo personal de Mafer",
    start_url: "/",
    display: "standalone",
    background_color: "#faf7f1",
    theme_color: "#faf7f1",
    lang: "es",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
