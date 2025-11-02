import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';

import { analyzeImage as analyzeWithClient } from '../api/client';
import type { AnalyzeResponse, ExperienceLevel } from '../types';
import type { PreparedImage } from './CameraButton';
import { CameraButton } from './CameraButton';
import { WebPhotoPicker } from './WebPhotoPicker';

interface AnalyzeFromPhotoProps {
  machineId: string;
  experience: ExperienceLevel;
  onResult(response: AnalyzeResponse): void;
  onError(message: string): void;
  material?: string;
  disabled?: boolean;
  label?: string;
  appVersion?: string;
}

export const AnalyzeFromPhoto: React.FC<AnalyzeFromPhotoProps> = ({
  machineId,
  experience,
  onResult,
  onError,
  material,
  disabled,
  label = 'Take Photo',
  appVersion = Platform.OS === 'web' ? 'web-analyze-from-photo' : 'native-analyze-from-photo',
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleNativeImage = useCallback(
    async (image: PreparedImage) => {
      try {
        setIsSubmitting(true);
        const response = await analyzeWithClient(
          { uri: image.uri, name: image.name, type: image.type },
          {
            machine_id: machineId,
            experience,
            app_version: appVersion,
            ...(material ? { material } : {}),
          },
        );
        onResult(response);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        onError(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [appVersion, experience, machineId, material, onError, onResult],
  );

  if (Platform.OS === 'web') {
    return (
      <WebPhotoPicker
        machineId={machineId}
        experience={experience}
        material={material}
        onResult={onResult}
        onError={onError}
        label={label}
        appVersion={appVersion}
      />
    );
  }

  return (
    <View style={{ gap: 12 }}>
      <CameraButton
        disabled={disabled || isSubmitting}
        label={isSubmitting ? 'Analyzing…' : label}
        onImageReady={handleNativeImage}
      />
      {isSubmitting ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <ActivityIndicator color="#2563eb" />
        </View>
      ) : null}
    </View>
  );
};

export default AnalyzeFromPhoto;
