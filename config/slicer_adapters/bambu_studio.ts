export const bambuStudioAdapter = {
  nozzle_temp: 'nozzle_temperature',
  bed_temp: 'bed_temperature',
  print_speed: 'print_speed',
  travel_speed: 'travel_speed',
  accel: 'max_acceleration',
  jerk: 'max_jerk',
  fan_speed: 'cooling_fan_speed',
  flow_rate: 'flow_ratio',
  retraction_distance: 'retraction_distance',
} as const;

export type BambuStudioAdapterKey = keyof typeof bambuStudioAdapter;

export default bambuStudioAdapter;
