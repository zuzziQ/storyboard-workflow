export interface CinematicPromptCard {
  shotId: string;
  duration: string;
  uploadOutsidePrompt: string;
  promptText: string;
  videoPromptText: string;
  wordCount: number;
  riskFlag: 'READY' | 'NEED REF' | 'NEED SPLIT' | 'NEED PATCH' | 'NEED DIRECTOR DECISION';
  riskNotes: string[];
}

function getCharacterSizeDescription(size: string): string {
  if (!size) return "";
  const map: Record<string, string> = {
    extreme_closeup: "extreme close-up shot, character filling the frame, showing detail",
    closeup: "close-up shot, character is large in the frame, portrait framing",
    medium_shot: "medium shot, character size is balanced, waist-up framing",
    medium_wide: "medium wide shot, character is visible knee-up, slightly smaller in the frame",
    wide_shot: "wide shot, character is small in the frame, full body visible",
    extreme_wide: "extreme wide shot, character size is very small, tiny in the frame, dominant background"
  };
  return map[size] || "";
}

/**
 * Compiles visual shot fields into a strict Cinematic Prompt card
 */
export function compileCinematicPrompt(sh: any, projectStyle: string = "Pixar-style 3D animation"): CinematicPromptCard {
  const shotId = sh.id || sh.beat || "S01.01";
  const duration = `${sh.duration || 4}s`;
  const ratio = "16:9";

  const action = sh.description || sh.action || "";
  const dialogue = sh.thoại || sh.dialogue || "";
  const framing = sh.kind || sh.framing || "Medium Shot";
  const camera = sh.camera || sh.cameraMovement || "Static";

  const firstFrame = sh.firstFrameState || sh.rawFields?.["First Frame Exact Visual State"] || "";
  const physicalDelta = sh.physicalDelta || sh.rawFields?.["Physical Motion Delta"] || "";
  const plannedLastFrame = sh.plannedLastFrame || sh.rawFields?.["Planned Last Frame / Clean Out Anchor"] || "";
  const propState = sh.propState || sh.rawFields?.["Prop / Object State (end of shot)"] || "";
  const visualBridge = sh.causalLink || sh.visualBridge || sh.rawFields?.["Camera Transition Geometry / Visual Bridge"] || "";

  // 1. Detect Shot Category
  let category: 'action' | 'reaction' | 'insert' = 'action';
  const framingLower = String(framing).toLowerCase();
  const actionLower = String(action).toLowerCase();

  if (framingLower.includes('ecu') || framingLower.includes('close-up insert') || actionLower.includes('insert') || propState) {
    category = 'insert';
  } else if (dialogue || framingLower.includes('mcu') || framingLower.includes('reaction') || actionLower.includes('react') || actionLower.includes('cười') || actionLower.includes('khóc')) {
    category = 'reaction';
  }

  // 2. Identify referenced characters/assets for Upload Outside Prompt
  const uploadRefs: string[] = [];
  const charRefs: string[] = sh.detectedCharacters || sh.character_refs || [];
  
  // Lấy tên nhân vật thật và tên bối cảnh thật
  const charNamesStr = charRefs.length > 0 ? charRefs.join('/') : "characters";
  const locationName = sh.locationName || sh.bối_cảnh || "environment";

  // Sử dụng Tên nhân vật, Tên bối cảnh thật thay thế cho @IMAGE2 hay @IMAGE1
  uploadRefs.push(`@${locationName} = [locked bối cảnh ${locationName} identity ref]`);
  if (charRefs.length > 0) {
    uploadRefs.push(`@${charNamesStr} = [locked nhân vật ${charNamesStr} identity ref]`);
  }
  if (category === 'insert' && propState) {
    uploadRefs.push(`@IMAGE3 = [optional prop/object target ref]`);
  }

  // 3. Compile prompt based on category template
  const charSizeDesc = getCharacterSizeDescription(sh.characterSize);
  let promptText = "";
  let videoPromptText = "";

  // Emotional Arc and Lighting extraction
  const rawEmotion = sh.emotion || sh.sceneEmotion || "focused";
  const rawIntensity = sh.sceneEmotionIntensity ?? sh.emotionIntensity;
  const intensityScore = rawIntensity !== undefined && rawIntensity !== null
    ? Math.min(10, Math.max(1, Math.round(Number(rawIntensity) > 10 ? Number(rawIntensity) / 10 : Number(rawIntensity))))
    : null;
  const emotionDesc = intensityScore ? `${rawEmotion} (intensity: ${intensityScore}/10)` : rawEmotion;
  const emotionPerformance = `Emotional tone: ${emotionDesc}. Facial expression & body language reflecting ${rawEmotion}.`;

  // Lighting & Atmosphere
  const lightingParts: string[] = [];
  if (sh.sceneLighting) lightingParts.push(`Lighting: ${sh.sceneLighting}`);
  if (sh.sceneWeather) lightingParts.push(`Atmosphere: ${sh.sceneWeather}`);
  const lightingAtmosphere = lightingParts.length > 0 ? ` ${lightingParts.join('. ')}.` : '';

  // Clean video style header without @IMAGE1 or [environment] for modern video AI models (Veo 3.1, Dreamina, Kling)
  const cleanLocationName = (locationName && locationName !== 'environment') ? locationName : '';
  const locationTag = cleanLocationName ? `, setting: ${cleanLocationName}` : '';
  const videoStyleHeader = `Cinematic 3D animation, ${projectStyle}${locationTag}, ${ratio}, ${framing}.${charSizeDesc ? ' Character scale: ' + charSizeDesc + '.' : ''}${lightingAtmosphere}`;

  // Storyboard header with characters/location identity refs
  const storyboardStyleHeader = `Premium stylized 3D family animation, ${projectStyle}, bối cảnh @${locationName}, ${ratio}, ${framing}.${charSizeDesc ? ' Character scale: ' + charSizeDesc + '.' : ''} Match characters @${charNamesStr} for identity, composition, spatial layout.${lightingAtmosphere}`;

  // Filter semantic terms from prompts
  const cleanFirstFrame = cleanSemanticLanguage(firstFrame || action);
  const cleanDelta = cleanSemanticLanguage(physicalDelta || action);
  const cleanLastFrame = cleanSemanticLanguage(plannedLastFrame || action);

  const cleanFirstFrameImg = cleanStoryboardOnlyPrompt(cleanFirstFrame);
  const cleanDeltaImg = cleanStoryboardOnlyPrompt(cleanDelta);

  if (category === 'insert') {
    // Storyboard visual: Static composition, no video-only stuff
    promptText = `${storyboardStyleHeader} Subject: ${cleanFirstFrameImg}. Setup: ${cleanDeltaImg}. Prop State: ${propState || "stable"}. No text, subtitles, UI, logos, panel border.`;
    // Video visual: Motion, camera, timing
    videoPromptText = `${videoStyleHeader} Start: object in focus ${cleanFirstFrame}. Motion: single physical change — ${cleanDelta}. Camera: locked readable close-up. End: ${cleanLastFrame}. Prop State: ${propState || "stable"}. Soft ambient sound only. No text, subtitles, UI, logos, panel border, morphing.`;
  } else if (category === 'reaction') {
    // Storyboard visual: Static composition, no video-only stuff
    promptText = `${storyboardStyleHeader} Subject: character position ${cleanFirstFrameImg}. Expression: ${rawEmotion}. No text, subtitles, UI, logos.`;
    // Video visual: Motion, camera, timing
    videoPromptText = `${videoStyleHeader} Start: character position ${cleanFirstFrame}. ${emotionPerformance} Camera: ${camera}. Performance: subtle acting, natural eye focus and fluid head motion. End: ${cleanLastFrame}. Room tone only. No speech audio, subtitles, captions, UI, logos, panel border, morphing.`;
  } else {
    // Storyboard visual: Static composition, no video-only stuff
    promptText = `${storyboardStyleHeader} Subject: ${cleanFirstFrameImg}. Action Setup: ${cleanDeltaImg}. Expression: ${rawEmotion}. No text, subtitles, UI, logos, panel border.`;
    // Video visual: Motion, camera, timing
    videoPromptText = `${videoStyleHeader} Start: ${cleanFirstFrame}. Motion: one clean primary action — ${cleanDelta}. ${emotionPerformance} Camera: ${camera}. End: ${cleanLastFrame}. Ambient action sounds only. No speech audio, subtitles, captions, UI, logos, panel border, morphing.`;
  }

  // Sanitize simulated tags or noise text from video prompt
  videoPromptText = videoPromptText
    .replace(/@IMAGE\d+/gi, '')
    .replace(/\[environment\]/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+\./g, '.')
    .replace(/\.{2,}/g, '.')
    .trim();

  // 4. Word count calculation and compression safety
  const wordCount = videoPromptText.split(/\s+/).filter(Boolean).length;

  // 5. Auditing Risk Flags
  const riskNotes: string[] = [];
  let riskFlag: CinematicPromptCard['riskFlag'] = 'READY';

  // Check 1: Missing critical fields (Addendum v005 check)
  if (!firstFrame || !plannedLastFrame) {
    riskFlag = 'NEED PATCH';
    riskNotes.push("Thiếu thông tin First Frame Exact Visual State hoặc Planned Last Frame.");
  }

  // Check 2: Missing character/asset references
  if (charRefs.length > 0 && !sh.imageUrl && !sh.mediaId) {
    riskFlag = 'NEED REF';
    riskNotes.push(`Nhân vật ${charRefs.join(', ')} chưa có ảnh thiết kế/root reference.`);
  }

  // Check 3: Overloaded actions (Multiple compound verbs)
  const compoundActionKeywords = ["sau đó", "sau khi", "and then", "then", "sau đấy", "tiếp tục"];
  const hasCompoundAction = compoundActionKeywords.some(kw => actionLower.includes(kw));
  if (hasCompoundAction || (sh.duration > 8 && category === 'action')) {
    riskFlag = 'NEED SPLIT';
    riskNotes.push("Shot chứa nhiều hành động tuần tự hoặc thời lượng quá dài (>8s). Cân nhắc tách Clip Unit.");
  }

  // Check 4: Director Decision / Contradictions
  if (actionLower.includes("?") || String(visualBridge).toLowerCase().includes("chưa rõ") || actionLower.includes("conflict")) {
    riskFlag = 'NEED DIRECTOR DECISION';
    riskNotes.push("Có mâu thuẫn hoặc chưa rõ ràng trong kịch bản (cần Đạo diễn chốt).");
  }

  return {
    shotId,
    duration,
    uploadOutsidePrompt: uploadRefs.join('\n'),
    promptText,
    videoPromptText,
    wordCount,
    riskFlag,
    riskNotes
  };
}

