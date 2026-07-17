import { CutTechnique, ShotType, Framing, CameraMovement } from "./models";
import type { CinematicShot } from "./models";

const HIGH_RISK_THRESHOLD = 0.6;

function baseTransitionRisk(prev: CinematicShot, cur: CinematicShot): number {
  if (prev.scene_id !== cur.scene_id) return 0.1;
  
  // Shared characters
  const prevChars = new Set(prev.character_refs || []);
  const curChars = new Set(cur.character_refs || []);
  let hasShared = false;
  for (const c of curChars) {
    if (prevChars.has(c)) {
      hasShared = true;
      break;
    }
  }

  if (!hasShared) return 0.2; // Safe, switching subjects

  let risk = 0.5;
  
  // Jump cut risk if framing is identical
  if (prev.framing === cur.framing) risk += 0.3;
  
  // Jump cut risk if angle difference is too small
  if (prev.camera_angle && cur.camera_angle) {
    if (Math.abs(prev.camera_angle.bearing - cur.camera_angle.bearing) < 30) {
      risk += 0.3;
    }
  }

  return Math.min(1.0, risk);
}

function chooseTechnique(prev: CinematicShot, cur: CinematicShot): CutTechnique {
  if (prev.scene_id !== cur.scene_id) return CutTechnique.DISSOLVE;
  if (cur.shot_type === ShotType.REACTION) return CutTechnique.REACTION_SHOT;
  if (cur.shot_type === ShotType.INSERT || cur.shot_type === ShotType.CUTAWAY) return CutTechnique.CUTAWAY;
  if (prev.shot_type === ShotType.ACTION || cur.shot_type === ShotType.ACTION) return CutTechnique.CUT_ON_ACTION;
  if (cur.shot_type === ShotType.DIALOGUE) return CutTechnique.J_CUT;
  return CutTechnique.HARD_CUT;
}

function makeGlueShot(prev: CinematicShot, cur: CinematicShot, index: number): CinematicShot {
  const isActionSequence = prev.shot_type === ShotType.ACTION || cur.shot_type === ShotType.ACTION;
  
  const description = isActionSequence 
    ? "Cận cảnh (Action Match Cut) — chi tiết bàn tay siết chặt / giọt mồ hôi / chuyển động nhanh để giữ nhịp độ"
    : "Cận chi tiết môi trường (lá rơi / đồ vật) — chèn để che điểm nối";

  return {
    id: `${cur.scene_id}_GLUE${index}`,
    scene_id: cur.scene_id,
    shotNumber: cur.shotNumber - 0.5, // Injecting between
    shot_type: ShotType.CUTAWAY,
    framing: Framing.CLOSE_UP,
    duration_target: isActionSequence ? 2 : 3,
    camera_movement: CameraMovement.STATIC,
    action_description: description,
    character_refs: isActionSequence && prev.character_refs?.length ? [prev.character_refs[0]] : [],
    scene_ref: cur.scene_ref,
    cut_in: CutTechnique.CUT_ON_ACTION,
    is_glue: true,
    notes: `Glue cutaway tự chèn: ${isActionSequence ? 'Duy trì nhịp Action' : 'Che điểm nối'}`
  };
}

export function planCuts(shots: CinematicShot[]): { optimizedShots: CinematicShot[], glueNotes: string[] } {
  if (!shots || shots.length === 0) return { optimizedShots: [], glueNotes: [] };

  const result: CinematicShot[] = [];
  const glueNotes: string[] = [];
  let glueCount = 0;

  shots[0].cut_in = CutTechnique.FADE;
  result.push(shots[0]);

  for (let i = 1; i < shots.length; i++) {
    const cur = shots[i];
    const prev = result[result.length - 1];

    cur.cut_in = chooseTechnique(prev, cur);

    const risk = baseTransitionRisk(prev, cur);
    const naturalIsWeak = cur.cut_in === CutTechnique.HARD_CUT || cur.cut_in === CutTechnique.CUT_ON_ACTION;
    
    if (risk >= HIGH_RISK_THRESHOLD && naturalIsWeak && !cur.is_glue) {
      glueCount++;
      const glue = makeGlueShot(prev, cur, glueCount);
      result.push(glue);
      cur.cut_in = CutTechnique.HARD_CUT; // safe after glue
      glueNotes.push(`Chèn ${glue.id} giữa ${prev.id} -> ${cur.id} (risk: ${risk.toFixed(2)})`);
    }
    
    result.push(cur);
  }

  // Renumber shots if glues were added
  result.forEach((sh, idx) => {
    sh.shotNumber = idx + 1;
  });

  return { optimizedShots: result, glueNotes };
}
