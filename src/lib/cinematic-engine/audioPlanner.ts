import type { CinematicShot } from "./models";

export interface AudioCue {
  id: string;
  shot_id: string;
  layer: "ambient" | "score" | "sfx" | "voice";
  type: string;
  description: string;
  startTime: number;
  duration: number;
  volume: number; // 0.0 to 1.0
}

export interface AudioPlan {
  scene_id: string;
  totalDuration: number;
  cues: AudioCue[];
}

export function planAudioForScene(
  sceneId: string,
  shots: CinematicShot[],
  mood: string = "neutral",
  location: string = "default location"
): AudioPlan {
  const cues: AudioCue[] = [];
  let currentTime = 0;

  // 1. Plan Ambient Cue (continuous throughout the scene)
  const sceneDuration = shots.reduce((acc, shot) => acc + (shot.duration_target || 4), 0);
  const locLower = location.toLowerCase();
  
  let ambientType = "room_tone";
  let ambientDesc = "Quiet interior room tone with subtle air hum.";
  if (locLower.includes("rừng") || locLower.includes("forest") || locLower.includes("outdoor")) {
    ambientType = "nature_wind";
    ambientDesc = "Soft forest wind rustling through leaves with distant birds.";
  } else if (locLower.includes("phòng khách") || locLower.includes("living room")) {
    ambientType = "living_room";
    ambientDesc = "Warm domestic room tone with distant street murmur.";
  } else if (locLower.includes("phòng thí nghiệm") || locLower.includes("lab") || locLower.includes("workshop")) {
    ambientType = "sci_fi_hum";
    ambientDesc = "Low electronic hum with occasional soft computer beeps.";
  } else if (locLower.includes("mưa") || locLower.includes("rain")) {
    ambientType = "heavy_rain";
    ambientDesc = "Steady rain patter against window pane.";
  }

  cues.push({
    id: `${sceneId}_amb_1`,
    shot_id: shots[0]?.id || "",
    layer: "ambient",
    type: ambientType,
    description: ambientDesc,
    startTime: 0,
    duration: sceneDuration,
    volume: 0.4
  });

  // 2. Plan Score / Music Cue (continuous throughout the scene)
  let scoreType = "ambient_synth";
  let scoreDesc = "Soft synthesizer pads establishing a curious atmosphere.";
  const moodLower = mood.toLowerCase();

  if (moodLower.includes("căng thẳng") || moodLower.includes("tension") || moodLower.includes("suspense")) {
    scoreType = "suspense_strings";
    scoreDesc = "Tense low staccato cello strings with slow swelling double bass.";
  } else if (moodLower.includes("u sầu") || moodLower.includes("sad") || moodLower.includes("melancholy")) {
    scoreType = "melancholic_piano";
    scoreDesc = "Slow, resonant solo piano melody with high reverb.";
  } else if (moodLower.includes("quyết liệt") || moodLower.includes("action") || moodLower.includes("climax")) {
    scoreType = "orchestral_action";
    scoreDesc = "Driving percussion beats with bold brass accents.";
  } else if (moodLower.includes("vui nhộn") || moodLower.includes("happy") || moodLower.includes("comedy")) {
    scoreType = "playful_marimba";
    scoreDesc = "Bouncy marimba notes with staccato woodwinds.";
  } else if (moodLower.includes("huyền bí") || moodLower.includes("mystery")) {
    scoreType = "mysterious_music";
    scoreDesc = "Curious pizzicato strings with airy woodwinds.";
  }

  cues.push({
    id: `${sceneId}_score_1`,
    shot_id: shots[0]?.id || "",
    layer: "score",
    type: scoreType,
    description: scoreDesc,
    startTime: 0,
    duration: sceneDuration,
    volume: 0.35
  });

  // 3. Plan SFX and Voice per shot
  shots.forEach((shot) => {
    const shotDuration = shot.duration_target || 4;
    const shotDesc = (shot.action_description || "").toLowerCase();
    
    // Voice / Dialogue Layer
    const hasDialogue = (shot as any).thoại || (shot as any).dialogue || "";
    if (hasDialogue) {
      cues.push({
        id: `${shot.id}_voice`,
        shot_id: shot.id,
        layer: "voice",
        type: "dialogue",
        description: `Voiceover/Dialogue: "${hasDialogue}"`,
        startTime: currentTime + 0.5,
        duration: Math.min(shotDuration - 1.0, 3.0),
        volume: 0.9
      });
    }

    // SFX Layer
    let sfxType = "";
    let sfxDesc = "";

    if (shotDesc.includes("chạy") || shotDesc.includes("run") || shotDesc.includes("bước") || shotDesc.includes("walk")) {
      sfxType = "footsteps";
      sfxDesc = "Rhythmic footsteps pacing on floor surface.";
    } else if (shotDesc.includes("mở cửa") || shotDesc.includes("open door") || shotDesc.includes("đóng cửa") || shotDesc.includes("close door")) {
      sfxType = "door_creak";
      sfxDesc = "Wooden door creaking open followed by a solid latch click.";
    } else if (shotDesc.includes("cười") || shotDesc.includes("laugh") || shotDesc.includes("giggle")) {
      sfxType = "laughter";
      sfxDesc = "Soft, warm chuckle matching character expression.";
    } else if (shotDesc.includes("khóc") || shotDesc.includes("cry") || shotDesc.includes("sob")) {
      sfxType = "sobbing";
      sfxDesc = "Subtle, quiet sniffing and indrawn breath.";
    } else if (shotDesc.includes("tiếng nổ") || shotDesc.includes("explosion") || shotDesc.includes("bùm")) {
      sfxType = "impact_boom";
      sfxDesc = "Muffled low-frequency rumble impact with high-end debris fall.";
    } else if (shotDesc.includes("điện thoại") || shotDesc.includes("phone") || shotDesc.includes("chuông")) {
      sfxType = "phone_ring";
      sfxDesc = "Double electronic phone ring chime.";
    } else if (shotDesc.includes("rơi") || shotDesc.includes("drop") || shotDesc.includes("ngã")) {
      sfxType = "object_thud";
      sfxDesc = "Dull thud impact of object landing on soft floor.";
    }

    if (sfxType) {
      cues.push({
        id: `${shot.id}_sfx_auto`,
        shot_id: shot.id,
        layer: "sfx",
        type: sfxType,
        description: sfxDesc,
        startTime: currentTime + 0.2,
        duration: Math.min(shotDuration, 2.5),
        volume: 0.7
      });
    }

    currentTime += shotDuration;
  });

  return {
    scene_id: sceneId,
    totalDuration: sceneDuration,
    cues
  };
}
