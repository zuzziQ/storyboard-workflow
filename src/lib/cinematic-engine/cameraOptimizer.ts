import { CameraHeight, ShotType } from "./models";
import type { CinematicShot } from "./models";

const MIN_ANGLE_DELTA = 30;
const ACTION_LINE_ARC = 170;
const STEP = 45;

function heightFor(shot: CinematicShot, index: number): CameraHeight {
  if (shot.shot_type === ShotType.ESTABLISHING) {
    return index % 2 === 0 ? CameraHeight.HIGH : CameraHeight.BIRD;
  }
  if (shot.shot_type === ShotType.CLIMAX) {
    return CameraHeight.LOW;
  }
  if (shot.shot_type === ShotType.ACTION) {
    // Luân phiên các góc máy cho shot hành động để tạo nhịp điệu phong phú
    const heights = [CameraHeight.EYE, CameraHeight.LOW, CameraHeight.HIGH];
    return heights[index % heights.length];
  }
  if (shot.shot_type === ShotType.TRANSITION) {
    return CameraHeight.HIGH;
  }
  return CameraHeight.EYE; // Mặc định là Eye-Level
}

function clamp(b: number): number {
  return Math.max(0, Math.min(ACTION_LINE_ARC, b));
}

export function assignCameraAngles(shots: CinematicShot[], side: "A" | "B" = "A"): string[] {
  const warnings: string[] = [];
  let lastBearing = 20;
  let direction = 1; // 1 = increase, -1 = decrease
  let prevSubjects = new Set<string>();

  for (let idx = 0; idx < shots.length; idx++) {
    const shot = shots[idx];
    const subjects = new Set(shot.character_refs || []);
    let sharesSubject = false;
    
    // Check if there is intersection between subjects and prevSubjects
    for (const sub of subjects) {
      if (prevSubjects.has(sub)) {
        sharesSubject = true;
        break;
      }
    }

    let bearing = 0;

    if (sharesSubject) {
      bearing = lastBearing + STEP * direction;
      if (bearing > ACTION_LINE_ARC || bearing < 0) {
        direction *= -1;
        bearing = lastBearing + STEP * direction;
      }
      bearing = clamp(bearing);

      if (Math.abs(bearing - lastBearing) < MIN_ANGLE_DELTA) {
        let forced = clamp(lastBearing + MIN_ANGLE_DELTA * direction);
        if (Math.abs(forced - lastBearing) < MIN_ANGLE_DELTA) {
          forced = clamp(lastBearing - MIN_ANGLE_DELTA);
        }
        bearing = forced;
        if (Math.abs(bearing - lastBearing) < MIN_ANGLE_DELTA) {
          warnings.push(`${shot.id}: Cannot achieve 30° difference compared to previous shot (narrow arc).`);
        }
      }
    } else {
      bearing = lastBearing > 90 ? 20 : 130;
      direction = bearing < 90 ? 1 : -1;
    }

    // Xác định chiều cao camera động
    const height = heightFor(shot, idx);

    // Luân phiên mặt bên (Side A/B) cho các shot thoại/phản ứng liên tiếp để tạo góc reverse OTS tự nhiên
    let activeSide: "A" | "B" = side;
    if (idx > 0) {
      const prevShot = shots[idx - 1];
      if (
        (shot.shot_type === ShotType.DIALOGUE || shot.shot_type === ShotType.REACTION) &&
        (prevShot.shot_type === ShotType.DIALOGUE || prevShot.shot_type === ShotType.REACTION)
      ) {
        activeSide = prevShot.camera_angle?.side === "A" ? "B" : "A";
      }
    }

    shot.camera_angle = {
      bearing: shot.camera_angle?.bearing !== undefined ? shot.camera_angle.bearing : Math.floor(bearing),
      height: shot.camera_angle?.height || height,
      side: shot.camera_angle?.side || activeSide,
    };
    
    lastBearing = bearing;
    prevSubjects = subjects;
  }

  return warnings;
}

