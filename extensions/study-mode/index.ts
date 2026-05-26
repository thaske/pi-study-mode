import { StringEnum } from "@earendil-works/pi-ai";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Type } from "typebox";

type LearnerLevel =
  | "new"
  | "beginner"
  | "intermediate"
  | "advanced"
  | "unknown";
type CadencePreference = "tight" | "balanced" | "open";
type ProjectScale = "small" | "medium" | "large";
type FrictionLevel = "gentle" | "normal" | "challenging";
type NoteKind =
  | "concept"
  | "review"
  | "misconception"
  | "decision"
  | "pace"
  | "general";

interface SessionBrief {
  objective?: string;
  artifact?: string;
  constraints?: string[];
  suggestedTimebox?: string;
  reviewTrigger?: string;
  optionalBranches?: string[];
}

interface StudyState {
  active: boolean;
  topic: string;
  curriculumPath: string;
  progressPath: string;
  learnerLevel?: LearnerLevel;
  assessmentSummary?: string;
  preferredCadence?: CadencePreference;
  preferredProjectScale?: ProjectScale;
  desiredFriction?: FrictionLevel;
  currentArea?: string;
  currentProject?: string;
  currentMilestone?: string;
  sessionBrief?: SessionBrief;
  completedMilestones: string[];
  notes: Array<{ at: string; text: string; kind?: NoteKind }>;
  updatedAt: string;

  // Legacy fields kept for migration from earlier study-state.json versions.
  currentModule?: string;
  currentLesson?: string;
  completed?: string[];
  nextStep?: string;
}

const SessionBriefParams = Type.Object({
  objective: Type.Optional(
    Type.String({ description: "Goal for the next bounded work block" }),
  ),
  artifact: Type.Optional(
    Type.String({ description: "Concrete thing the learner should produce" }),
  ),
  constraints: Type.Optional(
    Type.Array(
      Type.String({
        description: "Boundary, requirement, or success criterion",
      }),
    ),
  ),
  suggestedTimebox: Type.Optional(
    Type.String({
      description: "Suggested independent work duration, e.g. 45-120 minutes",
    }),
  ),
  reviewTrigger: Type.Optional(
    Type.String({
      description: "When the learner should return for coaching/review",
    }),
  ),
  optionalBranches: Type.Optional(
    Type.Array(
      Type.String({
        description: "Optional curiosity branch or stretch direction",
      }),
    ),
  ),
});

const ProgressParams = Type.Object({
  action: StringEnum([
    "status",
    "update",
    "complete",
    "note",
    "set_session_brief",
    "set_next_step",
    "save",
  ] as const),
  currentArea: Type.Optional(
    Type.String({ description: "Current broad exploration area" }),
  ),
  currentProject: Type.Optional(
    Type.String({ description: "Current project, artifact, or track" }),
  ),
  currentMilestone: Type.Optional(
    Type.String({ description: "Current milestone or review focus" }),
  ),
  sessionBrief: Type.Optional(SessionBriefParams),
  preferredCadence: Type.Optional(
    StringEnum(["tight", "balanced", "open"] as const),
  ),
  preferredProjectScale: Type.Optional(
    StringEnum(["small", "medium", "large"] as const),
  ),
  desiredFriction: Type.Optional(
    StringEnum(["gentle", "normal", "challenging"] as const),
  ),
  learnerLevel: Type.Optional(
    StringEnum([
      "new",
      "beginner",
      "intermediate",
      "advanced",
      "unknown",
    ] as const),
  ),
  assessmentSummary: Type.Optional(
    Type.String({
      description:
        "Terse, neutral placement notes used only to adapt instruction; avoid biography or identity labels",
    }),
  ),
  completedMilestone: Type.Optional(
    Type.String({
      description:
        "A completed artifact, milestone, review, or substantial checkpoint",
    }),
  ),
  note: Type.Optional(
    Type.String({
      description:
        "Brief learner progress note, misconception, design decision, or pace preference",
    }),
  ),
  noteKind: Type.Optional(
    StringEnum([
      "concept",
      "review",
      "misconception",
      "decision",
      "pace",
      "general",
    ] as const),
  ),
  nextWorkBlock: Type.Optional(
    Type.String({
      description:
        "Short fallback resume contract if no structured sessionBrief is supplied",
    }),
  ),

  // Backward-compatible aliases for older prompts/skills.
  currentModule: Type.Optional(
    Type.String({ description: "Legacy alias for currentArea" }),
  ),
  currentLesson: Type.Optional(
    Type.String({ description: "Legacy alias for currentMilestone" }),
  ),
  completedItem: Type.Optional(
    Type.String({ description: "Legacy alias for completedMilestone" }),
  ),
  nextStep: Type.Optional(
    Type.String({ description: "Legacy alias for nextWorkBlock" }),
  ),
});

