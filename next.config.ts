import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["postgres"],

  // Bloque 2 (oct 2026): Explorar se integró en Biblioteca y se retiraron de la
  // interfaz «Mi sistema de IA», Agentes y Skills. Los enlaces viejos (favoritos,
  // «vistos recientemente» guardados en la base, historial) siguen funcionando.
  // Temporales (307) a propósito: la estructura puede seguir afinándose.
  // /explorar/decisiones NO se redirige: Decisiones se queda donde está.
  async redirects() {
    return [
      { source: "/explorar", destination: "/biblioteca/ideas", permanent: false },
      { source: "/explorar/learn-fast/:path*", destination: "/biblioteca/ideas/learn-fast/:path*", permanent: false },
      { source: "/explorar/journal/:path*", destination: "/biblioteca/journal/:path*", permanent: false },
      { source: "/explorar/jardin/:path*", destination: "/biblioteca/jardin/:path*", permanent: false },
      { source: "/biblioteca/agentes", destination: "/biblioteca", permanent: false },
      { source: "/biblioteca/skills", destination: "/biblioteca", permanent: false },
    ];
  },
};

export default nextConfig;
