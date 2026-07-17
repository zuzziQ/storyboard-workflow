import type { CinematicShot } from "./models";

export interface ContinuityWarning {
  shotId: string;
  type: "JUMP_CUT" | "NARROW_ANGLE" | "LOCATION_MISMATCH" | "CHARACTER_BLINK" | "DURATION_TOO_LONG";
  message: string;
}

// Helper to normalize location strings and eliminate common filler terms like "bối cảnh" or "scene"
export function normalizeLocation(loc: string): string {
  if (!loc) return "";
  return loc
    .toLowerCase()
    .replace(/bối cảnh|scene/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Helper to calculate shortest angular distance between two bearings (0-360)
export function getAngularDistance(b1: number, b2: number): number {
  const diff = Math.abs(b1 - b2) % 360;
  return Math.min(diff, 360 - diff);
}

/**
 * Audits continuity errors across all cinematic shots in a timeline.
 * 
 * Rules:
 * 1. JUMP_CUT: Consecutive shots in the same scene have the same framing and a bearing diff < 30 degrees.
 * 2. NARROW_ANGLE: Consecutive shots in the same scene share a character but have a bearing diff < 30 degrees.
 * 3. LOCATION_MISMATCH: Shot location differs from the general scene location.
 * 4. CHARACTER_BLINK: A character is present in shot N, absent in N+1, and reappears in N+2 (same scene).
 * 5. DURATION_TOO_LONG: Shot duration is greater than 8 seconds.
 */
export function auditContinuity(
  shots: CinematicShot[],
  sceneLocations?: Record<string, string>
): ContinuityWarning[] {
  const warnings: ContinuityWarning[] = [];
  if (!shots || shots.length === 0) return warnings;

  // Group shots by scene_id for location and blink checks
  const sceneShotsMap: Record<string, CinematicShot[]> = {};
  for (const shot of shots) {
    const sId = shot.scene_id || "default";
    if (!sceneShotsMap[sId]) {
      sceneShotsMap[sId] = [];
    }
    sceneShotsMap[sId].push(shot);
  }

  // Determine base location for each scene
  const resolvedSceneLocations: Record<string, string> = { ...sceneLocations };
  for (const [sId, sShots] of Object.entries(sceneShotsMap)) {
    if (!resolvedSceneLocations[sId]) {
      // Find the first shot in this scene that has location info
      const firstWithLoc = sShots.find(
        (sh) => sh.location || sh.bối_cảnh || sh.scene_ref
      );
      if (firstWithLoc) {
        resolvedSceneLocations[sId] =
          firstWithLoc.location || firstWithLoc.bối_cảnh || firstWithLoc.scene_ref || "";
      }
    }
  }

  // 1. DURATION_TOO_LONG check
  for (const shot of shots) {
    const dur = shot.duration_target ?? shot.duration ?? 0;
    if (dur > 8) {
      warnings.push({
        shotId: shot.id,
        type: "DURATION_TOO_LONG",
        message: `Thời lượng shot (${dur}s) vượt quá 8 giây. AI Video Generator dễ bị méo hình hoặc drift.`,
      });
    }
  }

  // 2. Pairwise and sequence checks within each scene
  for (const [sId, sShots] of Object.entries(sceneShotsMap)) {
    const sceneLoc = resolvedSceneLocations[sId] || "";
    const normalizedSceneLoc = normalizeLocation(sceneLoc);

    for (let i = 0; i < sShots.length; i++) {
      const shot = sShots[i];
      const prevShot = i > 0 ? sShots[i - 1] : null;

      // 2a. LOCATION_MISMATCH check
      const shotLoc = shot.location || shot.bối_cảnh || shot.scene_ref || "";
      if (shotLoc && normalizedSceneLoc) {
        if (normalizeLocation(shotLoc) !== normalizedSceneLoc) {
          warnings.push({
            shotId: shot.id,
            type: "LOCATION_MISMATCH",
            message: `Shot chỉ định bối cảnh "${shotLoc}" khác biệt với bối cảnh chung của phân cảnh "${sceneLoc}".`,
          });
        }
      }

      // Pairwise checks with the previous shot
      if (prevShot) {
        const b1 = prevShot.camera_angle?.bearing;
        const b2 = shot.camera_angle?.bearing;
        const hasBearing = b1 !== undefined && b2 !== undefined;

        if (hasBearing) {
          const angleDiff = getAngularDistance(b1, b2);

          // JUMP_CUT check
          if (shot.framing && prevShot.framing && shot.framing === prevShot.framing) {
            if (angleDiff < 30) {
              warnings.push({
                shotId: shot.id,
                type: "JUMP_CUT",
                message: `Lỗi Jump Cut: Hai shot liên tiếp có cùng cỡ cảnh (${shot.framing}) và góc máy bearing lệch < 30° (${angleDiff.toFixed(1)}°).`,
              });
            }
          }

          // NARROW_ANGLE check
          const charRefs1 = prevShot.character_refs || [];
          const charRefs2 = shot.character_refs || [];
          const hasCommonChar = charRefs1.some((c) => charRefs2.includes(c));
          if (hasCommonChar && angleDiff < 30) {
            warnings.push({
              shotId: shot.id,
              type: "NARROW_ANGLE",
              message: `Lỗi Narrow Angle: Hai shot liên tiếp chung nhân vật nhưng góc bearing lệch < 30° (${angleDiff.toFixed(1)}°).`,
            });
          }
        }
      }

      // CHARACTER_BLINK check (needs N, N+1, N+2)
      if (i >= 2) {
        const shotN = sShots[i - 2];
        const shotN1 = sShots[i - 1];
        const shotN2 = shot;

        const charsN = shotN.character_refs || [];
        const charsN1 = shotN1.character_refs || [];
        const charsN2 = shotN2.character_refs || [];

        for (const char of charsN) {
          if (charsN2.includes(char) && !charsN1.includes(char)) {
            warnings.push({
              shotId: shotN2.id,
              type: "CHARACTER_BLINK",
              message: `Lỗi Character Blink: Nhân vật "${char}" xuất hiện ở shot ${shotN.shotNumber || (i - 1)}, biến mất ở shot ${shotN1.shotNumber || i}, lại xuất hiện ở shot ${shotN2.shotNumber || (i + 1)}.`,
            });
          }
        }
      }
    }
  }

  return warnings;
}
