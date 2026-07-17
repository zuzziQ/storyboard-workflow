import { useFlowStore } from '../store/useFlowStore';

export function useProjectStorage() {
  const setNodes = useFlowStore(state => state.setNodes);
  const setEdges = useFlowStore(state => state.setEdges);
  const setParsedData = useFlowStore(state => state.setParsedData);

  const handleExport = () => {
    const nodes = useFlowStore.getState().nodes;
    const edges = useFlowStore.getState().edges;
    const parsedData = useFlowStore.getState().parsedData;
    const projectData = useFlowStore.getState().projectData;

    const filePayload = {
      nodes,
      edges,
      parsedData,
      projectData
    };
    const blob = new Blob([JSON.stringify(filePayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectData.name.replace(/\s+/g, '_') || 'project'}.storymee`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (data.nodes) setNodes(data.nodes);
        if (data.edges) setEdges(data.edges);
        if (data.parsedData) setParsedData(data.parsedData);
        if (data.projectData) {
          useFlowStore.getState().setProjectData(data.projectData);
        }
      } catch (err) {
        alert("Lỗi import project! File không đúng định dạng.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return {
    handleExport,
    handleImport
  };
}
