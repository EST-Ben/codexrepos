import React, { useRef, useCallback } from 'react';

type Props = {
  label?: string;
  multiple?: boolean;
  accept?: string;
  onPick: (file: File, objectUrl: string) => void;
};

export default function WebPhotoPicker({
  label = 'Add photo',
  multiple = false,
  accept = 'image/*',
  onPick,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const onClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const onChange = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      const files = e.currentTarget.files;
      if (!files || files.length === 0) return;
      Array.from(files).forEach((f) => {
        const url = URL.createObjectURL(f);
        onPick(f, url);
      });
      e.currentTarget.value = ''; // allow re-pick of same file
    },
    [onPick]
  );

  return (
    <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
      <button
        type="button"
        onClick={onClick}
        style={{
          padding: '10px 14px',
          borderRadius: 10,
          border: '1px solid #ccc',
          background: '#111',
          color: 'white',
          cursor: 'pointer',
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
      />
    </div>
  );
}
