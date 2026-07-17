/**
 * sceneIntelligence.ts
 * Phân tích thông minh mục đích scene, gợi ý panel grid, shot breakdown
 * và liên kết mood shift trước khi bước vào Generate Shots.
 */

// ─── Keywords to detect exterior / atmosphere shot types ──────────────────────
const EXTERIOR_KEYWORDS = [
  'mưa', 'nắng', 'gió', 'bão', 'sương', 'tuyết', 'xe', 'đường', 'phố',
  'dây phơi', 'mái nhà', 'hàng cây', 'dòng người', 'traffic', 'street',
  'rain', 'wind', 'storm', 'fog', 'neon', 'chợ', 'bến', 'cầu',
  'toà nhà', 'ngõ', 'vỉa hè', 'công viên', 'bờ sông', 'cánh đồng',
  'bầu trời', 'hoàng hôn', 'bình minh', 'đêm tối',
];

const DIALOGUE_KEYWORDS = [
  'nói', 'hỏi', 'trả lời', 'thì thầm', 'la', 'hét', 'khóc', 'cười',
  'nhìn nhau', 'đối mặt', 'nói chuyện', 'tranh cãi', 'im lặng',
  'said', 'asked', 'replied', 'whispered', 'shouted', 'cried',
];

const ACTION_KEYWORDS = [
  'chạy', 'đuổi', 'bắn', 'đánh', 'ngã', 'nhảy', 'trốn', 'vật lộn',
  'đuổi theo', 'xô đẩy', 'tấn công', 'phòng thủ', 'thoát',
  'run', 'chase', 'fight', 'jump', 'dodge', 'attack', 'escape',
];

const ESTABLISH_KEYWORDS = [
  'khu vực', 'tổng quát', 'toàn cảnh', 'establish', 'wide shot',
  'không gian', 'bối cảnh', 'cảnh vật', 'khung cảnh', 'panorama',
];

// ─── Scene Analysis Result types ──────────────────────────────────────────────

export interface ShotTypeMix {
  exterior: number;       // % shots that are exterior/atmospheric
  dialogue: number;       // % shots that are dialogue/reaction
  action: number;         // % shots that are physical action
  establish: number;      // % shots that are establishing
}

export interface ScenePlanBrief {
  purpose: string;                    // Mục đích scene
  openingType: 'establish' | 'action' | 'dialogue' | 'atmosphere'; // Loại mở đầu
  hookPosition: 'early' | 'middle' | 'late' | 'none';             // Vị trí hook cảm xúc
  recommendedGrid: string;            // Grid gợi ý: '1x1','2x2','2x3','3x3'
  recommendedShotCount: number;       // Số shot gợi ý
  shotTypeMix: ShotTypeMix;
  moodShiftFrom: string;              // Mood của scene trước (nếu có)
  moodShiftTo: string;                // Mood của scene này
  moodShiftType: 'gradual' | 'sharp' | 'none';
  causalLinkIn: string;               // Nhân quả từ scene trước
  causalLinkOut: string;              // Nhân quả sang scene sau
  establishingNeeds: string[];        // Những gì cần establish (bối cảnh, nhân vật mới...)
  atmosphericNeeds: string[];         // Những cảnh không khí cần thiết
  rationale: string;                  // Giải thích logic phân tích
  warnings: string[];                 // Cảnh báo thiếu thông tin
}

// ─── Helper: Count keyword matches ────────────────────────────────────────────
function countKeywordMatches(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  return keywords.filter(kw => lower.includes(kw.toLowerCase())).length;
}

// ─── Helper: Detect what establishing shots are needed ──────────────────────
function detectEstablishingNeeds(scene: any): string[] {
  const needs: string[] = [];
  const action = (scene.action || scene.sceneDescription || '').toLowerCase();
  
  if (!scene.location || scene.location === 'Unknown Location') {
    needs.push('Cần wide shot thiết lập bối cảnh tổng quan');
  }
  if (countKeywordMatches(action, EXTERIOR_KEYWORDS) >= 2) {
    needs.push('Cảnh ngoại có nhiều chi tiết môi trường — cần establishing shots đầy đủ');
  }
  if ((scene.charactersInScene || []).length > 2) {
    needs.push('Nhiều nhân vật — cần group shot thiết lập vị trí các nhân vật');
  }
  const arcPos = (scene.arcPosition || 'setup').toLowerCase();
  if (arcPos === 'setup' || arcPos === 'inciting') {
    needs.push('Vị trí trong arc là setup/inciting — nên mở bằng establishing shot để định vị không gian');
  }
  return needs;
}

