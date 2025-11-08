import * as React from 'react';
import { Platform } from 'react-native';

export type PickedImage = { uri: string; name: string; type: string; file?: File };

type Props = {
  onPick(file: PickedImage): void;
  accept?: string; // default image/*
  children: (open: () => void) => React.ReactNode;
};

export default function WebFilePicker({ onPick, accept = 'image/*', children }: Props) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const open = React.useCallback(() => {
    if (Platform.OS !== 'web') return;
    inputRef.current?.click();
  }, []);

  const onChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (!f) return;
      const uri = URL.createObjectURL(f);
      onPick({ uri, name: f.name || 'photo.jpg', type: f.type || 'image/jpeg', file: f });
    },
    [onPick]
  );

  if (Platform.OS !== 'web') {
    return <>{children(() => {})}</>;
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={onChange}
      />
      {children(open)}
    </>
  );
}
