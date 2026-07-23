/* Conversión pura Markdown <-> HTML para el editor visual de la descripción
   de tareas. Markdown sigue siendo lo que se guarda (compatibilidad total con
   descripciones existentes y con el texto importado de Trello); esto es solo
   la capa que permite que la edición se vea con el formato real, sin mostrar
   los símbolos ** ## etc. Vocabulario deliberadamente acotado a lo que la
   barra de herramientas produce: h1/h2, párrafos, viñetas, numerada, negrita,
   cursiva, tachado y enlaces. Todo en string puro, sin DOM — corre igual en
   el navegador (sobre innerHTML real) y en las pruebas (sin jsdom). */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(text: string): string {
  return escapeHtml(text).replace(/"/g, "&quot;");
}

const HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  "#39": "'",
  apos: "'",
  nbsp: " ",
};

function unescapeHtml(text: string): string {
  return text.replace(/&([a-zA-Z]+|#\d+);/g, (m, code: string) => HTML_ENTITIES[code] ?? m);
}

/** Aplica negrita, cursiva, tachado y enlaces dentro de una línea de texto. */
function inlineMarkdownToHtml(text: string): string {
  let html = escapeHtml(text);
  html = html.replace(/\*\*([^\n]+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/~~([^\n]+?)~~/g, "<s>$1</s>");
  html = html.replace(/_([^\n_]+?)_/g, "<em>$1</em>");
  html = html.replace(/\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, label: string, url: string) => {
    const safeLabel = label.length ? label : url;
    return `<a href="${escapeAttr(url)}">${safeLabel}</a>`;
  });
  return html;
}

export function markdownToHtml(markdown: string): string {
  const text = markdown ?? "";
  if (text.trim().length === 0) return "";

  const blocks = text.split(/\n{2,}/);
  const html = blocks
    .map((block) => {
      const lines = block.split("\n").filter((l) => l.length > 0);
      if (lines.length === 0) return "";

      if (lines.every((l) => /^[-*]\s+/.test(l))) {
        const items = lines.map((l) => `<li>${inlineMarkdownToHtml(l.replace(/^[-*]\s+/, ""))}</li>`);
        return `<ul>${items.join("")}</ul>`;
      }
      if (lines.every((l) => /^\d+\.\s+/.test(l))) {
        const items = lines.map((l) => `<li>${inlineMarkdownToHtml(l.replace(/^\d+\.\s+/, ""))}</li>`);
        return `<ol>${items.join("")}</ol>`;
      }
      if (lines.length === 1 && /^#\s+/.test(lines[0])) {
        return `<h1>${inlineMarkdownToHtml(lines[0].replace(/^#\s+/, ""))}</h1>`;
      }
      if (lines.length === 1 && /^##\s+/.test(lines[0])) {
        return `<h2>${inlineMarkdownToHtml(lines[0].replace(/^##\s+/, ""))}</h2>`;
      }
      return `<p>${lines.map(inlineMarkdownToHtml).join("<br>")}</p>`;
    })
    .filter((b) => b.length > 0);

  return html.join("");
}

type Token = { kind: "open"; tag: string; attrs: string } | { kind: "close"; tag: string } | { kind: "text"; text: string };

function tokenize(html: string): Token[] {
  const tokens: Token[] = [];
  const re = /<(\/?)([a-zA-Z0-9]+)([^>]*)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (m[4] !== undefined) {
      tokens.push({ kind: "text", text: unescapeHtml(m[4]) });
    } else {
      const tag = m[2].toLowerCase();
      tokens.push(m[1] === "/" ? { kind: "close", tag } : { kind: "open", tag, attrs: m[3] });
    }
  }
  return tokens;
}

function extractHref(attrs: string): string | null {
  const m = attrs.match(/href\s*=\s*"([^"]*)"|href\s*=\s*'([^']*)'/i);
  if (!m) return null;
  return unescapeHtml(m[1] ?? m[2] ?? "");
}

function wrapInline(tag: string, inner: string, attrs: string): string {
  if (inner === "") return "";
  switch (tag) {
    case "strong":
    case "b":
      return `**${inner}**`;
    case "em":
    case "i":
      return `_${inner}_`;
    case "s":
    case "strike":
    case "del":
      return `~~${inner}~~`;
    case "a": {
      const href = extractHref(attrs);
      return href ? `[${inner}](${href})` : inner;
    }
    default:
      return inner;
  }
}

