export const prusaSlicerAdapter = {
  nozzle_temp: 'temperature',
  bed_temp: 'bed_temperature',
  print_speed: 'perimeter_speed',
  travel_speed: 'travel_speed',
  accel: 'perimeter_acceleration',
  jerk: 'perimeter_jerk',
  fan_speed: 'fan_speed',
  flow_rate: 'extrusion_multiplier',
  retraction_distance: 'retract_length',
} as const;

export type PrusaSlicerAdapterKey = keyof typeof prusaSlicerAdapter;

export default prusaSlicerAdapter;
