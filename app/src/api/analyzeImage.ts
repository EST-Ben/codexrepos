import { analyzeImage as coreAnalyzeImage } from './client';
import type { AnalyzeRequestMeta } from '../types';

// Local file union to avoid depending on a non-exported RNFileLike
export type LocalFile =
  | { uri: string; name?: string; type?: string } // React Native style
  | File
  | Blob;

export async function analyzeImage(
  file: LocalFile,
  meta: AnalyzeRequestMeta,
  onProgress?: (p: number) => void
) {
  // Delegate to the shared client helper; keep typing lax where needed
  return coreAnalyzeImage(file as any, meta, onProgress);
}