/** Parsea contenido en línea hasta encontrar el cierre de `stopTag` (o el final
 *  de los tokens). Recursivo: un tag anidado se resuelve antes de envolver el
 *  suyo, así el orden de los marcadores sale correcto sin una pila manual. */
function parseInline(tokens: Token[], pos: { i: number }, stopTag: string | null): string {
  let out = "";
  while (pos.i < tokens.length) {
    const t = tokens[pos.i];
    if (t.kind === "close") {
      if (stopTag && t.tag === stopTag) {
        pos.i++;
        return out;
      }
      pos.i++; // cierre huérfano/desalineado: se ignora, nunca rompe el parseo
      continue;
    }
    if (t.kind === "text") {
      out += t.text;
      pos.i++;
      continue;
    }
    pos.i++; // abre
    if (t.tag === "br") {
      out += "\n";
      continue;
    }
    const inner = parseInline(tokens, pos, t.tag);
    out += wrapInline(t.tag, inner, t.attrs);
  }
  return out;
}

const BLOCK_TAGS = new Set(["h1", "h2", "p", "div", "ul", "ol"]);

/** Texto y marcas inline (negrita, enlace…) que quedaron sueltos al nivel
 *  superior, sin un párrafo que los envuelva — p. ej. tras un fill() de
 *  prueba que hace textContent = "…", o una línea sin Enter todavía. Se
 *  acumulan como UN solo párrafo hasta el próximo tag de bloque real. */
function flushInlineRun(tokens: Token[], pos: { i: number }, blocks: string[]): void {
  let out = "";
  while (pos.i < tokens.length) {
    const t = tokens[pos.i];
    if (t.kind === "open" && BLOCK_TAGS.has(t.tag)) break;
    if (t.kind === "close") {
      pos.i++; // cierre huérfano de una marca que abrió sin bloque contenedor
      continue;
    }
    if (t.kind === "text") {
      out += t.text;
      pos.i++;
      continue;
    }
    pos.i++; // abre una marca inline (b, strong, em, i, s, strike, a, br…)
    if (t.tag === "br") {
      out += "\n";
      continue;
    }
    const inner = parseInline(tokens, pos, t.tag);
    out += wrapInline(t.tag, inner, t.attrs);
  }
  const trimmed = out.trim();
  if (trimmed) blocks.push(trimmed);
}

function parseBlocks(tokens: Token[]): string[] {
  const blocks: string[] = [];
  const pos = { i: 0 };
  while (pos.i < tokens.length) {
    const t = tokens[pos.i];
    if (t.kind !== "open" || !BLOCK_TAGS.has(t.tag)) {
      if (t.kind === "close") {
        pos.i++; // cierre suelto entre bloques — se ignora
        continue;
      }
      flushInlineRun(tokens, pos, blocks);
      continue;
    }
    pos.i++;

    if (t.tag === "ul" || t.tag === "ol") {
      const items: string[] = [];
      let n = 0;
      while (pos.i < tokens.length && !(tokens[pos.i].kind === "close" && (tokens[pos.i] as { tag: string }).tag === t.tag)) {
        const cur = tokens[pos.i];
        if (cur.kind === "open" && cur.tag === "li") {
          pos.i++;
          const content = parseInline(tokens, pos, "li").trim();
          if (content.length) {
            n += 1;
            items.push(t.tag === "ul" ? `- ${content}` : `${n}. ${content}`);
          }
        } else {
          pos.i++;
        }
      }
      if (pos.i < tokens.length && tokens[pos.i].kind === "close") pos.i++;
      if (items.length) blocks.push(items.join("\n"));
      continue;
    }

    const content = parseInline(tokens, pos, t.tag).trim();
    if (!content) continue;
    if (t.tag === "h1") blocks.push(`# ${content}`);
    else if (t.tag === "h2") blocks.push(`## ${content}`);
    else blocks.push(content); // p, div y cualquier otro contenedor de línea
  }
  return blocks;
}

export function htmlToMarkdown(html: string): string {
  if (!html) return "";
  return parseBlocks(tokenize(html)).join("\n\n");
}
