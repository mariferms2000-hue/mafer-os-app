import { describe, expect, it } from "vitest";
import { markdownToHtml, htmlToMarkdown } from "../src/lib/markdown-html";

describe("markdownToHtml", () => {
  it("convierte encabezados", () => {
    expect(markdownToHtml("# Título")).toBe("<h1>Título</h1>");
    expect(markdownToHtml("## Subtítulo")).toBe("<h2>Subtítulo</h2>");
  });

  it("convierte negrita, cursiva y tachado", () => {
    expect(markdownToHtml("hola **mundo**")).toBe("<p>hola <strong>mundo</strong></p>");
    expect(markdownToHtml("hola _mundo_")).toBe("<p>hola <em>mundo</em></p>");
    expect(markdownToHtml("hola ~~mundo~~")).toBe("<p>hola <s>mundo</s></p>");
  });

  it("convierte viñetas y lista numerada", () => {
    expect(markdownToHtml("- uno\n- dos")).toBe("<ul><li>uno</li><li>dos</li></ul>");
    expect(markdownToHtml("1. uno\n2. dos")).toBe("<ol><li>uno</li><li>dos</li></ol>");
  });

  it("convierte un enlace", () => {
    expect(markdownToHtml("visita [mi sitio](https://ejemplo.com)")).toBe(
      '<p>visita <a href="https://ejemplo.com">mi sitio</a></p>'
    );
  });

  it("separa párrafos por línea en blanco y conserva saltos simples con <br>", () => {
    expect(markdownToHtml("uno\ndos\n\ntres")).toBe("<p>uno<br>dos</p><p>tres</p>");
  });

  it("escapa HTML dentro del texto plano (Trello puede traer < o &)", () => {
    expect(markdownToHtml("a < b & c > d")).toBe("<p>a &lt; b &amp; c &gt; d</p>");
  });

  it("texto vacío o solo espacios produce HTML vacío", () => {
    expect(markdownToHtml("")).toBe("");
    expect(markdownToHtml("   \n\n  ")).toBe("");
  });
});

describe("htmlToMarkdown", () => {
  it("convierte encabezados de vuelta", () => {
    expect(htmlToMarkdown("<h1>Título</h1>")).toBe("# Título");
    expect(htmlToMarkdown("<h2>Subtítulo</h2>")).toBe("## Subtítulo");
  });

  it("convierte negrita, cursiva, tachado y enlace de vuelta", () => {
    expect(htmlToMarkdown("<p>hola <strong>mundo</strong></p>")).toBe("hola **mundo**");
    expect(htmlToMarkdown("<p>hola <em>mundo</em></p>")).toBe("hola _mundo_");
    expect(htmlToMarkdown("<p>hola <s>mundo</s></p>")).toBe("hola ~~mundo~~");
    expect(htmlToMarkdown('<p>visita <a href="https://ejemplo.com">mi sitio</a></p>')).toBe(
      "visita [mi sitio](https://ejemplo.com)"
    );
  });

  it("convierte viñetas y numerada de vuelta, renumerando secuencialmente", () => {
    expect(htmlToMarkdown("<ul><li>uno</li><li>dos</li></ul>")).toBe("- uno\n- dos");
    expect(htmlToMarkdown("<ol><li>uno</li><li>dos</li></ol>")).toBe("1. uno\n2. dos");
  });

  it("acepta las etiquetas reales que produce execCommand en distintos navegadores", () => {
    // Chrome/Firefox suelen envolver cada línea en <div>; Safari usa <b>/<i>/<strike>.
    expect(htmlToMarkdown("<div>hola <b>mundo</b></div>")).toBe("hola **mundo**");
    expect(htmlToMarkdown("<div>hola <i>mundo</i></div>")).toBe("hola _mundo_");
    expect(htmlToMarkdown("<div>hola <strike>mundo</strike></div>")).toBe("hola ~~mundo~~");
  });

  it("resuelve negrita y cursiva combinadas sin importar el orden de anidado", () => {
    expect(htmlToMarkdown("<p><strong><em>fuerte</em></strong></p>")).toBe("**_fuerte_**");
    expect(htmlToMarkdown("<p><em><strong>fuerte</strong></em></p>")).toBe("_**fuerte**_");
  });

  it("convierte <br> dentro de un párrafo en un salto de línea simple", () => {
    expect(htmlToMarkdown("<p>uno<br>dos</p>")).toBe("uno\ndos");
  });

  it("desescapa entidades HTML", () => {
    expect(htmlToMarkdown("<p>a &lt; b &amp; c &gt; d</p>")).toBe("a < b & c > d");
  });

  it("ignora párrafos vacíos (p. ej. una línea vacía suelta de contentEditable)", () => {
    expect(htmlToMarkdown("<p>hola</p><p><br></p><p>mundo</p>")).toBe("hola\n\nmundo");
  });

  it("cadena vacía produce Markdown vacío", () => {
    expect(htmlToMarkdown("")).toBe("");
  });

  it("texto suelto en el nivel superior, sin párrafo que lo envuelva, no se pierde", () => {
    expect(htmlToMarkdown("Descripción escrita desde el detalle.")).toBe("Descripción escrita desde el detalle.");
  });

  it("una marca inline suelta al nivel superior (sin <p>/<div>) se funde con el texto vecino, no en un bloque separado", () => {
    // Chrome deja esto así cuando negrita se aplica sobre una línea que
    // todavía no tiene ningún párrafo contenedor.
    expect(htmlToMarkdown("hola <b>mundo</b>")).toBe("hola **mundo**");
    expect(htmlToMarkdown('visita <a href="https://ejemplo.com">esto</a> ahora')).toBe(
      "visita [esto](https://ejemplo.com) ahora"
    );
  });
});

describe("round-trip Markdown -> HTML -> Markdown", () => {
  const samples = [
    "# Historia importada de Trello",
    "## Subtítulo",
    "Texto plano sin formato, como la mayoría de lo importado de Trello.",
    "Un párrafo con **negrita**, _cursiva_ y ~~tachado~~ mezclados.",
    "- uno\n- dos\n- tres",
    "1. abrir\n2. revisar\n3. cerrar",
    "Visita [la tarjeta original](https://trello.com/c/abc123) para más contexto.",
    "Primer párrafo.\n\nSegundo párrafo con **negrita** y un [enlace](https://ejemplo.com).",
  ];

  it.each(samples)("es estable para: %s", (markdown) => {
    const html = markdownToHtml(markdown);
    const back = htmlToMarkdown(html);
    expect(back).toBe(markdown);
    // un segundo ciclo debe quedar exactamente igual (idempotente)
    expect(htmlToMarkdown(markdownToHtml(back))).toBe(back);
  });

  it("una edición puntual no reescribe el resto del documento importado", () => {
    const trello = "## Historia importada\n\nPasos:\n1. abrir\n2. revisar\n\n[Ver original](https://trello.com/x)";
    const html = markdownToHtml(trello);
    expect(htmlToMarkdown(html)).toBe(trello);
  });
});
