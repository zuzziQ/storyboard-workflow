import { useState } from 'react';
import type { Node } from 'reactflow';
import { useFlowStore } from '../store/useFlowStore';
import { parseScriptLLM, generateCharacterPrompt, generateLocationPrompt, generatePropPrompt, normalizeParsedScript } from '../utils/scriptParser';
import { getApiBaseUrl, fetchWithTimeout } from '../utils/apiConfig';
import { generateExpandedShots } from '../utils/generateExpandedShots';




import { safeMatchName, matchAssetWithMapping, hydrateShotsWithUniverseAssets, cleanLocationName } from '../utils/assetMatcher';
import { runCinematicPipeline } from '../lib/cinematic-engine';


// Helper to limit parallel API requests (Concurrency Limit) to avoid network queueing and rate limits
async function pLimit<T, U>(items: T[], fn: (item: T, idx: number) => Promise<U>, limit: number = 3): Promise<U[]> {
  const results: U[] = new Array(items.length);
  let index = 0;
  
  async function worker() {
    while (index < items.length) {
      const currentIndex = index++;
      try {
        results[currentIndex] = await fn(items[currentIndex], currentIndex);
      } catch (err) {
        console.error(`[pLimit] Error at index ${currentIndex}:`, err);
      }
    }
  }
  
  const workers = [];
  const workerCount = Math.min(limit, items.length);
  for (let i = 0; i < workerCount; i++) {
    workers.push(worker());
  }
  
  await Promise.all(workers);
  return results;
}

