"use client";

import { useEffect } from "react";

/** Quita «?recompensa=» de la URL al llegar desde «Ver jardín»: la ficha
 *  brilla una sola vez, no en cada recarga. Sin navegación ni re-render. */
export function ClearRewardParam() {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("recompensa")) return;
    url.searchParams.delete("recompensa");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }, []);
  return null;
}
