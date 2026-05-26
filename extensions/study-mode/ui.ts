import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { StudyState } from "./types";

function compactLabel(
  text: string | undefined,
  fallback: string,
  maxWords: number,
): string {
  if (!text) return fallback;
  const cleaned = text.replace(/^Module\s+\d+\s*:\s*/i, "").trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  return words.length > maxWords
    ? `${words.slice(0, maxWords).join(" ")}…`
    : cleaned;
}

export function updateUi(ctx: ExtensionContext, state?: StudyState): void {
  if (!ctx.hasUI) return;
  if (!state?.active) {
    ctx.ui.setStatus("study-mode", undefined);
    ctx.ui.setWidget("study-mode", undefined);
    return;
  }
  const now = compactLabel(
    state.currentArea ?? state.currentProject,
    "study",
    6,
  );
  ctx.ui.setStatus("study-mode", ctx.ui.theme.fg("accent", `📚 Now: ${now}`));
  ctx.ui.setWidget("study-mode", undefined);
}
