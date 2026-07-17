export type AssetType = 'character' | 'location' | 'prop';

export interface AssetItem {
  name: string;
  aliases?: string;
  description?: string;
  imageUrl?: string;
  mediaId?: string;
  worldAssetCharId?: string;
  worldAssetCharName?: string;
  renderMode?: string;
  gridFormat?: string;
  adjacentLocationIds?: string[];
  sharedDna?: string;
  [key: string]: any;
}

export interface WorldAssetNodeProps {
  id: string;
  data: {
    characters?: AssetItem[];
    locations?: AssetItem[];
    props?: AssetItem[];
    [key: string]: any;
  };
}
