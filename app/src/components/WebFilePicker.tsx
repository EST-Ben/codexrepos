import * as React from 'react';
import { Platform } from 'react-native';

export type PickedImage = { uri: string; name: string; type: string };

type Props = {
  onPick(file: PickedImage): void;
  accept?: string;
  children: (open: () => void) => React.ReactNode;
};

/**
 * Web-only <input type="file"> wrapper. On native, it no-ops and relies on existing flow.
 */
export default function WebFilePicker({ onPick, accept = 'image/*', children }: Props) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const open = React.useCallback(() => {
    if (Platform.OS !== 'web') return;
    if (!inputRef.current) return;
    inputRef.current.value = '';
    inputRef.current.click();
  }, []);

  const onChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (!f) return;
      const uri = URL.createObjectURL(f);
      const file = {
        uri,
        name: f.name || 'photo.jpg',
        type: f.type || 'image/jpeg',
        file: f,
      } as PickedImage & { file?: File };
      onPick(file);
    },
    [onPick]
  );

  if (Platform.OS !== 'web') {
    // Render children with a no-op opener; native flow uses Camera/ImagePicker elsewhere
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
