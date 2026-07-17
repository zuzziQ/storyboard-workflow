import { useCallback, useState } from 'react';
import type { Node, ReactFlowInstance } from 'reactflow';
import { useFlowStore } from '../store/useFlowStore';

export const useDnD = () => {
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const setNodes = useFlowStore((state) => state.setNodes);

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      if (typeof type === 'undefined' || !type || !reactFlowInstance) {
        return;
      }

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      let newNodeData: any = {};
      if (type === 'characterNode') newNodeData = { name: 'New Character', description: 'Manual input' };
      else if (type === 'locationNode') newNodeData = { name: 'New Location', description: 'Manual input' };
      else if (type === 'propNode') newNodeData = { name: 'New Prop', description: 'Manual prop details' };
      else if (type === 'sceneNode') newNodeData = { sceneId: 'New Scene', location: 'Unknown', timeOfDay: 'DAY', physicalCharacteristics: '', frameDescription: 'Manual frame', characterCount: 0 };
      else if (type === 'omniNode') newNodeData = { status: 'idle' };
      else if (type === 'configNode') newNodeData = { model: 'veo_3_1', ratio: '16:9', type: 'video', variants: 1 };
      else if (type === 'mergeNode') newNodeData = { status: 'idle' };

      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        data: newNodeData,
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes]
  );

  return { reactFlowInstance, setReactFlowInstance, onDragStart, onDragOver, onDrop };
};
