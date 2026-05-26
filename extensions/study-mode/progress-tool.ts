import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { statusLines } from "./content";
import { ProgressParams } from "./schema";
import { ensureStudyFiles, loadState, saveState } from "./state";
import type { StudyState } from "./types";
import { updateUi } from "./ui";

type StateCache = {
  set(state: StudyState | undefined): void;
};

export function registerStudyProgressTool(
  pi: ExtensionAPI,
  cache: StateCache,
): void {
  pi.registerTool({
    name: "study_update_progress",
    label: "Study Progress",
    description:
      "Update or inspect Pi Study Mode progress files. Use this after meaningful learner progress, completed artifacts/reviews, important notes, pace/preferences, or changes to the next bundled work block.",
    promptSnippet: "Update or inspect the active study curriculum progress",
    promptGuidelines: [
      "Use study_update_progress whenever Study Mode is active and the learner completes a milestone/artifact, shows a misconception, changes exploration area/project, changes pace preferences, saves a stopping point, or receives a new bundled work block. Prefer storing feature slices over tiny next steps.",
    ],
    parameters: ProgressParams,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      let state = await loadState(ctx.cwd);
      if (!state) {
        state = await ensureStudyFiles(ctx.cwd, "unspecified topic");
      }

      const currentArea = params.currentArea ?? params.currentModule;
      const currentMilestone = params.currentMilestone ?? params.currentLesson;
      const completedMilestone =
        params.completedMilestone ?? params.completedItem;
      const nextWorkBlock = params.nextWorkBlock ?? params.nextStep;

      if (currentArea) state.currentArea = currentArea;
      if (params.currentProject) state.currentProject = params.currentProject;
      if (currentMilestone) state.currentMilestone = currentMilestone;
      if (params.learnerLevel) state.learnerLevel = params.learnerLevel;
      if (params.assessmentSummary)
        state.assessmentSummary = params.assessmentSummary;
      if (params.preferredCadence)
        state.preferredCadence = params.preferredCadence;
      if (params.preferredProjectScale)
        state.preferredProjectScale = params.preferredProjectScale;
      if (params.desiredFriction)
        state.desiredFriction = params.desiredFriction;
      if (params.sessionBrief) state.sessionBrief = params.sessionBrief;
      if (nextWorkBlock && !params.sessionBrief) {
        state.sessionBrief = {
          ...(state.sessionBrief ?? {}),
          objective: nextWorkBlock,
          reviewTrigger:
            state.sessionBrief?.reviewTrigger ??
            "Return with the artifact, output, design notes, or the first blocker that needs review.",
        };
      }
      if (params.action === "save") state.active = false;

      if (
        (params.action === "complete" || completedMilestone) &&
        completedMilestone
      ) {
        if (!state.completedMilestones.includes(completedMilestone))
          state.completedMilestones.push(completedMilestone);
      }

      if ((params.action === "note" || params.note) && params.note) {
        state.notes.push({
          at: new Date().toISOString(),
          kind: params.noteKind ?? "general",
          text: params.note,
        });
      }

      await saveState(ctx.cwd, state);
      cache.set(state);
      updateUi(ctx, state);

      return {
        content: [{ type: "text", text: statusLines(state).join("\n") }],
        details: { state },
      };
    },
    renderCall(args, theme) {
      return new Text(
        theme.fg("toolTitle", theme.bold("study_update_progress ")) +
          theme.fg("muted", args.action),
        0,
        0,
      );
    },
    renderResult(result, _options, theme) {
      const text =
        result.content[0]?.type === "text"
          ? result.content[0].text
          : "Study progress updated.";
      return new Text(
        theme.fg("success", "✓ ") + theme.fg("muted", text),
        0,
        0,
      );
    },
  });
}
