import { Handle, Position, useReactFlow } from 'reactflow';
import { UploadCloud, Settings2, Trash2, Play, Loader2 } from 'lucide-react';
import { useState } from 'react';

import { useFlowStore } from '../store/useFlowStore';

export default function UploadNode({ id, data }: any) {
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [mediaIds, setMediaIds] = useState<string[]>(data.mediaIds || []);
  
  const { getNodes } = useReactFlow();
  const setNodes = useFlowStore.getState().setNodes;
  const setEdges = useFlowStore.getState().setEdges;
  const setHoveredAssetId = useFlowStore(state => state.setHoveredAssetId);
  const hoveredAssetId = useFlowStore(state => state.hoveredAssetId);

  const handleDelete = () => {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  };

  const handleUpload = () => {
    setIsUploading(true);
    setStatus('idle');
    
    const nodes = getNodes();
    const projectData = useFlowStore.getState().projectData;
    const extId = localStorage.getItem('STORYMEE_EXT_ID');
    const useRemote = localStorage.getItem('STORYMEE_USE_REMOTE_WORKER') === 'true';
    
    if (!useRemote && !extId) {
      alert("⚠️ Extension ID chưa được thiết lập!");
      setIsUploading(false);
      setStatus('error');
      return;
    }

    if (!projectData || projectData.id === 'new') {
      alert("⚠️ Hãy khởi tạo Project ở Node Project Init trước khi Upload Media!");
      setIsUploading(false);
      setStatus('error');
      return;
    }

    const startUploads = async () => {
      const realMediaIds: string[] = [];
      let hasError = false;
      
      const worldAssetNode = nodes.find(n => n.type === 'worldAssetNode');
      
      let updatedCharacters = worldAssetNode ? [...(worldAssetNode.data.characters || [])] : [];
      let updatedLocations = worldAssetNode ? [...(worldAssetNode.data.locations || [])] : [];
      let updatedProps = worldAssetNode ? [...(worldAssetNode.data.props || [])] : [];
      
      const useRemote = localStorage.getItem('STORYMEE_USE_REMOTE_WORKER') === 'true';

      // Function to handle asset upload
      const uploadAssetList = async (assetList: any[]) => {
         for (const asset of assetList) {
            if (asset.imageUrl && !asset.mediaId) {
               if (useRemote) {
                  asset.mediaId = asset.imageUrl;
                  realMediaIds.push(asset.imageUrl);
               } else {
                  try {
                    const result: any = await new Promise((resolve) => {
                       (window as any).chrome.runtime.sendMessage(extId, {
                          action: "UPLOAD_REFERENCE_IMAGE",
                          payload: { projectId: projectData.id, base64Image: asset.imageUrl }
                       }, (response: any) => resolve(response));
                    });
                    
                    if ((window as any).chrome.runtime.lastError || result?.error) {
                       console.error("[StoryMee] Lỗi upload:", (window as any).chrome.runtime.lastError?.message || result?.error);
                       hasError = true;
                    } else if (result?.mediaId) {
                       asset.mediaId = result.mediaId;
                       realMediaIds.push(result.mediaId);
                    }
                  } catch (e) {
                    console.error(e);
                    hasError = true;
                  }
               }
            } else if (asset.mediaId) {
               realMediaIds.push(asset.mediaId);
            }
         }
      };

      await uploadAssetList(updatedCharacters);
      await uploadAssetList(updatedLocations);
      await uploadAssetList(updatedProps);
      
      setIsUploading(false);
      
      if (realMediaIds.length > 0 || (!hasError && (updatedCharacters.length > 0 || updatedLocations.length > 0 || updatedProps.length > 0))) {
         setStatus(hasError ? 'error' : 'success');
         setMediaIds(Array.from(new Set(realMediaIds)));
         setNodes(nds => nds.map(node => {
            if (node.id === id) {
               return { ...node, data: { ...node.data, mediaIds: Array.from(new Set(realMediaIds)) } };
            }
             if (node.type === 'worldAssetNode' && worldAssetNode) {
                 return { ...node, data: { ...node.data, characters: updatedCharacters, locations: updatedLocations, props: updatedProps } };
             }
             return node;
          }));
      } else {
         setStatus('error');
      }
    };

    startUploads();
  };

  const isHovered = hoveredAssetId === id;

  return (
    <div 
      className={`bg-[#121216] rounded-xl border-2 ${status === 'success' ? 'border-teal-500 shadow-[0_0_15px_rgba(20,184,166,0.3)]' : 'border-slate-700'} w-[280px] overflow-hidden transition-all ${isHovered ? 'ring-4 ring-teal-500 shadow-[0_0_30px_rgba(20,184,166,0.6)] scale-[1.02]' : ''}`}
      onMouseEnter={() => setHoveredAssetId(id)}
      onMouseLeave={() => setHoveredAssetId(null)}
    >
      <div className="bg-[#2a2a32] p-2 flex items-center justify-between border-b border-slate-700/50 react-flow__node-draghandle cursor-move">
        <div className="flex items-center gap-2">
          <UploadCloud size={16} className={status === 'success' ? 'text-teal-400' : 'text-slate-400'} />
          <span className="text-xs font-bold text-white tracking-wide">Media Upload Check</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleDelete} className="text-slate-400 hover:text-red-400 transition-colors">
            <Trash2 size={14} />
          </button>
          <Settings2 size={14} className="text-slate-400 hover:text-white cursor-pointer" />
        </div>
      </div>
      
      <div className="p-4 flex flex-col items-center">
        <div className="w-full mb-4">
           <label className="text-[10px] text-slate-400 uppercase tracking-wider mb-2 block text-center">Generated Media IDs</label>
           <div className="w-full bg-slate-900 rounded p-2 text-xs font-mono text-teal-400 outline-none border border-slate-700 text-center min-h-[40px] flex flex-col gap-1">
              {mediaIds.length > 0 ? (
                 mediaIds.map((mid, i) => <div key={i} className="truncate w-full max-w-[240px] block" title={mid}>{mid.startsWith('data:image') ? '[Base64 Local Image]' : mid}</div>)
              ) : (
                 <span className="text-slate-600">No assets uploaded</span>
              )}
           </div>
        </div>

        <button 
           onClick={handleUpload}
           disabled={isUploading}
           className={`w-full py-2 rounded flex items-center justify-center gap-2 font-bold text-sm transition-all ${
             status === 'success' && !isUploading ? 'bg-teal-900/50 text-teal-400 border border-teal-500/50' :
             status === 'error' ? 'bg-red-600/20 text-red-400 hover:bg-red-600/40 border border-red-500/50' :
             'bg-teal-600 hover:bg-teal-500 text-white shadow-[0_0_15px_rgba(20,184,166,0.4)] hover:shadow-[0_0_20px_rgba(20,184,166,0.6)]'
           }`}
        >
          {isUploading ? (
            <><Loader2 size={16} className="animate-spin" /> Uploading to Labs...</>
          ) : status === 'success' ? (
            <><Play size={16} fill="currentColor" /> Re-Upload Media</>
          ) : (
            <><Play size={16} fill="currentColor" /> Upload Media</>
          )}
        </button>
      </div>
      
      {/* Target handle left */}
      <Handle type="target" position={Position.Left} id="in" className="w-4 h-4 bg-slate-500 border-2 border-[#121216]" />
      
      {/* Source handle right */}
      <Handle type="source" position={Position.Right} id="out" className="w-4 h-4 bg-teal-500 border-2 border-[#121216]" />
    </div>
  );
}
