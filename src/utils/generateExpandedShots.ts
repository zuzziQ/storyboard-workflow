import { runCinematicPipeline, buildVisualPromptForGrid } from "../lib/cinematic-engine";

function suggestPanelGrid(_description: string): string {
  return '1x1';
}

function enrichShotDescription(
  actionText: string,
  scene: any,
  shotIndex: number,
  _totalShots: number,
  grid: string
): string {
  const weather = (scene.weather || '').toLowerCase();
  const lighting = (scene.lighting || '').toLowerCase();
  const actionLower = (actionText || '').toLowerCase();

  let enriched = actionText || '';

  // Get weather details based on current grid and weather type
  let weatherDetail = '';
  if (weather.includes('bão') || weather.includes('giông') || weather.includes('storm') || weather.includes('mưa lớn') || actionLower.includes('giông bão') || actionLower.includes('mưa bão') || actionLower.includes('sét')) {
    const details = [
      'Trời mưa bão bùng trắng xóa, sấm chớp gián đoạn giật sáng rực xé rách bầu trời đen kịt.',
      'Gió giật mạnh phần phật làm các hàng cây bên đường nghiêng ngả dữ dội, lá cây bay hỗn loạn.',
      'Dưới đường, xe cộ tấp nập vội vã bật đèn pha, xe cộ tránh mưa nép sát vỉa hè hoặc dưới mái hiên.',
      'Quần áo phơi trên dây ở ban công bay lả tả, giật liên hồi và chao đảo mạnh trong gió lớn.',
      'Nước mưa xối xả đập mạnh vào lòng đường nhựa tạo thành các vũng nước lớn bắn tung tóe dưới bánh xe.'
    ];
    if (grid === '1x2') {
      weatherDetail = `${details[0]} ${details[1]}`;
    } else if (grid === '2x2') {
      weatherDetail = `${details[0]} ${details[1]} ${details[2]} ${details[3]}`;
    } else if (grid === '2x3') {
      weatherDetail = `${details[0]} ${details[1]} ${details[2]} ${details[3]} ${details[4]}`;
    } else if (grid === '3x3') {
      weatherDetail = `${details[0]} ${details[1]} ${details[2]} ${details[3]} ${details[4]} ${details[0]} ${details[1]} ${details[2]} ${details[3]}`;
    } else {
      weatherDetail = details[shotIndex % details.length];
    }
  } else if (weather.includes('mưa') || weather.includes('rain') || actionLower.includes('mưa')) {
    const details = [
      'Cơn mưa bay lất phất làm mờ ảo toàn bộ cảnh vật xung quanh.',
      'Những hạt mưa li ti đọng trên các lá cây và ô cửa kính tạo thành những vệt nước chảy dài.',
      'Mặt đường nhựa ẩm ướt lấp loáng phản chiếu ánh đèn đường dịu nhẹ.',
      'Không khí se lạnh, hơi nước bốc lên từ mặt đất tạo nên lớp sương mỏng u ám bao trùm.',
      'Nhân vật kéo cao cổ áo hoặc vội vã che ô dưới những giọt nước mưa rơi đều đặc.'
    ];
    if (grid === '1x2') {
      weatherDetail = `${details[0]} ${details[1]}`;
    } else if (grid === '2x2') {
      weatherDetail = `${details[0]} ${details[1]} ${details[2]} ${details[3]}`;
    } else if (grid === '2x3') {
      weatherDetail = `${details[0]} ${details[1]} ${details[2]} ${details[3]} ${details[4]}`;
    } else if (grid === '3x3') {
      weatherDetail = `${details[0]} ${details[1]} ${details[2]} ${details[3]} ${details[4]} ${details[0]} ${details[1]} ${details[2]} ${details[3]}`;
    } else {
      weatherDetail = details[shotIndex % details.length];
    }
  } else if (weather.includes('nắng') || weather.includes('sunny') || weather.includes('hoàng hôn') || weather.includes('sunset') || lighting.includes('sunset') || lighting.includes('hoàng hôn') || actionLower.includes('nắng') || actionLower.includes('hoàng hôn')) {
    const details = [
      'Ánh nắng rực rỡ chiếu xiên khoai qua các tán cây, tạo thành các vệt sáng lung linh trong không khí.',
      'Những hạt bụi nhỏ bay lơ lửng trong không gian ấm áp tĩnh lặng, lấp lánh dưới nắng.',
      'Bóng đổ của các tòa nhà và nhân vật kéo dài thướt tha trên nền đất rực rỡ.',
      'Bầu trời nhuộm tông màu ấm áp từ cam đào rực sáng đến màu hồng tím nhạt ở phía chân trời.',
      'Ánh sáng hoàng hôn vàng óng phản chiếu lấp lánh lên bờ vai và mái tóc nhân vật.'
    ];
    if (grid === '1x2') {
      weatherDetail = `${details[0]} ${details[1]}`;
    } else if (grid === '2x2') {
      weatherDetail = `${details[0]} ${details[1]} ${details[2]} ${details[3]}`;
    } else if (grid === '2x3') {
      weatherDetail = `${details[0]} ${details[1]} ${details[2]} ${details[3]} ${details[4]}`;
    } else if (grid === '3x3') {
      weatherDetail = `${details[0]} ${details[1]} ${details[2]} ${details[3]} ${details[4]} ${details[0]} ${details[1]} ${details[2]} ${details[3]}`;
    } else {
      weatherDetail = details[shotIndex % details.length];
    }
  } else if (weather.includes('gió') || weather.includes('wind') || actionLower.includes('gió')) {
    const details = [
      'Gió thổi mạnh lồng lộng cuốn theo những lá khô bay xào xạc rải rác trên mặt đường.',
      'Tóc và tà áo của nhân vật bay phần phật, tạo cảm giác chuyển động khí quyển sống động.',
      'Bụi cát và những mảnh giấy vụn tung bay mờ ảo theo từng cơn gió rít.',
      'Các tán cây xung quanh đung đưa xào xạc theo nhịp gió rít nhè nhẹ.'
    ];
    if (grid === '1x2') {
      weatherDetail = `${details[0]} ${details[1]}`;
    } else if (grid === '2x2') {
      weatherDetail = `${details[0]} ${details[1]} ${details[2]} ${details[3 % details.length]}`;
    } else if (grid === '2x3') {
      weatherDetail = `${details[0]} ${details[1]} ${details[2]} ${details[3 % details.length]} ${details[0]}`;
    } else {
      weatherDetail = details[shotIndex % details.length];
    }
  }

  if (weatherDetail) {
    if (grid !== '1x1' && grid !== 'auto') {
      enriched = `${enriched}. ${weatherDetail}`;
    } else {
      enriched = `${enriched}. Khung cảnh xung quanh: ${weatherDetail.toLowerCase()}`;
    }
  }

  return enriched;
}

