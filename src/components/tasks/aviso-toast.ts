/** Si una acción de tarea guardó el cambio pero Google rechazó el aviso, lo
 *  dice en un mensaje aparte (el de «Deshacer» sigue intacto). Nunca se calla. */
export function warnAviso(
  toast: { show: (t: { tone: "warn"; message: string; link: { label: string; href: string }; duration: number }) => void },
  res: unknown
) {
  const error = (res as { avisoError?: string } | null | undefined)?.avisoError;
  if (!error) return;
  toast.show({
    tone: "warn",
    message: `El cambio se guardó, pero el aviso de Google no: ${error}`,
    link: { label: "Ver avisos", href: "/ajustes#avisos" },
    duration: 12000,
  });
}
