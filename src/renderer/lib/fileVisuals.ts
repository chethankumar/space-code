import type { LucideIcon } from "lucide-react";
import {
  File as FileIcon,
  FileArchive,
  FileCode2,
  FileCog,
  FileImage,
  FileJson2,
  FileSpreadsheet,
  FileTerminal,
  FileText,
  FileType2,
  Package
} from "lucide-react";

export type FileVisual = {
  icon: LucideIcon;
  className: string;
};

export function getFileVisual(name: string): FileVisual {
  const lowerName = name.toLowerCase();
  const extension = lowerName.includes(".") ? lowerName.split(".").pop() ?? "" : "";

  if (
    ["ts", "tsx", "js", "jsx", "mjs", "cjs", "py", "rs", "go", "java", "kt", "swift", "rb", "php", "c", "cc", "cpp", "h", "hpp"].includes(
      extension
    )
  ) {
    return { icon: FileCode2, className: "file-entry__icon--code" };
  }

  if (["json", "jsonc"].includes(extension)) {
    return { icon: FileJson2, className: "file-entry__icon--json" };
  }

  if (["md", "mdx", "txt", "rtf"].includes(extension)) {
    return { icon: FileText, className: "file-entry__icon--text" };
  }

  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "ico", "avif"].includes(extension)) {
    return { icon: FileImage, className: "file-entry__icon--image" };
  }

  if (["sh", "bash", "zsh", "fish", "env"].includes(extension) || lowerName === "dockerfile") {
    return { icon: FileTerminal, className: "file-entry__icon--shell" };
  }

  if (
    ["yaml", "yml", "toml", "ini", "conf", "config"].includes(extension) ||
    lowerName.endsWith(".config.js") ||
    lowerName.endsWith(".config.ts")
  ) {
    return { icon: FileCog, className: "file-entry__icon--config" };
  }

  if (["csv", "tsv", "xls", "xlsx"].includes(extension)) {
    return { icon: FileSpreadsheet, className: "file-entry__icon--sheet" };
  }

  if (["zip", "tar", "gz", "tgz", "rar", "7z"].includes(extension)) {
    return { icon: FileArchive, className: "file-entry__icon--archive" };
  }

  if (["lock"].includes(extension) || lowerName.includes("package-lock") || lowerName.includes("pnpm-lock")) {
    return { icon: Package, className: "file-entry__icon--package" };
  }

  if (["html", "css", "scss", "less", "xml"].includes(extension)) {
    return { icon: FileType2, className: "file-entry__icon--markup" };
  }

  return { icon: FileIcon, className: "file-entry__icon--default" };
}
