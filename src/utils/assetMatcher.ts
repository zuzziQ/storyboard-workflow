export function safeMatchName(text: string, name: string, aliases?: string | string[]): boolean {
  if (!text || !name) return false;
  const cleanText = String(text).toLowerCase();
  const cleanName = String(name).toLowerCase().trim();
  if (!cleanName) return false;
  
  const matchSingle = (word: string) => {
     const escaped = word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
     const letterClass = 'a-zA-Z0-9àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđĐ';
     const regex = new RegExp(`(^|[^${letterClass}])${escaped}([^${letterClass}]|$)`, 'i');
     return regex.test(cleanText);
  };

  if (matchSingle(cleanName)) return true;

  if (aliases) {
     const list = typeof aliases === 'string'
        ? aliases.split(',').map(x => x.trim().toLowerCase()).filter(Boolean)
        : aliases.map(x => x.trim().toLowerCase()).filter(Boolean);
     for (const item of list) {
        if (matchSingle(item)) return true;
     }
  }
  return false;
}

export const LOCAL_MAPPING_KEYWORDS: Record<string, string[]> = {
  // Characters
  'Chú Vẹt': ['paco', 'vẹt paco', 'con vẹt', 'paco the parrot', 'chú vẹt', 'chu vet'],
  'Paco': ['paco', 'vẹt paco', 'con vẹt', 'paco the parrot'],
  'Mica': ['mica', 'mèo mica', 'con mèo', 'mica the cat'],
  'Mom': ['mom', 'mẹ', 'mẹ paco'],
  'Dad': ['dad', 'bố', 'bố paco', 'ba'],
  'Bố': ['dad', 'bố', 'bố paco', 'ba', 'bo'],
  
  // Locations
  'Phòng khách': ['phòng khách', 'living room', 'sofa', 'ghế sofa', 'trong nhà', 'phong khach'],
  'Ban công chung cư Hà Nội': ['ban công', 'balcony', 'lan can', 'chung cư', 'ban cong', 'chung cu'],
  'Bếp': ['bếp', 'kitchen', 'phòng bếp', 'bàn ăn', 'bep'],
  'Apartment Courtyard': ['hành lang', 'courtyard', 'corridor', 'sảnh chung cư', 'ngoài cửa căn hộ', 'hanh lang', 'chung cu', 'apart courtyard'],
  'Minimart': ['minimart', 'siêu thị', 'cửa hàng', 'cửa hàng tiện lợi', 'grocery', 'sieu thi'],
  'Elevator': ['thang máy', 'elevator', 'buồng thang máy', 'thang may'],

  // Props
  'Orange-Red Bandana': ['bandana đỏ cam', 'khăn quàng đỏ cam', 'khăn rằn', 'bandana', 'khăn bandana', 'khăn quàng cổ', 'do cam', 'do-cam', 'orange-red bandana'],
  'Mystery Poster': ['mystery poster', 'poster bí ẩn', 'áp phích', 'tờ rơi', 'tờ quảng cáo', 'poster', 'bi an', 'mystery-poster'],
  'Snack Bags': ['snack bags', 'snack', 'gói bim bim', 'bim bim', 'túi snack', 'snack bag', 'snack-bags'],
  'Ladybug Hair Clip': ['ladybug hair clip', 'chiếc kẹp tóc bọ rùa', 'kẹp tóc bọ rùa', 'kẹp tóc', 'bọ rùa', 'hair clip', 'bo rua', 'ladybug-hair-clip'],
  'Chiếc kẹp tóc bọ rùa': ['ladybug hair clip', 'chiếc kẹp tóc bọ rùa', 'kẹp tóc bọ rùa', 'kẹp tóc', 'bọ rùa', 'hair clip', 'bo rua', 'ladybug-hair-clip'],
  'Laptop của bố': ['laptop', 'máy tính', 'laptop của bố', 'computer', 'laptop cua bo'],
  'Mini Hot Air Balloon': ['khinh khí cầu mini', 'mini hot air balloon', 'khinh khí cầu', 'balloon', 'hot air balloon', 'khinh khi cau'],
  'Khinh khí cầu mini': ['khinh khí cầu mini', 'mini hot air balloon', 'khinh khí cầu', 'balloon', 'hot air balloon', 'khinh khi cau']
};

