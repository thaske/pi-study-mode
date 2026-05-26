import { join } from "node:path";

export function studyDir(cwd: string): string {
  return join(cwd, ".pi", "study");
}

export function statePath(cwd: string): string {
  return join(studyDir(cwd), "study-state.json");
}

export function curriculumPath(cwd: string): string {
  return join(studyDir(cwd), "CURRICULUM.md");
}

export function progressPath(cwd: string): string {
  return join(studyDir(cwd), "PROGRESS.md");
}