// ─── Helper: Detect atmospheric shot needs ──────────────────────────────────
function detectAtmosphericNeeds(scene: any): string[] {
  const needs: string[] = [];
  const action = (scene.action || scene.sceneDescription || '').toLowerCase();
  
  const weatherTerms = ['mưa', 'rain', 'bão', 'storm', 'sương', 'fog', 'nắng', 'sunny', 'tuyết', 'snow'];
  const envTerms = ['xe', 'traffic', 'phố', 'street', 'dây phơi', 'hàng cây', 'dòng người', 'chợ'];
  
  const weatherMatches = weatherTerms.filter(kw => action.includes(kw));
  const envMatches = envTerms.filter(kw => action.includes(kw));
  
  if (weatherMatches.length > 0) {
    needs.push(`Thời tiết: ${weatherMatches.join(', ')} — cần insert shots về môi trường (mưa rơi, gió thổi...)`);
  }
  if (envMatches.length > 0) {
    needs.push(`Chi tiết đô thị: ${envMatches.join(', ')} — cần B-roll cuts để xây dựng không khí`);
  }
  if ((scene.lighting || '').toLowerCase().includes('sunset') || (scene.lighting || '').toLowerCase().includes('hoàng hôn')) {
    needs.push('Ánh sáng hoàng hôn — cần ít nhất 1 insert shot về bầu trời/ánh nắng');
  }
  return needs;
}

// ─── Recommend Grid based on shot type mix ──────────────────────────────────
function recommendGrid(mix: ShotTypeMix, sceneChars: string[], intensity: number): { grid: string; count: number; reason: string } {
  const totalAtmo = mix.exterior + mix.establish;
  const isAtmoHeavy = totalAtmo > 50;
  const isDialogueHeavy = mix.dialogue > 50;
  const isActionHeavy = mix.action > 50;
  const manyChars = sceneChars.length >= 3;

  if (isAtmoHeavy && mix.exterior >= 40) {
    // Nhiều cảnh ngoại / môi trường → 2x2 hoặc 2x3 để phát huy atmosphere
    if (mix.exterior >= 60 || manyChars) {
      return { grid: '2x3', count: 6, reason: 'Nhiều cảnh ngoại cảnh + môi trường → 2x3 để cover đủ: establish, atmosphere, action, reaction, close-up, transition' };
    }
    return { grid: '2x2', count: 4, reason: 'Cảnh ngoại trời + môi trường → 2x2 để có: establish, atmosphere, action, close-up' };
  }

  if (isActionHeavy && intensity >= 60) {
    // Cảnh hành động căng thẳng → 2x2 hoặc 2x3
    return { grid: intensity >= 80 ? '2x3' : '2x2', count: intensity >= 80 ? 6 : 4, reason: 'Cảnh hành động/căng thẳng cần nhiều shot để thể hiện tốc độ và kịch tính' };
  }

  if (isDialogueHeavy && !manyChars) {
    // Cảnh đối thoại 2 người → 1x2 hoặc 1x1
    return { grid: '1x2', count: 2, reason: 'Cảnh đối thoại 2 nhân vật → 1x2: over-the-shoulder + reaction shot' };
  }

  if (intensity >= 80) {
    // Cao trào → 2x3 để bùng nổ cảm xúc
    return { grid: '2x3', count: 6, reason: 'Cảnh cao trào (intensity ≥80%) → 2x3 để thể hiện đầy đủ escalation' };
  }

  if (manyChars) {
    return { grid: '2x2', count: 4, reason: 'Nhiều nhân vật → 2x2 để có chỗ cho các phản ứng riêng lẻ' };
  }

  return { grid: '1x1', count: 1, reason: 'Cảnh đơn giản, tập trung vào 1 khoảnh khắc quan trọng' };
}

