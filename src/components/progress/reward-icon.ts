import { Droplets, Sprout, type LucideIcon } from "lucide-react";
import type { RewardItem } from "@/lib/progress/logic";

/** Ícono de cada recurso: el elemento visual principal en el inventario y en
 *  la tarjeta de recompensa (nunca emojis). */
export const REWARD_ICON: Record<RewardItem, LucideIcon> = { agua: Droplets, fertilizante: Sprout };
