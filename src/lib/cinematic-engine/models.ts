export const ShotType = {
  ESTABLISHING: "ESTABLISHING",
  ACTION: "ACTION",
  REACTION: "REACTION",
  DIALOGUE: "DIALOGUE",
  INSERT: "INSERT",
  CUTAWAY: "CUTAWAY",
  CLIMAX: "CLIMAX",
  TRANSITION: "TRANSITION",
  MONTAGE: "MONTAGE"
} as const;
export type ShotType = typeof ShotType[keyof typeof ShotType];

export const Framing = {
  EXTREME_WIDE: "EXTREME_WIDE",
  WIDE: "WIDE",
  FULL: "FULL",
  MEDIUM_WIDE: "MEDIUM_WIDE",
  MEDIUM: "MEDIUM",
  MEDIUM_CLOSE_UP: "MEDIUM_CLOSE_UP",
  CLOSE_UP: "CLOSE_UP",
  EXTREME_CLOSE_UP: "EXTREME_CLOSE_UP",
  OVER_THE_SHOULDER: "OVER_THE_SHOULDER",
  POV: "POV"
} as const;
export type Framing = typeof Framing[keyof typeof Framing];

export const CameraMovement = {
  STATIC: "STATIC",
  PAN_LEFT: "PAN_LEFT",
  PAN_RIGHT: "PAN_RIGHT",
  TILT_UP: "TILT_UP",
  TILT_DOWN: "TILT_DOWN",
  ZOOM_IN: "ZOOM_IN",
  ZOOM_OUT: "ZOOM_OUT",
  DOLLY_IN: "DOLLY_IN",
  DOLLY_OUT: "DOLLY_OUT",
  TRACKING_L2R: "TRACKING_L2R",
  TRACKING_R2L: "TRACKING_R2L",
  CRANE_UP: "CRANE_UP",
  CRANE_DOWN: "CRANE_DOWN",
  HANDHELD: "HANDHELD",
  ORBIT: "ORBIT"
} as const;
export type CameraMovement = typeof CameraMovement[keyof typeof CameraMovement];

export const CameraHeight = {
  LOW: "LOW",
  EYE: "EYE",
  HIGH: "HIGH",
  BIRD: "BIRD"
} as const;
export type CameraHeight = typeof CameraHeight[keyof typeof CameraHeight];

export const CutTechnique = {
  HARD_CUT: "HARD_CUT",
  CUT_ON_ACTION: "CUT_ON_ACTION",
  J_CUT: "J_CUT",
  L_CUT: "L_CUT",
  MATCH_CUT: "MATCH_CUT",
  CROSS_CUT: "CROSS_CUT",
  CUTAWAY: "CUTAWAY",
  INSERT: "INSERT",
  DISSOLVE: "DISSOLVE",
  FADE: "FADE",
  WIPE: "WIPE",
  REACTION_SHOT: "REACTION_SHOT",
  INVISIBLE_CUT: "INVISIBLE_CUT",
  MORPH: "MORPH"
} as const;
export type CutTechnique = typeof CutTechnique[keyof typeof CutTechnique];

export const ExitType = {
  COMPLETE_ACTION: "COMPLETE_ACTION",
  MID_ACTION: "MID_ACTION",
  LOOK_OFF: "LOOK_OFF",
  HOLD: "HOLD",
  FADE: "FADE",
  ZOOM_OUT: "ZOOM_OUT",
  WALK_OUT: "WALK_OUT"
} as const;
export type ExitType = typeof ExitType[keyof typeof ExitType];

export interface CameraAngle {
  bearing: number; // 0-360
  height: CameraHeight;
  side: "A" | "B";
}

export interface ShotStructure {
  entry: string;
  core: string;
  exit: string;
  exit_type: ExitType;
  entry_dur: number;
  core_dur: number;
  exit_dur: number;
}

export interface CinematicShot {
  id: string;
  scene_id: string;
  shotNumber: number;
  shot_type: ShotType;
  framing: Framing;
  duration_target: number;
  camera_movement: CameraMovement;
  action_description: string;
  character_refs: string[];
  scene_ref?: string;
  cut_in?: CutTechnique;
  is_glue?: boolean;
  warnings?: string[];
  notes?: string;
  camera_angle?: CameraAngle;
  structure?: ShotStructure;
  // Fallbacks for the existing UI logic
  imageUrl?: string;
  renderUrl?: string;
  videoUrl?: string;
  video_url?: string;
  videoPrompt?: string;
  video_prompt?: string;
  variants?: any[];
  videoVariants?: any[];
  angle?: string;
  duration?: number;
  cameraMovement?: string;
  bối_cảnh?: string;
  location?: string;
  visual?: string;
  hình_ảnh?: string;
  thoại?: string;
  dialogue?: string;
  kind?: string;
  beat?: string;
  storyboardModel?: string;
  videoModel?: string;
}
