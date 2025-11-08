import React, { useCallback, useEffect, useRef } from 'react';
import type { PreparedImage } from './CameraButton';

type Props = {
  label?: string;
  multiple?: boolean;
  accept?: string;
  disabled?: boolean;
  onImageReady(image: PreparedImage): void;
};

export default function WebPhotoPicker({
  label = 'Add photo',
  multiple = false,
  accept = 'image/*',
  disabled = false,
  onImageReady,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const objectUrlsRef = useRef<string[]>([]);

  const onClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const onChange = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      const files = e.currentTarget.files;
      if (!files || files.length === 0) return;
      Array.from(files).forEach((file) => {
        const url = URL.createObjectURL(file);
        objectUrlsRef.current.push(url);
        const prepared: PreparedImage = {
          uri: url,
          width: 0,
          height: 0,
          name: file.name ?? 'photo.jpg',
          type: file.type || 'image/jpeg',
          blob: file,
          size: file.size,
        };
        onImageReady(prepared);
      });
      // reset so picking the same file again re-fires change
      e.currentTarget.value = '';
    },
    [onImageReady]
  );

  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrlsRef.current = [];
    };
  }, []);

  return (
    <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        style={{
          padding: '10px 14px',
          borderRadius: 10,
          border: '1px solid #ccc',
          background: disabled ? '#1f2937' : '#111',
          color: disabled ? '#9ca3af' : 'white',
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
        aria-label={label}
      >
        {label}
      </button>
      <input
        ref={inputRef}
        onChange={onChange}
        type="file"
        accept={accept}
        multiple={multiple}
        style={{ display: 'none' }}
        disabled={disabled}
      />
    </div>
  );
}
