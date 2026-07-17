import { useState, useEffect } from 'react';
import { getApiBaseUrl, coreRequest } from '../../utils/apiConfig';
import { useFlowStore } from '../../store/useFlowStore';

interface WorldAssetProjectOptions {
  projectData: any;
  getNodes: () => any[];
}

export function useWorldAssetProject({
  projectData,
  getNodes
}: WorldAssetProjectOptions) {
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  const [episodes, setEpisodes] = useState<any[]>([]);
  const [isLoadingEpisodes, setIsLoadingEpisodes] = useState(false);
  const [isSyncingEpisode, setIsSyncingEpisode] = useState(false);

  const [worldAssetChars, setWorldAssetChars] = useState<any[]>([]);

  // 1. Fetch Projects (formerly Universes) from PostgreSQL on mount
  const loadProjects = async () => {
    setIsLoadingProjects(true);
    try {
      const list = await coreRequest('/world-asset/projects');
      setProjects(list || []);
      if (list && list.length > 0) {
        // Restore selected project ID from Zustand store or pick the first one
        const activeId = projectData.selectedProjectId || projectData.selectedUniverseId || list[0].id;
        setSelectedProjectId(activeId);
        useFlowStore.getState().setProjectData({ ...projectData, selectedProjectId: activeId, selectedUniverseId: activeId });
      }
    } catch (err) {
      console.error("[useWorldAssetProject] Lỗi fetch projects:", err);
    } finally {
      setIsLoadingProjects(false);
    }
  };

  // 2. Create a new World Asset Project
  const handleCreateWorldAssetProject = async () => {
    if (!newProjectName.trim()) return;
    setIsCreatingProject(true);
    try {
      const newProj = await coreRequest('/world-asset/projects', {
        method: 'POST',
        body: JSON.stringify({ name: newProjectName.trim() })
      });
      setProjects(prev => [...prev, newProj]);
      setSelectedProjectId(newProj.id);
      useFlowStore.getState().setProjectData({ ...projectData, selectedProjectId: newProj.id, selectedUniverseId: newProj.id });
      setNewProjectName('');
      alert(`✅ Đã tạo Dự án World Asset "${newProj.name}" thành công!`);
    } catch (err: any) {
      alert("❌ Lỗi tạo dự án: " + err.message);
    } finally {
      setIsCreatingProject(false);
    }
  };

  // 3. Update project details to DB (gflowProjectId, lastSyncedAt, stylePrompt)
  const syncProjectSettingsToDB = async (projId: string) => {
    if (!projId) return;
    try {
      const proj = projects.find(p => p.id === projId);
      if (!proj) return;

      let existingMeta: any = {};
      if (proj.description && proj.description.trim().startsWith("{")) {
        try {
          existingMeta = JSON.parse(proj.description);
        } catch (e) {}
      }

      const payload = {
        name: proj.name,
        description: JSON.stringify({
          ...existingMeta,
          gflowProjectId: projectData.id,
          storyboardLink: window.location.href,
          lastSyncedAt: new Date().toISOString(),
          universeGenre: projectData.universeGenre || '',
          worldConstraints: projectData.worldConstraints || '',
          shotlistPreset: projectData.shotlistPreset || 'universal_cinematic'
        }),
        stylePrompt: projectData.stylePrompt || proj.stylePrompt || ''
      };

      await coreRequest(`/world-asset/projects/${projId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      console.log(`[useWorldAssetProject] Tự động đồng bộ Project GFlow ID (${projectData.id}) và Style Prompt vào DB!`);
    } catch (err) {
      console.error("[useWorldAssetProject] Lỗi khi đồng bộ cấu hình dự án lên DB:", err);
    }
  };

  // 4. Fetch Episodes (script segments) & restore settings when selected project changes
  useEffect(() => {
    if (!selectedProjectId) return;

    // Reset episode selector on Project change
    const proj = projects.find(p => p.id === selectedProjectId);
    if (proj) {
      let restoredProjectId = projectData.id;
      let restoredUniverseGenre = '';
      let restoredWorldConstraints = '';
      let restoredShotlistPreset: 'universal_cinematic' | 'paco_production' = 'universal_cinematic';
      if (proj.description) {
        try {
          const meta = JSON.parse(proj.description);
          if (meta.gflowProjectId) {
            restoredProjectId = meta.gflowProjectId;
            console.log(`[useWorldAssetProject] Khôi phục Google Labs Project ID từ DB:`, restoredProjectId);
          }
          if (meta.universeGenre) {
            restoredUniverseGenre = meta.universeGenre;
          }
          if (meta.worldConstraints) {
            restoredWorldConstraints = meta.worldConstraints;
          }
          if (meta.shotlistPreset) {
            restoredShotlistPreset = meta.shotlistPreset;
          }
        } catch (e) {
          // Normal text, ignore
        }
      }

      // Restore to Zustand store
      useFlowStore.getState().setProjectData({
        ...projectData,
        name: projectData.name || proj.name,
        selectedProjectId: selectedProjectId,
        selectedUniverseId: selectedProjectId,
        stylePrompt: proj.stylePrompt || projectData.stylePrompt,
        id: restoredProjectId,
        universeGenre: restoredUniverseGenre,
        worldConstraints: restoredWorldConstraints,
        shotlistPreset: restoredShotlistPreset
      });
    }

    const loadEpisodes = async () => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!selectedProjectId || selectedProjectId === 'undefined' || selectedProjectId === 'null' || !uuidRegex.test(selectedProjectId)) {
        setEpisodes([]);
        return;
      }
      setIsLoadingEpisodes(true);
      try {
        const list = await coreRequest(`/world-asset/episodes?projectId=${selectedProjectId}`);
        setEpisodes(list || []);
      } catch (err) {
        console.error("[useWorldAssetProject] Lỗi fetch episodes:", err);
      } finally {
        setIsLoadingEpisodes(false);
      }
    };

    loadEpisodes();
  }, [selectedProjectId, projects]);

  // 5. Fetch characters & assets whenever selected project changes
  const loadAssetsAndMedia = async () => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!selectedProjectId || selectedProjectId === 'undefined' || selectedProjectId === 'null' || !uuidRegex.test(selectedProjectId)) {
      setWorldAssetChars([]);
      return;
    }
    try {
      const list = await coreRequest(`/world-asset/characters?projectId=${selectedProjectId}`);
      setWorldAssetChars(list || []);
    } catch (err) {
      console.error("[useWorldAssetProject] Lỗi fetch characters / assets:", err);
    }
  };

  useEffect(() => {
    loadAssetsAndMedia();
    window.addEventListener('WORLD_ASSETS_CHANGED', loadAssetsAndMedia);
    return () => {
      window.removeEventListener('WORLD_ASSETS_CHANGED', loadAssetsAndMedia);
    };
  }, [selectedProjectId]);

  // 6. Auto-sync project settings to DB (Debounced 1s)
  useEffect(() => {
    if (!selectedProjectId || projects.length === 0) return;
    const proj = projects.find(p => p.id === selectedProjectId);
    if (!proj) return;

    let currentMeta: any = {};
    try {
      if (proj.description) currentMeta = JSON.parse(proj.description);
    } catch (e) {}

    const isIdChanged = currentMeta.gflowProjectId !== projectData.id;
    const isStyleChanged = proj.stylePrompt !== projectData.stylePrompt;
    const isGenreChanged = currentMeta.universeGenre !== projectData.universeGenre;
    const isConstraintsChanged = currentMeta.worldConstraints !== projectData.worldConstraints;

    if (isIdChanged || isStyleChanged || isGenreChanged || isConstraintsChanged) {
      const timer = setTimeout(() => {
        syncProjectSettingsToDB(selectedProjectId);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [projectData.id, projectData.stylePrompt, projectData.universeGenre, projectData.worldConstraints, selectedProjectId]);

  // 7. Sync Episode script & scene nodes to DB
  const handleSyncEpisodeToDB = async () => {
    if (!selectedProjectId) {
      alert("⚠️ Hãy chọn một Dự án World Asset trước!");
      return;
    }

    const title = prompt("Nhập tiêu đề Tập phim (Episode Title):", projectData.name || "Tập 1");
    if (!title || !title.trim()) return;

    setIsSyncingEpisode(true);
    try {
      const currentNodes = getNodes();
      const parsedData = useFlowStore.getState().parsedData;
      const scriptText = parsedData?.scriptText || "";
      const pendingShots = useFlowStore.getState().pendingShots;

      // Collect Scene Nodes
      const sceneNodes = currentNodes.filter(n => n.type === 'sceneNode');
      if (sceneNodes.length === 0) {
        alert("⚠️ Không tìm thấy Phân cảnh (Scene) nào trên canvas để đồng bộ!");
        setIsSyncingEpisode(false);
        return;
      }

      const scenesPayload = sceneNodes.map(n => ({
        sceneNumber: parseInt(n.data.sceneId?.replace(/[^0-9]/g, '') || '0'),
        title: n.data.sceneId || 'Scene',
        description: n.data.physicalCharacteristics || "",
        prompt: n.data.storyboardPrompt || "",
        imageUrl: n.data.renderUrl || null,
        tags: n.data.charactersInScene || []
      }));

      await coreRequest(`/world-asset/episodes/sync`, {
        method: 'POST',
        body: JSON.stringify({
          projectId: selectedProjectId,
          title: title.trim(),
          scriptText,
          scenes: scenesPayload,
          gflowProjectId: projectData.id,
          shots: pendingShots
        })
      });

      alert(`✅ Đồng bộ kịch bản và ${scenesPayload.length} phân cảnh về World Asset thành công!`);
      const epList = await coreRequest(`/world-asset/episodes?projectId=${selectedProjectId}`);
      setEpisodes(epList || []);
    } catch (err: any) {
      alert("❌ Lỗi khi đồng bộ kịch bản: " + err.message);
    } finally {
      setIsSyncingEpisode(false);
    }
  };

  const [isSyncingLetta, setIsSyncingLetta] = useState(false);

  const handleSyncLetta = async () => {
    if (!selectedProjectId) {
      alert("⚠️ Hãy chọn một Dự án World Asset trước!");
      return;
    }
    setIsSyncingLetta(true);
    try {
      const data = await coreRequest(`/world-asset/projects/${selectedProjectId}/sync-letta`, {
        method: 'POST'
      });
      alert(`✅ ${data.message || 'Đồng bộ Letta Agent thành công!'}`);
    } catch (err: any) {
      alert(`❌ Lỗi đồng bộ Letta Agent: ${err.message}`);
    } finally {
      setIsSyncingLetta(false);
    }
  };

  return {
    projects,
    selectedProjectId,
    setSelectedProjectId,
    isLoadingProjects,
    isCreatingProject,
    newProjectName,
    setNewProjectName,
    handleCreateWorldAssetProject,
    loadProjects,
    episodes,
    isLoadingEpisodes,
    isSyncingEpisode,
    handleSyncEpisodeToDB,
    worldAssetChars,
    setWorldAssetChars,
    isSyncingLetta,
    handleSyncLetta,
    syncProjectSettingsToDB
  };
}
