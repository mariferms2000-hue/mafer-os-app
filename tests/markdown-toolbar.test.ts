import { describe, expect, it } from "vitest";
import {
  toggleBold,
  toggleItalic,
  toggleStrikethrough,
  toggleHeading,
  toNormalText,
  toggleBulletList,
  toggleNumberedList,
  insertLink,
} from "../src/lib/markdown-toolbar";

describe("markdown-toolbar", () => {
  describe("toggleBold", () => {
    it("envuelve la selección con **", () => {
      const res = toggleBold("hola mundo", 5, 10);
      expect(res.text).toBe("hola **mundo**");
    });

    it("sin selección inserta un par vacío con el cursor en medio", () => {
      const res = toggleBold("hola ", 5, 5);
      expect(res.text).toBe("hola ****");
      expect(res.selectionStart).toBe(7);
      expect(res.selectionEnd).toBe(7);
    });

    it("clic de nuevo sobre texto ya envuelto lo desenvuelve", () => {
      const bolded = toggleBold("hola mundo", 5, 10);
      const back = toggleBold(bolded.text, bolded.selectionStart, bolded.selectionEnd);
      expect(back.text).toBe("hola mundo");
    });

    it("no toca el resto del texto (Markdown existente / importado de Trello intacto)", () => {
      const text = "# Encabezado\n\nAlgo con **ya negrita** y una lista:\n- uno\n- dos";
      const start = text.indexOf("una lista");
      const res = toggleBold(text, start, start + "una lista".length);
      expect(res.text).toContain("# Encabezado");
      expect(res.text).toContain("- uno\n- dos");
      expect(res.text).toContain("**ya negrita**");
      expect(res.text).toContain("**una lista**");
    });
  });

  describe("toggleItalic / toggleStrikethrough", () => {
    it("cursiva usa guión bajo", () => {
      expect(toggleItalic("hola mundo", 5, 10).text).toBe("hola _mundo_");
    });
    it("tachado usa doble virgulilla", () => {
      expect(toggleStrikethrough("hola mundo", 5, 10).text).toBe("hola ~~mundo~~");
    });
  });

  describe("toggleHeading", () => {
    it("título (nivel 1) prefija la línea con #", () => {
      const res = toggleHeading("hola mundo", 0, 4, 1);
      expect(res.text).toBe("# hola mundo");
    });
    it("subtítulo (nivel 2) prefija con ##", () => {
      const res = toggleHeading("hola mundo", 0, 4, 2);
      expect(res.text).toBe("## hola mundo");
    });
    it("aplicar el mismo nivel dos veces vuelve a texto normal (toggle)", () => {
      const once = toggleHeading("hola mundo", 0, 4, 1);
      const twice = toggleHeading(once.text, once.selectionStart, once.selectionEnd, 1);
      expect(twice.text).toBe("hola mundo");
    });
    it("cambiar de título a subtítulo reemplaza el marcador, no lo apila", () => {
      const titulo = toggleHeading("hola mundo", 0, 4, 1);
      const sub = toggleHeading(titulo.text, titulo.selectionStart, titulo.selectionEnd, 2);
      expect(sub.text).toBe("## hola mundo");
    });
    it("aplica a varias líneas seleccionadas", () => {
      const text = "uno\ndos\ntres";
      const res = toggleHeading(text, 0, text.length, 2);
      expect(res.text).toBe("## uno\n## dos\n## tres");
    });
  });

  describe("toNormalText", () => {
    it("quita encabezado, viñeta o numeración de la línea", () => {
      expect(toNormalText("## hola", 0, 3).text).toBe("hola");
      expect(toNormalText("- hola", 0, 2).text).toBe("hola");
      expect(toNormalText("3. hola", 0, 2).text).toBe("hola");
    });
    it("texto ya normal queda intacto", () => {
      expect(toNormalText("hola mundo", 0, 4).text).toBe("hola mundo");
    });
  });

  describe("toggleBulletList", () => {
    it("prefija cada línea seleccionada con guión", () => {
      const text = "uno\ndos\ntres";
      const res = toggleBulletList(text, 0, text.length);
      expect(res.text).toBe("- uno\n- dos\n- tres");
    });
    it("toggle: aplicar de nuevo quita las viñetas", () => {
      const text = "uno\ndos";
      const on = toggleBulletList(text, 0, text.length);
      const off = toggleBulletList(on.text, on.selectionStart, on.selectionEnd);
      expect(off.text).toBe("uno\ndos");
    });
    it("no numera ni deja marcador en líneas vacías dentro del bloque", () => {
      const text = "uno\n\ndos";
      const res = toggleBulletList(text, 0, text.length);
      expect(res.text).toBe("- uno\n\n- dos");
    });
  });

  describe("toggleNumberedList", () => {
    it("numera secuencialmente cada línea seleccionada", () => {
      const text = "uno\ndos\ntres";
      const res = toggleNumberedList(text, 0, text.length);
      expect(res.text).toBe("1. uno\n2. dos\n3. tres");
    });
    it("toggle: aplicar de nuevo quita la numeración", () => {
      const text = "uno\ndos";
      const on = toggleNumberedList(text, 0, text.length);
      const off = toggleNumberedList(on.text, on.selectionStart, on.selectionEnd);
      expect(off.text).toBe("uno\ndos");
    });
    it("cambiar de viñetas a numerada reemplaza el marcador, no lo apila", () => {
      const text = "uno\ndos";
      const bullets = toggleBulletList(text, 0, text.length);
      const numbered = toggleNumberedList(bullets.text, bullets.selectionStart, bullets.selectionEnd);
      expect(numbered.text).toBe("1. uno\n2. dos");
    });
  });

  describe("insertLink", () => {
    it("envuelve la selección como texto del enlace y deja «url» seleccionado", () => {
      const text = "visita mi sitio hoy";
      const start = text.indexOf("mi sitio");
      const res = insertLink(text, start, start + "mi sitio".length);
      expect(res.text).toBe("visita [mi sitio](url) hoy");
      expect(res.text.slice(res.selectionStart, res.selectionEnd)).toBe("url");
    });
    it("sin selección inserta un placeholder «texto»", () => {
      const res = insertLink("", 0, 0);
      expect(res.text).toBe("[texto](url)");
    });
  });

  describe("preservación de Markdown existente / importado", () => {
    it("una operación sobre una línea no reescribe el resto del documento", () => {
      const trello = "## Historia importada\n\nPasos:\n1. abrir\n2. revisar\n\n[Ver original](https://trello.com/x)";
      const lineStart = trello.indexOf("abrir");
      const res = toggleBold(trello, lineStart, lineStart + "abrir".length);
      expect(res.text).toBe(
        "## Historia importada\n\nPasos:\n1. **abrir**\n2. revisar\n\n[Ver original](https://trello.com/x)"
      );
    });
  });
});
