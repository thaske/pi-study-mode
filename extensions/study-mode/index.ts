import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { registerStudyCommand } from "./commands";
import { teachingPrompt } from "./content";
import { registerStudyProgressTool } from "./progress-tool";
import { loadState } from "./state";
import type { StudyState } from "./types";
import { updateUi } from "./ui";

export default function studyMode(pi: ExtensionAPI): void {
  let cachedState: StudyState | undefined;

  const cache = {
    get: () => cachedState,
    set: (state: StudyState | undefined) => {
      cachedState = state;
    },
  };

  async function refresh(ctx: ExtensionContext): Promise<void> {
    cachedState = await loadState(ctx.cwd);
    updateUi(ctx, cachedState);
  }

  pi.on("session_start", async (_event, ctx) => refresh(ctx));
  pi.on("session_tree", async (_event, ctx) => refresh(ctx));

  pi.on("before_agent_start", async (event, ctx) => {
    await refresh(ctx);
    if (!cachedState?.active) return;
    return { systemPrompt: event.systemPrompt + teachingPrompt(cachedState) };
  });

  registerStudyCommand(pi, cache);
  registerStudyProgressTool(pi, cache);
}
