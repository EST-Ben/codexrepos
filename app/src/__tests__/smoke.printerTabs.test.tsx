import React from 'react';
import { render, screen } from '@testing-library/react-native';
import PrinterTabs from '../screens/PrinterTabs';

test('renders machine list and API base', () => {
  render(<PrinterTabs />);
  expect(screen.getByText(/Machines/i)).toBeTruthy();
  expect(screen.getByText(/API/i)).toBeTruthy();
});
