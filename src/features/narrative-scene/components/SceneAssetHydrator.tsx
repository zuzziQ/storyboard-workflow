import React from 'react';

interface AssetRef {
  name: string;
  hasMedia: boolean;
}

interface SceneAssetHydratorProps {
  recognizedCharacters: AssetRef[];
  recognizedLocation: AssetRef | null;
  recognizedProps: AssetRef[];
}

export default function SceneAssetHydrator({
  recognizedCharacters,
  recognizedLocation,
  recognizedProps,
}: SceneAssetHydratorProps) {
  const totalAssetsCount =
    recognizedCharacters.length +
    (recognizedLocation ? 1 : 0) +
    recognizedProps.length;

  return (
    <div className="bg-[#17171c] p-2 rounded-lg border border-slate-800 space-y-1.5">
      <div className="text-[9px] text-slate-500 uppercase font-bold tracking-wider flex justify-between">
        <span>Asset References ({totalAssetsCount})</span>
        <span className="text-slate-600">Auto-Detect</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {recognizedCharacters.map((char) => (
          <span
            key={`char-${char.name}`}
            className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 font-semibold ${
              char.hasMedia
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
            }`}
            title={
              char.hasMedia
                ? 'Sẵn sàng gửi làm ảnh chân dung Ref!'
                : 'Cảnh báo: Nhân vật này chưa được tạo ảnh chân dung!'
            }
          >
            👤 {char.name} {char.hasMedia ? '✓' : '⚠️'}
          </span>
        ))}
        {recognizedLocation && (
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 font-semibold ${
              recognizedLocation.hasMedia
                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
            }`}
            title={
              recognizedLocation.hasMedia
                ? 'Sẵn sàng gửi bối cảnh Ref!'
                : 'Bối cảnh chưa được tạo ảnh Concept!'
            }
          >
            📍 {recognizedLocation.name} {recognizedLocation.hasMedia ? '✓' : '⚠️'}
          </span>
        )}
        {recognizedProps.map((prop) => (
          <span
            key={`prop-${prop.name}`}
            className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 font-semibold ${
              prop.hasMedia
                ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
                : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
            }`}
            title={
              prop.hasMedia
                ? 'Sẵn sàng gửi đạo cụ Ref!'
                : 'Đạo cụ chưa có ảnh Concept!'
            }
          >
            🧰 {prop.name} {prop.hasMedia ? '✓' : '⚠️'}
          </span>
        ))}
        {recognizedCharacters.length === 0 && !recognizedLocation && recognizedProps.length === 0 && (
          <span className="text-[9px] text-slate-600 font-medium italic">
            Không phát hiện ảnh Ref nào
          </span>
        )}
      </div>
    </div>
  );
}
