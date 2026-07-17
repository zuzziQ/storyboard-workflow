import { Handle, Position, useReactFlow, useNodes } from 'reactflow';
import { createPortal } from 'react-dom';
import { Database, User, MapPin, PlusCircle, ArrowRight, Loader2, Sparkles, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useFlowStore } from '../../store/useFlowStore';
import { useWorldAssetOps } from './hooks/useWorldAssetOps';

import { SliceModal } from './components/SliceModal';
import { ProjectSettingsPanel } from './components/ProjectSettingsPanel';
import { AssetCard } from './components/AssetCard';
import { DetailEditModal } from './components/DetailEditModal';
import type { AssetItem, AssetType } from './types';

function safeMatchName(text: string, name: string, aliases?: string | string[]): boolean {
  const cleanText = text.toLowerCase();
  const cleanName = name.toLowerCase().trim();
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

export default function WorldAssetNode({ id, data }: any) {
  const [activeTab, setActiveTab] = useState<'project' | 'style' | 'characters' | 'locations' | 'props' | 'album'>('characters');
  const [selectedZoomImage, setSelectedZoomImage] = useState<string | null>(null);
  const [assetActiveTab, setAssetActiveTab] = useState<'character' | 'location' | 'prop'>('character');
  const [editingAsset, setEditingAsset] = useState<{ type: AssetType; index: number } | null>(null);

  const { getNodes } = useReactFlow();
  const setNodes = useFlowStore.getState().setNodes;
  const projectData = useFlowStore((state: any) => state.projectData);
  const setProjectData = useFlowStore((state: any) => state.setProjectData);
  const parsedData = useFlowStore((state: any) => state.parsedData);
  const setHoveredAssetId = useFlowStore((state: any) => state.setHoveredAssetId);
  const hoveredAssetId = useFlowStore((state: any) => state.hoveredAssetId);

  const nodes = useNodes();
  const worldAssetNode = nodes.find(n => n.id === id);

  const canvasCharacters: AssetItem[] = (worldAssetNode?.data as any)?.characters || [];
  const canvasLocations: AssetItem[] = (worldAssetNode?.data as any)?.locations || [];
  const canvasProps: AssetItem[] = (worldAssetNode?.data as any)?.props || [];

  const updateCanvasCharacters = (updatedChars: AssetItem[]) => {
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, characters: updatedChars } } : n));
  };
  
  const updateCanvasLocations = (updatedLocs: AssetItem[]) => {
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, locations: updatedLocs } } : n));
  };

  const updateCanvasProps = (updatedProps: AssetItem[]) => {
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, props: updatedProps } } : n));
  };

  const { handleImportEpisode } = useFlowStore.getState() as any; // fallback from store direct

  // 3. Central command operations hook
  const ops = useWorldAssetOps({
    canvasCharacters,
    canvasLocations,
    canvasProps,
    updateCanvasCharacters,
    updateCanvasLocations,
    updateCanvasProps,
    getNodes
  });

  const {
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
    isCreatingProject,
    handleCreateProject,
    sliceModalOpen,
    setSliceModalOpen,
    activeSliceAsset,
    slicingStates,
    handleOpenSliceModal,
    handleSaveSlice,
    handleSelectVariantAsRoot,
    projectAssets,
    isSyncingLetta,
    handleSyncLetta
  } = ops;

  const handleAddNewChar = () => {
    const newChar = {
      name: `Nhân vật ${canvasCharacters.length + 1}`,
      description: 'Auto-detected character description',
      imageUrl: '',
      mediaId: undefined
    };
    updateCanvasCharacters([...canvasCharacters, newChar]);
  };

  const handleRemoveChar = (indexToRemove: number) => {
    if (confirm("Sếp có chắc chắn muốn xóa nhân vật này khỏi canvas không?")) {
      const updated = canvasCharacters.filter((_, idx) => idx !== indexToRemove);
      updateCanvasCharacters(updated);
    }
  };

  const handleAddNewLoc = () => {
    const newLoc = {
      name: `Bối cảnh ${canvasLocations.length + 1}`,
      description: 'Auto-detected location description',
      imageUrl: '',
      mediaId: undefined
    };
    updateCanvasLocations([...canvasLocations, newLoc]);
  };

  const handleRemoveLoc = (indexToRemove: number) => {
    if (confirm("Sếp có chắc chắn muốn xóa bối cảnh này khỏi canvas không?")) {
      const updated = canvasLocations.filter((_, idx) => idx !== indexToRemove);
      updateCanvasLocations(updated);
    }
  };

  const handleAddNewProp = () => {
    const newProp = {
      name: `Đạo cụ ${canvasProps.length + 1}`,
      description: 'Prop description sheet',
      imageUrl: '',
      mediaId: undefined
    };
    updateCanvasProps([...canvasProps, newProp]);
  };

  const handleRemoveProp = (indexToRemove: number) => {
    if (confirm("Sếp có chắc chắn muốn xóa đạo cụ này khỏi canvas không?")) {
      const updated = canvasProps.filter((_, idx) => idx !== indexToRemove);
      updateCanvasProps(updated);
    }
  };

  const handleAutoPromptStyle = async () => {
    try {
      setIsGeneratingStyle(true);
      const { generateStylePrompt } = await import('../../utils/scriptParser');
      const result = await generateStylePrompt(projectData.stylePrompt || '');
      setProjectData({ ...projectData, stylePrompt: result.stylePrompt });
    } catch (e) {
      console.warn("Lỗi auto style", e);
    } finally {
      setIsGeneratingStyle(false);
    }
  };

  // Auto hydrate characters, locations & props from DB to canvas node data on Project change
  useEffect(() => {
    if (worldAssetChars.length === 0) return;

    const dbChars = worldAssetChars.filter((c: any) => c.entityType === 'character' || !c.entityType);
    const dbLocs = worldAssetChars.filter((c: any) => c.entityType === 'location');
    const dbProps = worldAssetChars.filter((c: any) => c.entityType === 'prop');

    const currentChars = data.characters || [];
    const currentLocs = data.locations || [];
    const currentProps = data.props || [];

    // Extract asset names from analyzed script
    const scriptCharNames = (parsedData?.characters || []).map((c: any) => (c.name || '').toLowerCase().trim());
    const scriptLocNames = (parsedData?.locations || []).map((l: any) => (l.name || '').toLowerCase().trim());
    const scriptPropNames = (parsedData?.props || []).map((p: any) => (p.name || '').toLowerCase().trim());

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

    // Enrich characters
    const enrichedChars = currentChars.map((char: any) => {
      const dbMatch = dbChars.find((c: any) => {
        let dbAliases = '';
        try {
          const sg = typeof c.styleGuide === 'string' ? JSON.parse(c.styleGuide) : c.styleGuide;
          dbAliases = sg?.aliases || '';
        } catch(e){}
        return c.name.toLowerCase().trim() === char.name.toLowerCase().trim() || 
               safeMatchName(char.name, c.name, dbAliases) || 
               safeMatchName(c.name, char.name, char.aliases);
      });
      if (dbMatch) {
        let dbAliases = '';
        try {
          const sg = typeof dbMatch.styleGuide === 'string' ? JSON.parse(dbMatch.styleGuide) : dbMatch.styleGuide;
          dbAliases = sg?.aliases || '';
        } catch(e){}
        return {
          ...char,
          worldAssetCharId: dbMatch.id,
          worldAssetCharName: dbMatch.name,
          imageUrl: dbMatch.rootImageUrl || char.imageUrl || '',
          description: dbMatch.description || char.description || '',
          mediaId: getMediaId(dbMatch) || char.mediaId,
          renderMode: char.renderMode || 'character_only',
          gridFormat: char.gridFormat || '2x2',
          aliases: dbAliases || char.aliases || ''
        };
      }
      return char;
    });

    // Enrich locations
    const enrichedLocs = currentLocs.map((loc: any) => {
      const dbMatch = dbLocs.find((c: any) => {
        let dbAliases = '';
        try {
          const sg = typeof c.styleGuide === 'string' ? JSON.parse(c.styleGuide) : c.styleGuide;
          dbAliases = sg?.aliases || '';
        } catch(e){}
        return c.name.toLowerCase().trim() === loc.name.toLowerCase().trim() || 
               safeMatchName(loc.name, c.name, dbAliases) || 
               safeMatchName(c.name, loc.name, loc.aliases);
      });
      if (dbMatch) {
        let adjacentIds: string[] = [];
        let sharedDnaStr = '';
        let dbAliases = '';
        try {
          const sg = typeof dbMatch.styleGuide === 'string' ? JSON.parse(dbMatch.styleGuide) : dbMatch.styleGuide;
          if (sg?.spatialRelations) {
            adjacentIds = sg.spatialRelations.map((r: any) => r.targetLocationId);
          }
          if (sg?.sharedDna) {
            sharedDnaStr = sg.sharedDna;
          }
          dbAliases = sg?.aliases || '';
        } catch (e) {}

        return {
          ...loc,
          worldAssetCharId: dbMatch.id,
          worldAssetCharName: dbMatch.name,
          imageUrl: dbMatch.rootImageUrl || loc.imageUrl || '',
          description: dbMatch.description || loc.description || '',
          mediaId: getMediaId(dbMatch) || loc.mediaId,
          adjacentLocationIds: adjacentIds.length > 0 ? adjacentIds : loc.adjacentLocationIds || [],
          sharedDna: sharedDnaStr || loc.sharedDna || '',
          renderMode: loc.renderMode || 'location_only',
          gridFormat: loc.gridFormat || '2x2',
          aliases: dbAliases || loc.aliases || ''
        };
      }
      return loc;
    });

    // Enrich props
    const enrichedProps = currentProps.map((prop: any) => {
      const dbMatch = dbProps.find((c: any) => {
        let dbAliases = '';
        try {
          const sg = typeof c.styleGuide === 'string' ? JSON.parse(c.styleGuide) : c.styleGuide;
          dbAliases = sg?.aliases || '';
        } catch(e){}
        return c.name.toLowerCase().trim() === prop.name.toLowerCase().trim() || 
               safeMatchName(prop.name, c.name, dbAliases) || 
               safeMatchName(c.name, prop.name, prop.aliases);
      });
      if (dbMatch) {
        let dbAliases = '';
        try {
          const sg = typeof dbMatch.styleGuide === 'string' ? JSON.parse(dbMatch.styleGuide) : dbMatch.styleGuide;
          dbAliases = sg?.aliases || '';
        } catch(e){}
        return {
          ...prop,
          worldAssetCharId: dbMatch.id,
          worldAssetCharName: dbMatch.name,
          imageUrl: dbMatch.rootImageUrl || prop.imageUrl || '',
          description: dbMatch.description || prop.description || '',
          mediaId: getMediaId(dbMatch) || prop.mediaId,
          renderMode: prop.renderMode || 'character_only',
          gridFormat: prop.gridFormat || '1x1',
          aliases: dbAliases || prop.aliases || ''
        };
      }
      return prop;
    });

    // Append items from DB not on canvas ONLY if they are mentioned in the screenplay analysis
    dbChars.forEach((db: any) => {
      const dbNameClean = db.name.toLowerCase().trim();
      if (scriptCharNames.includes(dbNameClean)) {
        const exists = enrichedChars.some((c: any) => c.name.toLowerCase().trim() === dbNameClean);
        if (!exists) {
          enrichedChars.push({
            name: db.name,
            description: db.description || '',
            imageUrl: db.rootImageUrl || '',
            worldAssetCharId: db.id,
            worldAssetCharName: db.name,
            mediaId: getMediaId(db),
            renderMode: 'character_only',
            gridFormat: '2x2'
          });
        }
      }
    });

    dbLocs.forEach((db: any) => {
      const dbNameClean = db.name.toLowerCase().trim();
      if (scriptLocNames.includes(dbNameClean)) {
        const exists = enrichedLocs.some((l: any) => l.name.toLowerCase().trim() === dbNameClean);
        if (!exists) {
          let adjacentIds: string[] = [];
          let sharedDnaStr = '';
          try {
            const sg = typeof db.styleGuide === 'string' ? JSON.parse(db.styleGuide) : db.styleGuide;
            if (sg?.spatialRelations) {
              adjacentIds = sg.spatialRelations.map((r: any) => r.targetLocationId);
            }
            if (sg?.sharedDna) {
              sharedDnaStr = sg.sharedDna;
            }
          } catch (e) {}

          enrichedLocs.push({
            name: db.name,
            description: db.description || '',
            imageUrl: db.rootImageUrl || '',
            worldAssetCharId: db.id,
            worldAssetCharName: db.name,
            mediaId: getMediaId(db),
            adjacentLocationIds: adjacentIds,
            sharedDna: sharedDnaStr,
            renderMode: 'location_only',
            gridFormat: '2x2'
          });
        }
      }
    });

    dbProps.forEach((db: any) => {
      const dbNameClean = db.name.toLowerCase().trim();
      if (scriptPropNames.includes(dbNameClean)) {
        const exists = enrichedProps.some((p: any) => p.name.toLowerCase().trim() === dbNameClean);
        if (!exists) {
          enrichedProps.push({
            name: db.name,
            description: db.description || '',
            imageUrl: db.rootImageUrl || '',
            worldAssetCharId: db.id,
            worldAssetCharName: db.name,
            mediaId: getMediaId(db),
            renderMode: 'character_only',
            gridFormat: '1x1'
          });
        }
      }
    });

    const isCharsDifferent = JSON.stringify(data.characters || []) !== JSON.stringify(enrichedChars);
    const isLocsDifferent = JSON.stringify(data.locations || []) !== JSON.stringify(enrichedLocs);
    const isPropsDifferent = JSON.stringify(data.props || []) !== JSON.stringify(enrichedProps);

    if (isCharsDifferent || isLocsDifferent || isPropsDifferent) {
      setNodes(nds => nds.map(n => n.id === id ? { 
        ...n, 
        data: { 
          ...n.data, 
          characters: enrichedChars,
          locations: enrichedLocs,
          props: enrichedProps
        } 
      } : n));
    }
  }, [worldAssetChars, projectData.id, parsedData]);

  const isHovered = hoveredAssetId === id;

  return (
    <div 
      className={`bg-[#121216] rounded-2xl border-2 border-indigo-500/80 shadow-[0_0_25px_rgba(99,102,241,0.35)] w-fit min-w-[820px] max-w-none overflow-hidden transition-all ${isHovered ? 'ring-4 ring-indigo-500/50 scale-[1.005]' : ''}`}
      onMouseEnter={() => setHoveredAssetId(id)}
      onMouseLeave={() => setHoveredAssetId(null)}
    >
      {/* Target handle top */}
      <Handle type="target" position={Position.Top} id="in" className="w-3.5 h-3.5 bg-indigo-500 border-2 border-[#121216]" />

      {/* Header */}
      <div className="bg-[#2a2a32] p-3 flex items-center justify-between border-b border-slate-700/50 react-flow__node-draghandle cursor-move">
        <div className="flex items-center gap-2">
          <Database size={16} className="text-indigo-400" />
          <span className="text-xs font-black text-white uppercase tracking-wider">World Asset Master Center</span>
        </div>
        <div className="flex items-center gap-2">
          {isLoadingProjects && <Loader2 size={12} className="animate-spin text-slate-400" />}
          

          <button
            onClick={handleSyncAllAssets}
            disabled={isSyncingAll}
            className="flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-amber-600 via-pink-600 to-indigo-600 hover:from-amber-500 hover:to-indigo-500 text-white rounded-lg text-[9px] font-black uppercase transition-all shadow-[0_0_10px_rgba(219,39,119,0.25)] shrink-0 active:scale-95 duration-200 border border-pink-500/10 cursor-pointer"
            title="Đồng bộ toàn bộ Style, Char, Location, Prop về World Asset DB"
          >
            {isSyncingAll ? (
              <><Loader2 size={10} className="animate-spin" /> Syncing...</>
            ) : (
              <><Sparkles size={10} fill="currentColor" /> Đồng Bộ Tất Cả</>
            )}
          </button>
          <span className="text-[9px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full font-bold border border-indigo-500/20">Master Board</span>
        </div>
      </div>

      {/* Sub Tabs Bar */}
      <div className="flex items-center justify-between bg-[#18181f] px-4 py-2.5 border-b border-slate-800/80">
        <div className="flex items-center gap-2 bg-slate-900/60 p-1 border border-slate-800/80 rounded-xl">
          <button 
            onClick={() => setActiveTab('characters')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${activeTab === 'characters' ? 'bg-emerald-650 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <User size={12} /> Chars ({canvasCharacters.length})
          </button>
          <button 
            onClick={() => setActiveTab('locations')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${activeTab === 'locations' ? 'bg-orange-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <MapPin size={12} /> Locs ({canvasLocations.length})
          </button>
          <button 
            onClick={() => setActiveTab('props')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${activeTab === 'props' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Database size={12} /> Props ({canvasProps.length})
          </button>
          <button 
            onClick={() => setActiveTab('project')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${activeTab === 'project' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
          >
            🗂 Project & Style
          </button>
          <button 
            onClick={() => setActiveTab('album')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${activeTab === 'album' ? 'bg-rose-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
          >
            🎬 Album ({projectAssets.length})
          </button>
        </div>

        <button
          onClick={() => {
            if (activeTab === 'characters') handleAddNewChar();
            else if (activeTab === 'locations') handleAddNewLoc();
            else if (activeTab === 'props') handleAddNewProp();
          }}
          className={`flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold transition-all active:scale-95 duration-200 cursor-pointer ${(activeTab === 'project' || activeTab === 'album') ? 'opacity-40 pointer-events-none' : ''}`}
        >
          <PlusCircle size={12} /> Thêm Mới
        </button>
      </div>

      {/* Horizontal Scroller list of items */}
      <div className="p-4 flex flex-row gap-4 items-start overflow-visible bg-[#121217]/50">
        {activeTab === 'characters' && canvasCharacters.map((char, idx) => (
          <AssetCard
            key={idx}
            type="character"
            item={char}
            idx={idx}
            worldAssetChars={worldAssetChars}
            charVariants={charVariants}
            syncingStates={syncingStates}
            generatingStates={generatingStates}
            generatingPrompts={generatingPrompts}
            onUpdateAsset={(updated) => {
              const list = [...canvasCharacters];
              list[idx] = updated;
              updateCanvasCharacters(list);
            }}
            onRemove={() => handleRemoveChar(idx)}
            onOpenSlice={() => handleOpenSliceModal({
              type: 'character',
              index: idx,
              name: char.name,
              imageUrl: char.imageUrl,
              worldAssetCharId: char.worldAssetCharId,
              gridFormat: char.gridFormat || '2x2'
            })}
            onUploadFile={(e) => handleUploadFileChar(e, idx)}
            onLink={(val) => handleLinkChar(idx, val)}
            onGenPrompt={() => handleGeneratePromptChar(idx)}
            onGenImg={() => handleAutoGenChar(idx)}
            onSync={() => syncAssetToLibrary('character', idx)}
            onZoom={() => setSelectedZoomImage(char.imageUrl || null)}
            onViewDetail={() => setEditingAsset({ type: 'character', index: idx })}
            onSelectVariant={(variantUrl, variantId) => handleSelectVariantAsRoot('character', idx, variantUrl, variantId)}
          />
        ))}
        {activeTab === 'characters' && canvasCharacters.length === 0 && (
          <div className="py-12 w-full text-center border border-dashed border-slate-800 rounded-xl bg-slate-950/20 text-slate-500 italic text-[10px] flex flex-col items-center justify-center">
            Không phát hiện nhân vật nào
          </div>
        )}

        {activeTab === 'locations' && canvasLocations.map((loc, idx) => (
          <AssetCard
            key={idx}
            type="location"
            item={loc}
            idx={idx}
            worldAssetChars={worldAssetChars}
            charVariants={charVariants}
            syncingStates={syncingStates}
            generatingStates={generatingStates}
            generatingPrompts={generatingPrompts}
            onUpdateAsset={(updated) => {
              const list = [...canvasLocations];
              list[idx] = updated;
              updateCanvasLocations(list);
            }}
            onRemove={() => handleRemoveLoc(idx)}
            onOpenSlice={() => handleOpenSliceModal({
              type: 'location',
              index: idx,
              name: loc.name,
              imageUrl: loc.imageUrl,
              worldAssetCharId: loc.worldAssetCharId,
              gridFormat: loc.gridFormat || '2x2'
            })}
            onUploadFile={(e) => handleUploadFileLoc(e, idx)}
            onLink={(val) => handleLinkLoc(idx, val)}
            onGenPrompt={() => handleGeneratePromptLoc(idx)}
            onGenImg={() => handleAutoGenLoc(idx)}
            onSync={() => syncAssetToLibrary('location', idx)}
            onZoom={() => setSelectedZoomImage(loc.imageUrl || null)}
            onViewDetail={() => setEditingAsset({ type: 'location', index: idx })}
            onSelectVariant={(variantUrl, variantId) => handleSelectVariantAsRoot('location', idx, variantUrl, variantId)}
          />
        ))}
        {activeTab === 'locations' && canvasLocations.length === 0 && (
          <div className="py-12 w-full text-center border border-dashed border-slate-800 rounded-xl bg-slate-950/20 text-slate-500 italic text-[10px] flex flex-col items-center justify-center">
            Không phát hiện bối cảnh nào
          </div>
        )}

        {activeTab === 'props' && canvasProps.map((prop, idx) => (
          <AssetCard
            key={idx}
            type="prop"
            item={prop}
            idx={idx}
            worldAssetChars={worldAssetChars}
            charVariants={charVariants}
            syncingStates={syncingStates}
            generatingStates={generatingStates}
            generatingPrompts={generatingPrompts}
            onUpdateAsset={(updated) => {
              const list = [...canvasProps];
              list[idx] = updated;
              updateCanvasProps(list);
            }}
            onRemove={() => handleRemoveProp(idx)}
            onOpenSlice={() => handleOpenSliceModal({
              type: 'prop',
              index: idx,
              name: prop.name,
              imageUrl: prop.imageUrl,
              worldAssetCharId: prop.worldAssetCharId,
              gridFormat: prop.gridFormat || '1x1'
            })}
            onUploadFile={(e) => handleUploadFileProp(e, idx)}
            onLink={(val) => handleLinkProp(idx, val)}
            onGenPrompt={() => handleGeneratePromptProp(idx)}
            onGenImg={() => handleAutoGenProp(idx)}
            onSync={() => syncAssetToLibrary('prop', idx)}
            onZoom={() => setSelectedZoomImage(prop.imageUrl || null)}
            onViewDetail={() => setEditingAsset({ type: 'prop', index: idx })}
            onSelectVariant={(variantUrl, variantId) => handleSelectVariantAsRoot('prop', idx, variantUrl, variantId)}
          />
        ))}
        {activeTab === 'props' && canvasProps.length === 0 && (
          <div className="py-12 w-full text-center border border-dashed border-slate-800 rounded-xl bg-slate-950/20 text-slate-500 italic text-[10px] flex flex-col items-center justify-center">
            Không phát hiện đạo cụ nào
          </div>
        )}

        {activeTab === 'project' && (
          <ProjectSettingsPanel
            selectedProjectId={selectedProjectId}
            setSelectedProjectId={setSelectedProjectId}
            projects={projects}
            newProjectName={newProjectName}
            setNewProjectName={setNewProjectName}
            handleCreateWorldAssetProject={handleCreateWorldAssetProject}
            isCreatingWorldAssetProject={isCreatingWorldAssetProject}
            projectData={projectData}
            setProjectData={setProjectData}
            handleCreateProject={handleCreateProject}
            isCreatingProject={isCreatingProject}
            handleAutoPromptStyle={handleAutoPromptStyle}
            isGeneratingStyle={isGeneratingStyle}
            handleSyncEpisodeToDB={handleSyncEpisodeToDB}
            isSyncingEpisode={isSyncingEpisode}
            episodes={episodes}
            isLoadingEpisodes={isLoadingEpisodes}
            handleImportEpisode={handleImportEpisode}
            isSyncingLetta={isSyncingLetta}
            handleSyncLetta={handleSyncLetta}
          />
        )}
        {activeTab === 'album' && (
          <div className="w-full min-h-[300px] flex flex-col gap-4">
            {projectAssets.length === 0 ? (
              <div className="py-24 text-center border border-dashed border-slate-800 rounded-xl bg-slate-950/20 text-slate-500 italic text-[11px] flex flex-col items-center justify-center gap-2">
                <span>Không tìm thấy ảnh Storyboard hay Video nào của dự án</span>
                <span className="text-[10px] text-slate-600 not-italic font-normal">Hãy thực hiện đồng bộ kịch bản và phân cảnh từ Review Board về World Asset để nạp Album!</span>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar w-full">
                {projectAssets.map((asset: any, idx: number) => {
                  const isVideo = asset.assetType === 'video';
                  const sceneTag = asset.tags?.find((t: string) => t.toLowerCase().includes('scene')) || '';
                  const shotTag = asset.tags?.find((t: string) => t.toLowerCase().includes('shot')) || '';
                  const label = [sceneTag, shotTag].filter(Boolean).join(' - ') || `Asset #${idx + 1}`;

                  return (
                    <div 
                      key={asset.id || idx} 
                      className="group relative bg-[#18181f] border border-slate-800/80 rounded-xl overflow-hidden shadow-lg hover:border-rose-500/50 transition-all duration-300 flex flex-col w-[180px]"
                    >
                      {/* Media container */}
                      <div className="relative aspect-video w-full bg-black/60 overflow-hidden flex items-center justify-center">
                        {isVideo ? (
                          <div className="w-full h-full relative group/video">
                            <video 
                              src={asset.driveUrl} 
                              className="w-full h-full object-cover" 
                              preload="metadata"
                              controls
                            />
                            <div className="absolute top-2 left-2 bg-rose-600/90 text-white font-black text-[8px] uppercase px-1.5 py-0.5 rounded tracking-wide shadow pointer-events-none">
                              Video
                            </div>
                          </div>
                        ) : (
                          <div className="w-full h-full relative cursor-zoom-in" onClick={() => setSelectedZoomImage(asset.driveUrl)}>
                            <img 
                              src={asset.driveUrl} 
                              alt={label} 
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              loading="lazy"
                            />
                            <div className="absolute top-2 left-2 bg-indigo-600/90 text-white font-black text-[8px] uppercase px-1.5 py-0.5 rounded tracking-wide shadow">
                              Image
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Info bar */}
                      <div className="p-2 flex flex-col gap-1 border-t border-slate-900/60 bg-[#14141a]">
                        <span className="text-[10px] font-bold text-white tracking-wide truncate group-hover:text-rose-400 transition-colors">
                          {label}
                        </span>
                        <div className="flex items-center justify-between text-[8px] text-slate-500 font-medium">
                          <span>{asset.assetType === 'video' ? '🎬 MP4' : '🖼 JPEG'}</span>
                          <span>{new Date(asset.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="p-3 bg-[#1e293b] border-t border-slate-800 text-[10px] text-slate-400 text-center flex items-center justify-center gap-1.5 font-bold">
        <span>Gửi ảnh Ref đã đồng bộ</span>
        <ArrowRight size={12} className="text-indigo-400" />
        <span className="text-white uppercase font-black text-[9px] bg-indigo-500/20 px-1.5 py-0.5 rounded tracking-wide">Scene Storyboard</span>
      </div>



      {/* Slice Panel Modal */}
      <SliceModal
        isOpen={sliceModalOpen}
        onClose={() => setSliceModalOpen(false)}
        activeAsset={activeSliceAsset}
        slicingStates={slicingStates}
        onSaveSlice={handleSaveSlice}
      />

      {/* 5. FULL-SCREEN IMAGE ZOOM PREVIEW DIALOG */}
      {selectedZoomImage && createPortal(
        <div 
          className="fixed inset-0 z-[10000] bg-black/95 flex items-center justify-center p-4 animate-fade-in cursor-zoom-out"
          onClick={() => setSelectedZoomImage(null)}
        >
          <button 
            onClick={() => setSelectedZoomImage(null)}
            className="absolute top-6 right-6 p-3 rounded-full bg-slate-900 hover:bg-slate-800 text-white transition-all shadow-xl cursor-pointer"
          >
            <X size={24} />
          </button>
          <img 
            src={selectedZoomImage} 
            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl border border-slate-850 animate-scale-up" 
            alt="Asset Zoom Preview" 
          />
        </div>,
        document.body
      )}

      {/* 6. SINGLE ASSET DETAIL & EDIT MODAL */}
      <DetailEditModal
        editingAsset={editingAsset}
        onClose={() => setEditingAsset(null)}
        canvasCharacters={canvasCharacters}
        canvasLocations={canvasLocations}
        canvasProps={canvasProps}
        updateCanvasCharacters={updateCanvasCharacters}
        updateCanvasLocations={updateCanvasLocations}
        updateCanvasProps={updateCanvasProps}
        worldAssetChars={worldAssetChars}
        syncingStates={syncingStates}
        generatingStates={generatingStates}
        generatingPrompts={generatingPrompts}
        onUploadFileChar={handleUploadFileChar}
        onUploadFileLoc={handleUploadFileLoc}
        onUploadFileProp={handleUploadFileProp}
        onLinkChar={handleLinkChar}
        onLinkLoc={handleLinkLoc}
        onLinkProp={handleLinkProp}
        onGeneratePromptChar={handleGeneratePromptChar}
        onGeneratePromptLoc={handleGeneratePromptLoc}
        onGeneratePromptProp={handleGeneratePromptProp}
        onAutoGenChar={handleAutoGenChar}
        onAutoGenLoc={handleAutoGenLoc}
        onAutoGenProp={handleAutoGenProp}
        onSyncAssetToLibrary={syncAssetToLibrary}
        onOpenSliceModal={handleOpenSliceModal}
      />

      {/* Source handle bottom */}
      <Handle type="source" position={Position.Bottom} id="out" className="w-3.5 h-3.5 bg-indigo-500 border-2 border-[#121216]" />
    </div>
  );
}
