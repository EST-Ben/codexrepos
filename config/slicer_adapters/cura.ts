export const curaAdapter = {
  nozzle_temp: 'material_print_temperature',
  bed_temp: 'material_bed_temperature',
  print_speed: 'speed_print',
  travel_speed: 'speed_travel',
  accel: 'acceleration_print',
  jerk: 'jerk_print',
  flow_rate: 'material_flow',
  fan_speed: 'cool_fan_speed',
  retraction_distance: 'retraction_amount',
} as const;

export type CuraAdapterKey = keyof typeof curaAdapter;

export default curaAdapter;
