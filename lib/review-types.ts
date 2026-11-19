import type { Voice } from "./voices";

export const reviewStates = ["pending", "approved", "declined"] as const;
export type ReviewStatus = typeof reviewStates[number];
export type ReviewStory = Voice & { status: ReviewStatus; createdAt: string; reviewedAt: string | null };
export type ReviewPage = {
  stories: ReviewStory[];
  counts: Record<ReviewStatus, number>;
  cursor: string | null;
};