function studyDir(cwd: string): string {
  return join(cwd, ".pi", "study");
}

function statePath(cwd: string): string {
  return join(studyDir(cwd), "study-state.json");
}

function curriculumPath(cwd: string): string {
  return join(studyDir(cwd), "CURRICULUM.md");
}

function progressPath(cwd: string): string {
  return join(studyDir(cwd), "PROGRESS.md");
}

async function readJson<T>(path: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch {
    return undefined;
  }
}

async function writeText(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
}

function emptyState(cwd: string, topic = "unspecified topic"): StudyState {
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

function migrateState(state: StudyState): StudyState {
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

async function loadState(cwd: string): Promise<StudyState | undefined> {
  const state = await readJson<StudyState>(statePath(cwd));
  return state ? migrateState(state) : undefined;
}

async function saveState(cwd: string, state: StudyState): Promise<void> {
  state.updatedAt = new Date().toISOString();
  state.completed = undefined;
  state.currentModule = undefined;
  state.currentLesson = undefined;
  state.nextStep = undefined;
  await writeText(statePath(cwd), JSON.stringify(state, null, 2) + "\n");
  await writeProgressMarkdown(state);
}

function curriculumTemplate(topic: string): string {
  return `# Study Curriculum: ${topic}\n\n> Generated by Pi Study Mode. Treat this as a living expedition map, not a rigid syllabus. The goal is: open-ended enough to explore; bounded enough to review.\n\n## Learning Goal\n\nDescribe what you want to be able to build, understand, or explore with ${topic}.\n\n## Placement / Starting Point\n\nBefore finalizing the map, ask 3-5 short diagnostic questions to determine the learner's current level, goals, preferred project scale, feedback cadence, desired pace, and appetite for challenge. Keep placement notes terse and focused on learning needs, not biography. Update this section after checking their answers.\n\n- Placement level: unknown\n- Current learning needs:\n- Gaps / misconceptions:\n- Preferred project scale: medium\n- Preferred cadence: balanced\n- Desired friction: normal\n\n## Exploration Tracks\n\n### Track A: Build Something Useful\n\nA medium-sized artifact that forces the main ideas to appear naturally. Each milestone should produce code, notes, tests, output, a design sketch, or a debugging trace that can be reviewed.\n\nPossible milestones:\n1. First working slice\n2. Real input/output or realistic data\n3. Error handling and edge cases\n4. Refactor after pain appears\n5. Explain design tradeoffs and next branches\n\n### Track B: Investigate and Compare\n\nRun experiments, inspect behavior, compare alternatives, and write observations. Use this when the learner is exploring a concept whose shape is not obvious yet.\n\nPossible milestones:\n1. Predict behavior before running\n2. Build a small experiment harness\n3. Compare 2-3 approaches\n4. Summarize the rule of thumb and where it breaks\n\n### Track C: Debugging and Revision Lab\n\nTake broken, naive, or incomplete work and improve it through review cycles. This is for learning from friction rather than avoiding it.\n\nPossible milestones:\n1. Reproduce the failure\n2. Form a hypothesis and test it\n3. Make the smallest useful fix\n4. Improve design/readability after correctness\n5. Record the durable lesson\n\n## Work Block Pattern\n\nMost study turns should assign one bundled work block, not a stream of tiny tasks. Prefer feature sets over single-function checkpoints. A good work block includes:\n\n- Objective\n- Artifact to produce\n- Starter code, contracts, or setup when useful\n- Tests, expected outputs, invariants, or compile/run commands\n- 2-4 constraints or success criteria\n- Suggested timebox, usually 45-120 minutes unless the learner asks for tighter coaching\n- Review trigger: when to return for feedback after attempting the whole slice\n- Optional branches for curiosity or stretch\n\nExample shape: implement several related operations in one pass, such as \`remove_at\`, \`get\`, \`clear\`, and \`insert_at\`; provide signatures and tests, then let the learner work independently.\n\nBreak work into micro-steps only when the learner asks, is blocked, is very new to the topic, or a misconception would compound if left unchecked.\n\n## Running Progress\n\n- Current exploration area: TBD\n- Current project / artifact: TBD\n- Current milestone: TBD\n- Current work block: TBD\n- Open questions: TBD\n\n## Teacher Notes\n\nUse this section for durable observations about misconceptions, strengths, project ideas, review preferences, design decisions, and questions to revisit.\n`;
}

function briefLines(brief?: SessionBrief): string[] {
  if (!brief) return ["- TBD"];
  const lines: string[] = [];
  if (brief.objective) lines.push(`- Objective: ${brief.objective}`);
  if (brief.artifact) lines.push(`- Artifact: ${brief.artifact}`);
  if (brief.suggestedTimebox)
    lines.push(`- Suggested timebox: ${brief.suggestedTimebox}`);
  if (brief.reviewTrigger)
    lines.push(`- Review trigger: ${brief.reviewTrigger}`);
  if (brief.constraints?.length) {
    lines.push("- Constraints / success criteria:");
    lines.push(...brief.constraints.map((item) => `  - ${item}`));
  }
  if (brief.optionalBranches?.length) {
    lines.push("- Optional branches:");
    lines.push(...brief.optionalBranches.map((item) => `  - ${item}`));
  }
  return lines.length ? lines : ["- TBD"];
}

function progressMarkdown(state: StudyState): string {
  const completed = state.completedMilestones.length
    ? state.completedMilestones.map((item) => `- [x] ${item}`).join("\n")
    : "- No completed milestones recorded yet.";
  const notes = state.notes.length
    ? state.notes
        .map((n) => `- ${n.at}${n.kind ? ` [${n.kind}]` : ""}: ${n.text}`)
        .join("\n")
    : "- No notes yet.";
  return `# Study Progress: ${state.topic}\n\n- Active: ${state.active ? "yes" : "no"}\n- Placement level: ${state.learnerLevel ?? "unknown"}\n- Placement notes: ${state.assessmentSummary ?? "TBD"}\n- Preferred cadence: ${state.preferredCadence ?? "balanced"}\n- Preferred project scale: ${state.preferredProjectScale ?? "medium"}\n- Desired friction: ${state.desiredFriction ?? "normal"}\n- Current area: ${state.currentArea ?? "TBD"}\n- Current project: ${state.currentProject ?? "TBD"}\n- Current milestone: ${state.currentMilestone ?? "TBD"}\n- Last updated: ${state.updatedAt}\n\n## Resume Work Block\n\nTo continue, run \`/study resume\` from this project. The assistant should orient briefly and continue from this bounded work block:\n\n${briefLines(state.sessionBrief).join("\n")}\n\n## Completed Milestones\n\n${completed}\n\n## Notes\n\n${notes}\n\n## Files\n\n- Curriculum: ${state.curriculumPath}\n- State JSON: ${statePath(dirname(dirname(dirname(state.progressPath))))}\n`;
}

async function writeProgressMarkdown(state: StudyState): Promise<void> {
  await writeText(state.progressPath, progressMarkdown(state));
}

async function ensureStudyFiles(
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

function briefSummary(brief?: SessionBrief): string {
  if (!brief) return "TBD";
  return brief.objective ?? brief.artifact ?? brief.reviewTrigger ?? "TBD";
}

function statusLines(state?: StudyState): string[] {
  if (!state)
    return ["Study mode: no curriculum in this cwd. Run /study start <topic>."];
  return [
    `Study mode: ${state.active ? "active" : "paused"}`,
    `Topic: ${state.topic}`,
    `Level: ${state.learnerLevel ?? "unknown"}`,
    `Cadence: ${state.preferredCadence ?? "balanced"}`,
    `Current: ${state.currentArea ?? "TBD"}${state.currentProject ? ` / ${state.currentProject}` : ""}${state.currentMilestone ? ` / ${state.currentMilestone}` : ""}`,
    `Work block: ${briefSummary(state.sessionBrief)}`,
    `Completed milestones: ${state.completedMilestones.length}`,
    `Curriculum: ${state.curriculumPath}`,
    `Progress: ${state.progressPath}`,
  ];
}

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

function updateUi(ctx: ExtensionContext, state?: StudyState): void {
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

function sessionBriefPrompt(brief?: SessionBrief): string {
  return briefLines(brief).join("\n");
}

function teachingPrompt(state: StudyState): string {
  return `\n\n## PI STUDY MODE ACTIVE\n\nYou are tutoring the user on: ${state.topic}.\n\nPersistent files:\n- Curriculum: ${state.curriculumPath}\n- Progress: ${state.progressPath}\n\nCurrent progress:\n- Placement level: ${state.learnerLevel ?? "unknown"}\n- Placement notes: ${state.assessmentSummary ?? "TBD"} (use only to adapt difficulty; do not repeat or quote to the learner)\n- Preferred cadence: ${state.preferredCadence ?? "balanced"}\n- Preferred project scale: ${state.preferredProjectScale ?? "medium"}\n- Desired friction: ${state.desiredFriction ?? "normal"}\n- Exploration area: ${state.currentArea ?? "TBD"}\n- Project / artifact: ${state.currentProject ?? "TBD"}\n- Milestone / review focus: ${state.currentMilestone ?? "TBD"}\n- Current bounded work block:\n${sessionBriefPrompt(state.sessionBrief)}\n- Completed milestones: ${state.completedMilestones.length ? state.completedMilestones.join("; ") : "none yet"}\n\nMandatory teaching behavior:\n- DO NOT give the learner the finished answer by default. Act as a coach and reviewer, not an answer key.\n- If placement level is unknown, ask 3-5 short diagnostic questions before finalizing the curriculum. Include current goals, relevant starting point, preferred project scale, feedback cadence, desired pace, appetite for challenge, and only tiny skill checks that help choose a starting project.\n- After placement, propose 2-3 project tracks or expedition branches and ask the learner to choose or adapt one.\n- Prefer assigning ONE bundled work block per response over a stream of tiny tasks. A work block should include objective, artifact, starter/setup code when useful, tests or expected outputs, 2-4 constraints/success criteria, a suggested timebox, a review trigger, and optional branches.\n- Prefer feature sets over single-function checkpoints. Example: assign \`people_list_remove_at\`, \`people_list_get\`, \`people_list_clear\`, and \`people_list_insert_at\` together with signatures, starter code, tests, and compile/run commands, then let the learner implement independently.\n- Default work-block size by cadence: tight = 25-45 minute checkpoints; balanced = 45-120 minute milestones; open = multi-hour or multi-session milestones with explicit review triggers.\n- Do not ask the learner to report back after every tiny substep, each compiler run, or each function in a related set. Let them work independently for a meaningful stretch.\n- Break into micro-steps only when the learner asks, is blocked, is very new to the topic, or a misconception would compound if left unchecked.\n- Prefer medium-sized programs, API slices, experiments, design sketches, debugging sessions, and revision cycles over isolated minutia drills.\n- Keep pace brisk and adaptive: once the learner has correctly predicted, implemented, or explained the core idea, advance to the next meaningful concept or integrate it into a larger artifact. Do not add extra micro-drills just because the topic has more edge cases.\n- Teach just enough theory to unblock the current project or exploration branch. Avoid nitpicking trivia unless it affects correctness, safety, debugging, or idiomatic use.\n- Do not repeat the learner's stored background, biography, job history, or assessment summary in normal replies. Use placement notes privately for difficulty calibration, and prefer evidence from the learner's current work over initial background assumptions.\n- Before revealing solutions, ask for the learner's plan, code, experiment result, design choice, or revision. For large work blocks, ask for an initial sketch only if it would prevent wasted effort; otherwise provide scaffolding and send them off to attempt the whole slice.\n- Review work at natural checkpoints: say what is solid, identify the highest-impact issues, and suggest one or two meaningful revisions or branches.\n- Use escalating hints before any reveal. If the learner explicitly asks for the answer, first offer one more hint unless they insist.\n- Keep the curriculum and progress current. Use study_update_progress after meaningful progress, artifact completion, review, revision, a new misconception, a saved stopping point, pace/preference changes, or a new exploration branch.\n- Store the next resume point as a bundled work block or feature slice, not a tiny instruction.\n- Record durable concepts, repeated weak spots, design decisions, pace preferences, and useful review observations as progress notes.\n- If the curriculum file is missing, too vague, too granular, or too lesson-drill oriented, create or improve it before continuing.\n`;
}

export default function studyMode(pi: ExtensionAPI): void {
  let cachedState: StudyState | undefined;

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
        cachedState = await ensureStudyFiles(ctx.cwd, topic);
        pi.setSessionName(`Study: ${topic}`);
        updateUi(ctx, cachedState);
        ctx.ui.notify(
          `Study mode started. Curriculum: ${cachedState.curriculumPath}`,
          "info",
        );
        pi.sendUserMessage(
          `Study mode is now active for "${topic}". Before finalizing the curriculum, run a brief placement diagnostic: ask me 3-5 short questions to determine my current level, goals, preferred project scale, feedback cadence, desired pace, and appetite for challenge. Include only tiny skill checks that help choose a starting project. Ask a compact numbered set, then wait for my answers. After checking my responses, update study progress with learnerLevel, preferredCadence, preferredProjectScale, desiredFriction, and a terse, neutral assessmentSummary focused on learning needs, not biography. Do not repeat that summary back to me in normal replies; use it only to calibrate difficulty. Then tailor ${cachedState.curriculumPath} as an exploratory project map. Propose 2-3 project tracks or expedition branches and ask me to choose or adapt one. Once chosen, give me a bundled work block large enough for a meaningful independent stretch, not a tiny task. Prefer feature sets over single-function checkpoints; provide setup code, contracts, tests, and compile/run commands, but not finished implementations. Include objective, artifact, constraints/success criteria, suggested timebox, review trigger, and optional branches. Remember: open-ended enough to explore; bounded enough to review. Do not give me finished answers; coach me through planning, writing, revising, and reviewing medium-sized artifacts, and move on once I demonstrate the core idea.`,
        );
        return;
      }

      cachedState = await loadState(ctx.cwd);
      if (!cachedState) {
        ctx.ui.notify(
          "No study state here. Run /study start <topic>.",
          "warning",
        );
        return;
      }

      if (subcommand === "status") {
        ctx.ui.notify(statusLines(cachedState).join("\n"), "info");
        return;
      }

      if (subcommand === "pause") {
        if (argText)
          cachedState.notes.push({
            at: new Date().toISOString(),
            kind: "general",
            text: `Paused: ${argText}`,
          });
        cachedState.active = false;
        await saveState(ctx.cwd, cachedState);
        updateUi(ctx, cachedState);
        ctx.ui.notify(
          `Study mode paused. Resume later with /study resume. Work block: ${briefSummary(cachedState.sessionBrief)}`,
          "info",
        );
        return;
      }

      if (subcommand === "resume" || subcommand === "continue") {
        cachedState.active = true;
        await saveState(ctx.cwd, cachedState);
        updateUi(ctx, cachedState);
        pi.sendUserMessage(
          `Resume Study Mode for "${cachedState.topic}" from the saved progress. Orient me briefly, then continue from this bounded work block:\n${sessionBriefPrompt(cachedState.sessionBrief)}\nCurrent area: ${cachedState.currentArea ?? "TBD"}. Current project: ${cachedState.currentProject ?? "TBD"}. Current milestone: ${cachedState.currentMilestone ?? "TBD"}. If the saved block is too tiny, too granular, or vague, replace it with a broader bundled work block or feature slice before continuing.`,
        );
        return;
      }

      ctx.ui.notify(
        `Unknown /study command: ${subcommand}. Try /study help.`,
        "warning",
      );
    },
  });

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
      cachedState = state;
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
