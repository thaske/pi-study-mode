import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { briefSummary, sessionBriefPrompt, statusLines } from "./content";
import { ensureStudyFiles, loadState, saveState } from "./state";
import type { StudyState } from "./types";
import { updateUi } from "./ui";

type StateCache = {
  get(): StudyState | undefined;
  set(state: StudyState | undefined): void;
};

export function registerStudyCommand(
  pi: ExtensionAPI,
  cache: StateCache,
): void {
  pi.registerCommand("study", {
    description:
      "Study mode: /study start <topic>, resume, pause [note], status, help",
    handler: async (args, ctx) => {
      const [subcommandRaw, ...rest] = args.trim().split(/\s+/).filter(Boolean);
      const subcommand = subcommandRaw ?? "status";
      const argText = rest.join(" ");

      if (subcommand === "help") {
        ctx.ui.notify(
          "/study start <topic> | /study resume | /study pause [note] | /study status | /study help",
          "info",
        );
        return;
      }

      if (subcommand === "start") {
        const topic =
          argText ||
          (ctx.hasUI
            ? await ctx.ui.input("Study topic", "What do you want to learn?")
            : undefined);
        if (!topic) {
          ctx.ui.notify("Study start cancelled: no topic provided.", "warning");
          return;
        }
        const state = await ensureStudyFiles(ctx.cwd, topic);
        cache.set(state);
        pi.setSessionName(`Study: ${topic}`);
        updateUi(ctx, state);
        ctx.ui.notify(
          `Study mode started. Curriculum: ${state.curriculumPath}`,
          "info",
        );
        pi.sendUserMessage(
          `Study mode is now active for "${topic}". Before finalizing the curriculum, run a brief placement diagnostic: ask me 3-5 short questions to determine my current level, goals, preferred project scale, feedback cadence, desired pace, and appetite for challenge. Include only tiny skill checks that help choose a starting project. Ask a compact numbered set, then wait for my answers. After checking my responses, update study progress with learnerLevel, preferredCadence, preferredProjectScale, desiredFriction, and a terse, neutral assessmentSummary focused on learning needs, not biography. Do not repeat that summary back to me in normal replies; use it only to calibrate difficulty. Then tailor ${state.curriculumPath} as an exploratory project map. Propose 2-3 project tracks or expedition branches and ask me to choose or adapt one. Once chosen, give me a bundled work block large enough for a meaningful independent stretch, not a tiny task. Prefer feature sets over single-function checkpoints; provide setup code, contracts, tests, and compile/run commands, but not finished implementations. Include objective, artifact, constraints/success criteria, suggested timebox, review trigger, and optional branches. Remember: open-ended enough to explore; bounded enough to review. Do not give me finished answers; coach me through planning, writing, revising, and reviewing medium-sized artifacts, and move on once I demonstrate the core idea.`,
        );
        return;
      }

      const state = await loadState(ctx.cwd);
      cache.set(state);
      if (!state) {
        ctx.ui.notify(
          "No study state here. Run /study start <topic>.",
          "warning",
        );
        return;
      }

      if (subcommand === "status") {
        ctx.ui.notify(statusLines(state).join("\n"), "info");
        return;
      }

      if (subcommand === "pause") {
        if (argText)
          state.notes.push({
            at: new Date().toISOString(),
            kind: "general",
            text: `Paused: ${argText}`,
          });
        state.active = false;
        await saveState(ctx.cwd, state);
        updateUi(ctx, state);
        ctx.ui.notify(
          `Study mode paused. Resume later with /study resume. Work block: ${briefSummary(state.sessionBrief)}`,
          "info",
        );
        return;
      }

      if (subcommand === "resume" || subcommand === "continue") {
        state.active = true;
        await saveState(ctx.cwd, state);
        updateUi(ctx, state);
        pi.sendUserMessage(
          `Resume Study Mode for "${state.topic}" from the saved progress. Orient me briefly, then continue from this bounded work block:\n${sessionBriefPrompt(state.sessionBrief)}\nCurrent area: ${state.currentArea ?? "TBD"}. Current project: ${state.currentProject ?? "TBD"}. Current milestone: ${state.currentMilestone ?? "TBD"}. If the saved block is too tiny, too granular, or vague, replace it with a broader bundled work block or feature slice before continuing.`,
        );
        return;
      }

      ctx.ui.notify(
        `Unknown /study command: ${subcommand}. Try /study help.`,
        "warning",
      );
    },
  });
}
