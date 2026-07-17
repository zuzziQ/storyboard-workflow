import { memo } from 'react';
import CinematicShotDetailModal from './components/modals/presets/cinematic/CinematicShotDetailModal';
import PacoShotDetailModal from './components/modals/presets/paco/PacoShotDetailModal';

export const getSanitizedImageModel = (model: string, provider: string) => {
  const modelVal = model || 'auto';
  if (provider === 'dreamina') {
    const valid = ['high_aes_gpt_v20', 'high_aes_general_v50', 'high_aes_general_v47', 'high_aes_general_v46', 'high_aes_general_v45', 'auto'];
    return valid.includes(modelVal) ? modelVal : 'auto';
  }
  if (provider === 'google-native') {
    const valid = ['imagen-3.0-fast-002', 'imagen-3.0-generate-002', 'auto'];
    return valid.includes(modelVal) ? modelVal : 'auto';
  }
  if (provider === 'sdk') {
    const valid = ['imagen-3', 'auto'];
    return valid.includes(modelVal) ? modelVal : 'auto';
  }
  if (provider === 'hub') {
    const valid = ['narwhal', 'flux_schnell', 'banana2', 'omni-flash-3', 'auto'];
    return valid.includes(modelVal) ? modelVal : 'auto';
  }
  return modelVal;
};

export const getSanitizedVideoModel = (model: string, provider: string) => {
  const modelVal = model || 'auto';
  if (provider === 'dreamina') {
    const valid = ['dreamina_seedance_40_mini', 'dreamina_seedance_40', 'dreamina_seedance_40_pro', 'dreamina_lib_sync_image_quick_1.5', 'dreamina_seedance_10', 'auto'];
    return valid.includes(modelVal) ? modelVal : 'auto';
  }
  if (provider === 'google-native') {
    const valid = ['veo-2.0-generate-001', 'auto'];
    return valid.includes(modelVal) ? modelVal : 'auto';
  }
  if (provider === 'sdk') {
    const valid = ['veo-3.1-fast-generate-001', 'veo-2', 'auto'];
    return valid.includes(modelVal) ? modelVal : 'auto';
  }
  if (provider === 'hub') {
    const valid = ['veo_3_1_r2v_lite_low_priority', 'veo_3_1_r2v_lite', 'veo_3_1', 'dreamina', 'auto'];
    return valid.includes(modelVal) ? modelVal : 'auto';
  }
  return modelVal;
};

export interface ShotDetailModalProps {
  sh: any;
  allLocations: any[];
  allCharacters: any[];
  renderingStates: Record<string, string>;
  videoStates: Record<string, string>;
  runImageGenForShot: (sh: any, modelId: string) => void;
  runVideoGenForShot: (sh: any, videoModel: string) => void;
  handleUpdateShot: (shotId: string, field: string | Record<string, any>, value?: any) => void;
  setActiveDetailBeat: (beatId: string | null) => void;
  customProjectRules: string[];
  customEpisodeRules: string[];
  projectData: any;
  activeSceneId: string;
}

const ShotDetailModal = memo(function ShotDetailModal(props: ShotDetailModalProps) {
  if (props.projectData?.shotlistPreset === 'paco_production') {
    return <PacoShotDetailModal {...props} />;
  }
  return <CinematicShotDetailModal {...props} />;
});

export default ShotDetailModal;
