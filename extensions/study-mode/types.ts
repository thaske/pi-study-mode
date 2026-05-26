export type LearnerLevel =
  | "new"
  | "beginner"
  | "intermediate"
  | "advanced"
  | "unknown";
export type CadencePreference = "tight" | "balanced" | "open";
export type ProjectScale = "small" | "medium" | "large";
export type FrictionLevel = "gentle" | "normal" | "challenging";
export type NoteKind =
  | "concept"
  | "review"
  | "misconception"
  | "decision"
  | "pace"
  | "general";

export interface SessionBrief {
  objective?: string;
  artifact?: string;
  constraints?: string[];
  suggestedTimebox?: string;
  reviewTrigger?: string;
  optionalBranches?: string[];
}

export interface StudyState {
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
