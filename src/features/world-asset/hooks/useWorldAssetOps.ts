import { useState, useEffect } from 'react';
import { useFlowStore } from '../../../store/useFlowStore';
import { getApiBaseUrl } from '../../../utils/apiConfig';
import { useGFlowExtension } from '../../../nodes/hooks/useGFlowExtension';
import { useWorldAssetProject } from '../../../nodes/hooks/useWorldAssetProject';
import { uploadFileToDB, createAssetInDB } from '../../../services/api';
import type { AssetItem, AssetType } from '../types';

interface UseWorldAssetOpsProps {
  canvasCharacters: AssetItem[];
  canvasLocations: AssetItem[];
  canvasProps: AssetItem[];
  updateCanvasCharacters: (chars: AssetItem[]) => void;
  updateCanvasLocations: (locs: AssetItem[]) => void;
  updateCanvasProps: (props: AssetItem[]) => void;
  getNodes: any;
}

export function useWorldAssetOps({
  canvasCharacters,
  canvasLocations,
  canvasProps,
  updateCanvasCharacters,
  updateCanvasLocations,
  updateCanvasProps,
  getNodes
}: UseWorldAssetOpsProps) {
  const [charVariants, setCharVariants] = useState<Record<string, any[]>>({});
  const [projectAssets, setProjectAssets] = useState<any[]>([]);
  const [syncingStates, setSyncingStates] = useState<Record<string, boolean>>({});
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [generatingStates, setGeneratingStates] = useState<Record<string, boolean>>({});
  const [generatingPrompts, setGeneratingPrompts] = useState<Record<string, boolean>>({});
  const [isGeneratingStyle, setIsGeneratingStyle] = useState(false);

  // Slice Panel States in hook
  const [sliceModalOpen, setSliceModalOpen] = useState(false);
  const [activeSliceAsset, setActiveSliceAsset] = useState<any>(null);
  const [slicingStates, setSlicingStates] = useState<Record<number, string>>({});

  const projectData = useFlowStore((state: any) => state.projectData);
  const setProjectData = useFlowStore((state: any) => state.setProjectData);

  // 1. GFlow Chrome Extension Integration
  const {
    isCreatingProject,
    handleCreateProject,
    uploadReferenceImage
  } = useGFlowExtension({ projectData, setProjectData });

  // 2. World Asset Projects & Data Management
  const {
    projects,
    selectedProjectId,
    setSelectedProjectId,
    isLoadingProjects,
    isCreatingProject: isCreatingWorldAssetProject,
    newProjectName,
    setNewProjectName,
    handleCreateWorldAssetProject,
    loadProjects,
    episodes,
    isLoadingEpisodes,
    isSyncingEpisode,
    handleSyncEpisodeToDB,
    worldAssetChars,
    isSyncingLetta,
    handleSyncLetta
  } = useWorldAssetProject({
    projectData,
    getNodes
  });

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, []);

  const getBase64Image = async (imgUrl: string): Promise<string> => {
    if (!imgUrl) return '';
    if (imgUrl.startsWith('data:image/')) return imgUrl;
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          try {
            const dataURL = canvas.toDataURL('image/png');
            resolve(dataURL);
            return;
          } catch (e) {
            console.warn("Canvas toDataURL failed:", e);
          }
        }
        resolve(imgUrl);
      };
      img.onerror = () => {
        resolve(imgUrl);
      };
      img.src = imgUrl;
    });
  };

  const cropImageTo4Quadrants = (imageUrl: string): Promise<string[]> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error("Cannot get canvas context"));
          return;
        }
        
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        const halfW = Math.floor(w / 2);
        const halfH = Math.floor(h / 2);
        
        canvas.width = halfW;
        canvas.height = halfH;
        
        const quadrants = [
          { sx: 0, sy: 0 },         // Top-Left
          { sx: halfW, sy: 0 },     // Top-Right
          { sx: 0, sy: halfH },     // Bottom-Left
          { sx: halfW, sy: halfH }  // Bottom-Right
        ];
        
        const results: string[] = [];
        try {
          quadrants.forEach(q => {
            ctx.clearRect(0, 0, halfW, halfH);
            ctx.drawImage(img, q.sx, q.sy, halfW, halfH, 0, 0, halfW, halfH);
            results.push(canvas.toDataURL('image/png'));
          });
          resolve(results);
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => {
        reject(new Error("Failed to load image for cropping"));
      };
      img.src = imageUrl;
    });
  };

  const handleOpenSliceModal = (asset: any) => {
    setActiveSliceAsset(asset);
    setSlicingStates({});
    setSliceModalOpen(true);
  };

  const handleSaveSlice = async (idx: number, row: number, col: number, totalRows: number, totalCols: number, setAsRoot?: boolean) => {
    if (!activeSliceAsset) return;
    const imageUrl = activeSliceAsset.imageUrl;
    if (!imageUrl) return;

    setSlicingStates(prev => ({ ...prev, [idx]: 'Đang cắt...' }));

    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = imageUrl;

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Canvas context is not available");

      const subWidth = img.naturalWidth / totalCols;
      const subHeight = img.naturalHeight / totalRows;

      canvas.width = subWidth;
      canvas.height = subHeight;

      ctx.drawImage(
        img,
        col * subWidth, row * subHeight, subWidth, subHeight,
        0, 0, subWidth, subHeight
      );

      setSlicingStates(prev => ({ ...prev, [idx]: 'Đang lưu...' }));

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95));
      if (!blob) throw new Error("Failed to create blob from canvas");

      const uploadRes = await uploadFileToDB(blob, `slice_${activeSliceAsset.type}_${activeSliceAsset.index}_${idx}.jpg`);
      const finalUrl = uploadRes.url;

      await createAssetInDB({
        ipId: activeSliceAsset.worldAssetCharId || null,
        assetType: 'image',
        driveUrl: finalUrl,
        tags: ['angle-slice', 'paco-bible', activeSliceAsset.type],
        projectId: selectedProjectId || undefined
      });

      // Nếu setAsRoot = true, tự động cập nhật rootImageUrl trong DB
      if (setAsRoot && activeSliceAsset.worldAssetCharId) {
        console.log(`[SliceRootSync] Setting sliced panel ${idx} as root image in DB...`);
        const baseUrl = getApiBaseUrl();
        const HUB_API_KEY = localStorage.getItem('STORYMEE_HUB_API_KEY') || import.meta.env.VITE_HUB_API_KEY || '';
        const headers: any = { 'Content-Type': 'application/json' };
        if (HUB_API_KEY) headers['Authorization'] = `Bearer ${HUB_API_KEY}`;

        const getRes = await fetch(`${baseUrl}/internal/v1/asset/world/characters/${activeSliceAsset.worldAssetCharId}`, {
          method: 'GET',
          headers
        });

        if (getRes.ok) {
          const assetDetail = await getRes.json();
          if (assetDetail) {
            assetDetail.rootImageUrl = finalUrl;
            
            // Cập nhật cục bộ cho Node Canvas
            const type = activeSliceAsset.type;
            const assetIdx = activeSliceAsset.index;
            const arr = type === 'character' ? canvasCharacters : type === 'location' ? canvasLocations : canvasProps;
            const updated = [...arr];
            updated[assetIdx] = {
              ...updated[assetIdx],
              imageUrl: finalUrl
            };
            if (type === 'character') updateCanvasCharacters(updated);
            else if (type === 'location') updateCanvasLocations(updated);
            else if (type === 'prop') updateCanvasProps(updated);

            await fetch(`${baseUrl}/internal/v1/asset/world/characters/${activeSliceAsset.worldAssetCharId}`, {
              method: 'PUT',
              headers,
              body: JSON.stringify(assetDetail)
            });
          }
        }
      }

      setSlicingStates(prev => ({ ...prev, [idx]: setAsRoot ? 'Đã lưu & Đặt làm ảnh chính!' : 'Đã lưu Ref!' }));

      if (activeSliceAsset.worldAssetCharId) {
        setTimeout(() => {
          loadVariantsForChar(activeSliceAsset.worldAssetCharId, true);
        }, 100);
      }
    } catch (err: any) {
      console.error(err);
      setSlicingStates(prev => ({ ...prev, [idx]: `Lỗi: ${err.message || err}` }));
    }
  };

  const handleSelectVariantAsRoot = async (
    type: AssetType,
    idx: number,
    variantUrl: string,
    variantId: string
  ) => {
    const arr = type === 'character' ? canvasCharacters : type === 'location' ? canvasLocations : canvasProps;
    const item = arr[idx];
    const worldAssetId = item.worldAssetCharId;
    if (!worldAssetId) return;

    try {
      const baseUrl = getApiBaseUrl();
      const HUB_API_KEY = localStorage.getItem('STORYMEE_HUB_API_KEY') || import.meta.env.VITE_HUB_API_KEY || '';
      const headers: any = { 'Content-Type': 'application/json' };
      if (HUB_API_KEY) headers['Authorization'] = `Bearer ${HUB_API_KEY}`;

      const getRes = await fetch(`${baseUrl}/internal/v1/asset/world/characters/${worldAssetId}`, {
        method: 'GET',
        headers
      });

      if (getRes.ok) {
        const assetDetail = await getRes.json();
        if (assetDetail) {
          assetDetail.rootImageUrl = variantUrl;

          let sg = {};
          if (assetDetail.styleGuide) {
            sg = typeof assetDetail.styleGuide === 'string' ? JSON.parse(assetDetail.styleGuide) : assetDetail.styleGuide;
          }
          if (!sg) sg = {};
          if (!(sg as any).gflowMediaIds) (sg as any).gflowMediaIds = {};
          (sg as any).gflowMediaIds[projectData.id] = variantId;
          (sg as any).gflowMediaId = variantId;

          assetDetail.styleGuide = typeof sg === 'string' ? sg : JSON.stringify(sg);

          const putRes = await fetch(`${baseUrl}/internal/v1/asset/world/characters/${worldAssetId}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(assetDetail)
          });

          if (putRes.ok) {
            console.log(`[RootImageSync] Variant selected as root image updated in DB for ${item.name}!`);
            window.dispatchEvent(new CustomEvent('WORLD_ASSETS_CHANGED'));
          } else {
            console.warn("[RootImageSync] Failed to update root image in DB, status:", putRes.status);
          }
        }
      }
    } catch (err) {
      console.error("Lỗi khi cập nhật root image từ variant:", err);
    }
  };

  const ensureWorldAssetId = async (type: AssetType, idx: number): Promise<string | null> => {
    const arr = type === 'character' ? canvasCharacters : type === 'location' ? canvasLocations : canvasProps;
    const item = arr[idx];
    if (item.worldAssetCharId) return item.worldAssetCharId;
    if (!selectedProjectId) return null;

    try {
      const baseUrl = getApiBaseUrl();
      const payload = {
        rootImageUrl: item.imageUrl || '',
        name: item.name,
        slug: item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        description: item.description || '',
        entityType: type,
        projectId: selectedProjectId,
        universeId: selectedProjectId,
        styleGuide: { gflowMediaIds: {}, gflowMediaId: item.mediaId || '', aliases: item.aliases || '' }
      };

      const HUB_API_KEY = localStorage.getItem('STORYMEE_HUB_API_KEY') || import.meta.env.VITE_HUB_API_KEY || '';
      const headers: any = { 'Content-Type': 'application/json' };
      if (HUB_API_KEY) headers['Authorization'] = `Bearer ${HUB_API_KEY}`;

      const response = await fetch(`${baseUrl}/internal/v1/asset/world/characters`, {
         method: 'POST',
         headers,
         body: JSON.stringify(payload)
      });

      if (response.ok) {
        const created = await response.json();
        if (created && created.id) {
          const updated = [...arr];
          updated[idx] = { 
            ...updated[idx], 
            worldAssetCharId: created.id,
            worldAssetCharName: item.name 
          };
          if (type === 'character') updateCanvasCharacters(updated);
          else if (type === 'location') updateCanvasLocations(updated);
          else if (type === 'prop') updateCanvasProps(updated);
          
          window.dispatchEvent(new CustomEvent('WORLD_ASSETS_CHANGED'));
          return created.id;
        }
      }
    } catch (e) {
      console.error("Failed to auto-create world asset character", e);
    }
    return null;
  };

  const handleAutoGenChar = async (idx: number) => {
    const char = canvasCharacters[idx];
    const key = `char-gen-${idx}`;
    setGeneratingStates(prev => ({ ...prev, [key]: true }));
    try {
      const globalStyle = projectData.stylePrompt || "Mặc định";
      const renderMode = char.renderMode || 'character_only';
      const gridFormat = char.gridFormat || '2x2';

      let layoutDesc = '';
      if (gridFormat === '2x1') layoutDesc = 'showing 2-panel side-by-side turnaround character design sheet';
      else if (gridFormat === '2x2') layoutDesc = 'showing 4-panel turnaround character design sheet';
      else if (gridFormat === '2x3') layoutDesc = 'showing 6-panel turnaround character design sheet';
      else layoutDesc = 'showing single turnaround view';

      let renderStyleDesc = '';
      if (renderMode === 'character_only') renderStyleDesc = 'character turnaround design sheet, isolated on a solid white background, clean cutout, no environment background';
      else if (renderMode === 'location_only') renderStyleDesc = 'empty background, no characters';
      else renderStyleDesc = 'integrated with detailed atmospheric background';

      const prompt = `A clean, warm cinematic 3D animated character design turnaround sheet ${layoutDesc} of ${char.name}. ${char.description || ''}. Panel details: front view, side view, back view, turnaround, isolated on a solid white background. Visual Style: ${globalStyle}. ${renderStyleDesc}, masterpiece, highly detailed.`;
      
      const { generateMediaViaGateway } = await import('../../../utils/mediaGateway');
      const result = await generateMediaViaGateway({
         prompt,
         projectId: projectData.id,
         projectName: projectData.name,
         ipId: char.worldAssetCharId,
         numOutputs: 1,
         mediaType: 'image',
         renderMode: renderMode as any,
         gridFormat: gridFormat as any
      });

      if (result.success && result.images && result.images.length > 0) {
         const generatedImg = result.images[0].url;
         const mediaId = result.images[0].mediaId || generatedImg;

         const updated = [...canvasCharacters];
         updated[idx] = { 
            ...updated[idx], 
            imageUrl: generatedImg,
            mediaId: mediaId
         };
         updateCanvasCharacters(updated);

         // Root Image Sync
          console.log("[RootImageSync] Ensuring character is synced and root image is updated in World Asset DB...");
          const resolvedCharId = await ensureWorldAssetId('character', idx);
          if (resolvedCharId) {
             console.log(`[RootImageSync] Character ID resolved: ${resolvedCharId}. Fetching and updating root image...`);
             try {
                const baseUrl = getApiBaseUrl();
                const HUB_API_KEY = localStorage.getItem('STORYMEE_HUB_API_KEY') || import.meta.env.VITE_HUB_API_KEY || '';
                const headers: any = { 'Content-Type': 'application/json' };
                if (HUB_API_KEY) headers['Authorization'] = `Bearer ${HUB_API_KEY}`;
                
                const getRes = await fetch(`${baseUrl}/internal/v1/asset/world/characters/${resolvedCharId}`, {
                   method: 'GET',
                   headers
                });
                if (getRes.ok) {
                   const assetDetail = await getRes.json();
                   if (assetDetail) {
                      assetDetail.rootImageUrl = generatedImg;
                      
                      let sg = {};
                      if (assetDetail.styleGuide) {
                         sg = typeof assetDetail.styleGuide === 'string' ? JSON.parse(assetDetail.styleGuide) : assetDetail.styleGuide;
                      }
                      if (!sg) sg = {};
                      if (!(sg as any).gflowMediaIds) (sg as any).gflowMediaIds = {};
                      (sg as any).gflowMediaIds[projectData.id] = mediaId;
                      (sg as any).gflowMediaId = mediaId;
                      
                      assetDetail.styleGuide = typeof sg === 'string' ? sg : JSON.stringify(sg);
                      
                      const putRes = await fetch(`${baseUrl}/internal/v1/asset/world/characters/${resolvedCharId}`, {
                         method: 'PUT',
                         headers,
                         body: JSON.stringify(assetDetail)
                      });
                      if (putRes.ok) {
                         console.log("[RootImageSync] Character root image and styleGuide updated successfully in DB!");
                      } else {
                         console.warn("[RootImageSync] Failed to update character in DB, status:", putRes.status);
                      }
                   }
                } else {
                   console.warn("[RootImageSync] Failed to fetch character details, status:", getRes.status);
                }
                
                setTimeout(() => {
                   loadVariantsForChar(resolvedCharId, true);
                }, 200);
                
                window.dispatchEvent(new CustomEvent('WORLD_ASSETS_CHANGED'));
             } catch (err: any) {
                console.error("Lỗi khi cập nhật root image nhân vật:", err);
             }
          }
      } else {
         alert("❌ Lỗi sinh ảnh: " + (result.error || "Không có kết quả"));
      }
    } catch (e: any) {
      alert("❌ Lỗi sinh ảnh: " + e.message);
    } finally {
      setGeneratingStates(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleAutoGenLoc = async (idx: number) => {
    const loc = canvasLocations[idx];
    const key = `loc-gen-${idx}`;
    setGeneratingStates(prev => ({ ...prev, [key]: true }));
    try {
      const globalStyle = projectData.stylePrompt || "Mặc định";
      const renderMode = loc.renderMode || 'location_only';
      const gridFormat = loc.gridFormat || '1x1';

      let layoutDesc = '';
      if (gridFormat === '2x1') layoutDesc = 'showing 2-panel horizontal grid layout, 2 panorama views side-by-side, split screen, 2 panels';
      else if (gridFormat === '2x2') layoutDesc = 'showing 4-panel grid layout in 4 angles: wide establishing, medium angle, close-up, high angle';
      else if (gridFormat === '2x3') layoutDesc = 'showing 6-panel grid layout with multiple camera angles and perspectives';
      else layoutDesc = 'showing wide establishing cinematic shot';

      let renderStyleDesc = '';
      if (renderMode === 'location_only') renderStyleDesc = 'empty background, no characters, no people, pure environment concept art';
      else if (renderMode === 'character_only') renderStyleDesc = 'character isolated concept art';
      else renderStyleDesc = 'with characters interacting naturally within the scene';

      const prompt = `A clean, warm cinematic 3D animated environment design sheet ${layoutDesc} of ${loc.name}. ${loc.description || ''}. Visual Style: ${globalStyle}. ${renderStyleDesc}, masterpiece, highly detailed.`;
      
      const { generateMediaViaGateway } = await import('../../../utils/mediaGateway');
      const result = await generateMediaViaGateway({
         prompt,
         projectId: projectData.id,
         projectName: projectData.name,
         ipId: loc.worldAssetCharId,
         numOutputs: 1,
         mediaType: 'image',
         renderMode: renderMode as any,
         gridFormat: gridFormat as any
      });

      if (result.success && result.images && result.images.length > 0) {
         const generatedImg = result.images[0].url;
         const mediaId = result.images[0].mediaId || generatedImg;

         const updated = [...canvasLocations];
         updated[idx] = { 
            ...updated[idx], 
            imageUrl: generatedImg,
            mediaId: mediaId
         };
         updateCanvasLocations(updated);

         // Root Image Sync
         console.log("[RootImageSync] Ensuring location is synced and root image is updated in World Asset DB...");
         const resolvedLocId = await ensureWorldAssetId('location', idx);
         if (resolvedLocId) {
            console.log(`[RootImageSync] Location ID resolved: ${resolvedLocId}. Fetching and updating root image...`);
            try {
               const baseUrl = getApiBaseUrl();
               const HUB_API_KEY = localStorage.getItem('STORYMEE_HUB_API_KEY') || import.meta.env.VITE_HUB_API_KEY || '';
               const headers: any = { 'Content-Type': 'application/json' };
               if (HUB_API_KEY) headers['Authorization'] = `Bearer ${HUB_API_KEY}`;
               
               const getRes = await fetch(`${baseUrl}/internal/v1/asset/world/characters/${resolvedLocId}`, {
                  method: 'GET',
                  headers
               });
               if (getRes.ok) {
                  const assetDetail = await getRes.json();
                  if (assetDetail) {
                     assetDetail.rootImageUrl = generatedImg;
                     
                     let sg = {};
                     if (assetDetail.styleGuide) {
                        sg = typeof assetDetail.styleGuide === 'string' ? JSON.parse(assetDetail.styleGuide) : assetDetail.styleGuide;
                     }
                     if (!sg) sg = {};
                     if (!(sg as any).gflowMediaIds) (sg as any).gflowMediaIds = {};
                     (sg as any).gflowMediaIds[projectData.id] = mediaId;
                     (sg as any).gflowMediaId = mediaId;
                     
                     assetDetail.styleGuide = typeof sg === 'string' ? sg : JSON.stringify(sg);
                     
                     const putRes = await fetch(`${baseUrl}/internal/v1/asset/world/characters/${resolvedLocId}`, {
                        method: 'PUT',
                        headers,
                        body: JSON.stringify(assetDetail)
                     });
                     if (putRes.ok) {
                        console.log("[RootImageSync] Location root image and styleGuide updated successfully in DB!");
                     } else {
                        console.warn("[RootImageSync] Failed to update location in DB, status:", putRes.status);
                     }
                  }
               } else {
                  console.warn("[RootImageSync] Failed to fetch location details, status:", getRes.status);
               }
               
               setTimeout(() => {
                  loadVariantsForChar(resolvedLocId, true);
               }, 200);
               
               window.dispatchEvent(new CustomEvent('WORLD_ASSETS_CHANGED'));
            } catch (err: any) {
               console.error("Lỗi khi cập nhật root image bối cảnh:", err);
            }
         }
      } else {
         alert("❌ Lỗi sinh ảnh: " + (result.error || "Không có kết quả"));
      }
    } catch (e: any) {
      alert("❌ Lỗi sinh ảnh: " + e.message);
    } finally {
      setGeneratingStates(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleAutoGenProp = async (idx: number) => {
    const prop = canvasProps[idx];
    const key = `prop-gen-${idx}`;
    setGeneratingStates(prev => ({ ...prev, [key]: true }));
    try {
      const globalStyle = projectData.stylePrompt || "Mặc định";
      const renderMode = prop.renderMode || 'character_only';
      const gridFormat = prop.gridFormat || '1x1';

      let layoutDesc = '';
      if (gridFormat === '2x1') layoutDesc = 'showing 2-angle views contact sheet horizontal grid layout';
      else if (gridFormat === '2x2') layoutDesc = 'showing 4-angle views contact sheet grid layout';
      else if (gridFormat === '2x3') layoutDesc = 'showing 6-angle views contact sheet grid layout';
      else layoutDesc = 'showing single isolated view';

      let renderStyleDesc = '';
      if (renderMode === 'character_only') renderStyleDesc = 'isolated object, clean solid white background, clean cutout, no characters, no hands';
      else if (renderMode === 'location_only') renderStyleDesc = 'environment only background';
      else renderStyleDesc = 'integrated in environment background';

      const prompt = `A clean, warm cinematic 3D animated prop design sheet ${layoutDesc} of ${prop.name}. ${prop.description || ''}. Visual Style: ${globalStyle}. ${renderStyleDesc}, masterpiece, highly detailed.`;
      
      const { generateMediaViaGateway } = await import('../../../utils/mediaGateway');
      const result = await generateMediaViaGateway({
         prompt,
         projectId: projectData.id,
         projectName: projectData.name,
         ipId: prop.worldAssetCharId,
         numOutputs: 1,
         mediaType: 'image',
         renderMode: renderMode as any,
         gridFormat: gridFormat as any
      });

      if (result.success && result.images && result.images.length > 0) {
         const generatedImg = result.images[0].url;
         const mediaId = result.images[0].mediaId || generatedImg;

         const updated = [...canvasProps];
         updated[idx] = { 
            ...updated[idx], 
            imageUrl: generatedImg,
            mediaId: mediaId
         };
         updateCanvasProps(updated);
      } else {
         alert("❌ Lỗi sinh ảnh: " + (result.error || "Không có kết quả"));
      }
    } catch (e: any) {
      alert("❌ Lỗi sinh ảnh: " + e.message);
    } finally {
      setGeneratingStates(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleGeneratePromptChar = async (idx: number) => {
    const char = canvasCharacters[idx];
    const key = `char-prompt-${idx}`;
    setGeneratingPrompts(prev => ({ ...prev, [key]: true }));
    try {
      const { generateCharacterPrompt } = await import('../../../utils/scriptParser');
      const globalStyle = projectData.stylePrompt || "Mặc định";
      const result = await generateCharacterPrompt(char.name, globalStyle, char.description || '');
      const updated = [...canvasCharacters];
      updated[idx] = { ...updated[idx], description: result?.description || result?.['mô tả'] || result?.['mieu ta'] || char.description || 'A dynamic character in the story.' };
      updateCanvasCharacters(updated);
    } catch (e) {
      console.error("Lỗi gen prompt nhân vật:", e);
    } finally {
      setGeneratingPrompts(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleGeneratePromptLoc = async (idx: number) => {
    const loc = canvasLocations[idx];
    const key = `loc-prompt-${idx}`;
    setGeneratingPrompts(prev => ({ ...prev, [key]: true }));
    try {
      const { generateLocationPrompt } = await import('../../../utils/scriptParser');
      const globalStyle = projectData.stylePrompt || "Mặc định";
      const result = await generateLocationPrompt(loc.name, globalStyle, loc.description || '');
      const updated = [...canvasLocations];
      updated[idx] = { ...updated[idx], description: result?.description || result?.['mô tả'] || result?.['mieu ta'] || loc.description || 'A scenic setting in the story.' };
      updateCanvasLocations(updated);
    } catch (e) {
      console.error("Lỗi gen prompt bối cảnh:", e);
    } finally {
      setGeneratingPrompts(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleGeneratePromptProp = async (idx: number) => {
    const prop = canvasProps[idx];
    const key = `prop-prompt-${idx}`;
    setGeneratingPrompts(prev => ({ ...prev, [key]: true }));
    try {
      const { generatePropPrompt } = await import('../../../utils/scriptParser');
      const globalStyle = projectData.stylePrompt || "Mặc định";
      const result = await generatePropPrompt(prop.name, globalStyle, prop.description || '');
      const updated = [...canvasProps];
      updated[idx] = { ...updated[idx], description: result?.description || result?.['mô tả'] || result?.['mieu ta'] || prop.description || 'A key prop in the story.' };
      updateCanvasProps(updated);
    } catch (e) {
      console.error("Lỗi gen prompt đạo cụ:", e);
    } finally {
      setGeneratingPrompts(prev => ({ ...prev, [key]: false }));
    }
  };

  const syncAssetToLibrary = async (type: AssetType, idx: number) => {
    const arr = type === 'character' ? canvasCharacters : type === 'location' ? canvasLocations : canvasProps;
    const item = arr[idx];
    
    if (!selectedProjectId) {
      alert("⚠️ Sếp chưa chọn dự án World Asset!");
      return;
    }

    if (item.imageUrl && !item.mediaId) {
      if (!projectData.id || projectData.id === 'new') {
        const confirmed = confirm("Labs Project (GFlow) chưa được khởi tạo. Để upload ảnh Ref và lấy Media ID, Sếp có muốn tạo Labs Project trước không?");
        if (confirmed) {
          const labsId = await handleCreateProject();
          if (!labsId) return;
        } else {
          return;
        }
      }
    }

    const key = `${type}-sync-${idx}`;
    setSyncingStates(prev => ({ ...prev, [key]: true }));

    try {
      const baseUrl = getApiBaseUrl();
      
      let mediaId = item.mediaId;
      if (item.imageUrl && !mediaId) {
        console.log(`[SyncSingle] Converting and uploading image for ${item.name} to GFlow...`);
        const b64 = await getBase64Image(item.imageUrl);
        const uploadedId = await uploadReferenceImage(b64);
        if (uploadedId) {
          mediaId = uploadedId;
          const updated = [...arr];
          updated[idx] = { ...updated[idx], mediaId };
          if (type === 'character') updateCanvasCharacters(updated);
          else if (type === 'location') updateCanvasLocations(updated);
          else if (type === 'prop') updateCanvasProps(updated);
        }
      }

      let worldAssetId = item.worldAssetCharId;
      let currentStyleGuide: any = {};

      if (worldAssetId) {
        const selectedAsset = worldAssetChars.find((c: any) => c.id === worldAssetId);
        if (selectedAsset?.styleGuide) {
          try {
            currentStyleGuide = typeof selectedAsset.styleGuide === 'string' 
              ? JSON.parse(selectedAsset.styleGuide) 
              : selectedAsset.styleGuide;
          } catch (e) {}
        }
      }

      if (!currentStyleGuide.gflowMediaIds) {
        currentStyleGuide.gflowMediaIds = {};
      }
      if (mediaId) {
        currentStyleGuide.gflowMediaIds[projectData.id] = mediaId;
        currentStyleGuide.gflowMediaId = mediaId;
      }

      currentStyleGuide.aliases = item.aliases || '';

      if (type === 'character') {
        currentStyleGuide.relationships = item.relationships || [];
      }

      if (type === 'location') {
        currentStyleGuide.spatialRelations = item.adjacentLocationIds?.map((id: string) => {
          const matched = worldAssetChars.find((c: any) => c.id === id);
          return {
            targetLocationId: id,
            targetLocationName: matched?.name || '',
            relationType: 'connected',
            sharedDnaDescription: item.sharedDna || ''
          };
        }) || [];
        currentStyleGuide.sharedDna = item.sharedDna || '';
      }

      const payload = {
        rootImageUrl: item.imageUrl || '',
        name: item.name,
        slug: item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        description: item.description || '',
        entityType: type,
        projectId: selectedProjectId,
        universeId: selectedProjectId,
        styleGuide: currentStyleGuide
      };

      const HUB_API_KEY = localStorage.getItem('STORYMEE_HUB_API_KEY') || import.meta.env.VITE_HUB_API_KEY || '';
      const headers: any = { 'Content-Type': 'application/json' };
      if (HUB_API_KEY) headers['Authorization'] = `Bearer ${HUB_API_KEY}`;

      let response;
      if (worldAssetId) {
        response = await fetch(`${baseUrl}/internal/v1/asset/world/characters/${worldAssetId}`, {
           method: 'PUT',
           headers,
           body: JSON.stringify(payload)
        });
      } else {
        response = await fetch(`${baseUrl}/internal/v1/asset/world/characters`, {
           method: 'POST',
           headers,
           body: JSON.stringify(payload)
        });
      }

      if (response.ok) {
         if (!worldAssetId) {
           const created = await response.json();
           if (created && created.id) {
             const updated = [...arr];
             updated[idx] = { 
               ...updated[idx], 
               worldAssetCharId: created.id,
               worldAssetCharName: item.name 
             };
             if (type === 'character') updateCanvasCharacters(updated);
             else if (type === 'location') updateCanvasLocations(updated);
             else if (type === 'prop') updateCanvasProps(updated);
           }
         }
         alert(`✅ Đồng bộ ${type === 'character' ? 'nhân vật' : type === 'location' ? 'bối cảnh' : 'đạo cụ'} "${item.name}" lên thư viện World Asset thành công!`);
         window.dispatchEvent(new CustomEvent('WORLD_ASSETS_CHANGED'));
      } else {
         alert("❌ Lỗi đồng bộ: " + response.statusText);
      }
    } catch (err: any) {
      console.error("Lỗi khi đồng bộ lên World Asset DB:", err);
      alert("❌ Lỗi đồng bộ: " + err.message);
    } finally {
      setSyncingStates(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleSyncAllAssets = async () => {
    if (!selectedProjectId) {
      alert("⚠️ Sếp chưa chọn dự án World Asset!");
      return;
    }
    
    if (!projectData.id || projectData.id === 'new') {
      const confirmed = confirm("Labs Project (GFlow) chưa được khởi tạo. Để upload ảnh Ref và lấy Media ID, Sếp có muốn tự động tạo Labs Project trước không?");
      if (confirmed) {
        const labsId = await handleCreateProject();
        if (!labsId) return;
      } else {
        return;
      }
    }

    setIsSyncingAll(true);
    const baseUrl = getApiBaseUrl();
    
    const allAssets: { type: AssetType; idx: number; name: string; imageUrl: string; description: string; mediaId?: string; worldAssetCharId?: string; aliases?: string; relationships?: any[]; adjacentLocationIds?: string[]; sharedDna?: string }[] = [];
    
    canvasCharacters.forEach((item: any, idx: number) => {
      allAssets.push({ 
        type: 'character', 
        idx, 
        name: item.name, 
        imageUrl: item.imageUrl || '', 
        description: item.description || '', 
        mediaId: item.mediaId, 
        worldAssetCharId: item.worldAssetCharId, 
        aliases: item.aliases,
        relationships: item.relationships
      });
    });
    
    canvasLocations.forEach((item: any, idx: number) => {
      allAssets.push({
        type: 'location',
        idx,
        name: item.name,
        imageUrl: item.imageUrl || '',
        description: item.description || '',
        mediaId: item.mediaId,
        worldAssetCharId: item.worldAssetCharId,
        adjacentLocationIds: item.adjacentLocationIds,
        sharedDna: item.sharedDna,
        aliases: item.aliases
      } as any);
    });
    
    canvasProps.forEach((item: any, idx: number) => {
      allAssets.push({ type: 'prop', idx, name: item.name, imageUrl: item.imageUrl || '', description: item.description || '', mediaId: item.mediaId, worldAssetCharId: item.worldAssetCharId, aliases: item.aliases });
    });

    if (allAssets.length === 0) {
      alert("⚠️ Không tìm thấy nhân vật, bối cảnh hay đạo cụ nào trên canvas để đồng bộ!");
      setIsSyncingAll(false);
      return;
    }

    let successCount = 0;
    const updatedChars = [...canvasCharacters];
    const updatedLocs = [...canvasLocations];
    const updatedProps = [...canvasProps];

    try {
      for (let i = 0; i < allAssets.length; i++) {
        const asset = allAssets[i];
        console.log(`[SyncAll] Processing ${i + 1}/${allAssets.length}: ${asset.name} (${asset.type})`);
        
        let mediaId = asset.mediaId;
        
        if (asset.imageUrl && !mediaId) {
          try {
            console.log(`[SyncAll] Uploading image for ${asset.name} to GFlow...`);
            const b64 = await getBase64Image(asset.imageUrl);
            const uploadedId = await uploadReferenceImage(b64);
            if (uploadedId) {
              mediaId = uploadedId;
              if (asset.type === 'character') updatedChars[asset.idx].mediaId = mediaId;
              else if (asset.type === 'location') updatedLocs[asset.idx].mediaId = mediaId;
              else if (asset.type === 'prop') updatedProps[asset.idx].mediaId = mediaId;
            }
          } catch (uploadErr) {
            console.warn(`[SyncAll] Failed to upload image for ${asset.name}:`, uploadErr);
          }
        }
        
        let worldAssetId = asset.worldAssetCharId;
        let currentStyleGuide: any = {};
        if (worldAssetId) {
          const selectedAsset = worldAssetChars.find((c: any) => c.id === worldAssetId);
          if (selectedAsset?.styleGuide) {
            try {
              currentStyleGuide = typeof selectedAsset.styleGuide === 'string' 
                ? JSON.parse(selectedAsset.styleGuide) 
                : selectedAsset.styleGuide;
            } catch (e) {}
          }
        }
        
        if (!currentStyleGuide.gflowMediaIds) {
          currentStyleGuide.gflowMediaIds = {};
        }
        if (mediaId) {
          currentStyleGuide.gflowMediaIds[projectData.id] = mediaId;
          currentStyleGuide.gflowMediaId = mediaId;
        }

        currentStyleGuide.aliases = asset.aliases || '';

        if (asset.type === 'character') {
          currentStyleGuide.relationships = (asset as any).relationships || [];
        }

        if (asset.type === 'location') {
          currentStyleGuide.spatialRelations = (asset as any).adjacentLocationIds?.map((id: string) => {
            const matched = worldAssetChars.find((c: any) => c.id === id);
            return {
              targetLocationId: id,
              targetLocationName: matched?.name || '',
              relationType: 'connected',
              sharedDnaDescription: (asset as any).sharedDna || ''
            };
          }) || [];
          currentStyleGuide.sharedDna = (asset as any).sharedDna || '';
        }

        const payload = {
          name: asset.name,
          slug: asset.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          description: asset.description,
          rootImageUrl: asset.imageUrl,
          entityType: asset.type,
          projectId: selectedProjectId,
          universeId: selectedProjectId,
          styleGuide: currentStyleGuide
        };

        const HUB_API_KEY = localStorage.getItem('STORYMEE_HUB_API_KEY') || import.meta.env.VITE_HUB_API_KEY || '';
        const headers: any = { 'Content-Type': 'application/json' };
        if (HUB_API_KEY) headers['Authorization'] = `Bearer ${HUB_API_KEY}`;

        if (worldAssetId) {
          const res = await fetch(`${baseUrl}/internal/v1/asset/world/characters/${worldAssetId}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(payload)
          });
          if (res.ok) successCount++;
        } else {
          const res = await fetch(`${baseUrl}/internal/v1/asset/world/characters`, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
          });
          if (res.ok) {
            const created = await res.json();
            if (created && created.id) {
              worldAssetId = created.id;
              if (asset.type === 'character') {
                updatedChars[asset.idx].worldAssetCharId = worldAssetId;
                updatedChars[asset.idx].worldAssetCharName = asset.name;
              } else if (asset.type === 'location') {
                updatedLocs[asset.idx].worldAssetCharId = worldAssetId;
                updatedLocs[asset.idx].worldAssetCharName = asset.name;
              } else if (asset.type === 'prop') {
                updatedProps[asset.idx].worldAssetCharId = worldAssetId;
                updatedProps[asset.idx].worldAssetCharName = asset.name;
              }
              successCount++;
            }
          }
        }
      }

      updateCanvasCharacters(updatedChars);
      updateCanvasLocations(updatedLocs);
      updateCanvasProps(updatedProps);

      window.dispatchEvent(new CustomEvent('WORLD_ASSETS_CHANGED'));
      alert(`✅ Đồng bộ thành công ${successCount}/${allAssets.length} tài sản về thư viện World Asset DB!\nĐồng thời tự động upload ảnh Ref và truyền Media ID về Google Labs.`);
    } catch (err: any) {
      console.error("[SyncAll] Critical error:", err);
      alert("❌ Lỗi đồng bộ hàng loạt: " + err.message);
    } finally {
      setIsSyncingAll(false);
    }
  };

  const handleLinkChar = async (idx: number, val: string) => {
    const updated = [...canvasCharacters];
    if (val === "") {
      updated[idx] = { 
        ...updated[idx], 
        worldAssetCharId: undefined,
        worldAssetCharName: undefined
      };
    } else {
      const selectedChar = worldAssetChars.find((c: any) => c.id === val);
      if (selectedChar) {
        let mediaIdFromDb = '';
        let aliasesFromDb = '';
        let relationshipsFromDb: any[] = [];
        try {
          const sg = typeof selectedChar.styleGuide === 'string' 
            ? JSON.parse(selectedChar.styleGuide) 
            : selectedChar.styleGuide;
          if (sg?.gflowMediaIds?.[projectData.id]) {
            mediaIdFromDb = sg.gflowMediaIds[projectData.id];
          } else if (sg?.gflowMediaId) {
            mediaIdFromDb = sg.gflowMediaId;
          }
          if (sg?.aliases) {
            aliasesFromDb = sg.aliases;
          }
          if (sg?.relationships) {
            relationshipsFromDb = sg.relationships;
          }
        } catch (e) {}

        updated[idx] = { 
          ...updated[idx], 
          name: selectedChar.name,
          description: selectedChar.description || updated[idx].description || "",
          imageUrl: selectedChar.rootImageUrl || updated[idx].imageUrl || "",
          worldAssetCharId: selectedChar.id,
          worldAssetCharName: selectedChar.name,
          mediaId: mediaIdFromDb || undefined,
          aliases: aliasesFromDb || updated[idx].aliases || '',
          relationships: relationshipsFromDb
        };
      }
    }
    updateCanvasCharacters(updated);
  };

  const handleLinkLoc = async (idx: number, val: string) => {
    const updated = [...canvasLocations];
    if (val === "") {
      updated[idx] = { 
        ...updated[idx], 
        worldAssetCharId: undefined,
        worldAssetCharName: undefined
      };
    } else {
      const selectedLoc = worldAssetChars.find((c: any) => c.id === val);
      if (selectedLoc) {
        let mediaIdFromDb = '';
        let aliasesFromDb = '';
        let adjacentLocationIdsFromDb: string[] = [];
        let sharedDnaFromDb = '';
        try {
          const sg = typeof selectedLoc.styleGuide === 'string' 
            ? JSON.parse(selectedLoc.styleGuide) 
            : selectedLoc.styleGuide;
          if (sg?.gflowMediaIds?.[projectData.id]) {
            mediaIdFromDb = sg.gflowMediaIds[projectData.id];
          } else if (sg?.gflowMediaId) {
            mediaIdFromDb = sg.gflowMediaId;
          }
          if (sg?.aliases) {
            aliasesFromDb = sg.aliases;
          }
          if (sg?.spatialRelations) {
            adjacentLocationIdsFromDb = sg.spatialRelations.map((r: any) => r.targetLocationId);
          }
          if (sg?.sharedDna) {
            sharedDnaFromDb = sg.sharedDna;
          }
        } catch (e) {}

        updated[idx] = { 
          ...updated[idx], 
          name: selectedLoc.name,
          description: selectedLoc.description || updated[idx].description || "",
          imageUrl: selectedLoc.rootImageUrl || updated[idx].imageUrl || "",
          worldAssetCharId: selectedLoc.id,
          worldAssetCharName: selectedLoc.name,
          mediaId: mediaIdFromDb || undefined,
          aliases: aliasesFromDb || updated[idx].aliases || '',
          adjacentLocationIds: adjacentLocationIdsFromDb,
          sharedDna: sharedDnaFromDb
        };
      }
    }
    updateCanvasLocations(updated);
  };

  const handleLinkProp = async (idx: number, val: string) => {
    const updated = [...canvasProps];
    if (val === "") {
      updated[idx] = { 
        ...updated[idx], 
        worldAssetCharId: undefined,
        worldAssetCharName: undefined
      };
    } else {
      const selectedProp = worldAssetChars.find((c: any) => c.id === val);
      if (selectedProp) {
        let mediaIdFromDb = '';
        let aliasesFromDb = '';
        try {
          const sg = typeof selectedProp.styleGuide === 'string' 
            ? JSON.parse(selectedProp.styleGuide) 
            : selectedProp.styleGuide;
          if (sg?.gflowMediaIds?.[projectData.id]) {
            mediaIdFromDb = sg.gflowMediaIds[projectData.id];
          } else if (sg?.gflowMediaId) {
            mediaIdFromDb = sg.gflowMediaId;
          }
          if (sg?.aliases) {
            aliasesFromDb = sg.aliases;
          }
        } catch (e) {}

        updated[idx] = { 
          ...updated[idx], 
          name: selectedProp.name,
          description: selectedProp.description || updated[idx].description || "",
          imageUrl: selectedProp.rootImageUrl || updated[idx].imageUrl || "",
          worldAssetCharId: selectedProp.id,
          worldAssetCharName: selectedProp.name,
          mediaId: mediaIdFromDb || undefined,
          aliases: aliasesFromDb || updated[idx].aliases || ''
        };
      }
    }
    updateCanvasProps(updated);
  };

  const handleUploadFileChar = async (e: React.ChangeEvent<HTMLInputElement>, charIndex: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      // 1. Upload qua API World Asset để lấy URL lưu trữ CDN thật
      const uploadRes = await uploadFileToDB(file, file.name);
      const cdnUrl = uploadRes.url;
      
      // 2. Upload reference lên Extension nếu có
      let gflowMediaId: string | null = null;
      try {
        const base64 = await getBase64Image(cdnUrl);
        gflowMediaId = await uploadReferenceImage(base64);
      } catch (e) {
        console.warn("Upload to extension skipped:", e);
      }

      // 3. Cập nhật state Canvas
      const updated = [...canvasCharacters];
      updated[charIndex] = {
        ...updated[charIndex],
        imageUrl: cdnUrl,
        mediaId: gflowMediaId || undefined
      };
      updateCanvasCharacters(updated);

      // 4. Đồng bộ rootImageUrl vào DB nếu đã có WorldAssetId
      const resolvedCharId = await ensureWorldAssetId('character', charIndex);
      if (resolvedCharId) {
        const baseUrl = getApiBaseUrl();
        const HUB_API_KEY = localStorage.getItem('STORYMEE_HUB_API_KEY') || import.meta.env.VITE_HUB_API_KEY || '';
        const headers: any = { 'Content-Type': 'application/json' };
        if (HUB_API_KEY) headers['Authorization'] = `Bearer ${HUB_API_KEY}`;

        const getRes = await fetch(`${baseUrl}/internal/v1/asset/world/characters/${resolvedCharId}`, { headers });
        if (getRes.ok) {
          const detail = await getRes.json();
          if (detail) {
            detail.rootImageUrl = cdnUrl;
            await fetch(`${baseUrl}/internal/v1/asset/world/characters/${resolvedCharId}`, {
              method: 'PUT',
              headers,
              body: JSON.stringify(detail)
            });
          }
        }
      }
      window.dispatchEvent(new CustomEvent('WORLD_ASSETS_CHANGED'));
    } catch (err: any) {
      alert("❌ Lỗi tải ảnh nhân vật lên World Asset: " + err.message);
    }
  };

  const handleUploadFileLoc = async (e: React.ChangeEvent<HTMLInputElement>, locIndex: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      // 1. Upload qua API World Asset để lấy URL lưu trữ CDN thật
      const uploadRes = await uploadFileToDB(file, file.name);
      const cdnUrl = uploadRes.url;
      
      // 2. Upload reference lên Extension nếu có
      let gflowMediaId: string | null = null;
      try {
        const base64 = await getBase64Image(cdnUrl);
        gflowMediaId = await uploadReferenceImage(base64);
      } catch (e) {
        console.warn("Upload to extension skipped:", e);
      }

      // 3. Cập nhật state Canvas
      const updated = [...canvasLocations];
      updated[locIndex] = {
        ...updated[locIndex],
        imageUrl: cdnUrl,
        mediaId: gflowMediaId || undefined
      };
      updateCanvasLocations(updated);

      // 4. Đồng bộ rootImageUrl vào DB nếu đã có WorldAssetId
      const resolvedLocId = await ensureWorldAssetId('location', locIndex);
      if (resolvedLocId) {
        const baseUrl = getApiBaseUrl();
        const HUB_API_KEY = localStorage.getItem('STORYMEE_HUB_API_KEY') || import.meta.env.VITE_HUB_API_KEY || '';
        const headers: any = { 'Content-Type': 'application/json' };
        if (HUB_API_KEY) headers['Authorization'] = `Bearer ${HUB_API_KEY}`;

        const getRes = await fetch(`${baseUrl}/internal/v1/asset/world/characters/${resolvedLocId}`, { headers });
        if (getRes.ok) {
          const detail = await getRes.json();
          if (detail) {
            detail.rootImageUrl = cdnUrl;
            await fetch(`${baseUrl}/internal/v1/asset/world/characters/${resolvedLocId}`, {
              method: 'PUT',
              headers,
              body: JSON.stringify(detail)
            });
          }
        }
      }
      window.dispatchEvent(new CustomEvent('WORLD_ASSETS_CHANGED'));
    } catch (err: any) {
      alert("❌ Lỗi tải ảnh bối cảnh lên World Asset: " + err.message);
    }
  };

  const handleUploadFileProp = async (e: React.ChangeEvent<HTMLInputElement>, propIndex: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      // 1. Upload qua API World Asset để lấy URL lưu trữ CDN thật
      const uploadRes = await uploadFileToDB(file, file.name);
      const cdnUrl = uploadRes.url;
      
      // 2. Upload reference lên Extension nếu có
      let gflowMediaId: string | null = null;
      try {
        const base64 = await getBase64Image(cdnUrl);
        gflowMediaId = await uploadReferenceImage(base64);
      } catch (e) {
        console.warn("Upload to extension skipped:", e);
      }

      // 3. Cập nhật state Canvas
      const updated = [...canvasProps];
      updated[propIndex] = {
        ...updated[propIndex],
        imageUrl: cdnUrl,
        mediaId: gflowMediaId || undefined
      };
      updateCanvasProps(updated);

      // 4. Đồng bộ rootImageUrl vào DB nếu đã có WorldAssetId
      const resolvedPropId = await ensureWorldAssetId('prop', propIndex);
      if (resolvedPropId) {
        const baseUrl = getApiBaseUrl();
        const HUB_API_KEY = localStorage.getItem('STORYMEE_HUB_API_KEY') || import.meta.env.VITE_HUB_API_KEY || '';
        const headers: any = { 'Content-Type': 'application/json' };
        if (HUB_API_KEY) headers['Authorization'] = `Bearer ${HUB_API_KEY}`;

        const getRes = await fetch(`${baseUrl}/internal/v1/asset/world/characters/${resolvedPropId}`, { headers });
        if (getRes.ok) {
          const detail = await getRes.json();
          if (detail) {
            detail.rootImageUrl = cdnUrl;
            await fetch(`${baseUrl}/internal/v1/asset/world/characters/${resolvedPropId}`, {
              method: 'PUT',
              headers,
              body: JSON.stringify(detail)
            });
          }
        }
      }
      window.dispatchEvent(new CustomEvent('WORLD_ASSETS_CHANGED'));
    } catch (err: any) {
      alert("❌ Lỗi tải ảnh đạo cụ lên World Asset: " + err.message);
    }
  };

  const loadVariantsForChar = async (charId: string, force = false) => {
    if (!charId || (!force && charVariants[charId])) return;
    try {
      const baseUrl = getApiBaseUrl();
      const HUB_API_KEY = localStorage.getItem('STORYMEE_HUB_API_KEY') || import.meta.env.VITE_HUB_API_KEY || '';
      const headers: any = {};
      if (HUB_API_KEY) headers['Authorization'] = `Bearer ${HUB_API_KEY}`;

      const res = await fetch(`${baseUrl}/internal/v1/asset/world/characters/${charId}/assets`, { headers });
      if (res.ok) {
        const list = await res.json();
        setCharVariants(prev => ({ ...prev, [charId]: list || [] }));
      }
    } catch (e) {
      console.warn("Failed to load variants:", e);
    }
  };

  const loadProjectAssets = async () => {
    if (!projectData.id || projectData.id === 'new') {
      setProjectAssets([]);
      return;
    }
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(projectData.id)) {
      setProjectAssets([]);
      return;
    }
    try {
      const baseUrl = getApiBaseUrl();
      const HUB_API_KEY = localStorage.getItem('STORYMEE_HUB_API_KEY') || import.meta.env.VITE_HUB_API_KEY || '';
      const res = await fetch(`${baseUrl}/internal/v1/asset/world/episodes/${projectData.id}/storyboard-assets`, {
        headers: {
          'Authorization': `Bearer ${HUB_API_KEY}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        const albumAssets = (data.assets || []).filter((a: any) => a.assetType === 'storyboard' || a.assetType === 'video');
        setProjectAssets(albumAssets);
      }
    } catch (e) {
      console.warn("Failed to load project assets for album:", e);
    }
  };

  useEffect(() => {
    loadProjectAssets();
    window.addEventListener('WORLD_ASSETS_CHANGED', loadProjectAssets);
    return () => {
      window.removeEventListener('WORLD_ASSETS_CHANGED', loadProjectAssets);
    };
  }, [projectData.id]);

  useEffect(() => {
    const allLinkedIds = [
      ...canvasCharacters.map((c: AssetItem) => c.worldAssetCharId),
      ...canvasLocations.map((l: AssetItem) => l.worldAssetCharId),
      ...canvasProps.map((p: AssetItem) => p.worldAssetCharId)
    ].filter(Boolean) as string[];

    allLinkedIds.forEach((charId: string) => {
      loadVariantsForChar(charId);
    });
  }, [canvasCharacters, canvasLocations, canvasProps]);

  return {
    projects,
    selectedProjectId,
    setSelectedProjectId,
    isLoadingProjects,
    isCreatingWorldAssetProject,
    newProjectName,
    setNewProjectName,
    handleCreateWorldAssetProject,
    episodes,
    isLoadingEpisodes,
    isSyncingEpisode,
    handleSyncEpisodeToDB,
    worldAssetChars,
    charVariants,
    syncingStates,
    isSyncingAll,
    generatingStates,
    generatingPrompts,
    isGeneratingStyle,
    setIsGeneratingStyle,
    getBase64Image,
    cropImageTo4Quadrants,
    ensureWorldAssetId,
    handleAutoGenChar,
    handleAutoGenLoc,
    handleAutoGenProp,
    handleGeneratePromptChar,
    handleGeneratePromptLoc,
    handleGeneratePromptProp,
    syncAssetToLibrary,
    handleSyncAllAssets,
    handleLinkChar,
    handleLinkLoc,
    handleLinkProp,
    handleUploadFileChar,
    handleUploadFileLoc,
    handleUploadFileProp,
    loadVariantsForChar,
    isCreatingProject,
    handleCreateProject,
    uploadReferenceImage,
    sliceModalOpen,
    setSliceModalOpen,
    activeSliceAsset,
    setActiveSliceAsset,
    slicingStates,
    setSlicingStates,
    handleOpenSliceModal,
    handleSaveSlice,
    handleSelectVariantAsRoot,
    projectAssets,
    loadProjectAssets,
    isSyncingLetta,
    handleSyncLetta
  };
}
