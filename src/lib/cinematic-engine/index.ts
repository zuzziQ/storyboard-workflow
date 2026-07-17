export * from "./models";
export * from "./cameraOptimizer";
export * from "./cutPlanner";
export * from "./shotStructure";
export * from "./audioPlanner";

import type { CinematicShot } from "./models";
import { assignCameraAngles } from "./cameraOptimizer";
import { planCuts } from "./cutPlanner";
import { planShotStructures } from "./shotStructure";
import { planAudioForScene } from "./audioPlanner";
import { useFlowStore } from "../../store/useFlowStore";
import { compileCinematicPrompt } from "./promptBuilder";
import { auditContinuity } from "./continuityAuditor";

/**
 * Main Deterministic Engine Pipeline
 * Converts raw shots or beats into fully planned cinematic shots.
 */
export function runCinematicPipeline(rawShots: CinematicShot[]): { 
  optimizedShots: CinematicShot[], 
  warnings: string[],
  glueNotes: string[] 
} {
  // Step 0: Normalize character_refs to strings to fix camera intersection & templating bugs
  for (const shot of rawShots) {
    if (shot.character_refs) {
      const refsArray = Array.isArray(shot.character_refs)
        ? shot.character_refs
        : typeof shot.character_refs === 'string'
          ? (shot.character_refs as string).split(',').map(s => s.trim()).filter(Boolean)
          : [];
      shot.character_refs = refsArray.map((c: any) => {
        if (!c) return "";
        if (typeof c === "string") return c;
        return c.scriptName || c.name || "";
      }).filter(Boolean);
    } else {
      shot.character_refs = [];
    }
  }

  // Step 1: Plan cuts and discontinuity risk (inject glue shots)
  const { optimizedShots, glueNotes } = planCuts(rawShots);
  
  // Step 2: Assign camera angles and check 30/180 degree rules
  const warnings = assignCameraAngles(optimizedShots, "A");
  
  // Step 3: Map 3-part prompt structure [ENTRY, CORE, EXIT]
  planShotStructures(optimizedShots);

  // Step 4: Write back to UI-expected fallback properties and plan audio
  // Group optimizedShots by scene_id to generate scene-level audio plans
  const sceneShotsMap: Record<string, CinematicShot[]> = {};
  for (const shot of optimizedShots) {
    const sId = shot.scene_id || "SC01";
    if (!sceneShotsMap[sId]) sceneShotsMap[sId] = [];
    sceneShotsMap[sId].push(shot);
  }

  for (const [sceneId, sceneShots] of Object.entries(sceneShotsMap)) {
    const firstShot = sceneShots[0];
    const location = firstShot.scene_ref || firstShot.bối_cảnh || "bối cảnh";
    
    // Check if the script contains mood clues, fallback to neutral
    const mood = firstShot.action_description?.toLowerCase().includes("căng thẳng") ? "suspense" : "neutral";
    const audioPlan = planAudioForScene(sceneId, sceneShots, mood, location);

    let shotIndex = 1;
    for (const shot of sceneShots) {
      const sh = shot as any;
      // Assign essential UI fields to ensure all shots (including Glue Shots) render properly
      const sceneCode = sceneId || "SC01";
      sh.beat = sh.beat || `${sceneCode}_B${String(shotIndex).padStart(2, "0")}`;
      sh.id = sh.beat;
      sh.sceneId = sh.sceneId || sceneId;
      sh.sc = sh.sc || sceneId;
      sh.sceneNumber = sh.sceneNumber || parseInt(sceneCode.replace(/\D/g, "")) || 1;

      // Set angle string for UI and prompt builder
      if (sh.camera_angle) {
        sh.angle = `${sh.camera_angle.height}-Level (Bearing: ${sh.camera_angle.bearing}°, Side: ${sh.camera_angle.side})`;
      } else {
        sh.angle = sh.angle || "Eye-Level";
      }

      // Set cameraMovement string
      if (sh.camera_movement) {
        sh.cameraMovement = sh.camera_movement;
      }

      // Sync duration
      if (sh.duration_target) {
        sh.duration = sh.duration_target;
      }

      // Đồng bộ ngược thuộc tính action_description -> description & diễn_tả cho UI
      sh.description = sh.action_description || sh.description || "";
      sh.diễn_tả = sh.description;
      
      sh.objective = sh.objective || sh.mục_tiêu || (sh.is_glue ? "Chèn cảnh trám để che điểm nối trục máy." : "");
      sh.mục_tiêu = sh.objective;

      sh.causalLink = sh.causalLink || sh.causal_link || (sh.is_glue ? "Liên kết chuyển cảnh tự động." : "");
      sh.causal_link = sh.causalLink;

      // Plan audio cues for this shot
      const shotCues = audioPlan.cues.filter(c => c.shot_id === sh.id);
      
      // Also add scene-wide cues (ambient & score) to the first shot of the scene
      if (sh.id === firstShot.id) {
        const sceneWideCues = audioPlan.cues.filter(c => c.layer === "score" || c.layer === "ambient");
        shotCues.push(...sceneWideCues);
      }

      // Attach audio plan info to the shot
      (shot as any).audioCues = shotCues;
      (shot as any).audioPlanSummary = `Score: ${mood}, Ambient: ${location}`;

      // Retrieve project style and assets from store
      let styleHint = "";
      let allCharacters: any[] = [];
      let allLocations: any[] = [];
      try {
        const store = useFlowStore.getState();
        styleHint = store.projectData?.stylePrompt || "";
        const nodes = store.nodes || [];
        const worldAssetNode = nodes.find(n => n.type === 'worldAssetNode');
        allCharacters = worldAssetNode?.data?.characters || [];
        allLocations = worldAssetNode?.data?.locations || [];
      } catch (e) {
        console.warn("Could not load flow store in cinematic pipeline:", e);
      }

      // Call prompt builder to compile Cinematic prompt and audit risk flags
      const projectStyle = styleHint || "Pixar-style 3D animation";
      const compiledCard = compileCinematicPrompt(sh, projectStyle);
      
      sh.storyboardPrompt = sh.storyboardPrompt || sh.visual || sh.hình_ảnh || sh.prompt || compiledCard.promptText;
      sh.visual = sh.storyboardPrompt;
      sh.hình_ảnh = sh.storyboardPrompt;
      sh.uploadOutsidePrompt = compiledCard.uploadOutsidePrompt;
      sh.wordCount = compiledCard.wordCount;
      sh.riskFlag = compiledCard.riskFlag;
      sh.riskNotes = compiledCard.riskNotes;

      shotIndex++;
    }
  }
  
  // Step 5: Audit Continuity and assign warning list to each shot
  for (const shot of optimizedShots) {
    shot.warnings = [];
  }
  const continuityWarnings = auditContinuity(optimizedShots);
  for (const cw of continuityWarnings) {
    const shot = optimizedShots.find(s => s.id === cw.shotId);
    if (shot) {
      if (!shot.warnings) shot.warnings = [];
      if (!shot.warnings.includes(cw.message)) {
        shot.warnings.push(cw.message);
      }
    }
    if (!warnings.includes(cw.message)) {
      warnings.push(cw.message);
    }
  }
  
  return { optimizedShots, warnings, glueNotes };
}

