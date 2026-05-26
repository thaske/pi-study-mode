import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { curriculumTemplate, writeProgressMarkdown } from "./content";
import { readJson, writeText } from "./files";
import { curriculumPath, progressPath, statePath, studyDir } from "./paths";
import type { StudyState } from "./types";

export function emptyState(
  cwd: string,
  topic = "unspecified topic",
): StudyState {
  const now = new Date().toISOString();
  return {
    active: true,
    topic,
    curriculumPath: curriculumPath(cwd),
    progressPath: progressPath(cwd),
    learnerLevel: "unknown",
    preferredCadence: "balanced",
    preferredProjectScale: "medium",
    desiredFriction: "normal",
    completedMilestones: [],
    notes: [],
    updatedAt: now,
  };
}

export function migrateState(state: StudyState): StudyState {
  delete (state as StudyState & { srs?: unknown }).srs;
  state.completedMilestones ??= state.completed ?? [];
  state.notes ??= [];
  state.learnerLevel ??= "unknown";
  state.preferredCadence ??= "balanced";
  state.preferredProjectScale ??= "medium";
  state.desiredFriction ??= "normal";
  state.currentArea ??= state.currentModule;
  state.currentMilestone ??= state.currentLesson;
  if (!state.currentProject && state.currentLesson)
    state.currentProject = state.currentLesson;
  if (!state.sessionBrief && state.nextStep) {
    state.sessionBrief = {
      objective: state.nextStep,
      reviewTrigger:
        "Return with the artifact, a design note, output, or the first blocker that needs review.",
    };
  }
  return state;
}

export async function loadState(cwd: string): Promise<StudyState | undefined> {
  const state = await readJson<StudyState>(statePath(cwd));
  return state ? migrateState(state) : undefined;
}

export async function saveState(cwd: string, state: StudyState): Promise<void> {
  state.updatedAt = new Date().toISOString();
  state.completed = undefined;
  state.currentModule = undefined;
  state.currentLesson = undefined;
  state.nextStep = undefined;
  await writeText(statePath(cwd), JSON.stringify(state, null, 2) + "\n");
  await writeProgressMarkdown(state);
}

export async function ensureStudyFiles(
  cwd: string,
  topic: string,
): Promise<StudyState> {
  const dir = studyDir(cwd);
  await mkdir(dir, { recursive: true });
  let state = await loadState(cwd);
  if (!state) state = emptyState(cwd, topic);
  state.active = true;
  state.topic = topic || state.topic;
  state.curriculumPath = curriculumPath(cwd);
  state.progressPath = progressPath(cwd);
  migrateState(state);

  if (!existsSync(state.curriculumPath)) {
    await writeText(state.curriculumPath, curriculumTemplate(state.topic));
  }
  await saveState(cwd, state);
  return state;
}