/**
 * Strips non-visual semantic terms from prompt strings and replaces them with visual descriptors
 */
function cleanSemanticLanguage(text: string): string {
  if (!text) return "";
  
  let cleaned = text;
  
  // Replace semantic phrases with visual actions
  const replacements: Array<[RegExp, string]> = [
    [/hiểu ra|nhận ra|phát hiện/gi, "mắt mở to, liếc nhìn"],
    [/tức giận|giận dữ/gi, "cau mày, hai tay nắm chặt"],
    [/buồn bã|thất vọng/gi, "cúi đầu gục xuống, mắt nhìn xuống sàn"],
    [/lo lắng|sợ hãi/gi, "vai co lại, mắt đảo liên tục, giữ khoảng cách"],
    [/ngạc nhiên|sốc/gi, "hơi há miệng, đầu lùi lại phía sau"],
    [/dramatic irony|relationship turn|cảm nhận/gi, "nhìn thẳng nhau, ánh mắt giao nhau"]
  ];

  for (const [regex, replacement] of replacements) {
    cleaned = cleaned.replace(regex, replacement);
  }

  return cleaned;
}

/**
 * Strips camera movement, video time sequence, and character sheet elements from storyboard prompts
 */
function cleanStoryboardOnlyPrompt(text: string): string {
  if (!text) return "";
  let cleaned = text;

  // 1. Remove camera movements and camera specs
  const cameraPatterns = [
    /\b(camera zoom|zoom in|zoom out|pan left|pan right|tilt up|tilt down|dolly in|dolly out|camera follows|camera tracks|tracking shot|camera panning|camera panning to|panning|orbiting|locked camera|interview axis|axis lock)\b/gi,
    /\b(cận cảnh|toàn cảnh|trung cảnh|góc máy|xoay máy|di chuyển máy|máy ảnh|camera)\b/gi
  ];
  
  for (const pattern of cameraPatterns) {
    cleaned = cleaned.replace(pattern, "");
  }

  // 2. Remove video motion transition words that imply sequence/time
  const videoTimePatterns = [
    /\b(sau đó|sau khi|tiếp theo|tiếp tục|then|next|after that|afterward|afterwards|gradually|slowly|suddenly)\b/gi,
    /\b(bắt đầu|kết thúc|chuẩn bị|start|end|beginning|ending)\b/gi
  ];

  for (const pattern of videoTimePatterns) {
    cleaned = cleaned.replace(pattern, "");
  }

  // 3. Remove character sheet indicators to avoid grid/multiple views of character
  const characterSheetPatterns = [
    /\b(character sheet|character design|concept art sheet|t-pose|multiple views|turnaround|front view|side view|model sheet|poses|expressions|collage|grid|split screen|multiple poses)\b/gi,
    /\b(bảng thiết kế|thiết kế nhân vật|nhiều tư thế|nhiều góc nhìn|xoay vòng|tư thế t)\b/gi
  ];

  for (const pattern of characterSheetPatterns) {
    cleaned = cleaned.replace(pattern, "");
  }

  // Clean double spaces/periods
  cleaned = cleaned.replace(/\s+/g, " ")
                   .replace(/\.+/g, ".")
                   .replace(/\s+\./g, ".")
                   .trim();

  return cleaned;
}
