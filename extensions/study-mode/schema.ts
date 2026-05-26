import { StringEnum } from "@earendil-works/pi-ai";
import { Type } from "typebox";

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

export const ProgressParams = Type.Object({
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
