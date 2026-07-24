/* Lógica pura de la barra de formato de la descripción de tareas — sin DOM.
   Cada función recibe el texto completo y la selección actual (start/end de
   un textarea) y devuelve el texto resultante más la selección donde debe
   quedar el cursor. El formato es Markdown plano: no hay modelo propio, así
   que el texto existente (incluido el importado de Trello) nunca se
   reescribe salvo en la línea/selección que el botón realmente toca. */

export type EditResult = { text: string; selectionStart: number; selectionEnd: number };

function wrapSelection(text: string, start: number, end: number, marker: string): EditResult {
  const before = text.slice(0, start);
  const selected = text.slice(start, end);
  const after = text.slice(end);

  // La propia selección incluye los marcadores en sus bordes: desenvolver in-place.
  if (selected.length >= marker.length * 2 && selected.startsWith(marker) && selected.endsWith(marker)) {
    const inner = selected.slice(marker.length, selected.length - marker.length);
    return { text: before + inner + after, selectionStart: start, selectionEnd: start + inner.length };
  }

  // La selección quedó justo ADENTRO de los marcadores (el estado tras un primer
  // toggle, que deja seleccionado solo el texto interno): desenvolver quitando
  // los marcadores de afuera para que un segundo clic siempre sea el inverso del primero.
  if (before.endsWith(marker) && after.startsWith(marker)) {
    const newBefore = before.slice(0, before.length - marker.length);
    const newAfter = after.slice(marker.length);
    return {
      text: newBefore + selected + newAfter,
      selectionStart: newBefore.length,
      selectionEnd: newBefore.length + selected.length,
    };
  }

  const newText = before + marker + selected + marker + after;
  return {
    text: newText,
    selectionStart: start + marker.length,
    selectionEnd: start + marker.length + selected.length,
  };
}

export function toggleBold(text: string, start: number, end: number): EditResult {
  return wrapSelection(text, start, end, "**");
}

export function toggleItalic(text: string, start: number, end: number): EditResult {
  return wrapSelection(text, start, end, "_");
}

export function toggleStrikethrough(text: string, start: number, end: number): EditResult {
  return wrapSelection(text, start, end, "~~");
}

/** Quita cualquier marcador de bloque (encabezado, viñeta, numerada) al inicio de una línea. */
function stripBlockPrefix(line: string): string {
  return line.replace(/^(#{1,6}\s+|[-*]\s+|\d+\.\s+)/, "");
}

function selectedLineRange(text: string, start: number, end: number): { lineStart: number; lineEnd: number } {
  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  const idx = text.indexOf("\n", end);
  const lineEnd = idx === -1 ? text.length : idx;
  return { lineStart, lineEnd };
}

function applyLinePrefix(
  text: string,
  start: number,
  end: number,
  makePrefix: (strippedLine: string) => string,
  isOn: (lines: string[]) => boolean
): EditResult {
  const { lineStart, lineEnd } = selectedLineRange(text, start, end);
  const block = text.slice(lineStart, lineEnd);
  const lines = block.split("\n");
  const turnOff = isOn(lines);

  const newLines = lines.map((line) => {
    const stripped = stripBlockPrefix(line);
    if (turnOff) return stripped;
    if (stripped.length === 0) return line; // las líneas vacías del bloque no llevan marcador
    return makePrefix(stripped) + stripped;
  });

  const newBlock = newLines.join("\n");
  const newText = text.slice(0, lineStart) + newBlock + text.slice(lineEnd);
  return { text: newText, selectionStart: lineStart, selectionEnd: lineStart + newBlock.length };
}

const nonEmpty = (lines: string[]) => lines.filter((l) => l.length > 0);

export function toggleHeading(text: string, start: number, end: number, level: 1 | 2): EditResult {
  const marker = "#".repeat(level) + " ";
  return applyLinePrefix(
    text,
    start,
    end,
    () => marker,
    (lines) => nonEmpty(lines).every((l) => l.startsWith(marker))
  );
}

export function toNormalText(text: string, start: number, end: number): EditResult {
  return applyLinePrefix(text, start, end, () => "", () => true);
}

export function toggleBulletList(text: string, start: number, end: number): EditResult {
  return applyLinePrefix(
    text,
    start,
    end,
    () => "- ",
    (lines) => nonEmpty(lines).every((l) => /^[-*]\s/.test(l))
  );
}

export function toggleNumberedList(text: string, start: number, end: number): EditResult {
  let n = 0;
  return applyLinePrefix(
    text,
    start,
    end,
    () => {
      n += 1;
      return `${n}. `;
    },
    (lines) => nonEmpty(lines).every((l) => /^\d+\.\s/.test(l))
  );
}

/** Envuelve la selección (o «texto» si no hay nada seleccionado) como enlace
 *  Markdown y deja «url» seleccionado para que se escriba encima de una vez. */
export function insertLink(text: string, start: number, end: number): EditResult {
  const before = text.slice(0, start);
  const selected = text.slice(start, end) || "texto";
  const after = text.slice(end);
  const placeholder = "url";
  const inserted = `[${selected}](${placeholder})`;
  const urlStart = before.length + 1 + selected.length + 2;
  return { text: before + inserted + after, selectionStart: urlStart, selectionEnd: urlStart + placeholder.length };
}