// ─── Analyze mood shift between scenes ────────────────────────────────────────
function analyzeMoodShift(currentValence: string, prevValence: string, prevEmotion: string, currentEmotion: string): {
  type: 'gradual' | 'sharp' | 'none';
  description: string;
} {
  if (!prevValence) return { type: 'none', description: 'Scene đầu tiên — không có mood shift từ trước' };
  
  const isOpposite = (
    (currentValence === 'positive' && (prevValence === 'negative' || prevValence === 'tense')) ||
    (currentValence === 'negative' && prevValence === 'positive') ||
    ((currentValence === 'tense' || currentValence === 'negative') && prevValence === 'positive')
  );
  
  if (isOpposite) {
    return {
      type: 'sharp',
      description: `Mood shift đột ngột: ${prevEmotion || prevValence} → ${currentEmotion || currentValence}. Cần transition mạnh (smash cut, nhạc đứt, hard cut).`
    };
  }
  
  if (currentValence === prevValence) {
    return {
      type: 'gradual',
      description: `Mood shift nhẹ nhàng: tiếp nối ${prevValence}. Có thể dùng dissolve, J-cut hoặc tiếng động nối tiếp.`
    };
  }
  
  return {
    type: 'gradual',
    description: `Mood shift vừa phải: ${prevEmotion || prevValence} → ${currentEmotion || currentValence}. Dùng L-cut hoặc âm thanh cầu nối.`
  };
}

