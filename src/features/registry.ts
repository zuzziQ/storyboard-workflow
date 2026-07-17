import React from 'react';

// Lười tải các Node features để tối ưu hóa bundle và load time
const WorldAssetNode = React.lazy(() => import('./world-asset/WorldAssetNode'));
const EmotionArcNode = React.lazy(() => import('./emotion-arc/EmotionArcNode'));
const SceneNode = React.lazy(() => import('./narrative-scene/SceneNode'));
const ScenePrepNode = React.lazy(() => import('./narrative-scene/ScenePrepNode'));
const ReviewBoardNode = React.lazy(() => import('./review-board/ReviewBoardNode'));
const ShotPlanNode = React.lazy(() => import('./shot-plan/ShotPlanNode'));
const VideoNode = React.lazy(() => import('./video-generator/VideoNode'));

// Các node tĩnh không đổi
import MergeNode from '../nodes/MergeNode';
import PropNode from '../nodes/PropNode';
import UploadNode from '../nodes/UploadNode';
import ConfigNode from '../nodes/ConfigNode';
import EmotionBridgeNode from '../nodes/EmotionBridgeNode';
import OmniNode from '../nodes/OmniNode';

export interface ModuleConfig {
  type: string;
  name: string;
  description: string;
  enabled: boolean;
  component: React.ComponentType<any>;
  defaultY: number;
  heightOffset: number; // Khoảng cách dọc khuyến nghị phía sau node này
}

export const flowRegistry: ModuleConfig[] = [
  {
    type: 'worldAssetNode',
    name: 'World Asset Bridge',
    description: 'Quản lý tài sản thế giới (Nhân vật, Bối cảnh, Đạo cụ)',
    enabled: true,
    component: WorldAssetNode,
    defaultY: 50,
    heightOffset: 700 // Khoảng cách Y tiếp theo: 50 + 700 = 750
  },
  {
    type: 'emotionArcNode',
    name: 'Emotional Arc',
    description: 'Bản đồ nhịp cảm xúc và kịch tính của toàn bộ phân cảnh',
    enabled: true,
    component: EmotionArcNode,
    defaultY: 750,
    heightOffset: 350 // Khoảng cách Y tiếp theo: 750 + 350 = 1100
  },
  {
    type: 'sceneNode',
    name: 'Narrative Scene Node',
    description: 'Phân cảnh kịch bản chi tiết và phân rã các shot hình',
    enabled: true,
    component: SceneNode,
    defaultY: 1100,
    heightOffset: 1000 // Khoảng cách Y tiếp theo: 1100 + 1000 = 2100
  },
  {
    type: 'reviewBoardNode',
    name: 'Review Board Node',
    description: 'Bảng đánh giá, duyệt storyboard và đồng bộ dữ liệu PostgreSQL',
    enabled: true,
    component: ReviewBoardNode,
    defaultY: 2100,
    heightOffset: 1000
  }
];

// Xuất danh sách nodeTypes để React Flow sử dụng trực tiếp
export const registryNodeTypes = {
  worldAssetNode: WorldAssetNode,
  emotionArcNode: EmotionArcNode,
  sceneNode: SceneNode,
  scenePrepNode: ScenePrepNode,
  reviewBoardNode: ReviewBoardNode,
  shotPlanNode: ShotPlanNode,
  videoNode: VideoNode,
  
  // Tĩnh
  mergeNode: MergeNode,
  propNode: PropNode,
  uploadNode: UploadNode,
  configNode: ConfigNode,
  emotionBridgeNode: EmotionBridgeNode,
  omniNode: OmniNode
};