export function matchAssetWithMapping(text: string, assetName: string, dbAliases?: string | string[]): boolean {
  if (safeMatchName(text, assetName, dbAliases)) return true;
  
  const cleanText = String(text).toLowerCase();
  
  const matchKeyword = (kw: string) => {
    const escaped = kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const letterClass = 'a-zA-Z0-9àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđĐ';
    const regex = new RegExp(`(^|[^${letterClass}])${escaped}([^${letterClass}]|$)`, 'i');
    return regex.test(cleanText);
  };

  for (const [key, keywords] of Object.entries(LOCAL_MAPPING_KEYWORDS)) {
    if (key.toLowerCase().trim() === assetName.toLowerCase().trim()) {
      for (const kw of keywords) {
        if (matchKeyword(kw)) return true;
      }
    }
  }
  return false;
}

export function cleanLocationName(s: any): string {
  if (!s) return '';
  
  const extractName = (text: string): string => {
    if (!text) return '';
    const trimmed = text.trim();
    // If it is purely "Scene X", return empty string
    if (/^(scene|sc|cảnh|phân cảnh|phân\s*cảnh)\s*\d+$/i.test(trimmed)) {
      return '';
    }
    // If it contains " - "
    if (trimmed.includes(' - ')) {
      const parts = trimmed.split(' - ');
      const firstPart = parts[0].trim();
      const secondPart = parts[1].trim();
      if (/^(scene|sc|cảnh|phân cảnh|phân\s*cảnh)\s*\d+$/i.test(firstPart)) {
        if (/^(scene|sc|cảnh|phân cảnh|phân\s*cảnh)\s*\d+$/i.test(secondPart)) {
          return '';
        }
        return secondPart;
      }
      return firstPart;
    }
    return trimmed;
  };

  if (typeof s === 'string') {
    return extractName(s);
  }

  // Object case
  const loc = s.location || '';
  const title = s.title || '';

  const cleanLoc = extractName(loc);
  if (cleanLoc) return cleanLoc;

  const cleanTitle = extractName(title);
  if (cleanTitle) return cleanTitle;

  return '';
}

export function extractSceneNumber(sceneIdStr: string): number {
  if (!sceneIdStr) return 1;
  const cleanStr = String(sceneIdStr).trim();
  
  // Tách beat/shot number
  let part = cleanStr;
  if (cleanStr.includes('.')) {
    part = cleanStr.split('.')[0];
  } else if (/[_-][Bb]\d+/.test(cleanStr)) {
    part = cleanStr.split(/[_-][Bb]/)[0];
  } else if (cleanStr.includes('_')) {
    part = cleanStr.split('_')[0];
  }
  
  const num = parseInt(part.replace(/[^0-9]/g, ''), 10);
  return isNaN(num) ? 1 : num;
}

export function parseTransitionString(text: string) {
  if (!text) return { causalLink: '', visualBridge: '', transitionGeometry: '', audioSfxRules: '' };
  
  let visualBridge = '';
  let transitionGeometry = '';
  let audioSfxRules = '';
  let causalLink = text;

  const geoIndex = text.search(/TRANSITION GEOMETRY:|GEOMETRY:/i);
  const audioIndex = text.search(/AUDIO\/SFX:|AUDIO\/SFX RULES:|SOUND:|SOUND BRIDGE:/i);
  const visualIndex = text.search(/VISUAL BRIDGE:|VISUAL:/i);

  const markers = [
    { type: 'geo', index: geoIndex },
    { type: 'audio', index: audioIndex },
    { type: 'visual', index: visualIndex }
  ].filter(m => m.index !== -1).sort((a, b) => a.index - b.index);

  if (markers.length > 0) {
    causalLink = text.substring(0, markers[0].index).trim();
    causalLink = causalLink.replace(/^TRANSITION:\s*/i, '');
    
    for (let i = 0; i < markers.length; i++) {
      const current = markers[i];
      const nextIndex = i < markers.length - 1 ? markers[i + 1].index : text.length;
      let val = text.substring(current.index, nextIndex).trim();
      
      if (current.type === 'geo') {
        val = val.replace(/^(TRANSITION GEOMETRY:|GEOMETRY:)\s*/i, '');
        transitionGeometry = val;
      } else if (current.type === 'audio') {
        val = val.replace(/^(AUDIO\/SFX:|AUDIO\/SFX RULES:|SOUND:|SOUND BRIDGE:)\s*/i, '');
        audioSfxRules = val;
      } else if (current.type === 'visual') {
        val = val.replace(/^(VISUAL BRIDGE:|VISUAL:)\s*/i, '');
        visualBridge = val;
      }
    }
  } else {
    causalLink = causalLink.replace(/^TRANSITION:\s*/i, '');
  }

  causalLink = causalLink.replace(/[\s,.;-]+$/, '').trim();
  visualBridge = visualBridge.replace(/[\s,.;-]+$/, '').trim();
  transitionGeometry = transitionGeometry.replace(/[\s,.;-]+$/, '').trim();
  audioSfxRules = audioSfxRules.replace(/[\s,.;-]+$/, '').trim();

  return {
    causalLink,
    visualBridge,
    transitionGeometry,
    audioSfxRules
  };
}

