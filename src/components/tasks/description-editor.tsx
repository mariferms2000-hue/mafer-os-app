"use client";

import { useRef } from "react";
import { Heading1, Heading2, Bold, Italic, Strikethrough, List, ListOrdered, Link2, Pilcrow } from "lucide-react";
import {
  toggleBold,
  toggleItalic,
  toggleStrikethrough,
  toggleHeading,
  toNormalText,
  toggleBulletList,
  toggleNumberedList,
  insertLink,
  type EditResult,
} from "@/lib/markdown-toolbar";

type Action = (text: string, start: number, end: number) => EditResult;

/** Un solo lugar con las nueve herramientas aprobadas — el orden aquí es el
 *  orden visual de la barra. Markdown plano: el textarea sigue siendo el
 *  campo `description` de siempre, así que nada del guardado ni de las
 *  descripciones existentes (incluidas las importadas de Trello) cambia. */
const TOOLS: { key: string; label: string; icon: typeof Bold; action: Action }[] = [
  { key: "normal", label: "Texto normal", icon: Pilcrow, action: toNormalText },
  { key: "titulo", label: "Título", icon: Heading1, action: (t, s, e) => toggleHeading(t, s, e, 1) },
  { key: "subtitulo", label: "Subtítulo", icon: Heading2, action: (t, s, e) => toggleHeading(t, s, e, 2) },
  { key: "bold", label: "Negrita", icon: Bold, action: toggleBold },
  { key: "italic", label: "Cursiva", icon: Italic, action: toggleItalic },
  { key: "strike", label: "Tachado", icon: Strikethrough, action: toggleStrikethrough },
  { key: "bullets", label: "Viñetas", icon: List, action: toggleBulletList },
  { key: "numbered", label: "Lista numerada", icon: ListOrdered, action: toggleNumberedList },
  { key: "link", label: "Enlace", icon: Link2, action: insertLink },
];

export function DescriptionEditor({
  id,
  name,
  defaultValue,
  placeholder,
  testid,
}: {
  id: string;
  name: string;
  defaultValue: string;
  placeholder?: string;
  testid?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function apply(action: Action) {
    const el = ref.current;
    if (!el) return;
    const { text, selectionStart, selectionEnd } = action(el.value, el.selectionStart ?? 0, el.selectionEnd ?? 0);
    el.value = text;
    // dispara un input real para que el onChange del <form> ancestro (dirty state) se entere.
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.focus();
    el.setSelectionRange(selectionStart, selectionEnd);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="flex flex-wrap gap-1 rounded-lg border border-beige bg-cream/60 p-1"
        role="toolbar"
        aria-label="Formato de la descripción"
        data-testid={testid ? `${testid}-toolbar` : undefined}
      >
        {TOOLS.map(({ key, label, icon: Icon, action }) => (
          <button
            key={key}
            type="button"
            className="btn btn-ghost !p-2 !min-h-9 !min-w-9"
            aria-label={label}
            title={label}
            data-testid={testid ? `${testid}-tool-${key}` : undefined}
            onClick={() => apply(action)}
          >
            <Icon size={15} aria-hidden />
          </button>
        ))}
      </div>
      <textarea
        ref={ref}
        id={id}
        name={name}
        className="textarea"
        rows={4}
        defaultValue={defaultValue}
        placeholder={placeholder}
        data-testid={testid}
      />
    </div>
  );
}
