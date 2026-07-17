export interface QCAuditResult {
  wordCount: number;
  wordBudgetMin: number;
  wordBudgetMax: number;
  wordBudgetStatus: 'good' | 'caution' | 'danger' | 'low';
  wordBudgetMessage: string;
  hasStart: boolean;
  hasMotion: boolean;
  hasCamera: boolean;
  hasEnd: boolean;
  structureScore: number;
  bannedWordsMatched: string[];
  noTextLockOk: boolean;
  noSpeechLockOk: boolean;
  suggestedRiskFlag: 'READY' | 'NEED REF' | 'NEED SPLIT' | 'NEED PATCH' | 'NEED DIRECTOR DECISION';
  suggestedRiskNotes: string[];
  modelAlerts: string[];
}

const checkBannedWord = (prompt: string, word: string): boolean => {
  const regex = new RegExp(`\\b${word}\\b`, 'gi');
  let match;
  while ((match = regex.exec(prompt)) !== null) {
    const matchIndex = match.index;
    const lastPeriod = Math.max(
      prompt.lastIndexOf('.', matchIndex),
      prompt.lastIndexOf('\n', matchIndex)
    );
    const sentenceStart = lastPeriod === -1 ? 0 : lastPeriod + 1;
    const sentence = prompt.substring(sentenceStart, matchIndex).toLowerCase();
    
    // Kiểm tra xem trong cùng một dòng hoặc cùng câu trước từ khóa có các từ phủ định (negative prompt) không
    const isNegative = /\b(no|without|avoid|never|avoiding|do not|don't|no fake|no heavy|no unresolved|no visible)\b/i.test(sentence);
    
    if (!isNegative) {
      return true; // Tìm thấy từ cấm thực sự
    }
  }
  return false;
};

export const runAdvancedQCAudit = (
  promptText: string,
  shotKind: string,
  characterIds: string[],
  locationId: string,
  activeModel: string,
  customProjectRules: string[] = [],
  customEpisodeRules: string[] = []
): QCAuditResult => {
  const cleanPrompt = promptText || '';
  const safeProjectRules = Array.isArray(customProjectRules) ? customProjectRules.filter(r => typeof r === 'string') : [];
  const safeEpisodeRules = Array.isArray(customEpisodeRules) ? customEpisodeRules.filter(r => typeof r === 'string') : [];
  const words = cleanPrompt.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  
  // 1. Determine Word Budget based on model and shot kind
  let wordBudgetMin = 60;
  let wordBudgetMax = 120;
  const kindClean = String(shotKind || 'action').toLowerCase().trim();
  const modelClean = String(activeModel || 'auto').toLowerCase().trim();
  
  if (modelClean.includes('veo') || modelClean.includes('google_veo')) {
    // Veo 3.1 optimal budget: 100-140 words
    if (kindClean === 'reaction' || kindClean === 'dialogue') {
      wordBudgetMin = 80;
      wordBudgetMax = 120;
    } else if (kindClean === 'action') {
      wordBudgetMin = 100;
      wordBudgetMax = 140;
    } else {
      wordBudgetMin = 60;
      wordBudgetMax = 100;
    }
  } else if (modelClean.includes('omni') || modelClean.includes('flash')) {
    // Omni Flash optimal budget: 50-100 words
    wordBudgetMin = 50;
    wordBudgetMax = 100;
  } else {
    // Default Seedance 2.0
    if (kindClean === 'reaction' || kindClean === 'dialogue') {
      wordBudgetMin = 80;
      wordBudgetMax = 120;
    } else if (kindClean === 'action') {
      wordBudgetMin = 110;
      wordBudgetMax = 150;
    } else {
      wordBudgetMin = 60;
      wordBudgetMax = 100;
    }
  }

  let wordBudgetStatus: 'good' | 'caution' | 'danger' | 'low' = 'good';
  let wordBudgetMessage = 'Ngân sách đạt chuẩn';

  if (wordCount === 0) {
    wordBudgetStatus = 'low';
    wordBudgetMessage = 'Prompt trống';
  } else if (wordCount < 40) {
    wordBudgetStatus = 'low';
    wordBudgetMessage = `Quá ngắn (Target: ${wordBudgetMin}-${wordBudgetMax} từ)`;
  } else if (wordCount > 180) {
    wordBudgetStatus = 'danger';
    wordBudgetMessage = 'Danger zone (Trực quan AI dễ bị cắt/drift)';
  } else if (wordCount > 150) {
    wordBudgetStatus = 'caution';
    wordBudgetMessage = 'Caution zone (Khuyên dùng dưới 150 từ)';
  } else if (wordCount < wordBudgetMin) {
    wordBudgetStatus = 'caution';
    wordBudgetMessage = `Hơi ngắn (Target: ${wordBudgetMin}-${wordBudgetMax} từ)`;
  } else if (wordCount > wordBudgetMax) {
    wordBudgetStatus = 'caution';
    wordBudgetMessage = `Hơi dài (Target: ${wordBudgetMin}-${wordBudgetMax} từ)`;
  }

  // 2. Structure Check
  const hasStart = /start:/i.test(cleanPrompt);
  const hasMotion = /motion:|performance:|action:/i.test(cleanPrompt);
  const hasCamera = /camera:/i.test(cleanPrompt);
  const hasEnd = /end:/i.test(cleanPrompt);

  let structureScore = 0;
  if (hasStart) structureScore++;
  if (hasMotion) structureScore++;
  if (hasCamera) structureScore++;
  if (hasEnd) structureScore++;

  // 3. Banned / Drift Keywords Check (Negative locks)
  const speechWords = ["voiceover", "subtitle", "dialogue", "talking", "speech bubble", "says", "speak", "generated speech"];
  const textWords = ["text", "subtitle", "caption", "logo", "watermark", "fake writing", "lettering", "words", "music notes", "lyrics"];
  const morphWords = ["morph", "morphing", "transition", "split screen", "border"];
  const bloodWords = ["blood", "injury", "wound", "cut", "gore"];
  const unsafeWords = [
    // Tiếng Anh (Imagen/Veo safety)
    "gun", "rifle", "knife", "weapon", "sword", "pistol", "bomb", "explosion", "shoot", "kill", "die", "death", "murder", 
    "bleeding", "punch", "kick", "fight", "violence", "war", "soldier", "army",
    "ghost", "monster", "zombie", "demon", "devil", "skeleton", "skull", "corpse", "scary", "spooky", "creepy", "horror", 
    "scream", "terror", "grave", "cemetery", "nude", "naked",
    // Tiếng Việt (StoryMee kids safety)
    "súng", "dao", "kiếm", "vũ khí", "bom", "nổ", "bắn", "giết", "chết", "máu", "vết thương", "đấm", "đá", "đánh", 
    "bạo lực", "chiến tranh", "ma", "quỷ", "quái vật", "xác sống", "bộ xương", "đầu lâu", "xác chết", "đáng sợ", 
    "kinh dị", "thét", "khóc", "bia mộ", "nghĩa trang"
  ];

  const matchedBanned: string[] = [];
  speechWords.forEach(w => {
    if (checkBannedWord(cleanPrompt, w)) matchedBanned.push(w);
  });
  textWords.forEach(w => {
    if (checkBannedWord(cleanPrompt, w)) matchedBanned.push(w);
  });
  morphWords.forEach(w => {
    if (checkBannedWord(cleanPrompt, w)) matchedBanned.push(w);
  });
  bloodWords.forEach(w => {
    if (checkBannedWord(cleanPrompt, w)) matchedBanned.push(w);
  });
  unsafeWords.forEach(w => {
    if (checkBannedWord(cleanPrompt, w)) matchedBanned.push(`nhạy cảm: "${w}"`);
  });

  const noTextLockOk = !textWords.some(w => checkBannedWord(cleanPrompt, w));
  const noSpeechLockOk = !speechWords.some(w => checkBannedWord(cleanPrompt, w));

  // 4. Model-Specific Checks & Alerts
  const modelAlerts: string[] = [];
  let suggestedRiskFlag: 'READY' | 'NEED REF' | 'NEED SPLIT' | 'NEED PATCH' | 'NEED DIRECTOR DECISION' = 'READY';
  const suggestedRiskNotes: string[] = [];

  if (modelClean.includes('veo')) {
    // Check multiple camera movements
    const cameraSection = cleanPrompt.match(/camera:\s*([^\n.]+)/i);
    if (cameraSection) {
      const camText = cameraSection[1].toLowerCase();
      const movementCount = (camText.match(/(pan|zoom|dolly|tilt|orbit|track)/g) || []).length;
      if (movementCount > 1) {
        modelAlerts.push("Veo 3.1: Phát hiện nhiều chuyển động camera phức tạp trong một shot. Khuyên dùng chuyển động đơn giản.");
        suggestedRiskFlag = 'NEED SPLIT';
        suggestedRiskNotes.push("Veo 3.1: Tránh chuyển động camera phức tạp.");
      }
    }
    if (!hasStart || !hasEnd) {
      modelAlerts.push("Veo 3.1: Yêu cầu cú pháp Start: và End: để kiểm soát raccord.");
    }
  } else if (modelClean.includes('omni') || modelClean.includes('flash')) {
    // Check for complex camera movements
    const complexCam = /(dolly zoom|orbit|crane|dolly out)/i.test(cleanPrompt);
    if (complexCam) {
      modelAlerts.push("Omni Flash: Hạn chế chuyển động camera phức tạp (dolly zoom, crane) để giữ chất lượng.");
    }
    if (wordCount > 120) {
      modelAlerts.push("Omni Flash: Prompt quá dài có thể gây suy giảm chất lượng sinh ảnh.");
    }
  } else if (modelClean.includes('narwhal')) {
    if (characterIds.length === 0) {
      modelAlerts.push("Narwhal: Bắt buộc gán đầy đủ nhân vật thiết kế.");
      suggestedRiskFlag = 'NEED REF';
      suggestedRiskNotes.push("Narwhal: Thiếu ảnh ref nhân vật.");
    }
    if (!locationId) {
      if (!suggestedRiskNotes.some(n => n.includes("Narwhal: Chưa liên kết bối cảnh"))) {
        suggestedRiskNotes.push("Narwhal: Chưa liên kết bối cảnh thiết kế.");
      }
    }
  }

  // 5. Custom Project/Episode Rules Verification
  // Check custom rules against prompt content (using keyword matching)
  for (const rule of safeProjectRules) {
    const cleanRule = rule.toLowerCase().trim();
    if (cleanRule.includes('cấm') || cleanRule.includes('chặn') || cleanRule.includes('no')) {
      const match = cleanRule.match(/(?:cấm|chặn|no)\s+([a-z0-9àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđĐ\s]+)/i);
      if (match) {
        const keyword = match[1].trim();
        if (keyword && cleanPrompt.toLowerCase().includes(keyword)) {
          matchedBanned.push(`Dự án: ${keyword}`);
          suggestedRiskFlag = 'NEED DIRECTOR DECISION';
          suggestedRiskNotes.push(`Vi phạm quy tắc dự án: Chứa "${keyword}"`);
        }
      }
    } else {
      // General rule warning if not present (heuristic)
      if (cleanRule.includes('phải có') || cleanRule.includes('yêu cầu')) {
        const match = cleanRule.match(/(?:phải có|yêu cầu)\s+([a-z0-9àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđĐ\s]+)/i);
        if (match) {
          const keyword = match[1].trim();
          if (keyword && !cleanPrompt.toLowerCase().includes(keyword)) {
            suggestedRiskFlag = 'NEED PATCH';
            suggestedRiskNotes.push(`Yêu cầu dự án: Thiếu "${keyword}"`);
          }
        }
      }
    }
  }

  for (const rule of safeEpisodeRules) {
    const cleanRule = rule.toLowerCase().trim();
    if (cleanRule.includes('cấm') || cleanRule.includes('chặn') || cleanRule.includes('no')) {
      const match = cleanRule.match(/(?:cấm|chặn|no)\s+([a-z0-9àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđĐ\s]+)/i);
      if (match) {
        const keyword = match[1].trim();
        if (keyword && cleanPrompt.toLowerCase().includes(keyword)) {
          matchedBanned.push(`Tập: ${keyword}`);
          suggestedRiskFlag = 'NEED DIRECTOR DECISION';
          suggestedRiskNotes.push(`Vi phạm quy tắc tập phim: Chứa "${keyword}"`);
        }
      }
    } else {
      // General rule warning if not present (heuristic)
      if (cleanRule.includes('phải có') || cleanRule.includes('yêu cầu')) {
        const match = cleanRule.match(/(?:phải có|yêu cầu)\s+([a-z0-9àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđĐ\s]+)/i);
        if (match) {
          const keyword = match[1].trim();
          if (keyword && !cleanPrompt.toLowerCase().includes(keyword)) {
            suggestedRiskFlag = 'NEED PATCH';
            suggestedRiskNotes.push(`Yêu cầu tập phim: Thiếu "${keyword}"`);
          }
        }
      }
    }
  }

  // 6. General Risk Flag & Notes (only if not already flagged as DECISION/SPLIT)
  const matchedUnsafe = unsafeWords.filter(w => checkBannedWord(cleanPrompt, w));
  if (matchedUnsafe.length > 0) {
    suggestedRiskFlag = 'NEED DIRECTOR DECISION';
    suggestedRiskNotes.push(`Phát hiện từ khóa nhạy cảm có nguy cơ bị lọc an toàn (Safety Risk): ${matchedUnsafe.map(w => `"${w}"`).join(', ')}`);
  }

  if (!hasStart || !hasEnd) {
    if (suggestedRiskFlag === 'READY') suggestedRiskFlag = 'NEED PATCH';
    if (!suggestedRiskNotes.some(n => n.includes("Start: hoặc End:"))) {
      suggestedRiskNotes.push("Thiếu cú pháp Start: hoặc End: để mô tả frame đầu/cuối.");
    }
  }

  if (characterIds.length === 0) {
    if (suggestedRiskFlag === 'READY' || suggestedRiskFlag === 'NEED PATCH') {
      suggestedRiskFlag = 'NEED REF';
    }
    if (!suggestedRiskNotes.some(n => n.includes("Chưa liên kết nhân vật"))) {
      suggestedRiskNotes.push("Chưa liên kết nhân vật. Cần gán nhân vật.");
    }
  }

  if (!locationId) {
    if (!suggestedRiskNotes.some(n => n.includes("Chưa liên kết bối cảnh"))) {
      suggestedRiskNotes.push("Chưa liên kết bối cảnh (Không bắt buộc).");
    }
  }

  const compoundActionKeywords = ["sau đó", "sau khi", "and then", "then", "sau đấy", "tiếp tục"];
  const hasCompoundAction = compoundActionKeywords.some(kw => cleanPrompt.toLowerCase().includes(kw));
  if (hasCompoundAction || wordCount > 180) {
    if (suggestedRiskFlag !== 'NEED DIRECTOR DECISION') {
      suggestedRiskFlag = 'NEED SPLIT';
    }
    if (!suggestedRiskNotes.some(n => n.includes("Chứa nhiều hành động"))) {
      suggestedRiskNotes.push("Chứa nhiều hành động liên tiếp hoặc quá dài. Cần tách shot.");
    }
  }

  if (cleanPrompt.includes("?") || cleanPrompt.toLowerCase().includes("chưa rõ") || cleanPrompt.toLowerCase().includes("conflict")) {
    suggestedRiskFlag = 'NEED DIRECTOR DECISION';
    if (!suggestedRiskNotes.some(n => n.includes("nghi vấn hoặc mâu thuẫn"))) {
      suggestedRiskNotes.push("Phát hiện truy vấn nghi vấn hoặc mâu thuẫn cần Đạo diễn chốt.");
    }
  }

  if (suggestedRiskNotes.length === 0) {
    suggestedRiskNotes.push("Prompt đạt chuẩn Seedance 2.0 và sẵn sàng!");
  }

  return {
    wordCount,
    wordBudgetMin,
    wordBudgetMax,
    wordBudgetStatus,
    wordBudgetMessage,
    hasStart,
    hasMotion,
    hasCamera,
    hasEnd,
    structureScore,
    bannedWordsMatched: matchedBanned,
    noTextLockOk,
    noSpeechLockOk,
    suggestedRiskFlag,
    suggestedRiskNotes,
    modelAlerts
  };
};
