/** Se ejecuta antes del primer render (inline en <head>) para evitar
 *  parpadeo/salto de tamaño al cargar. No puede importar TypeScript —
 *  reimplementa a mano las mismas bases y factores que
 *  src/lib/font-size.ts (FONT_SIZE_SCALE y FONT_CATEGORY_VARS).
 *  Si esos valores cambian ahí, actualizar aquí también. */
export const FONT_SIZE_INIT_SCRIPT = `(function(){try{var SCALE={pequeno:0.88,normal:1,grande:1.15};var VARS={titulos:[["--text-lg",1.125],["--text-xl",1.25],["--text-2xl",1.5],["--text-3xl",1.875]],botones:[["--btn-font-size",0.875]],cuerpo:[["--text-xs",0.75],["--text-sm",0.875],["--text-base",1]],etiquetas:[["--label-font-size",0.75],["--chip-font-size",0.72],["--eyebrow-font-size",0.72]],campos:[["--field-font-size",0.9]]};var raw=localStorage.getItem('mafer-font-sizes');var prefs=raw?JSON.parse(raw):{};var h=document.documentElement;for(var cat in VARS){var level=(prefs[cat]==='pequeno'||prefs[cat]==='grande')?prefs[cat]:'normal';var factor=SCALE[level];var list=VARS[cat];for(var i=0;i<list.length;i++){h.style.setProperty(list[i][0],(Math.round(list[i][1]*factor*1000)/1000)+'rem');}}}catch(e){}})();`;