function suggestCameraSequences(grid: string, kind: string): { cameraMovement: string, angle: string } {
  if (!grid || grid === '1x1' || grid === 'auto') {
    if (kind === 'establishing') {
      return { cameraMovement: 'Dolly In', angle: 'High Angle' };
    } else if (kind === 'detail') {
      return { cameraMovement: 'Zoom In', angle: 'Close-up' };
    } else if (kind === 'reaction') {
      return { cameraMovement: 'Handheld', angle: 'Close-up' };
    } else if (kind === 'dialogue') {
      return { cameraMovement: 'Static', angle: 'Over the Shoulder' };
    } else if (kind === 'transition') {
      return { cameraMovement: 'Dolly Out', angle: 'Wide Shot' };
    } else {
      return { cameraMovement: 'Pan Left', angle: 'Eye-Level' };
    }
  }

  if (grid === '1x2') {
    return {
      cameraMovement: 'Static',
      angle: 'Over the Shoulder'
    };
  } else if (grid === '2x2') {
    return {
      cameraMovement: 'Tracking Shot',
      angle: 'Eye-Level'
    };
  } else if (grid === '2x3') {
    return {
      cameraMovement: 'Pan Left',
      angle: 'Medium Shot'
    };
  } else if (grid === '3x3') {
    return {
      cameraMovement: 'Static',
      angle: 'Wide Shot'
    };
  }

  return { cameraMovement: 'Static', angle: 'Eye-Level' };
}


