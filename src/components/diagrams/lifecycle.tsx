/** Diagrama responsivo del ciclo de vida de una captura. */
export function LifecycleDiagram() {
  const steps = [
    { label: "Capturar", desc: "El botón +, sin pensar" },
    { label: "Inbox", desc: "Se guarda al instante" },
    { label: "Aclarar", desc: "¿Qué es esto en realidad?" },
    { label: "Destino", desc: "Proyecto · Tarea · Incubadora · Learn Fast · Journal · Recurso" },
    { label: "Próxima acción", desc: "…o archivo, y a otra cosa" },
  ];
  return (
    <ol className="card p-5 flex flex-col md:flex-row md:items-stretch gap-3" aria-label="Ciclo de vida de una captura">
      {steps.map((s, i) => (
        <li key={s.label} className="flex md:flex-1 items-center gap-3 md:flex-col md:text-center">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sage-soft text-forest font-display">
            {i + 1}
          </span>
          <div className="md:mt-1">
            <p className="text-sm font-semibold text-ink-green">{s.label}</p>
            <p className="text-xs text-stone">{s.desc}</p>
          </div>
          {i < steps.length - 1 && (
            <span aria-hidden className="hidden md:block text-sand-deep mx-auto mt-2">↓</span>
          )}
        </li>
      ))}
    </ol>
  );
}