export const buildVisualPromptForGrid = (
  grid: string,
  description: string,
  locName: string,
  weather: string,
  lighting: string,
  kind: string,
  angle: string,
  activeCharStr: string
): string => {
  const weatherStr = weather ? `, in ${weather} weather` : "";
  const lightStr = lighting ? `, under ${lighting} lighting` : "";
  
  let styleHint = "Pixar-style 3D animation, soft volume lighting, expressive details";
  try {
    const customStyle = useFlowStore.getState().projectData?.stylePrompt;
    if (customStyle) styleHint = customStyle;
  } catch (e) {}

  if (!grid || grid === '1x1' || grid === 'auto') {
    const target = activeCharStr ? activeCharStr : "the scene";
    return `Cinematic ${kind} shot, ${angle} view, focusing on ${target}. ${description}${weatherStr}${lightStr}. [STYLE] ${styleHint}.`;
  }

  const sentences = description.split(/(?<=[.!?])\s+/).filter(Boolean);
  
  const getSentence = (idx: number) => {
    if (sentences.length === 0) return description;
    return sentences[idx % sentences.length];
  };

  let panelPrompts: string[] = [];
  
  if (grid === '1x2') {
    panelPrompts.push(`Panel 1/2 (Left): [CAMERA] Establishing wide view of ${locName}${lightStr}. [CORE] ${getSentence(0)}. [STYLE] ${styleHint}.`);
    panelPrompts.push(`Panel 2/2 (Right): [CAMERA] Reverse medium angle. [CORE] ${getSentence(1) || 'Dynamic interaction/atmosphere detail'}. [STYLE] ${styleHint}.`);
  } else if (grid === '2x2') {
    panelPrompts.push(`Panel 1/4 (Top-Left): [CAMERA] Establishing wide angle of ${locName}${weatherStr}. [CORE] ${getSentence(0)}. [STYLE] ${styleHint}.`);
    panelPrompts.push(`Panel 2/4 (Top-Right): [CAMERA] Close-up detail focusing on the environment. [CORE] ${getSentence(1) || 'Detailed atmospheric movement'}. [STYLE] ${styleHint}.`);
    panelPrompts.push(`Panel 3/4 (Bottom-Left): [CAMERA] Medium dynamic angle showing contrast. [CORE] ${getSentence(2) || getSentence(0)}. [STYLE] ${styleHint}.`);
    panelPrompts.push(`Panel 4/4 (Bottom-Right): [CAMERA] High angle overview summarizing the climax. [CORE] ${getSentence(3) || getSentence(1) || 'Climactic atmosphere resolution'}. [STYLE] ${styleHint}.`);
  } else if (grid === '2x3') {
    panelPrompts.push(`Panel 1/6 (Top-Left): [CAMERA] Wide shot of ${locName}${weatherStr}. [CORE] ${getSentence(0)}. [STYLE] ${styleHint}.`);
    panelPrompts.push(`Panel 2/6 (Top-Center): [CAMERA] Medium camera tracking. [CORE] ${getSentence(1) || 'Atmospheric wind/rain details'}. [STYLE] ${styleHint}.`);
    panelPrompts.push(`Panel 3/6 (Top-Right): [CAMERA] Low angle detailed view. [CORE] ${getSentence(2) || getSentence(0)}. [STYLE] ${styleHint}.`);
    panelPrompts.push(`Panel 4/6 (Bottom-Left): [CAMERA] OTS perspective showing depth. [CORE] ${getSentence(3) || getSentence(1) || 'Dramatic lighting contrast'}. [STYLE] ${styleHint}.`);
    panelPrompts.push(`Panel 5/6 (Bottom-Center): [CAMERA] Extreme close-up on physical elements/props. [CORE] ${getSentence(4) || getSentence(2) || 'Tactile textures'}. [STYLE] ${styleHint}.`);
    panelPrompts.push(`Panel 6/6 (Bottom-Right): [CAMERA] Wide cinematic sweep fading out. [CORE] ${getSentence(5) || getSentence(0) || 'Atmosphere settling'}. [STYLE] ${styleHint}.`);
  } else if (grid === '3x3') {
    const positions = ["Top-Left", "Top-Center", "Top-Right", "Middle-Left", "Middle-Center", "Middle-Right", "Bottom-Left", "Bottom-Center", "Bottom-Right"];
    for (let i = 0; i < 9; i++) {
      panelPrompts.push(`Panel ${i+1}/9 (${positions[i]}): [CAMERA] Detailed storyboard angle ${i+1}. [CORE] ${getSentence(i)}. [STYLE] ${styleHint}.`);
    }
  } else {
    return `Storyboard ${grid} layout sheet featuring ${locName}. Description: ${description}${weatherStr}${lightStr}. [STYLE] ${styleHint}.`;
  }

  return `[STORYBOARD GRID ${grid}] ${panelPrompts.join("\n")}`;
};
