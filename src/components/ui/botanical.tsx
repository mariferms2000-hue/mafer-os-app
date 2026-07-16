/** Detalles botánicos originales de Mafer OS — trazos ligeros, color heredado (currentColor). */

export function Sprig({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <path d="M24 42c0-10 1-18 4-26" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M27 24c-5-1-8-4-9-9 5 1 8 4 9 9Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M26.5 17c1-5 4-8 9-9-1 5-4 8-9 9Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M25 33c-4-.5-7-2.5-8.5-6.5 4 .5 7 2.5 8.5 6.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

export function SprigWide({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 72 32" fill="none" className={className} aria-hidden="true">
      <path d="M4 28c16-4 34-6 64-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M22 25c-1-6 1-10 5-13 1 6-1 10-5 13Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M36 23.5c-2-5-1-9 2-13 2 5 1 9-2 13Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M50 23c-3-4-3.5-8-1.5-12.5 3 4 3.5 8 1.5 12.5Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
    </svg>
  );
}

/** Planta adulta del pie del sidebar: tallo alto con hojas alternas,
 *  trazo lineal minimalista sobre una línea de tierra discreta. */
export function SidebarPlant({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 108" fill="none" className={className} aria-hidden="true">
      {/* tallo principal, con una curva ligera y orgánica */}
      <path d="M48 98C48 78 46.5 52 48.5 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      {/* hojas alternas, de mayor a menor hacia la punta */}
      <path d="M47.6 84C36 82 29.5 76 27.5 64.5 39 66.5 45.5 72.5 47.6 84Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M48 72c2.5-11.5 9-17.5 20.5-19.5C66 64 59.5 70 48 72Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M47.3 58C37.5 56.3 32 51.3 30.4 41.5 40.2 43.2 45.7 48.2 47.3 58Z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
      <path d="M48.2 46c2-9.6 7.5-14.6 17-16.3-2 9.6-7.4 14.6-17 16.3Z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
      <path d="M47.8 33.5c-7-1.2-11-4.8-12.2-11.8 7 1.2 11 4.8 12.2 11.8Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M48.6 23.5c1.3-6.7 5-10.2 11.6-11.4-1.3 6.7-5 10.2-11.6 11.4Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      {/* nervaduras sutiles */}
      <path d="M31 67.5c6 1.5 11.5 5 15 12" stroke="currentColor" strokeWidth="0.7" strokeLinecap="round" opacity="0.55" />
      <path d="M65 56c-6 1.8-11.5 5.6-14.6 12.3" stroke="currentColor" strokeWidth="0.7" strokeLinecap="round" opacity="0.55" />
      {/* línea de tierra */}
      <path d="M28 98h40" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M22 102h12M62 102h12" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

/** Semilla germinando: para estados vacíos de «aún no hay nada» (algo va a nacer). */
export function Seed({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <path d="M20 38c2.5-1 4-3 4-6.5V24" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M24 27c-3.5-.6-5.6-2.6-6.4-6.2 3.6.6 5.7 2.7 6.4 6.2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M24 24.5c.8-3.4 2.9-5.4 6.3-6-0.8 3.4-2.9 5.4-6.3 6Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <ellipse cx="22" cy="38.5" rx="6.5" ry="3.6" stroke="currentColor" strokeWidth="1.3" />
      <path d="M12 44h24" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}