export function useGraphBuilder() {
  const [isBuildingStoryboard, setIsBuildingStoryboard] = useState(false);
  const [buildingStage, setBuildingStage] = useState('');
  const [isAnalyzingEmotion, setIsAnalyzingEmotion] = useState(false);
  const setIsAnalyzing = useFlowStore(state => state.setIsAnalyzing);
  const setParsedData = useFlowStore(state => state.setParsedData);
  const setIsDrawerOpen = useFlowStore(state => state.setIsDrawerOpen);

  const handleAnalyze = async (text: string) => {
    try {
      setIsAnalyzing(true);

      // Fetch existing assets from World Asset DB to reuse existing assets
      const activeUniverseId = useFlowStore.getState().projectData?.selectedProjectId || useFlowStore.getState().projectData?.selectedUniverseId;
      let dbAssets: any[] = [];
      
      if (activeUniverseId && activeUniverseId !== 'undefined' && activeUniverseId !== 'null' && activeUniverseId !== 'new') {
        try {
          const baseUrl = getApiBaseUrl();
          const HUB_API_KEY = localStorage.getItem('STORYMEE_HUB_API_KEY') || import.meta.env.VITE_HUB_API_KEY || '';
          const res = await fetchWithTimeout(`${baseUrl}/api/world-asset/characters?projectId=${activeUniverseId}`, { 
            timeout: 4000,
            headers: {
              'Authorization': `Bearer ${HUB_API_KEY}`
            }
          });
          if (res.ok) {
            const jsonVal = await res.json();
            dbAssets = Array.isArray(jsonVal) ? jsonVal : [];
            console.log(`[handleAnalyze] Loaded ${dbAssets.length} assets to guide LLM for reuse.`);
          }
        } catch (err) {
          console.warn("[handleAnalyze] Cannot fetch assets from DB for analysis guidance:", err);
        }
      }

      const data = await parseScriptLLM(text, dbAssets);
      if (data) data.isImported = false;
      setParsedData(data);

      const setPendingShots = useFlowStore.getState().setPendingShots;
      setPendingShots(data.shots || []);

      // Auto-trigger build storyboard after successful analysis
      setTimeout(async () => {
        await handleBuildStoryboard({}, data.shots || [], true);
        await handleAnalyzeImportedScriptEmotion();
      }, 100);
    } catch (error: any) {
      alert("Lỗi khi phân tích kịch bản bằng LLM: " + error.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const autoGetGoogleLabsToken = async (): Promise<boolean> => {
    const useRemote = localStorage.getItem('STORYMEE_USE_REMOTE_WORKER') === 'true';
    if (useRemote) return true;

    const extId = localStorage.getItem("STORYMEE_EXT_ID");
    if (!extId || !(window as any).chrome?.runtime) return false;
    
    return new Promise((resolve) => {
        (window as any).chrome.runtime.sendMessage(extId, { action: "OPEN_LABS_BACKGROUND" }, () => {
           setTimeout(() => {
               (window as any).chrome.runtime.sendMessage(extId, { action: "GET_GOOGLE_LABS_TOKEN" }, (res: any) => {
                   if (res?.token) resolve(true);
                   else resolve(false);
               });
           }, 3500);
        });
    });
  };

  const handleBuildStoryboard = async (
    assetImages: Record<string, string> = {},
    _customShots?: any[],
    skipAiAssetGeneration: boolean = false
  ) => {
    let parsedData = useFlowStore.getState().parsedData;
    if (!parsedData) return;

    // Đảm bảo parsedData được chuẩn hóa hoàn toàn (bù đắp emotionArc thiếu, đồng bộ các trường) trước khi dựng graph
    parsedData = normalizeParsedScript(parsedData, parsedData.scriptText || '');
    useFlowStore.getState().setParsedData(parsedData);
    
    setIsBuildingStoryboard(true);
    setBuildingStage("Đang liên kết Google Labs...");
    const tokenSuccess = await autoGetGoogleLabsToken();
    if (!tokenSuccess) {
       console.warn("⚠️ Không thể lấy Token Google Labs tự động. Tiếp tục dựng luồng phân cảnh...");
    }
    
    const setNodes = useFlowStore.getState().setNodes;
    const setEdges = useFlowStore.getState().setEdges;
    const currentNodes = useFlowStore.getState().nodes;

    const activeUniverseId = useFlowStore.getState().projectData?.selectedProjectId || useFlowStore.getState().projectData?.selectedUniverseId;
    let dbAssets: any[] = [];
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (activeUniverseId && activeUniverseId !== 'undefined' && activeUniverseId !== 'null' && uuidRegex.test(activeUniverseId)) {
      setBuildingStage("Đang tải dữ liệu từ World Asset DB...");
      try {
        const baseUrl = getApiBaseUrl();
        const HUB_API_KEY = localStorage.getItem('STORYMEE_HUB_API_KEY') || import.meta.env.VITE_HUB_API_KEY || '';
        const res = await fetchWithTimeout(`${baseUrl}/api/world-asset/characters?projectId=${activeUniverseId}`, { 
          timeout: 4000,
          headers: {
            'Authorization': `Bearer ${HUB_API_KEY}`
          }
        });
        if (res.ok) {
          const jsonVal = await res.json();
          dbAssets = Array.isArray(jsonVal) ? jsonVal : [];
          console.log(`[useGraphBuilder] Loaded ${dbAssets.length} assets từ World Asset DB cho Universe: ${activeUniverseId}`);
        }
      } catch (err) {
        console.warn("[useGraphBuilder] Không thể fetch assets từ DB:", err);
      }
    }

    const userGlobalStyle = useFlowStore.getState().projectData?.stylePrompt || (parsedData as any).globalStyle || "Mặc định";

    // 1. Pre-generation of Character descriptions (Batch Concurrency Limit to avoid queueing)
    console.log("[StoryMee] Pre-generating Characters descriptions with concurrency limit...");
    setBuildingStage("Đang phân tích nhân vật...");
    const finalCharacters = await pLimit(parsedData.characters, async (charObj: any) => {
       const charName = typeof charObj === 'string' ? charObj : charObj.name;
       const charDesc = typeof charObj === 'string' ? '' : charObj.description;
       
       const oldCharNode = currentNodes.find(n => n.id === 'world-asset-main');
       const oldChar = oldCharNode?.data?.characters?.find((c: any) => c.name === charName);
       
       // Kiểm tra xem đã có trong World Asset DB của Universe được chọn chưa (so khớp thông minh kèm aliases)
       const dbChar = dbAssets.find(c => {
          const isChar = (c.entityType === 'character' || !c.entityType);
          if (!isChar) return false;
          let dbAliases = '';
          try {
             const sg = typeof c.styleGuide === 'string' ? JSON.parse(c.styleGuide) : c.styleGuide;
             dbAliases = sg?.aliases || '';
          } catch (e) {}
          
          const slugName = c.slug || '';
          return safeMatchName(charName, c.name, dbAliases) || 
                 safeMatchName(c.name, charName, charObj.aliases) ||
                 (slugName && (charName.toLowerCase() === slugName.toLowerCase() || safeMatchName(charName, slugName)));
       });
       
       if (dbChar) {
           console.log(`[useGraphBuilder] Khớp nhân vật "${charName}" trong DB. Sử dụng mô tả và hình ảnh từ DB.`);
           let mediaIdFromDb = '';
           let dbCharAliases = '';
           try {
              const sg = typeof dbChar.styleGuide === 'string' ? JSON.parse(dbChar.styleGuide) : dbChar.styleGuide;
              const currentProjId = useFlowStore.getState().projectData?.id;
              if (sg?.gflowMediaIds?.[currentProjId]) {
                 mediaIdFromDb = sg.gflowMediaIds[currentProjId];
              } else if (sg?.gflowMediaId) {
                 mediaIdFromDb = sg.gflowMediaId;
              }
              dbCharAliases = sg?.aliases || '';
           } catch (e) {}

           return {
              name: charName,
              aliases: dbCharAliases || (Array.isArray(charObj.aliases) ? charObj.aliases.join(', ') : charObj.aliases) || '',
              description: dbChar.description || charDesc || 'A character from World Asset Database',
              imageUrl: dbChar.rootImageUrl || oldChar?.imageUrl || assetImages[charName],
              worldAssetCharId: dbChar.id,
              worldAssetCharName: dbChar.name,
              mediaId: mediaIdFromDb || oldChar?.mediaId
           };
        }
        
        if (oldChar?.description && oldChar.description !== 'Auto-detected character') {
           return {
              name: charName,
              aliases: oldChar.aliases || (Array.isArray(charObj.aliases) ? charObj.aliases.join(', ') : charObj.aliases) || '',
              description: oldChar.description,
              imageUrl: oldChar.imageUrl || assetImages[charName],
              mediaId: oldChar.mediaId
           };
        }
        
        if (skipAiAssetGeneration) {
           return {
              name: charName,
              aliases: (Array.isArray(charObj.aliases) ? charObj.aliases.join(', ') : charObj.aliases) || '',
              description: charDesc || 'A character from script.',
              imageUrl: assetImages[charName],
              mediaId: undefined
           };
        }
        
        try {
           const result = await generateCharacterPrompt(charName, userGlobalStyle, charDesc);
           return {
              name: charName,
              aliases: (Array.isArray(charObj.aliases) ? charObj.aliases.join(', ') : charObj.aliases) || '',
              description: result?.description || result?.['mô tả'] || result?.['mieu ta'] || charDesc || 'A dynamic character in the story.',
              imageUrl: assetImages[charName],
              mediaId: undefined
           };
        } catch (e) {
           return {
              name: charName,
              aliases: (Array.isArray(charObj.aliases) ? charObj.aliases.join(', ') : charObj.aliases) || '',
              description: charDesc || 'A dynamic character in the story.',
              imageUrl: assetImages[charName],
              mediaId: undefined
           };
        }
    }, 3);

    // 2. Pre-generation of Location descriptions (Batch Concurrency Limit to avoid queueing)
    console.log("[StoryMee] Pre-generating Locations descriptions with concurrency limit...");
    setBuildingStage("Đang phân tích bối cảnh...");
    const finalLocations = await pLimit(parsedData.locations, async (locObj: any) => {
       const locName = typeof locObj === 'string' ? locObj : locObj.name;
       const locDesc = typeof locObj === 'string' ? '' : locObj.description;
       
       const oldLocNode = currentNodes.find(n => n.id === 'world-asset-main');
       const oldLoc = oldLocNode?.data?.locations?.find((l: any) => l.name === locName);
       
       // Kiểm tra xem đã có trong World Asset DB của Universe được chọn chưa (so khớp thông minh kèm aliases)
       const dbLoc = dbAssets.find(c => {
          const isLoc = c.entityType === 'location';
          if (!isLoc) return false;
          let dbAliases = '';
          try {
             const sg = typeof c.styleGuide === 'string' ? JSON.parse(c.styleGuide) : c.styleGuide;
             dbAliases = sg?.aliases || '';
          } catch (e) {}
          
          const slugName = c.slug || '';
          return safeMatchName(locName, c.name, dbAliases) || 
                 safeMatchName(c.name, locName, locObj.aliases) ||
                 (slugName && (locName.toLowerCase() === slugName.toLowerCase() || safeMatchName(locName, slugName)));
       });
       
       if (dbLoc) {
           console.log(`[useGraphBuilder] Khớp bối cảnh "${locName}" trong DB. Sử dụng mô tả và hình ảnh từ DB.`);
           let mediaIdFromDb = '';
           let dbLocAliases = '';
           try {
              const sg = typeof dbLoc.styleGuide === 'string' ? JSON.parse(dbLoc.styleGuide) : dbLoc.styleGuide;
              const currentProjId = useFlowStore.getState().projectData?.id;
              if (sg?.gflowMediaIds?.[currentProjId]) {
                 mediaIdFromDb = sg.gflowMediaIds[currentProjId];
              } else if (sg?.gflowMediaId) {
                 mediaIdFromDb = sg.gflowMediaId;
              }
              dbLocAliases = sg?.aliases || '';
           } catch (e) {}

           return {
              name: locName,
              aliases: dbLocAliases || (Array.isArray(locObj.aliases) ? locObj.aliases.join(', ') : locObj.aliases) || '',
              description: dbLoc.description || locDesc || 'A location from World Asset Database',
              imageUrl: dbLoc.rootImageUrl || oldLoc?.imageUrl || assetImages[locName],
              worldAssetCharId: dbLoc.id,
              worldAssetCharName: dbLoc.name,
              mediaId: mediaIdFromDb || oldLoc?.mediaId
           };
        }
       
       if (oldLoc?.description && oldLoc.description !== 'Auto-detected location') {
          return {
             name: locName,
             aliases: oldLoc.aliases || (Array.isArray(locObj.aliases) ? locObj.aliases.join(', ') : locObj.aliases) || '',
             description: oldLoc.description,
             imageUrl: oldLoc.imageUrl || assetImages[locName],
             mediaId: oldLoc.mediaId
          };
       }
       
       if (skipAiAssetGeneration) {
          return {
             name: locName,
             aliases: (Array.isArray(locObj.aliases) ? locObj.aliases.join(', ') : locObj.aliases) || '',
             description: locDesc || 'A location from script.',
             imageUrl: assetImages[locName],
             mediaId: undefined
          };
       }
       
       try {
          const result = await generateLocationPrompt(locName, userGlobalStyle, locDesc);
          return {
             name: locName,
             aliases: (Array.isArray(locObj.aliases) ? locObj.aliases.join(', ') : locObj.aliases) || '',
             description: result?.description || result?.['mô tả'] || result?.['mieu ta'] || locDesc || 'A scenic setting in the story.',
             imageUrl: assetImages[locName],
             mediaId: undefined
          };
       } catch (e) {
          return {
             name: locName,
             aliases: (Array.isArray(locObj.aliases) ? locObj.aliases.join(', ') : locObj.aliases) || '',
             description: locDesc || 'A scenic setting in the story.',
             imageUrl: assetImages[locName],
             mediaId: undefined
          };
       }
    }, 3);

     // 3. Pre-generation of Prop descriptions (Batch Concurrency Limit to avoid queueing)
     console.log("[StoryMee] Pre-generating Props descriptions with concurrency limit...");
     setBuildingStage("Đang phân tích đạo cụ...");
     const finalProps = await pLimit(parsedData.props || [], async (propObj: any) => {
        const propName = typeof propObj === 'string' ? propObj : propObj.name;
        const propDesc = typeof propObj === 'string' ? '' : propObj.description;
        
        const oldWorldAssetNode = currentNodes.find(n => n.id === 'world-asset-main');
        const oldProp = oldWorldAssetNode?.data?.props?.find((p: any) => p.name === propName);
        
        const dbProp = dbAssets.find(c => {
           const isProp = c.entityType === 'prop';
           if (!isProp) return false;
           let dbAliases = '';
           try {
              const sg = typeof c.styleGuide === 'string' ? JSON.parse(c.styleGuide) : c.styleGuide;
              dbAliases = sg?.aliases || '';
           } catch (e) {}
           
           const slugName = c.slug || '';
           return safeMatchName(propName, c.name, dbAliases) || 
                  safeMatchName(c.name, propName, propObj.aliases) ||
                  (slugName && (propName.toLowerCase() === slugName.toLowerCase() || safeMatchName(propName, slugName)));
        });
        
        if (dbProp) {
           console.log(`[useGraphBuilder] Khớp đạo cụ "${propName}" trong DB. Sử dụng mô tả và hình ảnh từ DB.`);
           let mediaIdFromDb = '';
           let dbPropAliases = '';
           try {
              const sg = typeof dbProp.styleGuide === 'string' ? JSON.parse(dbProp.styleGuide) : dbProp.styleGuide;
              const currentProjId = useFlowStore.getState().projectData?.id;
              if (sg?.gflowMediaIds?.[currentProjId]) {
                 mediaIdFromDb = sg.gflowMediaIds[currentProjId];
              } else if (sg?.gflowMediaId) {
                 mediaIdFromDb = sg.gflowMediaId;
              }
              dbPropAliases = sg?.aliases || '';
           } catch (e) {}

           return {
              name: propName,
              aliases: dbPropAliases || (Array.isArray(propObj.aliases) ? propObj.aliases.join(', ') : propObj.aliases) || '',
              description: dbProp.description || propDesc || 'A prop from World Asset Database',
              imageUrl: dbProp.rootImageUrl || oldProp?.imageUrl || assetImages[propName],
              worldAssetCharId: dbProp.id,
              worldAssetCharName: dbProp.name,
              mediaId: mediaIdFromDb || oldProp?.mediaId
           };
        }
        
        if (oldProp?.description && oldProp.description !== 'Auto-detected prop') {
           return {
              name: propName,
              aliases: oldProp.aliases || (Array.isArray(propObj.aliases) ? propObj.aliases.join(', ') : propObj.aliases) || '',
              description: oldProp.description,
              imageUrl: oldProp.imageUrl || assetImages[propName],
              mediaId: oldProp.mediaId
           };
        }
        
        if (skipAiAssetGeneration) {
           return {
              name: propName,
              aliases: (Array.isArray(propObj.aliases) ? propObj.aliases.join(', ') : propObj.aliases) || '',
              description: propDesc || 'A key prop in the story.',
              imageUrl: assetImages[propName],
              mediaId: undefined
           };
        }
        
        try {
           const result = await generatePropPrompt(propName, userGlobalStyle, propDesc);
            return {
               name: propName,
               aliases: (Array.isArray(propObj.aliases) ? propObj.aliases.join(', ') : propObj.aliases) || '',
               description: result?.description || result?.['mô tả'] || result?.['mieu ta'] || propDesc || 'A key prop in the story.',
              imageUrl: assetImages[propName],
              mediaId: undefined
           };
        } catch (e) {
           return {
              name: propName,
              aliases: (Array.isArray(propObj.aliases) ? propObj.aliases.join(', ') : propObj.aliases) || '',
              description: propDesc || 'A key prop in the story.',
              imageUrl: assetImages[propName],
              mediaId: undefined
           };
        }
     }, 3);

           if (typeof window !== 'undefined') {
         (window as any).handleBuildStoryboard = handleBuildStoryboard;
      }



     console.log("[StoryMee] Finished preparing scenes! Constructing clean graph...");
    setBuildingStage("Đang thiết lập sơ đồ luồng & liên kết node...");

    const newNodes: Node[] = [];
    const newEdges: any[] = [];
    
    // Node 1: World Asset Node (Bridge)
    const worldAssetId = 'world-asset-main';
    newNodes.push({
      id: worldAssetId,
      type: 'worldAssetNode',
      position: { x: 100, y: 50 },
      data: { 
        name: 'World Asset Bridge',
        characters: finalCharacters,
        locations: finalLocations,
        props: finalProps
      }
    });

    // Node 2: EmotionArcNode — God View full-width at Y=750
    const emotionArcId = 'emotion-arc-main';
    const emotionArcData = parsedData.emotionArc || [];
    
    // Find existing EmotionArcNode to retain sceneConfigs
    const oldEmotionArcNode = currentNodes.find(n => n.id === emotionArcId);
    const oldSceneConfigs = oldEmotionArcNode?.data?.sceneConfigs || {};

    const sceneConfigs: Record<string, any> = {};

    if (parsedData.scenes && Array.isArray(parsedData.scenes)) {
      parsedData.scenes.forEach((sc, scIdx) => {
        const narrativeSceneId = sc.id || `Scene ${scIdx + 1}`;
        const emotionBeat = emotionArcData.find((b: any) => b.sceneId === narrativeSceneId);
        
        // Find existing configuration from old EmotionArcNode
        const oldConfig = oldSceneConfigs[narrativeSceneId] || {};
        // Or find old prepNode data if migrating
        const oldPrepNode = currentNodes.find(n => n.type === 'scenePrepNode' && n.data?.sceneId === narrativeSceneId);
        const oldPrepData = oldPrepNode?.data || {};

        // Merge them
        sceneConfigs[narrativeSceneId] = {
          sceneId: narrativeSceneId,
          sceneGroupId: narrativeSceneId,
          location: oldConfig.location || oldPrepData.location || sc.location || '',
          timeOfDay: oldConfig.timeOfDay || oldPrepData.timeOfDay || sc.timeOfDay || 'DAY',
          action: oldConfig.action || oldPrepData.action || sc.sceneDescription || sc.action || '',
          charactersInScene: oldConfig.charactersInScene || oldPrepData.charactersInScene || sc.charactersInScene || [],
          props: oldConfig.props || oldPrepData.props || sc.props || [],
          emotionIntensity: oldConfig.emotionIntensity ?? oldPrepData.emotionIntensity ?? emotionBeat?.intensity ?? 40,
          valence: oldConfig.valence || oldPrepData.valence || emotionBeat?.valence || sc.valence || 'neutral',
          emotion: oldConfig.emotion || oldPrepData.emotion || emotionBeat?.emotion || 'anticipation',
          arcPosition: oldConfig.arcPosition || oldPrepData.arcPosition || emotionBeat?.arcPosition || sc.arcPosition || 'setup',
          lighting: oldConfig.lighting || oldPrepData.lighting || emotionBeat?.lighting || (sc as any).lighting || '',
          weather: oldConfig.weather || oldPrepData.weather || emotionBeat?.weather || (sc as any).weather || '',
          soundCue: oldConfig.soundCue || oldPrepData.soundCue || emotionBeat?.soundCue || '',
          isReady: oldConfig.isReady ?? oldPrepData.isReady ?? false,
          prepNotes: oldConfig.prepNotes || oldPrepData.prepNotes || '',
          panelGrid: oldConfig.panelGrid || oldPrepData.panelGrid || 'auto',
          
          storyDirection: oldConfig.storyDirection || oldPrepData.storyDirection || sc.storyDirection || '',
          scenePurpose: oldConfig.scenePurpose || oldPrepData.scenePurpose || sc.scenePurpose || '',
          emotionHook: oldConfig.emotionHook || oldPrepData.emotionHook || sc.emotionHook || '',
          moodShift: oldConfig.moodShift || oldPrepData.moodShift || sc.moodShift || '',
          moodShiftOut: oldConfig.moodShiftOut || oldPrepData.moodShiftOut || sc.moodShiftOut || '',
          moodShiftPurpose: oldConfig.moodShiftPurpose || oldPrepData.moodShiftPurpose || sc.moodShiftPurpose || '',
          outerSetup: oldConfig.outerSetup !== undefined ? oldConfig.outerSetup : (oldPrepData.outerSetup !== undefined ? oldPrepData.outerSetup : (sc.outerSetup !== undefined ? sc.outerSetup : undefined)),
          aiSuggestions: oldConfig.aiSuggestions || oldPrepData.aiSuggestions || ((parsedData.scriptQuality === 'sparse') ? [
            `Ánh sáng: ${emotionBeat?.lighting || 'gợi ý ánh sáng phù hợp'}`,
            `Thời tiết: ${emotionBeat?.weather || 'thêm chi tiết thời tiết'}`,
            `Âm thanh: ${emotionBeat?.soundCue || 'thêm âm thanh nền'}`,
          ] : []),
          acceptedSuggestions: oldConfig.acceptedSuggestions || oldPrepData.acceptedSuggestions || [],
        };
      });
    }

    newNodes.push({
      id: emotionArcId,
      type: 'emotionArcNode',
      position: { x: 100, y: 750 },
      data: {
        title: parsedData.scriptSummary || 'Story Emotion Map',
        emotionArc: emotionArcData,
        scriptQuality: parsedData.scriptQuality || 'medium',
        sceneConfigs,
      }
    });

    newEdges.push({
      id: 'e-worldasset-to-emotionarc',
      source: worldAssetId,
      target: emotionArcId,
      animated: false,
      style: { stroke: '#6366f1', strokeWidth: 1.5, strokeDasharray: '6,3' }
    });

    // Create chain of narrative scene nodes horizontally at Y=1100
    if (parsedData.scenes && Array.isArray(parsedData.scenes)) {
      parsedData.scenes.forEach((sc, idx) => {
        const narrativeSceneId = sc.id || `Scene ${idx + 1}`;
        const sceneNodeId = `scene-item-${idx + 1}`;
        const config = sceneConfigs[narrativeSceneId] || {};
        
        newNodes.push({
          id: sceneNodeId,
          type: 'sceneNode',
          position: { x: 100 + idx * 360, y: 1100 },
          data: {
            sceneId: narrativeSceneId,
            sceneGroupId: narrativeSceneId,
            location: config.location || sc.location || '',
            timeOfDay: config.timeOfDay || 'DAY',
            action: config.action || sc.sceneDescription || sc.action || '',
            charactersInScene: config.charactersInScene || sc.charactersInScene || [],
            isNarrativeScene: true,
            emotion: config.emotion || 'neutral',
            emotionIntensity: config.emotionIntensity ?? 40,
            valence: config.valence || 'neutral',
            arcPosition: config.arcPosition || 'setup',
          }
        });

        // Connect emotion arc to first scene
        if (idx === 0) {
          newEdges.push({
            id: `e-emotionarc-to-${sceneNodeId}`,
            source: emotionArcId,
            target: sceneNodeId,
            animated: false,
            style: { stroke: '#6366f1', strokeWidth: 2 }
          });
        }

        // Chain narrative scenes sequentially
        if (idx > 0) {
          newEdges.push({
            id: `e-scene-chain-${idx}-to-${idx + 1}`,
            source: `scene-item-${idx}`,
            target: sceneNodeId,
            animated: false,
            style: { stroke: '#8b5cf6', strokeWidth: 1.5, strokeDasharray: '4,3', opacity: 0.8 }
          });
        }
      });
    }

    // Node 4: Review Board Node at Y=2100
    const reviewId = 'review-board-main';
    newNodes.push({
      id: reviewId,
      type: 'reviewBoardNode',
      position: { x: 100, y: 2100 },
      data: { projectName: useFlowStore.getState().projectData?.name || 'Storyboard' }
    });

    // Connect final scene node to review board
    if (parsedData.scenes && parsedData.scenes.length > 0) {
      const finalSceneNodeId = `scene-item-${parsedData.scenes.length}`;
      newEdges.push({
        id: `e-${finalSceneNodeId}-to-reviewboard`,
        source: finalSceneNodeId,
        target: reviewId,
        animated: false,
        style: { stroke: '#ef4444', strokeWidth: 2 }
      });
    } else {
      newEdges.push({
        id: 'e-emotionarc-to-reviewboard',
        source: emotionArcId,
        target: reviewId,
        animated: false,
        style: { stroke: '#8b5cf6', strokeWidth: 2, strokeDasharray: '4,4' }
      });
    }

    setNodes(newNodes);
    setEdges(newEdges);
    
    // Populate pendingShots with LLM analyzed shots, or keep empty
    const rawShots = _customShots || (parsedData.shots && parsedData.shots.length > 0 ? parsedData.shots : []);
    const allShots = hydrateShotsWithUniverseAssets(rawShots, dbAssets, activeUniverseId, parsedData.scenes);
    
    const { optimizedShots, warnings, glueNotes } = runCinematicPipeline(allShots);
    useFlowStore.getState().setPendingShots(optimizedShots);
    useFlowStore.getState().setCinematicWarnings(warnings);
    useFlowStore.getState().setCinematicGlueNotes(glueNotes);
    
    // Reset scene tab to 'all' view on fresh build
    useFlowStore.getState().setActiveSceneId('all');
    
    setIsDrawerOpen(false);
    setIsBuildingStoryboard(false);
    setBuildingStage('');
  };

  const handleImportEpisode = async (episode: any, targetProjectId?: string) => {
    setIsBuildingStoryboard(true);
    setBuildingStage("Đang khôi phục sơ đồ kịch bản từ World Asset...");

    const setNodes = useFlowStore.getState().setNodes;
    const setEdges = useFlowStore.getState().setEdges;
    const projectData = useFlowStore.getState().projectData;
    const activeProjId = targetProjectId || projectData.selectedProjectId || projectData.selectedUniverseId;

    // 1. Phục dựng scenes & shots
    let episodeScenes = episode.scenes || [];
    
    const episodeShots = (episode.meta?.shots && episode.meta.shots.length > 0)
      ? episode.meta.shots
      : (episode.shots && episode.shots.length > 0
         ? episode.shots
         : []);

    // Tự động phục dựng scenes nếu API chỉ trả về shots (khi import Docx trực tiếp)
    if (episodeScenes.length === 0 && episodeShots.length > 0) {
      console.log(`[handleImportEpisode] Phục dựng scenes từ ${episodeShots.length} shots...`);
      const sceneMap = new Map<number, any>();
      episodeShots.forEach((sh: any) => {
        const scNum = sh.sceneNumber || sh.scene_number || parseInt(String(sh.sceneId || sh.sc || '').replace(/[^0-9]/g, '')) || 1;
        if (!sceneMap.has(scNum)) {
          sceneMap.set(scNum, {
            sceneNumber: scNum,
            title: sh.sceneId || sh.sc || `Scene ${scNum}`,
            location: sh.location || sh.locationName || 'Bối cảnh',
            description: sh.sceneDescription || sh.description || '',
            tags: sh.character_refs || sh.characterIds || []
          });
        } else {
          const existing = sceneMap.get(scNum);
          const shChars = sh.character_refs || sh.characterIds || [];
          shChars.forEach((c: any) => {
            if (!existing.tags.includes(c)) {
              existing.tags.push(c);
            }
          });
          if (sh.description && !existing.description) {
            existing.description = sh.description;
          }
        }
      });
      episodeScenes = Array.from(sceneMap.values()).sort((a, b) => a.sceneNumber - b.sceneNumber);
    }

    // 2. Chạy cinematic pipeline cho shots ngay tại đây để có processedShots
    let processedShots = episodeShots;
    if (episodeShots.length > 0) {
      try {
        const { runCinematicPipeline } = await import('../lib/cinematic-engine');
        const rawShots = episodeShots.map((sh: any) => {
          const scNum = sh.sceneNumber || sh.scene_number || 1;
          const scCode = typeof scNum === 'number' || !isNaN(Number(scNum))
            ? `SC${String(scNum).padStart(2, '0')}`
            : String(scNum);
          return {
            ...sh,
            id: sh.id || sh.beat,
            scene_id: sh.sc || sh.sceneId || sh.scene_id || scCode,
            shot_type: sh.shot_type || sh.kind || "ACTION",
            framing: sh.framing || sh.angle || "MEDIUM",
            camera_movement: sh.camera_movement || sh.cameraMovement || "STATIC",
            action_description: sh.action_description || sh.description || sh.diễn_tả || "",
            character_refs: sh.character_refs || sh.characterIds || []
          };
        });
        const { optimizedShots } = runCinematicPipeline(rawShots);
        processedShots = optimizedShots;
      } catch (e) {
        console.warn("Could not process shots through cinematic pipeline:", e);
      }
    }

    // 2.5. Tự động chạy quy trình phân tích Emotion Arc bằng LLM
    let updatedScenes = episodeScenes;
    let emotionArcResult: any = null;
    try {
      setBuildingStage("Đang phân tích cảm xúc & nhịp điệu (Emotion Arc)...");
      const { analyzeImportedScriptEmotion } = await import('../utils/scriptParser');
      const analResult = await analyzeImportedScriptEmotion(episode.script || episode.scriptText || '', episodeScenes);
      if (analResult && Array.isArray(analResult.scenes)) {
        emotionArcResult = analResult.scenes;
        updatedScenes = episodeScenes.map((s: any) => {
          const matchingAnal = analResult.scenes.find((rs: any) => String(rs.id || rs.sceneNumber) === String(s.id || s.sceneNumber || ''));
          if (matchingAnal) {
            return {
              ...s,
              location: matchingAnal.location || s.location || '',
              emotionIntensity: matchingAnal.emotionIntensity ?? 50,
              valence: matchingAnal.valence || 'neutral',
              emotion: matchingAnal.emotion || 'neutral',
              arcPosition: matchingAnal.arcPosition || 'setup',
              lighting: matchingAnal.lighting || '',
              weather: matchingAnal.weather || '',
              soundCue: matchingAnal.soundCue || '',
              moodShift: matchingAnal.moodShift || '',
              moodShiftOut: matchingAnal.moodShiftOut || '',
              moodShiftPurpose: matchingAnal.moodShiftPurpose || ''
            };
          }
          return s;
        });
      }
    } catch (e) {
      console.warn("Could not analyze script emotion automatically on import:", e);
    }

     // Fetch DB characters/locations for enrichment if project ID exists
    let dbChars: any[] = [];
    if (activeProjId && activeProjId !== 'new' && activeProjId !== 'undefined') {
      setBuildingStage("Đang đồng bộ và làm giàu (hydrate) Asset từ World...");
      try {
        const baseUrl = getApiBaseUrl();
        const HUB_API_KEY = localStorage.getItem('STORYMEE_HUB_API_KEY') || import.meta.env.VITE_HUB_API_KEY || '';
        const charRes = await fetch(`${baseUrl}/api/world-asset/characters?projectId=${activeProjId}`, {
          headers: { 'Authorization': `Bearer ${HUB_API_KEY}` }
        });
        if (charRes.ok) {
          const jsonVal = await charRes.json();
          dbChars = Array.isArray(jsonVal) ? jsonVal : [];
          console.log(`[handleImportEpisode] Loaded ${dbChars.length} assets from DB for sync.`);
        }
      } catch (err) {
        console.warn("[handleImportEpisode] Failed to load DB assets for sync:", err);
      }
    }

    const getMediaId = (dbItem: any) => {
      try {
        const sg = typeof dbItem.styleGuide === 'string' ? JSON.parse(dbItem.styleGuide) : dbItem.styleGuide;
        if (sg?.gflowMediaIds?.[projectData.id]) {
          return sg.gflowMediaIds[projectData.id];
        } else if (sg?.gflowMediaId) {
          return sg.gflowMediaId;
        }
      } catch (e) {}
      return undefined;
    };

    // 3. Tự động phân tích nội dung hành động/mô tả của từng shot để gán các asset (nhân vật, bối cảnh) khớp từ DB World vào shot
    const enrichedShots = hydrateShotsWithUniverseAssets(processedShots, dbChars, projectData.id, updatedScenes);
    processedShots = enrichedShots;

    // Trích xuất toàn bộ nhân vật, bối cảnh, đạo cụ được phát hiện trong các shots
    const detectedCharNames = new Set<string>();
    const detectedLocNames = new Set<string>();
    const detectedPropNames = new Set<string>();

    processedShots.forEach((sh: any) => {
      if (sh.character_refs) sh.character_refs.forEach((c: string) => detectedCharNames.add(c));
      if (sh.location) detectedLocNames.add(sh.location);
      if (sh.prop_refs) sh.prop_refs.forEach((p: string) => detectedPropNames.add(p));
    });

    // Bổ sung thêm các nhân vật và bối cảnh từ Scenes đề phòng trong shots bị bỏ sót
    updatedScenes.forEach((s: any) => {
      const scChars = s.charactersInScene || s.tags || [];
      scChars.forEach((c: any) => detectedCharNames.add(String(c)));
      if (s.location) detectedLocNames.add(s.location);
    });

    const episodeProps = episode.props || episode.meta?.props || [];
    if (Array.isArray(episodeProps)) {
      episodeProps.forEach((p: any) => {
        const nameStr = typeof p === 'string' ? p : (p.name || String(p));
        if (nameStr.trim()) detectedPropNames.add(nameStr.trim());
      });
    }

    // Hydrate characters với DB assets
    const enrichedChars = Array.from(detectedCharNames).map((name: string) => {
      const dbMatch = dbChars.find((c: any) => {
        if (c.entityType !== 'character' && c.entityType) return false;
        let dbAliases = '';
        try {
          const sg = typeof c.styleGuide === 'string' ? JSON.parse(c.styleGuide) : c.styleGuide;
          dbAliases = sg?.aliases || '';
        } catch(e){}
        return c.name.toLowerCase().trim() === name.toLowerCase().trim() || 
               safeMatchName(name, c.name, dbAliases);
      });
      if (dbMatch) {
        let dbAliases = '';
        try {
          const sg = typeof dbMatch.styleGuide === 'string' ? JSON.parse(dbMatch.styleGuide) : dbMatch.styleGuide;
          dbAliases = sg?.aliases || '';
        } catch(e){}
        return {
          name: dbMatch.name,
          description: dbMatch.description || 'Nhân vật khớp từ World DB.',
          imageUrl: dbMatch.rootImageUrl || '',
          worldAssetCharId: dbMatch.id,
          worldAssetCharName: dbMatch.name,
          mediaId: getMediaId(dbMatch),
          renderMode: 'character_only',
          gridFormat: '2x2',
          aliases: dbAliases
        };
      }
      return {
        name: name,
        description: 'Nhân vật phát hiện từ kịch bản.',
        imageUrl: '',
        worldAssetCharId: undefined,
        worldAssetCharName: name,
        mediaId: '',
        renderMode: 'character_only',
        gridFormat: '2x2',
        aliases: ''
      };
    }).filter(Boolean);

    // Hydrate locations với DB assets
    const enrichedLocs = Array.from(detectedLocNames).map((name: string) => {
      const dbMatch = dbChars.find((c: any) => {
        if (c.entityType !== 'location') return false;
        let dbAliases = '';
        try {
          const sg = typeof c.styleGuide === 'string' ? JSON.parse(c.styleGuide) : c.styleGuide;
          dbAliases = sg?.aliases || '';
        } catch(e){}
        return c.name.toLowerCase().trim() === name.toLowerCase().trim() || 
               safeMatchName(name, c.name, dbAliases);
      });
      if (dbMatch) {
        let adjacentIds: string[] = [];
        let sharedDnaStr = '';
        let dbAliases = '';
        try {
          const sg = typeof dbMatch.styleGuide === 'string' ? JSON.parse(dbMatch.styleGuide) : dbMatch.styleGuide;
          if (sg?.spatialRelations) adjacentIds = sg.spatialRelations.map((r: any) => r.targetLocationId);
          if (sg?.sharedDna) sharedDnaStr = sg.sharedDna;
          dbAliases = sg?.aliases || '';
        } catch (e) {}

        return {
          name: dbMatch.name,
          description: dbMatch.description || 'Bối cảnh khớp từ World DB.',
          imageUrl: dbMatch.rootImageUrl || '',
          worldAssetCharId: dbMatch.id,
          worldAssetCharName: dbMatch.name,
          mediaId: getMediaId(dbMatch),
          adjacentLocationIds: adjacentIds.length > 0 ? adjacentIds : [],
          sharedDna: sharedDnaStr || '',
          renderMode: 'location_only',
          gridFormat: '2x2',
          aliases: dbAliases
        };
      }
      return {
        name: name,
        description: 'Bối cảnh phát hiện từ kịch bản.',
        imageUrl: '',
        worldAssetCharId: undefined,
        worldAssetCharName: name,
        mediaId: '',
        adjacentLocationIds: [],
        sharedDna: '',
        renderMode: 'location_only',
        gridFormat: '2x2',
        aliases: ''
      };
    }).filter(Boolean);

    // Hydrate props với DB assets
    const enrichedProps = Array.from(detectedPropNames).map((name: string) => {
      const dbMatch = dbChars.find((c: any) => c.entityType === 'prop' && c.name.toLowerCase().trim() === name.toLowerCase().trim());
      if (dbMatch) {
        let dbAliases = '';
        try {
          const sg = typeof dbMatch.styleGuide === 'string' ? JSON.parse(dbMatch.styleGuide) : dbMatch.styleGuide;
          dbAliases = sg?.aliases || '';
        } catch(e){}
        return {
          name: dbMatch.name,
          description: dbMatch.description || 'Đạo cụ khớp từ World DB.',
          imageUrl: dbMatch.rootImageUrl || '',
          worldAssetCharId: dbMatch.id,
          worldAssetCharName: dbMatch.name,
          mediaId: getMediaId(dbMatch),
          renderMode: 'prop_only',
          gridFormat: '2x2',
          aliases: dbAliases
        };
      }
      return {
        name: name,
        description: 'Đạo cụ phát hiện từ kịch bản.',
        imageUrl: '',
        worldAssetCharId: undefined,
        worldAssetCharName: name,
        mediaId: '',
        renderMode: 'prop_only',
        gridFormat: '2x2',
        aliases: ''
      };
    }).filter(Boolean);

    // 4. Tạo reconstructedParsedData có chứa cả shots đã được process và assets đã được enrich!
    const reconstructedParsedData: any = {
      isImported: true,
      scriptText: episode.script || "",
      characters: enrichedChars,
      locations: enrichedLocs,
      props: enrichedProps,
      emotionArc: emotionArcResult,
      scenes: updatedScenes.map((s: any) => {
        const sLoc = cleanLocationName(s);
        const dbMatchLoc = dbChars.find((c: any) => {
          if (c.entityType !== 'location') return false;
          let dbAliases = '';
          try {
            const sg = typeof c.styleGuide === 'string' ? JSON.parse(c.styleGuide) : c.styleGuide;
            dbAliases = sg?.aliases || '';
          } catch(e){}
          return c.name.toLowerCase().trim() === sLoc.toLowerCase().trim() ||
                 matchAssetWithMapping(sLoc, c.name, dbAliases);
        });

        return {
          id: `S-${s.sceneNumber}`,
          location: dbMatchLoc?.name || sLoc,
          timeOfDay: s.timeOfDay || 'DAY',
          action: s.description || s.action || "",
          charactersInScene: s.tags || s.charactersInScene || [],
          storyboardPrompt: s.prompt || s.storyboardPrompt || "",
          videoPrompt: `[00:00-00:04] SHOT 1\nCinematic scene.`,
          imageUrl: dbMatchLoc?.rootImageUrl || s.imageUrl || undefined,
          videoUrl: undefined
        };
      }),
      shots: processedShots
    };

    setParsedData(reconstructedParsedData);

    // 5. Dựng graph thống nhất bằng cách sử dụng chung hàm handleBuildStoryboard
    await handleBuildStoryboard({}, processedShots, true);

    // Không gọi lại phân tích Emotion ở đây vì nó đã chạy trong Bước 2.5. Gọi thêm sẽ sinh ra phân tích AI 2 lần lãng phí và gây lỗi sai state.
    // await handleAnalyzeImportedScriptEmotion();
  };

  const handleAnalyzeImportedScriptEmotion = async () => {
    const parsedData = useFlowStore.getState().parsedData;
    if (!parsedData || !parsedData.scenes || parsedData.scenes.length === 0) {
      console.warn("⚠️ Không có kịch bản phân cảnh nào để phân tích cảm xúc!");
      return;
    }

    setIsAnalyzingEmotion(true);
    try {
      let updatedScenes: any[] = [];

      const arc = parsedData.emotionArc;
      if (arc && Array.isArray(arc) && arc.length > 0) {
        updatedScenes = parsedData.scenes.map((s: any) => {
          const sNum = s.id?.replace(/\D/g, '') || s.id;
          const matchingAnal = (arc as any[]).find((ea: any) => {
            const eaNum = ea.sceneId?.replace(/\D/g, '') || ea.sceneId;
            return String(eaNum) === String(sNum);
          });
          if (matchingAnal) {
            return {
              ...s,
              location: matchingAnal.location || s.location || '',
              emotionIntensity: matchingAnal.intensity ?? matchingAnal.emotionIntensity ?? 50,
              valence: matchingAnal.valence || 'neutral',
              emotion: matchingAnal.emotion || 'neutral',
              arcPosition: matchingAnal.arcPosition || 'setup',
              lighting: matchingAnal.lighting || '',
              weather: matchingAnal.weather || '',
              soundCue: matchingAnal.soundCue || '',
              moodShift: matchingAnal.moodShift || '',
              moodShiftOut: matchingAnal.moodShiftOut || '',
              moodShiftPurpose: matchingAnal.moodShiftPurpose || ''
            };
          }
          return s;
        });
      } else {
        // 1. Phân tích AI cảm xúc, mood, bối cảnh thực tế cho scenes
        const { analyzeImportedScriptEmotion } = await import('../utils/scriptParser');
        const result = await analyzeImportedScriptEmotion(parsedData.scriptText || '', parsedData.scenes);
        
        if (!result || !result.scenes || !Array.isArray(result.scenes)) {
          throw new Error("Dữ liệu cảm xúc trả về không hợp lệ");
        }

        // Map kết quả phân tích về các scenes cũ
        updatedScenes = parsedData.scenes.map((s: any) => {
          const matchingAnal = result.scenes.find((rs: any) => String(rs.id) === String(s.id));
          if (matchingAnal) {
            return {
              ...s,
              location: matchingAnal.location || s.location || '',
              emotionIntensity: matchingAnal.emotionIntensity ?? 50,
              valence: matchingAnal.valence || 'neutral',
              emotion: matchingAnal.emotion || 'neutral',
              arcPosition: matchingAnal.arcPosition || 'setup',
              lighting: matchingAnal.lighting || '',
              weather: matchingAnal.weather || '',
              soundCue: matchingAnal.soundCue || '',
              moodShift: matchingAnal.moodShift || '',
              moodShiftOut: matchingAnal.moodShiftOut || '',
              moodShiftPurpose: matchingAnal.moodShiftPurpose || ''
            };
          }
          return s;
        });
      }

      // 2. Tải danh sách assets hiện tại từ World DB để phục vụ so khớp lại
      const activeUniverseId = useFlowStore.getState().projectData?.selectedProjectId || useFlowStore.getState().projectData?.selectedUniverseId;
      let dbAssets: any[] = [];
      
      if (activeUniverseId && activeUniverseId !== 'undefined' && activeUniverseId !== 'null' && activeUniverseId !== 'new') {
        try {
          const baseUrl = getApiBaseUrl();
          const HUB_API_KEY = localStorage.getItem('STORYMEE_HUB_API_KEY') || import.meta.env.VITE_HUB_API_KEY || '';
          const res = await fetch(`${baseUrl}/api/world-asset/characters?projectId=${activeUniverseId}`, {
            headers: { 'Authorization': `Bearer ${HUB_API_KEY}` }
          });
          if (res.ok) {
            const jsonVal = await res.json();
            dbAssets = Array.isArray(jsonVal) ? jsonVal : [];
          } else {
            console.warn("[handleAnalyzeImportedScriptEmotion] Failed to load assets: status", res.status);
            alert("⚠️ Không thể tải danh sách Asset từ World DB để phục vụ so khớp!");
          }
        } catch (err) {
          console.warn("[handleAnalyzeImportedScriptEmotion] Failed to load assets for mapping enrichment:", err);
          alert("⚠️ Lỗi kết nối World DB khi tải assets!");
        }
      }

      const getMediaId = (dbItem: any) => {
        try {
          const sg = typeof dbItem.styleGuide === 'string' ? JSON.parse(dbItem.styleGuide) : dbItem.styleGuide;
          const projId = useFlowStore.getState().projectData?.id;
          if (sg?.gflowMediaIds?.[projId]) {
            return sg.gflowMediaIds[projId];
          } else if (sg?.gflowMediaId) {
            return sg.gflowMediaId;
          }
        } catch (e) {}
        return undefined;
      };

      const isLocRaw = (loc: string) => {
        if (!loc) return true;
        const cleaned = loc.toLowerCase().trim();
        return /^(scene|sc|c\u1ea3nh)\s*\d+$/i.test(cleaned);
      };

      // 3. Khớp lại nhân vật, bối cảnh, đạo cụ cho các shot hiện có trong store
      const currentShots = useFlowStore.getState().pendingShots?.length > 0 
        ? useFlowStore.getState().pendingShots 
        : (parsedData.shots || []);
      const detectedCharNames = new Set<string>();
      const detectedLocNames = new Set<string>();
      const detectedPropNames = new Set<string>();

      if (parsedData?.props && Array.isArray(parsedData.props)) {
        parsedData.props.forEach((p: any) => {
          const nameStr = typeof p === 'string' ? p : (p.name || String(p));
          if (nameStr.trim()) detectedPropNames.add(nameStr.trim());
        });
      }

      const enrichedShots = currentShots.map((sh: any) => {
        const actionText = sh.action_description || sh.description || sh.diễn_tả || "";
        const dialogueText = sh.thoại || sh.dialogue || "";
        const combinedText = `${actionText} ${dialogueText}`;
        
        // A. Nhân vật
        const detectedChars = new Set<string>();
        const existingRefs = sh.character_refs || sh.characterIds || [];
        existingRefs.forEach((r: any) => {
          const nameStr = typeof r === 'string' ? r : (r.name || r.scriptName || String(r));
          if (nameStr.trim()) {
            detectedChars.add(nameStr.trim());
            detectedCharNames.add(nameStr.trim());
          }
        });

        dbAssets.forEach((c: any) => {
          if (c.entityType !== 'character' && c.entityType) return;
          let dbAliases = '';
          try {
            const sg = typeof c.styleGuide === 'string' ? JSON.parse(c.styleGuide) : c.styleGuide;
            dbAliases = sg?.aliases || '';
          } catch(e){}
          if (matchAssetWithMapping(combinedText, c.name, dbAliases)) {
            detectedChars.add(c.name);
            detectedCharNames.add(c.name);
          }
        });

        // Fallback: Tự động phát hiện các nhân vật mặc định từ LOCAL_MAPPING_KEYWORDS nếu có xuất hiện trong shot text
        const fallbackCharNames = ['Paco', 'Mica', 'Mom', 'Dad'];
        fallbackCharNames.forEach((charName) => {
          if (matchAssetWithMapping(combinedText, charName)) {
            detectedChars.add(charName);
            detectedCharNames.add(charName);
          }
        });

        // B. Bối cảnh
        let shotLoc = sh.location || sh.scene_ref || '';
        const scNum = sh.sceneNumber || sh.scene_number || parseInt(String(sh.sc || sh.sceneId || sh.scene_id || '').replace(/[^0-9]/g, '')) || 1;
        const matchedScene = updatedScenes.find((s: any) => {
          const sNum = parseInt(s.id?.replace(/\D/g, '') || '0', 10);
          return sNum === scNum;
        });

        if (isLocRaw(shotLoc) && matchedScene) {
          shotLoc = matchedScene.location || '';
        }

        const dbMatchLoc = dbAssets.find((c: any) => {
          if (c.entityType !== 'location') return false;
          let dbAliases = '';
          try {
            const sg = typeof c.styleGuide === 'string' ? JSON.parse(c.styleGuide) : c.styleGuide;
            dbAliases = sg?.aliases || '';
          } catch(e){}
          const slugName = c.slug || '';
          return c.name.toLowerCase().trim() === shotLoc.toLowerCase().trim() ||
                 (slugName && slugName.toLowerCase().trim() === shotLoc.toLowerCase().trim()) ||
                 matchAssetWithMapping(shotLoc, c.name, dbAliases) ||
                 matchAssetWithMapping(combinedText, c.name, dbAliases);
        });

        if (dbMatchLoc) {
          detectedLocNames.add(dbMatchLoc.name);
        } else if (shotLoc) {
          detectedLocNames.add(shotLoc);
        }

        // C. Đạo cụ
        const detectedProps = new Set<string>();
        const existingPropRefs = sh.prop_refs || sh.props || [];
        existingPropRefs.forEach((r: any) => {
          const nameStr = typeof r === 'string' ? r : (r.name || r.scriptName || String(r));
          if (nameStr.trim()) {
            detectedProps.add(nameStr.trim());
            detectedPropNames.add(nameStr.trim());
          }
        });

        dbAssets.forEach((c: any) => {
          if (c.entityType !== 'prop') return;
          let dbAliases = '';
          try {
            const sg = typeof c.styleGuide === 'string' ? JSON.parse(c.styleGuide) : c.styleGuide;
            dbAliases = sg?.aliases || '';
          } catch(e){}
          if (matchAssetWithMapping(combinedText, c.name, dbAliases)) {
            detectedProps.add(c.name);
            detectedPropNames.add(c.name);
          }
        });

        // Tìm characterIds tương ứng từ detectedChars để cập nhật luôn vào shot
        const resolvedCharIds = Array.from(detectedChars).map(charName => {
          const dbChar = dbAssets.find(c => {
            if (c.entityType !== 'character' && c.entityType) return false;
            let dbAliases = '';
            try {
              const sg = typeof c.styleGuide === 'string' ? JSON.parse(c.styleGuide) : c.styleGuide;
              dbAliases = sg?.aliases || '';
            } catch(e){}
            const slugName = c.slug || '';
            return safeMatchName(charName, c.name, dbAliases) || 
                   (slugName && (charName.toLowerCase() === slugName.toLowerCase() || safeMatchName(charName, slugName)));
          });
          return dbChar ? dbChar.id : null;
        }).filter(Boolean);

        return {
          ...sh,
          character_refs: Array.from(detectedChars),
          characterIds: Array.from(new Set([...(sh.characterIds || []), ...resolvedCharIds])),
          location: dbMatchLoc ? dbMatchLoc.name : shotLoc,
          locationId: sh.locationId || (dbMatchLoc ? dbMatchLoc.id : undefined),
          prop_refs: Array.from(detectedProps)
        };
      });

      // Bổ sung thêm các nhân vật & bối cảnh từ Scene LLM tags để làm giàu toàn diện
      updatedScenes.forEach((s: any) => {
        const scChars = s.charactersInScene || s.tags || [];
        scChars.forEach((c: any) => detectedCharNames.add(String(c)));
        if (s.location) detectedLocNames.add(s.location);
      });

      // 4. Tạo danh sách làm giàu (hydrate) Asset tương ứng
      const enrichedChars = Array.from(detectedCharNames).map(name => {
        const dbMatch = dbAssets.find((c: any) => 
          (c.entityType === 'character' || !c.entityType) && 
          (c.name.toLowerCase().trim() === name.toLowerCase().trim() || (c.slug && c.slug.toLowerCase().trim() === name.toLowerCase().trim()))
        );
        if (dbMatch) {
          let dbAliases = '';
          try {
            const sg = typeof dbMatch.styleGuide === 'string' ? JSON.parse(dbMatch.styleGuide) : dbMatch.styleGuide;
            dbAliases = sg?.aliases || '';
          } catch(e){}
          return {
            name: dbMatch.name,
            description: dbMatch.description || 'Nhân vật khớp từ World DB.',
            imageUrl: dbMatch.rootImageUrl || '',
            worldAssetCharId: dbMatch.id,
            worldAssetCharName: dbMatch.name,
            mediaId: getMediaId(dbMatch),
            renderMode: 'character_only',
            gridFormat: '2x2',
            aliases: dbAliases
          };
        }
        return {
          name: name,
          description: 'Nhân vật phát hiện từ kịch bản.',
          imageUrl: '',
          worldAssetCharId: undefined,
          worldAssetCharName: name,
          mediaId: '',
          renderMode: 'character_only',
          gridFormat: '2x2',
          aliases: ''
        };
      }).filter(Boolean) as any[];

      const enrichedLocs = Array.from(detectedLocNames).map(name => {
        const dbMatch = dbAssets.find((c: any) => 
          c.entityType === 'location' && 
          (c.name.toLowerCase().trim() === name.toLowerCase().trim() || (c.slug && c.slug.toLowerCase().trim() === name.toLowerCase().trim()))
        );
        if (dbMatch) {
          let adjacentIds: string[] = [];
          let sharedDnaStr = '';
          let dbAliases = '';
          try {
            const sg = typeof dbMatch.styleGuide === 'string' ? JSON.parse(dbMatch.styleGuide) : dbMatch.styleGuide;
            if (sg?.spatialRelations) adjacentIds = sg.spatialRelations.map((r: any) => r.targetLocationId);
            if (sg?.sharedDna) sharedDnaStr = sg.sharedDna;
            dbAliases = sg?.aliases || '';
          } catch (e) {}

          return {
            name: dbMatch.name,
            description: dbMatch.description || 'Bối cảnh khớp từ World DB.',
            imageUrl: dbMatch.rootImageUrl || '',
            worldAssetCharId: dbMatch.id,
            worldAssetCharName: dbMatch.name,
            mediaId: getMediaId(dbMatch),
            adjacentLocationIds: adjacentIds.length > 0 ? adjacentIds : [],
            sharedDna: sharedDnaStr || '',
            renderMode: 'location_only',
            gridFormat: '2x2',
            aliases: dbAliases
          };
        }
        return {
          name: name,
          description: 'Bối cảnh phát hiện từ kịch bản.',
          imageUrl: '',
          worldAssetCharId: undefined,
          worldAssetCharName: name,
          mediaId: '',
          adjacentLocationIds: [],
          sharedDna: '',
          renderMode: 'location_only',
          gridFormat: '2x2',
          aliases: ''
        };
      }).filter(Boolean) as any[];

      const enrichedProps = Array.from(detectedPropNames).map(name => {
        const dbMatch = dbAssets.find((c: any) => 
          c.entityType === 'prop' && 
          (c.name.toLowerCase().trim() === name.toLowerCase().trim() || (c.slug && c.slug.toLowerCase().trim() === name.toLowerCase().trim()))
        );
        if (dbMatch) {
          let dbAliases = '';
          try {
            const sg = typeof dbMatch.styleGuide === 'string' ? JSON.parse(dbMatch.styleGuide) : dbMatch.styleGuide;
            dbAliases = sg?.aliases || '';
          } catch(e){}
          return {
            name: dbMatch.name,
            description: dbMatch.description || 'Đạo cụ khớp từ World DB.',
            imageUrl: dbMatch.rootImageUrl || '',
            worldAssetCharId: dbMatch.id,
            worldAssetCharName: dbMatch.name,
            mediaId: getMediaId(dbMatch),
            renderMode: 'prop_only',
            gridFormat: '2x2',
            aliases: dbAliases
          };
        }
        return {
          name: name,
          description: 'Đạo cụ phát hiện từ kịch bản.',
          imageUrl: '',
          worldAssetCharId: undefined,
          worldAssetCharName: name,
          mediaId: '',
          renderMode: 'prop_only',
          gridFormat: '2x2',
          aliases: ''
        };
      }).filter(Boolean) as any[];

      // Tạo emotion arc beat data mới
      const updatedEmotionArc = updatedScenes.map((s: any) => {
        const narrativeSceneId = `Scene ${s.id?.replace(/\D/g, '') || s.id}`;
        return {
          sceneId: narrativeSceneId,
          intensity: s.emotionIntensity ?? 50,
          valence: s.valence || 'neutral',
          emotion: s.emotion || 'neutral',
          arcPosition: s.arcPosition || 'setup',
          lighting: s.lighting || '',
          weather: s.weather || '',
          soundCue: s.soundCue || '',
          moodShift: s.moodShift || '',
          moodShiftOut: s.moodShiftOut || '',
          moodShiftPurpose: s.moodShiftPurpose || ''
        };
      });

      // Tạo sceneConfigs mới cho emotionArcNode
      const sceneConfigs: Record<string, any> = {};
      updatedScenes.forEach((s: any) => {
        const narrativeSceneId = `Scene ${s.id?.replace(/\D/g, '') || s.id}`;
        sceneConfigs[narrativeSceneId] = {
          sceneId: narrativeSceneId,
          sceneGroupId: narrativeSceneId,
          location: s.location || 'Bối cảnh',
          timeOfDay: s.timeOfDay || 'DAY',
          action: s.action || s.sceneDescription || '',
          charactersInScene: s.charactersInScene || s.tags || [],
          props: s.props || [],
          emotionIntensity: s.emotionIntensity ?? 50,
          valence: s.valence || 'neutral',
          emotion: s.emotion || 'neutral',
          arcPosition: s.arcPosition || 'setup',
          lighting: s.lighting || '',
          weather: s.weather || '',
          soundCue: s.soundCue || '',
          isReady: true,
          prepNotes: '',
          panelGrid: 'auto',
        };
      });

      // Cập nhật các node trên canvas (giữ nguyên worldAssetCharId)
      const setNodes = useFlowStore.getState().setNodes;
      setNodes(nds => nds.map(n => {
        if (n.type === 'worldAssetNode') {
          return {
            ...n,
            data: {
              ...n.data,
              characters: enrichedChars,
              locations: enrichedLocs,
              props: enrichedProps
            }
          };
        }
        if (n.type === 'emotionArcNode') {
          return {
            ...n,
            data: {
              ...n.data,
              emotionArc: updatedEmotionArc,
              sceneConfigs
            }
          };
        }
        if (n.type === 'sceneNode') {
          const sIdNum = n.data?.sceneId?.replace(/\D/g, '') || '';
          const matchingScene = updatedScenes.find((s: any) => s.id?.replace(/\D/g, '') === sIdNum);
          if (matchingScene) {
            return {
              ...n,
              data: {
                ...n.data,
                location: matchingScene.location || n.data.location || 'Bối cảnh',
                emotion: matchingScene.emotion || 'neutral',
                emotionIntensity: matchingScene.emotionIntensity ?? 50,
                valence: matchingScene.valence || 'neutral',
                arcPosition: matchingScene.arcPosition || 'setup',
              }
            };
          }
        }
        return n;
      }));

      // Cập nhật parsedData trong store
      const latestParsed = useFlowStore.getState().parsedData;
      useFlowStore.getState().setParsedData({
        ...(latestParsed || parsedData),
        scenes: updatedScenes,
        emotionArc: updatedEmotionArc,
        shots: enrichedShots,
        characters: enrichedChars,
        locations: enrichedLocs,
        props: enrichedProps
      });

      // Cập nhật pendingShots trong store
      useFlowStore.getState().setPendingShots(enrichedShots);

      // Báo sự kiện thay đổi asset để các UI khác cập nhật
      window.dispatchEvent(new CustomEvent('WORLD_ASSETS_CHANGED'));

      alert("🎉 Đã phân tích kịch bản tổng hợp (Cảm xúc, Mood, Assets) thành công!");
    } catch (err: any) {
      alert("❌ Lỗi phân tích kịch bản: " + err.message);
    } finally {
      setIsAnalyzingEmotion(false);
    }
  };

  const handleRefreshAssets = async (targetProjectId?: string) => {
    const projectData = useFlowStore.getState().projectData;
    const activeProjId = targetProjectId || projectData.selectedProjectId || projectData.selectedUniverseId;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    if (!activeProjId || !uuidRegex.test(activeProjId)) {
      return;
    }

    try {
      const baseUrl = getApiBaseUrl();
      const HUB_API_KEY = localStorage.getItem('STORYMEE_HUB_API_KEY') || import.meta.env.VITE_HUB_API_KEY || '';
      
      const res = await fetch(`${baseUrl}/api/world-asset/characters?projectId=${activeProjId}`, {
        headers: { 'Authorization': `Bearer ${HUB_API_KEY}` }
      });
      if (!res.ok) throw new Error("Không thể tải danh sách Asset từ World DB");
      const dbChars = await res.json();
      console.log(`[handleRefreshAssets] Loaded ${dbChars.length} assets from DB.`);

      const getMediaId = (dbItem: any) => {
        try {
          const sg = typeof dbItem.styleGuide === 'string' ? JSON.parse(dbItem.styleGuide) : dbItem.styleGuide;
          if (sg?.gflowMediaIds?.[projectData.id]) {
            return sg.gflowMediaIds[projectData.id];
          } else if (sg?.gflowMediaId) {
            return sg.gflowMediaId;
          }
        } catch (e) {}
        return undefined;
      };

      const currentShots = useFlowStore.getState().pendingShots || [];
      const parsedData = useFlowStore.getState().parsedData;
      const scenes = parsedData?.scenes || [];
      const enrichedShots = hydrateShotsWithUniverseAssets(currentShots, dbChars, projectData.id, scenes);

      const detectedCharNames = new Set<string>();
      const detectedLocNames = new Set<string>();
      const detectedPropNames = new Set<string>();

      enrichedShots.forEach((sh: any) => {
        if (sh.character_refs) sh.character_refs.forEach((c: string) => detectedCharNames.add(c));
        if (sh.location) detectedLocNames.add(sh.location);
        if (sh.prop_refs) sh.prop_refs.forEach((p: string) => detectedPropNames.add(p));
      });

      if (parsedData?.props && Array.isArray(parsedData.props)) {
        parsedData.props.forEach((p: any) => {
          const nameStr = typeof p === 'string' ? p : (p.name || String(p));
          if (nameStr.trim()) detectedPropNames.add(nameStr.trim());
        });
      }

      const enrichedChars = Array.from(detectedCharNames).map(name => {
        const dbMatch = dbChars.find((c: any) => (c.entityType === 'character' || !c.entityType) && c.name.toLowerCase().trim() === name.toLowerCase().trim());
        if (dbMatch) {
          let dbAliases = '';
          try {
            const sg = typeof dbMatch.styleGuide === 'string' ? JSON.parse(dbMatch.styleGuide) : dbMatch.styleGuide;
            dbAliases = sg?.aliases || '';
          } catch(e){}
          return {
            name: dbMatch.name,
            description: dbMatch.description || 'Nhân vật khớp từ World DB.',
            imageUrl: dbMatch.rootImageUrl || '',
            worldAssetCharId: dbMatch.id,
            worldAssetCharName: dbMatch.name,
            mediaId: getMediaId(dbMatch),
            renderMode: 'character_only',
            gridFormat: '2x2',
            aliases: dbAliases
          };
        }
        return {
          name: name,
          description: 'Nhân vật phát hiện từ kịch bản.',
          imageUrl: '',
          worldAssetCharId: undefined,
          worldAssetCharName: name,
          mediaId: '',
          renderMode: 'character_only',
          gridFormat: '2x2',
          aliases: ''
        };
      }).filter(Boolean) as any[];

      const enrichedLocs = Array.from(detectedLocNames).map(name => {
        const dbMatch = dbChars.find((c: any) => c.entityType === 'location' && c.name.toLowerCase().trim() === name.toLowerCase().trim());
        if (dbMatch) {
          let adjacentIds: string[] = [];
          let sharedDnaStr = '';
          let dbAliases = '';
          try {
            const sg = typeof dbMatch.styleGuide === 'string' ? JSON.parse(dbMatch.styleGuide) : dbMatch.styleGuide;
            if (sg?.spatialRelations) adjacentIds = sg.spatialRelations.map((r: any) => r.targetLocationId);
            if (sg?.sharedDna) sharedDnaStr = sg.sharedDna;
            dbAliases = sg?.aliases || '';
          } catch (e) {}

          return {
            name: dbMatch.name,
            description: dbMatch.description || 'Bối cảnh khớp từ World DB.',
            imageUrl: dbMatch.rootImageUrl || '',
            worldAssetCharId: dbMatch.id,
            worldAssetCharName: dbMatch.name,
            mediaId: getMediaId(dbMatch),
            adjacentLocationIds: adjacentIds.length > 0 ? adjacentIds : [],
            sharedDna: sharedDnaStr || '',
            renderMode: 'location_only',
            gridFormat: '2x2',
            aliases: dbAliases
          };
        }
        return {
          name: name,
          description: 'Bối cảnh phát hiện từ kịch bản.',
          imageUrl: '',
          worldAssetCharId: undefined,
          worldAssetCharName: name,
          mediaId: '',
          adjacentLocationIds: [],
          sharedDna: '',
          renderMode: 'location_only',
          gridFormat: '2x2',
          aliases: ''
        };
      }).filter(Boolean) as any[];

      const enrichedProps = Array.from(detectedPropNames).map(name => {
        const dbMatch = dbChars.find((c: any) => c.entityType === 'prop' && c.name.toLowerCase().trim() === name.toLowerCase().trim());
        if (dbMatch) {
          let dbAliases = '';
          try {
            const sg = typeof dbMatch.styleGuide === 'string' ? JSON.parse(dbMatch.styleGuide) : dbMatch.styleGuide;
            dbAliases = sg?.aliases || '';
          } catch(e){}
          return {
            name: dbMatch.name,
            description: dbMatch.description || 'Đạo cụ khớp từ World DB.',
            imageUrl: dbMatch.rootImageUrl || '',
            worldAssetCharId: dbMatch.id,
            worldAssetCharName: dbMatch.name,
            mediaId: getMediaId(dbMatch),
            renderMode: 'prop_only',
            gridFormat: '2x2',
            aliases: dbAliases
          };
        }
        return {
          name: name,
          description: 'Đạo cụ phát hiện từ kịch bản.',
          imageUrl: '',
          worldAssetCharId: undefined,
          worldAssetCharName: name,
          mediaId: '',
          renderMode: 'prop_only',
          gridFormat: '2x2',
          aliases: ''
        };
      }).filter(Boolean) as any[];

      const setNodes = useFlowStore.getState().setNodes;
      setNodes(nds => nds.map(n => {
        if (n.type === 'worldAssetNode') {
          return {
            ...n,
            data: {
              ...n.data,
              characters: enrichedChars,
              locations: enrichedLocs,
              props: enrichedProps
            }
          };
        }
        return n;
      }));

      useFlowStore.getState().setPendingShots(enrichedShots);
      useFlowStore.getState().setParsedData({
        ...parsedData,
        characters: enrichedChars,
        locations: enrichedLocs,
        props: enrichedProps,
        scenes: parsedData?.scenes || [],
        scriptText: parsedData?.scriptText || "",
        shots: enrichedShots
      } as any);

      window.dispatchEvent(new CustomEvent('WORLD_ASSETS_CHANGED'));
      console.log("[handleRefreshAssets] Successfully re-matched assets and updated store/canvas.");
    } catch (err: any) {
      console.error("[handleRefreshAssets] Error refreshing assets:", err);
    }
  };

  const handleImportGeneratedShotlist = async (generatedData: any, targetProjectId?: string) => {
    setIsBuildingStoryboard(true);
    setBuildingStage("Đang đồng bộ và chuẩn bị dựng Storyboard...");
    try {
      // Lưu vào parsedData của store
      setParsedData(generatedData);
      
      const rawShots = generatedData.shots || [];
      
      // 1. Dựng graph
      await handleBuildStoryboard({}, rawShots, true);
      
      // 2. Chạy tiếp phân tích cảm xúc tuần tự
      await handleAnalyzeImportedScriptEmotion();
    } catch (err: any) {
      console.error("Lỗi khi nạp dữ liệu sinh bởi AI:", err);
      throw err;
    } finally {
      setIsBuildingStoryboard(false);
      setBuildingStage('');
    }
  };

  return {
    isBuildingStoryboard,
    buildingStage,
    handleAnalyze,
    handleBuildStoryboard,
    handleImportEpisode,
    isAnalyzingEmotion,
    handleAnalyzeImportedScriptEmotion,
    handleRefreshAssets,
    handleImportGeneratedShotlist
  };
}