export function hydrateShotsWithUniverseAssets(
  shots: any[],
  incomingDbChars: any[],
  projectId?: string,
  scenes?: any[]
): any[] {
  if (!shots || !Array.isArray(shots)) return [];
  const dbChars = Array.isArray(incomingDbChars) ? incomingDbChars : [];

  return shots.map((sh: any) => {
    const actionText = sh.action_description || sh.description || sh.diễn_tả || "";
    const dialogueText = sh.thoại || sh.dialogue || "";
    const combinedText = `${actionText} ${dialogueText}`;
    
    // A. Nhận diện nhân vật khớp từ DB và gán vào character_refs
    const detectedChars = new Set<string>();
    const existingRefs = sh.character_refs || sh.characterIds || [];
    existingRefs.forEach((r: any) => {
      const nameStr = typeof r === 'string' ? r : (r.name || r.scriptName || String(r));
      if (nameStr.trim()) {
        // Nếu nameStr là một ID của nhân vật trong DB, đổi nó thành tên thật để đồng bộ hiển thị
        const dbMatch = dbChars.find((c: any) => (c.entityType === 'character' || !c.entityType) && c.id === nameStr.trim());
        if (dbMatch) {
          detectedChars.add(dbMatch.name);
        } else {
          detectedChars.add(nameStr.trim());
        }
      }
    });

    dbChars.forEach((c: any) => {
      if (c.entityType !== 'character' && c.entityType) return;
      const charName = c.name;
      let dbAliases = '';
      try {
        const sg = typeof c.styleGuide === 'string' ? JSON.parse(c.styleGuide) : c.styleGuide;
        dbAliases = sg?.aliases || '';
      } catch(e){}
      
      if (matchAssetWithMapping(combinedText, charName, dbAliases)) {
        detectedChars.add(charName);
      }
    });


    // B. Nhận diện bối cảnh (Location)
    let shotLoc = sh.location || sh.scene_ref || '';
    const scNum = sh.sceneNumber || sh.scene_number || extractSceneNumber(sh.sc || sh.sceneId || sh.scene_id || '');
    
    let matchedScene: any = null;
    if (scenes && Array.isArray(scenes)) {
      matchedScene = scenes.find((s: any) => {
        const sNum = s.sceneNumber || parseInt(String(s.id || '').replace(/[^0-9]/g, '')) || 1;
        return sNum === scNum;
      });
    }

    const isLocRaw = (loc: string) => {
      if (!loc) return true;
      const cleaned = loc.toLowerCase().trim();
      return /^(scene|sc|c\u1ea3nh|phân cảnh|phân\s*cảnh)\s*\d+$/i.test(cleaned);
    };

    if (isLocRaw(shotLoc) && matchedScene) {
      shotLoc = cleanLocationName(matchedScene);
    } else if (!shotLoc && matchedScene) {
      shotLoc = cleanLocationName(matchedScene);
    }

    const dbMatchLoc = dbChars.find((c: any) => {
      if (c.entityType !== 'location') return false;
      let dbAliases = '';
      try {
        const sg = typeof c.styleGuide === 'string' ? JSON.parse(c.styleGuide) : c.styleGuide;
        dbAliases = sg?.aliases || '';
      } catch(e){}
      return c.id === shotLoc || // Cho phép so khớp Location qua ID
             c.name.toLowerCase().trim() === shotLoc.toLowerCase().trim() ||
             matchAssetWithMapping(shotLoc, c.name, dbAliases) ||
             matchAssetWithMapping(combinedText, c.name, dbAliases);
    });

    // C. Nhận diện Đạo cụ (Prop)
    const detectedProps = new Set<string>();
    const existingPropRefs = sh.prop_refs || sh.props || [];
    existingPropRefs.forEach((r: any) => {
      const nameStr = typeof r === 'string' ? r : (r.name || r.scriptName || String(r));
      if (nameStr.trim()) {
        // Nếu nameStr là một ID của prop trong DB, đổi nó thành tên thật để đồng bộ hiển thị
        const dbMatch = dbChars.find((c: any) => c.entityType === 'prop' && c.id === nameStr.trim());
        if (dbMatch) {
          detectedProps.add(dbMatch.name);
        } else {
          detectedProps.add(nameStr.trim());
        }
      }
    });

    dbChars.forEach((c: any) => {
      if (c.entityType !== 'prop') return;
      const propName = c.name;
      let dbAliases = '';
      try {
        const sg = typeof c.styleGuide === 'string' ? JSON.parse(c.styleGuide) : c.styleGuide;
        dbAliases = sg?.aliases || '';
      } catch(e){}
      
      if (matchAssetWithMapping(combinedText, propName, dbAliases)) {
        detectedProps.add(propName);
      }
    });

    const resolvedCharIds = Array.from(detectedChars).map(charName => {
      const dbChar = dbChars.find((c: any) => {
        if (c.entityType !== 'character' && c.entityType) return false;
        let dbAliases = '';
        try {
          const sg = typeof c.styleGuide === 'string' ? JSON.parse(c.styleGuide) : c.styleGuide;
          dbAliases = sg?.aliases || '';
        } catch(e){}
        return c.id === charName || safeMatchName(charName, c.name, dbAliases); // Cho phép so khớp bằng ID hoặc Tên
      });
      return dbChar ? dbChar.id : null;
    }).filter(Boolean);

    // Bóc tách transition gộp
    const causal = sh.causalLink || sh.causal_link || '';
    const parsedTrans = parseTransitionString(causal);

    return {
      ...sh,
      character_refs: Array.from(detectedChars),
      characterIds: Array.from(new Set([...(sh.characterIds || []), ...resolvedCharIds])),
      location: dbMatchLoc ? dbMatchLoc.name : shotLoc,
      locationId: sh.locationId || (dbMatchLoc ? dbMatchLoc.id : undefined),
      prop_refs: Array.from(detectedProps),
      causalLink: parsedTrans.causalLink || causal,
      causal_link: parsedTrans.causalLink || causal,
      visualBridge: sh.visualBridge || sh.visual_bridge || parsedTrans.visualBridge || '',
      visual_bridge: sh.visualBridge || sh.visual_bridge || parsedTrans.visualBridge || '',
      transitionGeometry: sh.transitionGeometry || sh.transition_geometry || parsedTrans.transitionGeometry || '',
      transition_geometry: sh.transitionGeometry || sh.transition_geometry || parsedTrans.transitionGeometry || '',
      audioSfxRules: sh.audioSfxRules || sh.audio_sfx_rules || parsedTrans.audioSfxRules || '',
      audio_sfx_rules: sh.audioSfxRules || sh.audio_sfx_rules || parsedTrans.audioSfxRules || '',
      transition: {
        ...(sh.transition || {}),
        visualBridge: sh.transition?.visualBridge || sh.visualBridge || sh.visual_bridge || parsedTrans.visualBridge || '',
        transitionGeometry: sh.transition?.transitionGeometry || sh.transitionGeometry || sh.transition_geometry || parsedTrans.transitionGeometry || '',
        audioSfxRules: sh.transition?.audioSfxRules || sh.audioSfxRules || sh.audio_sfx_rules || parsedTrans.audioSfxRules || '',
      },
      sceneEmotion: sh.sceneEmotion || matchedScene?.emotion || matchedScene?.sceneEmotion || '',
      sceneEmotionIntensity: sh.sceneEmotionIntensity ?? matchedScene?.emotionIntensity ?? matchedScene?.intensity ?? 50,
      sceneValence: sh.sceneValence || matchedScene?.valence || 'neutral',
      sceneLighting: sh.sceneLighting || matchedScene?.lighting || '',
      sceneWeather: sh.sceneWeather || matchedScene?.weather || '',
      sceneArcPosition: sh.sceneArcPosition || matchedScene?.arcPosition || '',
      emotion: sh.emotion || matchedScene?.emotion || 'neutral',
    };
  });
}