export const generateExpandedShots = (
  scenes: any[],
  charNames: string[],
  totalDuration: number = 180,
  avgShotDuration: number = 4,
  scriptText?: string
) => {
  charNames = (charNames as any[] || []).map(c => typeof c === 'string' ? c : (c?.name || '')).filter(Boolean);
  if (!scenes || scenes.length === 0) return [];

  // Calculate number of shots based on duration inputs
  const totalShots = Math.max(scenes.length, Math.round(totalDuration / avgShotDuration));

  // Distribution logic for scenes
  const shotsPerScene = new Array(scenes.length).fill(0);
  let remainingShots = totalShots;
  for (let i = 0; i < scenes.length; i++) {
    shotsPerScene[i] = 1;
    remainingShots--;
  }
  if (remainingShots > 0) {
    const base = Math.floor(remainingShots / scenes.length);
    for (let i = 0; i < scenes.length; i++) {
      shotsPerScene[i] += base;
    }
    remainingShots = remainingShots % scenes.length;
    for (let i = 0; i < remainingShots; i++) {
      shotsPerScene[i] += 1;
    }
  }

  // Parse scriptText into a map of scene index / sceneNumber -> { dialogues: { character, action, line }[], actionLines: string[] }
  const parsedScenesMap: Record<string, { dialogues: any[], actionLines: string[] }> = {};
  if (scriptText) {
    // Split scriptText by "Cảnh [number]", "Scene [number]", or standard script heading (INT. / EXT. at start of line)
    const blocks = scriptText.split(/(?=Cảnh \d+|Scene \d+|^INT\.|^EXT\.|[\r\n]+(?:INT|EXT)\.)/gi);
    
    // Filter and prepare actual scene blocks
    const actualBlocks: string[] = [];
    blocks.forEach(block => {
      const trimmed = block.trim();
      if (!trimmed) return;
      if (trimmed.match(/^(?:Cảnh|Scene|INT\.|EXT\.)/i)) {
        actualBlocks.push(block);
      }
    });

    actualBlocks.forEach((block, blockIndex) => {
      const dialogues: any[] = [];
      const actionLines: string[] = [];
      const lines = block.split(/\r?\n/);
      
      for (let idx = 0; idx < lines.length; idx++) {
        const line = lines[idx];
        const cleanLine = line.trim();
        if (!cleanLine) continue;
        
        // Skip scene header
        if (cleanLine.match(/^(?:Cảnh|Scene|INT\.|EXT\.)/i)) continue;
        
        // Skip ACT headings and FADE IN / FADE OUT
        if (cleanLine.match(/^(?:ACT\s+[I|V|X]+|FADE\s+IN|FADE\s+OUT|FADE\s+TO)/i)) continue;

        // Check if it starts with "Hành động:"
        if (cleanLine.startsWith("Hành động:")) {
          const actionText = cleanLine.replace(/^Hành động:\s*/i, "").trim();
          if (actionText) actionLines.push(actionText);
          continue;
        }

        // 1. Check for Colon format: "Name: (Action) Dialogue" or "Name: Dialogue"
        const diagMatch = cleanLine.match(/^([^:]+):\s*(?:\(([^)]+)\))?\s*(.*)$/);
        if (diagMatch) {
          const charName = diagMatch[1].trim();
          const isChar = charNames.some(cn => cn.toLowerCase() === charName.toLowerCase()) || 
                         ["mica", "paco", "bố", "kilo", "bruno", "wolfie", "wollfie", "chloe", "elena", "bác bình", "bác chủ tiệm", "cam", "chú vẹt"].includes(charName.toLowerCase());
          if (isChar) {
            dialogues.push({
              character: charName,
              action: diagMatch[2] ? diagMatch[2].trim() : "",
              line: diagMatch[3] ? diagMatch[3].trim() : ""
            });
            continue;
          }
        }

        // 2. Check for Standard Screenplay format
        const isCharName = charNames.some(cn => cn.toLowerCase() === cleanLine.toLowerCase()) || 
                           ["mica", "paco", "bố", "kilo", "bruno", "wolfie", "wollfie", "chloe", "elena", "bác bình", "bác chủ tiệm", "cam", "chú vẹt"].includes(cleanLine.toLowerCase());
        
        if (isCharName && !cleanLine.includes(":") && cleanLine.length < 30) {
          // Look ahead to check parenthetical and/or dialogue text
          let nextLine = "";
          let lookAheadIdx = idx + 1;
          
          while (lookAheadIdx < lines.length && !nextLine) {
            const candidate = lines[lookAheadIdx].trim();
            if (candidate) {
              nextLine = candidate;
            } else {
              lookAheadIdx++;
            }
          }
          
          if (nextLine) {
            if (nextLine.startsWith("(")) {
              const paren = nextLine.replace(/[()]/g, "").trim();
              
              let nextNextLine = "";
              let lookAheadIdx2 = lookAheadIdx + 1;
              while (lookAheadIdx2 < lines.length && !nextNextLine) {
                const candidate = lines[lookAheadIdx2].trim();
                if (candidate) {
                  nextNextLine = candidate;
                } else {
                  lookAheadIdx2++;
                }
              }
              
              if (nextNextLine) {
                dialogues.push({
                  character: cleanLine,
                  action: paren,
                  line: nextNextLine
                });
                idx = lookAheadIdx2;
                continue;
              }
            } else {
              dialogues.push({
                character: cleanLine,
                action: "",
                line: nextLine
              });
              idx = lookAheadIdx;
              continue;
            }
          }
        }

        // 3. Otherwise, treat as action line
        if (!cleanLine.includes(":")) {
          actionLines.push(cleanLine);
        }
      }

      const matchNum = block.match(/(?:Cảnh|Scene)\s+(\d+)/i);
      if (matchNum) {
        const sceneNum = parseInt(matchNum[1]);
        parsedScenesMap[`num_${sceneNum}`] = { dialogues, actionLines };
      }
      
      parsedScenesMap[`idx_${blockIndex}`] = { dialogues, actionLines };
    });
  }

  const sampleBeats = (pool: any[], K: number, sceneCode: string) => {
    if (K <= 0) return [];
    const sampled: any[] = [];
    if (K === 1) {
      const idx = Math.min(pool.length - 1, 0); // Always start with establishing if K=1
      sampled.push({
        ...pool[idx],
        beat: `${sceneCode}_B01`,
        sc: sceneCode,
        T: avgShotDuration,
        shotNumber: 1
      });
    } else if (K === 2) {
      sampled.push({
        ...pool[0],
        beat: `${sceneCode}_B01`,
        sc: sceneCode,
        T: avgShotDuration,
        shotNumber: 1
      });
      sampled.push({
        ...pool[Math.min(pool.length - 1, pool.length > 2 ? 2 : 1)],
        beat: `${sceneCode}_B02`,
        sc: sceneCode,
        T: avgShotDuration,
        shotNumber: 2
      });
    } else {
      for (let j = 0; j < K; j++) {
        let index = 0;
        if (K > 1) {
          index = Math.min(pool.length - 1, Math.round((j / (K - 1)) * (pool.length - 1)));
        }
        const baseBeat = pool[index];
        sampled.push({
          ...baseBeat,
          beat: `${sceneCode}_B${String(j + 1).padStart(2, "0")}`,
          sc: sceneCode,
          T: avgShotDuration,
          shotNumber: j + 1
        });
      }
    }
    return sampled;
  };

  const result: any[] = [];
  scenes.forEach((s, i) => {
    const scNumber = s.sceneNumber || (i + 1);
    const scCode = `SC${String(scNumber).replace(/[^0-9]/g, "").padStart(2, "0") || "01"}`;
    const count = shotsPerScene[i];
    
    const desc = s.description || "";
    const title = s.title || "";
    
    // Retrieve dialogues and action lines parsed from scriptText
    const blockData = parsedScenesMap[`num_${scNumber}`] || parsedScenesMap[`idx_${i}`];
    const dialogues = blockData ? blockData.dialogues : [];
    
    // Build action lines: either from parser or split from scene description
    let actionLines = blockData ? blockData.actionLines : [];
    if (actionLines.length === 0) {
      // Split scene description by sentences
      actionLines = desc.split(/(?<=[.!?])\s+/).filter(Boolean);
    }
    
    // Find characters in the scene
    const sceneChars = charNames.filter(name => 
      desc.toLowerCase().includes(name.toLowerCase()) || 
      title.toLowerCase().includes(name.toLowerCase()) ||
      dialogues.some((d: any) => d.character.toLowerCase() === name.toLowerCase())
    );
    
    // Explicit character role assignment: no fallbacks to unmentioned characters!
    const primeChar = sceneChars[0] || "";
    const secondChar = sceneChars[1] || "";
    const locName = s.location || title || "không gian";

    // Build pool dynamically
    const pool: any[] = [];

    // Slot 1: Establishing Shot
    {
      const act = actionLines[0] || desc || "";
      const charStr = sceneChars.join(", ");
      const baseDesc = `Cảnh toàn rộng (Establishing Shot) thiết lập bối cảnh tại ${locName}. ${act}`;
      const suggestedGrid = suggestPanelGrid(baseDesc);
      const enrichedDesc = enrichShotDescription(baseDesc, s, 0, 6, suggestedGrid);
      const camAndAngle = suggestCameraSequences(suggestedGrid, "establishing");
      const visualText = buildVisualPromptForGrid(suggestedGrid, enrichedDesc, locName, s.weather || "", s.lighting || "", "establishing", camAndAngle.angle, charStr);

      pool.push({
        kind: "establishing",
        function: "setup",
        diễn_tả: enrichedDesc,
        description: enrichedDesc,
        mục_tiêu: `Định vị không gian bối cảnh ${locName} và thiết lập bầu không khí chung cho phân cảnh.`,
        objective: `Định vị không gian bối cảnh ${locName} và thiết lập bầu không khí chung cho phân cảnh.`,
        hình_ảnh: visualText,
        visual: visualText,
        assetDnaRefs: `Location Ref (${locName})`,
        causalLink: `Thiết lập bối cảnh nền trước khi tiến gần vào chi tiết của các nhân vật và hành động tiếp diễn.`,
        cameraMovement: camAndAngle.cameraMovement,
        angle: camAndAngle.angle,
        panelGrid: suggestedGrid,
        nhân_vật: charStr,
        characters: charStr,
        bối_cảnh: locName,
        location: locName,
        đạo_cụ: "",
        props: "",
        thoại: "",
        dialogue: ""
      });
    }

    // Slot 2: Detail Shot
    {
      const act = actionLines[1] || actionLines[0] || desc || "";
      const target = primeChar || "";
      const detailTarget = s.props && s.props.length > 0 ? s.props[0].name : "chi tiết bối cảnh";
      const baseDesc = `Cận cảnh (Close-Up) chi tiết: ${act}`;
      const suggestedGrid = suggestPanelGrid(baseDesc);
      const enrichedDesc = enrichShotDescription(baseDesc, s, 1, 6, suggestedGrid);
      const camAndAngle = suggestCameraSequences(suggestedGrid, "detail");
      const visualText = buildVisualPromptForGrid(suggestedGrid, enrichedDesc, locName, s.weather || "", s.lighting || "", "detail", camAndAngle.angle, target);

      pool.push({
        kind: "detail",
        function: "setup",
        diễn_tả: enrichedDesc,
        description: enrichedDesc,
        mục_tiêu: `Lột tả chi tiết vật lý hoặc biểu cảm cụ thể, tăng tính chân thực và nhân quả cho phân đoạn.`,
        objective: `Lột tả chi tiết vật lý hoặc biểu cảm cụ thể, tăng tính chân thực và nhân quả cho phân đoạn.`,
        hình_ảnh: visualText,
        visual: visualText,
        assetDnaRefs: target ? `Character Ref (${target})` : `Prop Ref (${detailTarget})`,
        causalLink: `Làm nổi bật đạo cụ hoặc tiểu tiết vật lý để tạo cơ sở logic cho các hành động sau đó.`,
        cameraMovement: camAndAngle.cameraMovement,
        angle: camAndAngle.angle,
        panelGrid: suggestedGrid,
        nhân_vật: target,
        characters: target,
        bối_cảnh: locName,
        location: locName,
        đạo_cụ: detailTarget,
        props: detailTarget,
        thoại: "",
        dialogue: ""
      });
    }

    // Slot 3: Action Shot
    {
      const act = actionLines[2] || actionLines[0] || desc || "";
      const isChar = sceneChars.length > 0;
      const target = primeChar || "";
      let dialogStr = "";
      if (dialogues.length > 0) {
        const d = dialogues[0];
        dialogStr = `${d.character}: "${d.line}"`;
      }
      const baseDesc = `Trung cảnh (Medium Shot): Tập trung vào ${isChar ? target : "không gian"} thực hiện hành động chính: ${act}`;
      const suggestedGrid = suggestPanelGrid(baseDesc);
      const enrichedDesc = enrichShotDescription(baseDesc, s, 2, 6, suggestedGrid);
      const camAndAngle = suggestCameraSequences(suggestedGrid, "action");
      const visualText = buildVisualPromptForGrid(suggestedGrid, enrichedDesc, locName, s.weather || "", s.lighting || "", "action", camAndAngle.angle, target);

      pool.push({
        kind: "action",
        function: "inciting_incident",
        diễn_tả: enrichedDesc,
        description: enrichedDesc,
        mục_tiêu: `Thực hiện hành động chính kịch tính, đóng vai trò Causal Trigger kích hoạt toàn bộ diễn biến tiếp theo.`,
        objective: `Thực hiện hành động chính kịch tính, đóng vai trò Causal Trigger kích hoạt toàn bộ diễn biến tiếp theo.`,
        hình_ảnh: visualText,
        visual: visualText,
        assetDnaRefs: target ? `Character Ref (${target})` : `Location Ref (${locName})`,
        causalLink: `Hành động quyết đoán này trực tiếp châm ngòi phản ứng tâm lý hoặc hành động tiếp theo của nhân vật.`,
        cameraMovement: camAndAngle.cameraMovement,
        angle: camAndAngle.angle,
        panelGrid: suggestedGrid,
        nhân_vật: target,
        characters: target,
        bối_cảnh: locName,
        location: locName,
        đạo_cụ: "",
        props: "",
        thoại: dialogStr,
        dialogue: dialogStr
      });
    }

    // Slot 4: Reaction Shot (Only generated as character reaction if secondChar is present)
    {
      const act = actionLines[3] || actionLines[1] || actionLines[0] || desc || "";
      const hasSecond = secondChar !== "";
      const target = hasSecond ? secondChar : (primeChar || "");
      const isChar = target !== "";
      
      let dialogStr = "";
      if (hasSecond && dialogues.length > 1) {
        const d = dialogues[1];
        dialogStr = `${d.character}: "${d.line}"`;
      } else if (dialogues.length > 0) {
        const d = dialogues[0];
        dialogStr = `${d.character}: "${d.line}"`;
      }
      const baseDesc = `Cận cảnh (Close-Up) phản ứng biểu cảm của ${isChar ? target : "môi trường"}: ${act}`;
      const suggestedGrid = suggestPanelGrid(baseDesc);
      const enrichedDesc = enrichShotDescription(baseDesc, s, 3, 6, suggestedGrid);
      const camAndAngle = suggestCameraSequences(suggestedGrid, "reaction");
      const visualText = buildVisualPromptForGrid(suggestedGrid, enrichedDesc, locName, s.weather || "", s.lighting || "", "reaction", camAndAngle.angle, target);

      pool.push({
        kind: "reaction",
        function: "rising_action",
        diễn_tả: enrichedDesc,
        description: enrichedDesc,
        mục_tiêu: `Lột tả Causal Effect trực tiếp trên biểu cảm và thái độ của nhân vật phản ứng.`,
        objective: `Lột tả Causal Effect trực tiếp trên biểu cảm và thái độ của nhân vật phản ứng.`,
        hình_ảnh: visualText,
        visual: visualText,
        assetDnaRefs: target ? `Character Ref (${target})` : `Location Ref (${locName})`,
        causalLink: `Phản ứng cảm xúc này làm gia tăng căng thẳng kịch tính, dẫn tới cuộc đối thoại trực diện.`,
        cameraMovement: camAndAngle.cameraMovement,
        angle: camAndAngle.angle,
        panelGrid: suggestedGrid,
        nhân_vật: target,
        characters: target,
        bối_cảnh: locName,
        location: locName,
        đạo_cụ: "",
        props: "",
        thoại: dialogStr,
        dialogue: dialogStr
      });
    }

    // Slot 5: Dialogue Shot
    {
      const act = actionLines[4] || actionLines[2] || actionLines[0] || desc || "";
      const hasTwo = primeChar !== "" && secondChar !== "";
      const target = primeChar || "";
      const other = secondChar || "";
      
      let dialogStr = "";
      if (dialogues.length > 2) {
        const d = dialogues[2];
        dialogStr = `${d.character}: "${d.line}"`;
      } else if (dialogues.length > 0) {
        const d = dialogues[dialogues.length - 1];
        dialogStr = `${d.character}: "${d.line}"`;
      }

      const charStr = hasTwo ? `${target} and ${other}` : (target ? target : "");
      const baseDesc = hasTwo
        ? `Trung cảnh qua vai (OTS Shot): Đối thoại trực tiếp giữa ${target} và ${other}. ${act}`
        : `Trung cảnh (Medium Shot): Tương tác thoại của ${target || "nhân vật"}. ${act}`;
      const suggestedGrid = suggestPanelGrid(baseDesc);
      const enrichedDesc = enrichShotDescription(baseDesc, s, 4, 6, suggestedGrid);
      const camAndAngle = suggestCameraSequences(suggestedGrid, "dialogue");
      const visualText = buildVisualPromptForGrid(suggestedGrid, enrichedDesc, locName, s.weather || "", s.lighting || "", "dialogue", camAndAngle.angle, charStr);

      pool.push({
        kind: "dialogue",
        function: "climax",
        diễn_tả: enrichedDesc,
        description: enrichedDesc,
        mục_tiêu: `Chốt hạ mâu thuẫn chính của phân cảnh thông qua những câu thoại và tương tác đắt giá.`,
        objective: `Chốt hạ mâu thuẫn chính của phân cảnh thông qua những câu thoại và tương tác đắt giá.`,
        hình_ảnh: visualText,
        visual: visualText,
        assetDnaRefs: hasTwo ? `Character Ref (${target}), Character Ref (${other})` : (target ? `Character Ref (${target})` : `Location Ref (${locName})`),
        causalLink: `Tương tác thoại giải quyết nút thắt hoặc tạo ra động cơ hành động mới trước khi chuyển sang cảnh tiếp theo.`,
        cameraMovement: camAndAngle.cameraMovement,
        angle: camAndAngle.angle,
        panelGrid: suggestedGrid,
        nhân_vật: charStr,
        characters: charStr,
        bối_cảnh: locName,
        location: locName,
        đạo_cụ: "",
        props: "",
        thoại: dialogStr,
        dialogue: dialogStr
      });
    }

    // Slot 6: Transition Shot
    {
      const act = actionLines[5] || actionLines[3] || actionLines[0] || desc || "";
      const isChar = sceneChars.length > 0;
      const charStr = sceneChars.join(", ");
      const baseDesc = `Trung cảnh góc rộng: ${isChar ? `Nhân vật ${charStr}` : "Cảnh vật"} chuyển tiếp. ${act}`;
      const suggestedGrid = suggestPanelGrid(baseDesc);
      const enrichedDesc = enrichShotDescription(baseDesc, s, 5, 6, suggestedGrid);
      const camAndAngle = suggestCameraSequences(suggestedGrid, "transition");
      const visualText = buildVisualPromptForGrid(suggestedGrid, enrichedDesc, locName, s.weather || "", s.lighting || "", "transition", camAndAngle.angle, charStr);

      pool.push({
        kind: "transition",
        function: "resolution",
        diễn_tả: enrichedDesc,
        description: enrichedDesc,
        mục_tiêu: `Giải tỏa áp lực cảnh hiện tại và bắc cầu liên kết nhân quả logic sang phân cảnh kế tiếp.`,
        objective: `Giải tỏa áp lực cảnh hiện tại và bắc cầu liên kết nhân quả logic sang phân cảnh kế tiếp.`,
        hình_ảnh: visualText,
        visual: visualText,
        assetDnaRefs: isChar ? `Character Ref (${charStr}), Location Ref (${locName})` : `Location Ref (${locName})`,
        causalLink: `Bắc cầu liên kết không gian và thời gian sang đầu phân cảnh kế tiếp.`,
        cameraMovement: camAndAngle.cameraMovement,
        angle: camAndAngle.angle,
        panelGrid: suggestedGrid,
        nhân_vật: charStr,
        characters: charStr,
        bối_cảnh: locName,
        location: locName,
        đạo_cụ: "",
        props: "",
        thoại: "",
        dialogue: ""
      });
    }

    const sampled = sampleBeats(pool, count, scCode);
    result.push(...sampled);
  });

  const rawShots = result.map((sh: any) => {
    const rawCharRefs = sh.characters ? sh.characters.split(/,\s*/).map((c: string) => c.trim()).filter(Boolean) : [];
    return {
      id: sh.id || sh.beat || `shot-${Math.random()}`,
      scene_id: sh.sc || sh.sceneId || sh.scene_id || "SC01",
      shotNumber: sh.shotNumber || parseInt(sh.beat?.replace(/\D/g, "") || "1"),
      shot_type: sh.kind?.toUpperCase() || "ACTION",
      framing: sh.angle?.toUpperCase() || "MEDIUM",
      duration_target: sh.duration || sh.T || 4,
      camera_movement: sh.cameraMovement?.toUpperCase() || "STATIC",
      action_description: sh.description || sh.diễn_tả || "",
      character_refs: rawCharRefs,
      scene_ref: sh.location || sh.bối_cảnh || "",
      ...sh
    };
  });

  const { optimizedShots } = runCinematicPipeline(rawShots);
  return optimizedShots;
};

