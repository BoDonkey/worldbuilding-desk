/*
 * Scene goals from accepted planning-chat proposals (Slice 4.86). A planned
 * scene is created empty; its goal is kept here for the session and fills
 * the goal in Draft this scene for that scene. Nothing is stored: after a
 * reload the draft falls back to the linked card's summary and plot points.
 */
const goals = new Map<string, string>();

export const rememberPlannedSceneGoal = (sceneId: string, goal: string): void => {
  const text = goal.trim();
  if (text) goals.set(sceneId, text);
};

export const plannedSceneGoal = (sceneId: string): string | undefined => goals.get(sceneId);
