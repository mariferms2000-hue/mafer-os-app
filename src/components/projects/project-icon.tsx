import {
  Folder,
  Stethoscope,
  BookOpen,
  Sparkles,
  Users,
  Heart,
  Leaf,
  Palette,
  GraduationCap,
  Briefcase,
  Camera,
  PenLine,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  folder: Folder,
  stethoscope: Stethoscope,
  book: BookOpen,
  sparkles: Sparkles,
  users: Users,
  heart: Heart,
  leaf: Leaf,
  palette: Palette,
  graduation: GraduationCap,
  briefcase: Briefcase,
  camera: Camera,
  pen: PenLine,
};

export const PROJECT_ICON_OPTIONS = Object.keys(ICONS);

export function ProjectIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Folder;
  return (
    <span
      className={`inline-flex items-center justify-center rounded-xl bg-sage-soft text-forest shrink-0 ${className ?? "h-9 w-9"}`}
    >
      <Icon size={18} aria-hidden />
    </span>
  );
}
