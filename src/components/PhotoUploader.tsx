import type { Photo } from '../types';
import { createId, fileToPhotoDataUrl } from '../lib/storage';

interface Props {
  label: string;
  photos: Photo[];
  onChange: (photos: Photo[]) => void;
}

export function PhotoUploader({ label, photos, onChange }: Props) {
  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const added: Photo[] = [];
    for (const file of Array.from(files)) {
      try {
        const dataUrl = await fileToPhotoDataUrl(file);
        added.push({ id: createId(), dataUrl, caption: '' });
      } catch {
        window.alert(`图片「${file.name}」读取失败，已跳过`);
      }
    }
    onChange([...photos, ...added]);
  };

  return (
    <div className="photo-uploader">
      <div className="photo-uploader-head">
        <span className="field-label">{label}</span>
        <label className="btn btn-sm">
          添加照片
          <input
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              void handleFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </label>
      </div>
      {photos.length > 0 && (
        <div className="photo-grid">
          {photos.map((photo) => (
            <figure key={photo.id} className="photo-item">
              <img src={photo.dataUrl} alt={photo.caption || label} />
              <input
                value={photo.caption}
                placeholder="照片说明"
                onChange={(e) =>
                  onChange(photos.map((p) => (p.id === photo.id ? { ...p, caption: e.target.value } : p)))
                }
              />
              <button
                className="btn btn-danger btn-sm"
                onClick={() => onChange(photos.filter((p) => p.id !== photo.id))}
              >
                移除
              </button>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
