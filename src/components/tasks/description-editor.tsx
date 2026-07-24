"use client";

import { useEffect, useRef } from "react";
import { Heading1, Heading2, Bold, Italic, Strikethrough, List, ListOrdered, Pilcrow } from "lucide-react";
import { markdownToHtml, htmlToMarkdown } from "@/lib/markdown-html";

/** Editor visual (WYSIWYG) de la descripción de tareas — Fase de reemplazo
 *  del editor de símbolos visibles: Mafer ve negrita/título/viñetas como se
 *  verían, nunca `**`/`##`. Por debajo sigue siendo Markdown: el campo real
 *  que el formulario envía (`name`, sin cambios) es un input oculto que se
 *  recalcula desde el HTML visible en cada edición. Si no se toca nada, el
 *  valor original se conserva byte a byte — ninguna descripción existente ni
 *  texto importado de Trello se reescribe solo por abrir la tarea. */

type ToolAction = { key: string; label: string; icon: typeof Bold; run: (el: HTMLElement) => void };

function currentBlockTag(): string {
  const raw = document.queryCommandValue("formatBlock") || "";
  return raw.replace(/[<>]/g, "").toLowerCase();
}

function toggleHeading(level: 1 | 2) {
  const tag = `h${level}`;
  document.execCommand("formatBlock", false, currentBlockTag() === tag ? "<p>" : `<${tag}>`);
}

function toNormalText() {
  if (document.queryCommandState("insertUnorderedList")) document.execCommand("insertUnorderedList");
  if (document.queryCommandState("insertOrderedList")) document.execCommand("insertOrderedList");
  document.execCommand("formatBlock", false, "<p>");
}

const TOOLS: ToolAction[] = [
  { key: "normal", label: "Texto normal", icon: Pilcrow, run: () => toNormalText() },
  { key: "titulo", label: "Título", icon: Heading1, run: () => toggleHeading(1) },
  { key: "subtitulo", label: "Subtítulo", icon: Heading2, run: () => toggleHeading(2) },
  { key: "bold", label: "Negrita", icon: Bold, run: () => document.execCommand("bold") },
  { key: "italic", label: "Cursiva", icon: Italic, run: () => document.execCommand("italic") },
  { key: "strike", label: "Tachado", icon: Strikethrough, run: () => document.execCommand("strikeThrough") },
  { key: "bullets", label: "Viñetas", icon: List, run: () => document.execCommand("insertUnorderedList") },
  { key: "numbered", label: "Lista numerada", icon: ListOrdered, run: () => document.execCommand("insertOrderedList") },
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
  const editorRef = useRef<HTMLDivElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = markdownToHtml(defaultValue);
    if (hiddenRef.current) hiddenRef.current.value = defaultValue; // intacto hasta que se edite de verdad
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function sync() {
    const editor = editorRef.current;
    const hidden = hiddenRef.current;
    if (!editor || !hidden) return;
    hidden.value = htmlToMarkdown(editor.innerHTML);
    hidden.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function run(action: ToolAction) {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    action.run(editor);
    sync();
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="flex flex-wrap gap-1 rounded-lg border border-beige bg-cream/60 p-1"
        role="toolbar"
        aria-label="Formato de la descripción"
        data-testid={testid ? `${testid}-toolbar` : undefined}
      >
        {TOOLS.map((tool) => (
          <button
            key={tool.key}
            type="button"
            className="btn btn-ghost !p-2 !min-h-9 !min-w-9"
            aria-label={tool.label}
            title={tool.label}
            data-testid={testid ? `${testid}-tool-${tool.key}` : undefined}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => run(tool)}
          >
            <tool.icon size={15} aria-hidden />
          </button>
        ))}
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Descripción"
        className="textarea rich-text-editor"
        data-placeholder={placeholder}
        onInput={sync}
        onBlur={sync}
        data-testid={testid}
      />
      <input ref={hiddenRef} type="hidden" id={id} name={name} data-testid={testid ? `${testid}-markdown` : undefined} />
    </div>
  );
}
