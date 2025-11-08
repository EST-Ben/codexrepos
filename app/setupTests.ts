import '@testing-library/jest-native/extend-expect';

if (!(URL as any).createObjectURL) {
  (URL as any).createObjectURL = () => 'blob://test';
}