// ─── Main Analysis Function ────────────────────────────────────────────────────
export function analyzeScene(
  scene: any,
  prevScene?: any,
  nextScene?: any
): ScenePlanBrief {
  const action = scene.action || scene.sceneDescription || '';
  const intensity = scene.emotionIntensity ?? scene.intensity ?? 40;
  const valence = scene.valence || 'neutral';
  const emotion = scene.emotion || 'anticipation';
  const arcPos = (scene.arcPosition || 'setup').toLowerCase();
  const sceneChars = scene.charactersInScene || [];
  const warnings: string[] = [];

  // ── Shot Type Mix Detection ──
  const extMatches = countKeywordMatches(action, EXTERIOR_KEYWORDS);
  const dialogueMatches = countKeywordMatches(action, DIALOGUE_KEYWORDS);
  const actionMatches = countKeywordMatches(action, ACTION_KEYWORDS);
  const establishMatches = countKeywordMatches(action, ESTABLISH_KEYWORDS);
  const totalMatches = Math.max(1, extMatches + dialogueMatches + actionMatches + establishMatches);
  
  const mix: ShotTypeMix = {
    exterior: Math.round((extMatches / totalMatches) * 100),
    dialogue: Math.round((dialogueMatches / totalMatches) * 100),
    action: Math.round((actionMatches / totalMatches) * 100),
    establish: Math.round((establishMatches / totalMatches) * 100),
  };

  // Fallback normalization based on arc position if text has no strong signals
  if (totalMatches <= 2) {
    if (arcPos === 'setup' || arcPos === 'inciting') {
      mix.exterior = Math.max(mix.exterior, 30);
      mix.establish = Math.max(mix.establish, 40);
    } else if (arcPos === 'climax') {
      mix.action = Math.max(mix.action, 60);
    } else if (arcPos === 'falling' || arcPos === 'resolution') {
      mix.dialogue = Math.max(mix.dialogue, 50);
    }
  }

  // ── Grid Recommendation ──
  const gridRec = recommendGrid(mix, sceneChars, intensity);

  // ── Opening Type ──
  let openingType: ScenePlanBrief['openingType'] = 'establish';
  if (arcPos === 'climax' || arcPos === 'rising') openingType = 'action';
  else if (arcPos === 'falling' || arcPos === 'resolution') openingType = 'dialogue';
  else if (mix.exterior >= 40) openingType = 'atmosphere';
  else openingType = 'establish';

  // ── Hook Position ──
  let hookPosition: ScenePlanBrief['hookPosition'] = 'none';
  if (arcPos === 'climax') hookPosition = 'early';
  else if (arcPos === 'rising' || arcPos === 'inciting') hookPosition = intensity >= 60 ? 'middle' : 'late';
  else if (intensity >= 70) hookPosition = 'middle';
  else if (arcPos === 'setup') hookPosition = 'late'; // tease at end of setup scenes

  // ── Mood Shift ──
  const prevValence = prevScene?.valence || '';
  const prevEmotion = prevScene?.emotion || '';
  const moodShift = analyzeMoodShift(valence, prevValence, prevEmotion, emotion);

  // ── Scene Purpose ──
  const purposeMap: Record<string, string> = {
    setup: `Thiết lập thế giới và nhân vật — Mục đích: xây dựng context cho toàn bộ câu chuyện. Khán giả cần biết: ai, ở đâu, khi nào, tâm trạng như thế nào.`,
    inciting: `Sự kiện khai mào — phá vỡ trạng thái bình thường. Mục đích: đẩy nhân vật vào một tình huống không thể từ chối, tạo conflict chính.`,
    rising: `Leo thang kịch tính — nhân vật đối mặt với thử thách ngày càng tăng. Mục đích: xây dựng tension, đặt câu hỏi "Điều gì sẽ xảy ra tiếp theo?".`,
    climax: `Cao trào — đỉnh điểm cảm xúc và kịch tính. Mục đích: giải quyết conflict chính, đưa ra quyết định không thể rút lui.`,
    falling: `Hạ nhiệt sau cao trào — xử lý hậu quả. Mục đích: cho khán giả thở, nhân vật phản ứng với những gì đã xảy ra.`,
    resolution: `Kết thúc — đóng mở câu chuyện. Mục đích: mang lại sự thỏa mãn, để lại dư âm cảm xúc hoặc mở ra câu hỏi mới.`,
  };

  const purpose = purposeMap[arcPos] || `Scene trung gian — tiếp nối câu chuyện, duy trì nhịp độ.`;

  // ── Causal Links ──
  const causalLinkIn = prevScene
    ? `Từ cảnh trước (${prevScene.sceneId || 'scene trước'} — ${prevEmotion || prevValence}): ${moodShift.description}`
    : 'Cảnh mở đầu — không có cảnh trước liên kết.';
  
  const causalLinkOut = nextScene
    ? `Dẫn sang cảnh tiếp theo (${nextScene.sceneId || 'scene sau'} — ${nextScene.emotion || nextScene.valence || '?'}): kết thúc cảnh này phải tạo ra lý do / câu hỏi để khán giả tiếp tục xem.`
    : 'Cảnh cuối — cần landing mạnh để kết thúc câu chuyện hoặc để lại open ending.';

  // ── Warnings ──
  if (!action || action.trim().length < 15) warnings.push('Mô tả hành động quá ngắn — phân tích có thể không chính xác');
  if (sceneChars.length === 0) warnings.push('Chưa xác định nhân vật — shot breakdown sẽ thiếu character references');
  if (!scene.location) warnings.push('Chưa xác định bối cảnh — establish shot không thể định vị');

  // ── Atmospheric & Establishing Needs ──
  const establishingNeeds = detectEstablishingNeeds({ ...scene, arcPosition: arcPos });
  const atmosphericNeeds = detectAtmosphericNeeds(scene);

  // ── Final Rationale ──
  const rationale = [
    `Arc position: ${arcPos.toUpperCase()} (intensity ${intensity}%)`,
    `Shot mix: Exterior ${mix.exterior}% | Dialogue ${mix.dialogue}% | Action ${mix.action}% | Establish ${mix.establish}%`,
    `Grid: ${gridRec.grid} — ${gridRec.reason}`,
    `Hook: vị trí ${hookPosition} của scene`,
    moodShift.type !== 'none' ? `Mood shift: ${moodShift.type} — ${moodShift.description}` : '',
  ].filter(Boolean).join('\n');

  return {
    purpose,
    openingType,
    hookPosition,
    recommendedGrid: gridRec.grid,
    recommendedShotCount: gridRec.count,
    shotTypeMix: mix,
    moodShiftFrom: prevValence || '(đầu)' ,
    moodShiftTo: valence,
    moodShiftType: moodShift.type,
    causalLinkIn,
    causalLinkOut,
    establishingNeeds,
    atmosphericNeeds,
    rationale,
    warnings,
  };
}
