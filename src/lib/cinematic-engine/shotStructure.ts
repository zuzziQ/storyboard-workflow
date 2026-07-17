import { CutTechnique, ExitType, ShotType } from "./models";
import type { CinematicShot } from "./models";

const DEFAULT_EXIT_BY_TYPE: Record<string, ExitType> = {
  [ShotType.ESTABLISHING]: ExitType.HOLD,
  [ShotType.ACTION]: ExitType.COMPLETE_ACTION,
  [ShotType.REACTION]: ExitType.HOLD,
  [ShotType.DIALOGUE]: ExitType.HOLD,
  [ShotType.INSERT]: ExitType.HOLD,
  [ShotType.CUTAWAY]: ExitType.HOLD,
  [ShotType.TRANSITION]: ExitType.ZOOM_OUT,
  [ShotType.MONTAGE]: ExitType.COMPLETE_ACTION,
  [ShotType.CLIMAX]: ExitType.ZOOM_OUT,
};

function splitDurations(d: number): [number, number, number] {
  let entry = Math.max(1, Math.round(d * 0.18));
  let exit = Math.max(1, Math.round(d * 0.18));
  let core = d - entry - exit;
  
  if (core < 1) {
    core = 1;
    entry = Math.max(1, Math.floor((d - core) / 2));
    exit = Math.max(1, d - core - entry);
  }
  return [entry, core, exit];
}

function determineExitType(shot: CinematicShot, nextShot: CinematicShot | null): ExitType {
  if (!nextShot) {
    return shot.shot_type === ShotType.CLIMAX ? ExitType.FADE : ExitType.ZOOM_OUT;
  }
  if (nextShot.scene_id !== shot.scene_id) {
    return ExitType.FADE;
  }
  if (nextShot.cut_in === CutTechnique.CUT_ON_ACTION) {
    return ExitType.MID_ACTION;
  }
  if (nextShot.cut_in === CutTechnique.REACTION_SHOT || nextShot.cut_in === CutTechnique.CUTAWAY || nextShot.is_glue) {
    return ExitType.LOOK_OFF;
  }
  return DEFAULT_EXIT_BY_TYPE[shot.shot_type] || ExitType.COMPLETE_ACTION;
}

function getEntryText(shot: CinematicShot): string {
  const subj = shot.character_refs && shot.character_refs.length > 0 ? shot.character_refs.join(", ") : "khung cảnh";
  if (shot.shot_type === ShotType.ESTABLISHING) {
    return `Khung cảnh hiện ra ở ${shot.framing}, thiết lập không gian.`;
  }
  return `Camera đã ở ${shot.framing}, ${subj} trong khung, bắt đầu hành động.`;
}

function getCoreText(shot: CinematicShot): string {
  return shot.action_description;
}

function getExitText(exitType: ExitType): string {
  return `Kết thúc: ${exitType}`;
}

export function planShotStructures(shots: CinematicShot[]): void {
  for (let i = 0; i < shots.length; i++) {
    const shot = shots[i];
    const nxt = (i + 1 < shots.length) ? shots[i + 1] : null;
    
    const exitType = determineExitType(shot, nxt);
    const [entryDur, coreDur, exitDur] = splitDurations(shot.duration_target || 4);
    
    shot.structure = {
      entry: getEntryText(shot),
      core: getCoreText(shot),
      exit: getExitText(exitType),
      exit_type: exitType,
      entry_dur: entryDur,
      core_dur: coreDur,
      exit_dur: exitDur
    };
  }
}
