import { useRef } from 'react';
import type { PhotoRecord } from '../types';
import { fileToPhotoDataUrl, uid } from '../logic/store';

interface Props {
  label: string;
  photos: PhotoRecord[];
  onChange: (photos: PhotoRecord[]) => void;
}

export function PhotoPicker({ label, photos, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    const added: PhotoRecord[] = [];
    for (const file of Array.from(files)) {
      try {
        const dataUrl = await fileToPhotoDataUrl(file);
        added.push({ id: uid(), dataUrl, caption: '', takenAt: new Date().toISOString() });
      } catch {
        alert(`图片「${file.name}」读取失败，已跳过`);
      }
    }
    if (added.length) onChange([...photos, ...added]);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="photo-picker">
      <div className="row between">
        <span className="photo-label">{label}</span>
        <button type="button" className="ghost" onClick={() => inputRef.current?.click()}>
          + 添加照片
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => void addFiles(e.target.files)}
      />
      {photos.length > 0 && (
        <div className="photo-grid">
          {photos.map((p) => (
            <figure key={p.id}>
              <img src={p.dataUrl} alt={p.caption || label} />
              <input
                value={p.caption}
                placeholder="照片说明"
                onChange={(e) =>
                  onChange(photos.map((x) => (x.id === p.id ? { ...x, caption: e.target.value } : x)))
                }
              />
              <button
                type="button"
                className="danger ghost"
                onClick={() => onChange(photos.filter((x) => x.id !== p.id))}
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