export const generateShotsForSingleScene = (
  scene: any,
  charNames: string[],
  panelGrid: string
) => {
  charNames = (charNames as any[] || []).map(c => typeof c === 'string' ? c : (c?.name || '')).filter(Boolean);
  const rawSceneChars = scene.charactersInScene || [];
  const sceneChars = (Array.isArray(rawSceneChars) ? rawSceneChars : [rawSceneChars])
    .map(c => typeof c === 'string' ? c : (c?.name || ''))
    .filter(Boolean);

  const desc = scene.action || scene.sceneDescription || "";
  const locName = scene.location || "không gian";
  
  // Split description by sentences
  const actionLines = desc.split(/(?<=[.!?])\s+/).filter(Boolean);
  const primeChar = sceneChars[0] || "";
  
  const scCode = scene.sc || (typeof scene.sceneId === 'string' && scene.sceneId.startsWith('SC') ? scene.sceneId : `SC${String(scene.id || scene.sceneId || '01').replace(/[^0-9]/g, "").padStart(2, "0")}`);
  const sceneId = scene.id || scene.sceneId || scCode;

  const pool: any[] = [];

  if (panelGrid === 'auto') {
    // Smart sentence-level classification & grouping
    const checkIsEnvironmental = (text: string): boolean => {
      const lower = text.toLowerCase();
      
      // If it mentions any specific character name, it is likely a character shot
      const allNames = Array.from(new Set([...sceneChars, ...charNames]));
      for (const name of allNames) {
        if (name && lower.includes(name.toLowerCase())) {
          return false;
        }
      }
      
      // Check for generic character words
      const charKeywords = [
        "cô", "anh", "họ", "người", "nhân vật", "ông", "bà", "đối phương", "cậu", "tôi", "ta", 
        "chúng tôi", "chúng ta", "bản thân", "đứa", "bé", "nàng", "chàng", "hắn", "gã", "kẻ"
      ];
      const hasCharWord = charKeywords.some(w => {
        const regex = new RegExp(`\\b${w}\\b`, 'i');
        return regex.test(lower);
      });
      if (hasCharWord) return false;

      // Check for dialogue quotes
      if (lower.includes('"') || lower.includes('“') || lower.includes('”') || lower.includes(':')) {
        return false;
      }

      // Check for environmental keywords
      const envKeywords = [
        "cảnh", "ngoại cảnh", "bối cảnh", "bầu trời", "mây", "mưa", "giông", "sấm", "chớp", 
        "gió", "đường phố", "căn phòng", "không gian", "ánh sáng", "chiều", "tối", "đêm", 
        "sáng", "trời", "biển", "phố", "nhà", "neon", "đèn", "vệt", "hạt", "nước", "phong cảnh",
        "thiết lập", "bản đồ", "mặt trời", "ánh trăng", "sương", "khói", "thời tiết", "môi trường",
        "landscape", "sky", "street", "rain", "storm", "environment", "setting", "scenery"
      ];
      const hasEnvWord = envKeywords.some(w => lower.includes(w));
      if (hasEnvWord) return true;

      // If it's short and has no character keywords, it might be atmospheric
      return text.trim().split(/\s+/).length < 8;
    };

    // Prepend a synthetic environmental B-roll shot if outerSetup is true and first line is not environmental
    const hasInitialEnv = actionLines.length > 0 && checkIsEnvironmental(actionLines[0]);
    if (scene.outerSetup && !hasInitialEnv) {
      const weatherText = scene.weather ? ` trong thời tiết ${scene.weather}` : "";
      const lightText = scene.lighting ? ` dưới ánh sáng ${scene.lighting}` : "";
      const synthLine = `Cảnh toàn ngoại cảnh thiết lập bối cảnh ${locName}${weatherText}${lightText}, không khí u ám hoành tráng.`;
      actionLines.unshift(synthLine);
    }

    const segments: { type: 'env' | 'char'; sentences: string[] }[] = [];
    actionLines.forEach((line: string) => {
      const isEnv = checkIsEnvironmental(line);
      const type = isEnv ? 'env' : 'char';
      
      // Only group consecutive environmental sentences. Character actions are kept individual.
      if (segments.length > 0 && segments[segments.length - 1].type === 'env' && type === 'env') {
        segments[segments.length - 1].sentences.push(line);
      } else {
        segments.push({ type, sentences: [line] });
      }
    });

    // Handle case where we have no segments
    if (segments.length === 0) {
      segments.push({ type: 'env', sentences: [desc || 'Cảnh phim thiết lập.'] });
    }

    segments.forEach((seg, j) => {
      const shotNum = j + 1;
      const beatId = `${sceneId}_B${String(shotNum).padStart(2, "0")}`;
      const shotDesc = seg.sentences.join(" ");

      let kind = "action";
      let func = "rising_action";
      let cam = "Pan Left";
      let angle = "Eye-Level";
      let objective = "";
      let causalLink = "";
      let currentGridVal = "1x1";

      if (seg.type === 'env') {
        kind = "establishing";
        func = "setup";
        cam = "Static Tilt";
        angle = "High Angle";
        
        // Determine grid layout for this env group based on weather severity and sentence count
        const sentenceCount = seg.sentences.length;
        const lowerDesc = shotDesc.toLowerCase();
        const isSevereWeather = lowerDesc.includes('bão') || lowerDesc.includes('giông') || lowerDesc.includes('storm') || lowerDesc.includes('mưa lớn') || lowerDesc.includes('lốc') || lowerDesc.includes('sét');
        
        if (isSevereWeather) {
          if (sentenceCount >= 3) {
            currentGridVal = "3x3";
          } else if (sentenceCount === 2) {
            currentGridVal = "2x3";
          } else {
            currentGridVal = "2x2";
          }
        } else {
          if (sentenceCount === 1) {
            currentGridVal = "1x2";
          } else if (sentenceCount === 2) {
            currentGridVal = "2x2";
          } else {
            currentGridVal = "2x3";
          }
        }

        objective = `Thiết lập môi trường và ngoại cảnh tại ${locName} sử dụng panel grid ${currentGridVal}.`;
        causalLink = `Định hình không gian khí quyển làm nền cho các diễn biến nhân vật tiếp theo.`;
      } else {
        // Character action/dialogue/introduction
        const lowerShotDesc = shotDesc.toLowerCase();
        const isIntenseAction = lowerShotDesc.includes('vật lộn') || lowerShotDesc.includes('chao đảo') || 
                               lowerShotDesc.includes('rơi') || lowerShotDesc.includes('va chạm') || 
                               lowerShotDesc.includes('đua') || lowerShotDesc.includes('chạy trốn') || 
                               lowerShotDesc.includes('đâm sầm') || lowerShotDesc.includes('cuồn cuộn') || 
                               lowerShotDesc.includes('struggle') || lowerShotDesc.includes('crash') || 
                               lowerShotDesc.includes('fall') || lowerShotDesc.includes('storm') ||
                               (scene.emotionIntensity && scene.emotionIntensity >= 70);
        
        const isDialogue = shotDesc.includes('"') || shotDesc.includes('“') || shotDesc.includes('”') || shotDesc.includes(':');
        const isInteraction = sceneChars.filter((c: string) => lowerShotDesc.includes(c.toLowerCase())).length >= 2 ||
                              lowerShotDesc.includes('gặp') || lowerShotDesc.includes('đáp xuống') || 
                              lowerShotDesc.includes('đến gần') || lowerShotDesc.includes('meet') || 
                              lowerShotDesc.includes('together');
        
        const isFirstChar = segments.findIndex(s => s.type === 'char') === j;

        if (isDialogue) {
          kind = "dialogue";
          func = "rising_action";
          cam = "Static Tilt";
          angle = "Over the Shoulder";
          currentGridVal = "1x2"; // OTS / Reverse panel for dialogues
          objective = `Tập trung đối thoại và tương tác trực tiếp của nhân vật sử dụng panel grid 1x2.`;
          causalLink = `Phát triển câu chuyện qua lời thoại, làm rõ mâu thuẫn/động cơ.`;
        } else if (isFirstChar) {
          kind = "detail";
          func = "rising_action";
          angle = "Close-up";
          if (isIntenseAction) {
            currentGridVal = "2x2";
            objective = `Giới thiệu nhân vật ${primeChar || 'chính'} đang trong tình huống nguy hiểm dữ dội, sử dụng panel grid 2x2.`;
          } else {
            currentGridVal = "1x1";
            objective = `Giới thiệu nhân vật ${primeChar || 'chính'} và biểu cảm/hành động đầu tiên (Single Shot 1x1).`;
          }
          causalLink = `Làm nổi bật sự xuất hiện của nhân vật trong bối cảnh mới.`;
        } else if (isIntenseAction) {
          kind = "action";
          func = "rising_action";
          cam = "Tracking Shot";
          angle = "Medium Shot";
          currentGridVal = "2x2"; // Panel 2x2 for intense character action
          objective = `Lột tả hành động kịch tính dữ dội, sử dụng panel grid 2x2 để nắm bắt chi tiết diễn biến.`;
          causalLink = `Hành động leo thang dồn dập đẩy tình huống đến điểm bùng nổ tiếp theo.`;
        } else if (isInteraction) {
          kind = "action";
          func = "rising_action";
          cam = "Pan Left/Right";
          angle = "Eye-Level";
          currentGridVal = "1x1"; // Single shot for character meeting
          objective = `Ghi lại cảnh gặp gỡ/tương tác nhân quả giữa các nhân vật (Single Shot 1x1).`;
          causalLink = `Sự kết nối giữa các nhân vật châm ngòi cho hướng phát triển mới của câu chuyện.`;
        } else {
          kind = "action";
          func = "rising_action";
          cam = "Pan Left/Right";
          angle = "Eye-Level";
          currentGridVal = "1x1";
          objective = `Lột tả hành động vật lý và diễn biến kịch tính của nhân vật (Single Shot 1x1).`;
          causalLink = `Tiếp tục chuỗi hành động nhân quả, đẩy nhanh nhịp độ kịch tính.`;
        }
      }

      // Add mood shift logic:
      // First shot gets incoming mood shift
      if (j === 0 && (scene.moodShift || scene.moodShiftPurpose)) {
        objective += ` [Mood transition: ${scene.moodShiftPurpose || ''}. ${scene.moodShift || ''}]`;
      }
      // Last shot gets outgoing mood shift
      if (j === segments.length - 1 && scene.moodShiftOut) {
        causalLink = scene.moodShiftOut;
        objective += ` [Cầu nối chuyển tiếp sang scene tiếp theo: ${scene.moodShiftOut}]`;
      }
      
      const shotChars = sceneChars.filter((c: string) => {
        if (!c) return false;
        const escaped = c.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        return new RegExp(escaped, 'i').test(shotDesc);
      });
      const activeChars = shotChars.length > 0 ? shotChars : (primeChar ? [primeChar] : []);
      const activeCharStr = activeChars.join(", ");

      const enrichedDesc = enrichShotDescription(shotDesc, scene, j, segments.length, currentGridVal);
      const camAndAngle = suggestCameraSequences(currentGridVal, kind);
      const finalCam = (currentGridVal === '1x1' || !currentGridVal) ? cam : camAndAngle.cameraMovement;
      const finalAngle = (currentGridVal === '1x1' || !currentGridVal) ? angle : camAndAngle.angle;
      const visualText = buildVisualPromptForGrid(
        currentGridVal,
        enrichedDesc,
        locName,
        scene.weather || "",
        scene.lighting || "",
        kind,
        finalAngle,
        activeCharStr
      );

      pool.push({
        beat: beatId,
        sceneId: sceneId,
        sc: scCode,
        kind: kind,
        function: func,
        duration: 4,
        cameraMovement: finalCam,
        angle: finalAngle,
        diễn_tả: enrichedDesc,
        description: enrichedDesc,
        mục_tiêu: objective,
        objective: objective,
        hình_ảnh: visualText,
        visual: visualText,
        causalLink: causalLink,
        panelGrid: currentGridVal,
        detectedCharacters: sceneChars,
        detectedProps: scene.props || [],
        imageUrl: null,
        videoUrl: null,
        variants: [],
        thoại: "",
        dialogue: "",
        dialogs: []
      });
    });
  } else {
    // FALLBACK TO MANUAL OVERRIDE (Existing logic)
    const gridCountMap: Record<string, number> = {
      '1x1': 1,
      '1x2': 2,
      '2x2': 4,
      '2x3': 6,
      '3x3': 9
    };
    let count = panelGrid === '1x1' ? Math.max(1, actionLines.length) : (gridCountMap[panelGrid] || 4);

    if (panelGrid !== '1x1' && actionLines.length < count) {
      count = Math.max(1, actionLines.length);
    }

    for (let j = 0; j < count; j++) {
      const shotNum = j + 1;
      const beatId = `${sceneId}_B${String(shotNum).padStart(2, "0")}`;
      
      let shotDesc = "";
      if (actionLines.length === 0) {
        shotDesc = desc;
      } else if (actionLines.length <= count) {
        shotDesc = actionLines[j] || actionLines[actionLines.length - 1] || desc;
      } else {
        const linesPerShot = Math.ceil(actionLines.length / count);
        const start = j * linesPerShot;
        shotDesc = actionLines.slice(start, start + linesPerShot).join(" ");
      }
      
      let kind = "action";
      let func = "rising_action";
      let cam = "Static";
      let angle = "Eye-Level";
      let objective = "";
      let causalLink = "";

      if (j === 0) {
        kind = "establishing";
        func = "setup";
        cam = "Dolly In";
        angle = "High Angle";
        objective = `Định vị không gian bối cảnh ${locName} và thiết lập bầu không khí chung cho phân cảnh.`;
        causalLink = `Thiết lập bối cảnh nền trước khi tiến gần vào chi tiết của các nhân vật và hành động tiếp diễn.`;
      } else if (j === 1 && count >= 3) {
        kind = "detail";
        func = "setup";
        cam = "Zoom In";
        angle = "Close-up";
        objective = `Lột tả chi tiết vật lý hoặc biểu cảm cụ thể của ${primeChar || 'nhân vật'}, tăng tính chân thực.`;
        causalLink = `Làm nổi bật đạo cụ hoặc tiểu tiết vật lý làm tiền đề cho hành động chính.`;
      } else if (j === count - 1 && count > 1) {
        kind = "reaction";
        func = count >= 6 ? "resolution" : "rising_action";
        cam = "Handheld";
        angle = "Close-up";
        objective = `Tập trung vào biểu cảm phản ứng của ${primeChar || 'nhân vật'} đối với diễn biến chính.`;
        causalLink = `Kết thúc phân cảnh bằng phản ứng cảm xúc của nhân vật để làm cầu nối chuyển sang cảnh tiếp theo.`;
      } else {
        kind = "action";
        func = "rising_action";
        cam = "Tracking Shot";
        angle = "Medium Shot";
        objective = `Thực hiện diễn biến hành động chính tiếp theo của ${primeChar || 'nhân vật'}.`;
        causalLink = `Tiếp nối hành động thiết lập trước đó, đẩy nhịp kịch tính lên cao hơn.`;
      }

      // Add mood shift logic:
      // First shot gets incoming mood shift
      if (j === 0 && (scene.moodShift || scene.moodShiftPurpose)) {
        objective += ` [Mood transition: ${scene.moodShiftPurpose || ''}. ${scene.moodShift || ''}]`;
      }
      // Last shot gets outgoing mood shift
      if (j === count - 1 && scene.moodShiftOut) {
        causalLink = scene.moodShiftOut;
        objective += ` [Cầu nối chuyển tiếp sang scene tiếp theo: ${scene.moodShiftOut}]`;
      }
      
      const shotChars = sceneChars.filter((c: string) => {
        if (!c) return false;
        const escaped = c.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        return new RegExp(escaped, 'i').test(shotDesc);
      });
      const activeChars = shotChars.length > 0 ? shotChars : (primeChar ? [primeChar] : []);
      const activeCharStr = activeChars.join(", ");

      const enrichedDesc = enrichShotDescription(shotDesc, scene, j, count, panelGrid);
      const camAndAngle = suggestCameraSequences(panelGrid, kind);
      const finalCam = (panelGrid === '1x1' || !panelGrid) ? cam : camAndAngle.cameraMovement;
      const finalAngle = (panelGrid === '1x1' || !panelGrid) ? angle : camAndAngle.angle;
      const visualText = buildVisualPromptForGrid(
        panelGrid,
        enrichedDesc,
        locName,
        scene.weather || "",
        scene.lighting || "",
        kind,
        finalAngle,
        activeCharStr
      );

      pool.push({
        beat: beatId,
        sceneId: sceneId,
        sc: scCode,
        kind: kind,
        function: func,
        duration: 4,
        cameraMovement: finalCam,
        angle: finalAngle,
        diễn_tả: enrichedDesc,
        description: enrichedDesc,
        mục_tiêu: objective,
        objective: objective,
        hình_ảnh: visualText,
        visual: visualText,
        causalLink: causalLink,
        panelGrid: panelGrid,
        detectedCharacters: sceneChars,
        detectedProps: scene.props || [],
        imageUrl: null,
        videoUrl: null,
        variants: [],
        thoại: "",
        dialogue: "",
        dialogs: []
      });
    }
  }

  const rawShots = pool.map((sh: any) => {
    const rawCharRefs = sh.detectedCharacters || [];
    return {
      id: sh.beat,
      scene_id: sh.sc,
      shotNumber: parseInt(sh.beat.replace(/.*_B/, "") || "1"),
      shot_type: sh.kind.toUpperCase(),
      framing: sh.angle.toUpperCase(),
      duration_target: sh.duration,
      camera_movement: sh.cameraMovement.toUpperCase(),
      action_description: sh.description,
      character_refs: rawCharRefs,
      scene_ref: sh.location,
      ...sh
    };
  });

  const { optimizedShots } = runCinematicPipeline(rawShots);
  return optimizedShots;
};
