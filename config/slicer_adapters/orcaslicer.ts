export const orcaSlicerAdapter = {
  nozzle_temp: 'nozzle_temperature',
  bed_temp: 'build_plate_temperature',
  print_speed: 'default_printing_speed',
  travel_speed: 'default_travel_speed',
  accel: 'default_acceleration',
  jerk: 'default_jerk',
  fan_speed: 'fan_speed',
  flow_rate: 'flow_ratio',
  retraction_distance: 'retraction_length',
} as const;

export type OrcaSlicerAdapterKey = keyof typeof orcaSlicerAdapter;

export default orcaSlicerAdapter;
