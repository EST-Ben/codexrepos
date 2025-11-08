export type BuildVolume = { x: number; y: number; z: number };

export type Machine = {
  id: MachineId;
  brand: string;
  model: string;
  nozzleDiameterMm: number;
  buildVolumeMm: BuildVolume;
  materials: string[];
};

const registry = {
  // ✅ required by tests / earlier checks
  bambu_p1s: {
    id: 'bambu_p1s',
    brand: 'Bambu Lab',
    model: 'P1S',
    nozzleDiameterMm: 0.4,
    buildVolumeMm: { x: 256, y: 256, z: 256 },
    materials: ['PLA', 'PETG', 'ABS', 'ASA', 'TPU', 'Nylon', 'CF-Nylon'],
  },
  bambu_a1: {
    id: 'bambu_a1',
    brand: 'Bambu Lab',
    model: 'A1',
    nozzleDiameterMm: 0.4,
    buildVolumeMm: { x: 256, y: 256, z: 256 },
    materials: ['PLA', 'PETG', 'TPU'],
  },
  bambu_x1c: {
    id: 'bambu_x1c',
    brand: 'Bambu Lab',
    model: 'X1 Carbon',
    nozzleDiameterMm: 0.4,
    buildVolumeMm: { x: 256, y: 256, z: 256 },
    materials: ['PLA', 'PETG', 'ABS', 'ASA', 'TPU', 'Nylon', 'CF-Nylon'],
  },
  creality_k1: {
    id: 'creality_k1',
    brand: 'Creality',
    model: 'K1',
    nozzleDiameterMm: 0.4,
    buildVolumeMm: { x: 220, y: 220, z: 250 },
    materials: ['PLA', 'PETG', 'ABS', 'TPU'],
  },
  prusa_mk4: {
    id: 'prusa_mk4',
    brand: 'Prusa',
    model: 'MK4',
    nozzleDiameterMm: 0.4,
    buildVolumeMm: { x: 250, y: 210, z: 220 },
    materials: ['PLA', 'PETG', 'ABS', 'ASA', 'TPU'],
  },

  // ✅ extras so “more machines” actually show up
  bambu_a1_mini: {
    id: 'bambu_a1_mini',
    brand: 'Bambu Lab',
    model: 'A1 mini',
    nozzleDiameterMm: 0.4,
    buildVolumeMm: { x: 180, y: 180, z: 180 },
    materials: ['PLA', 'PETG', 'TPU'],
  },
  creality_ender3_v3_ke: {
    id: 'creality_ender3_v3_ke',
    brand: 'Creality',
    model: 'Ender-3 V3 KE',
    nozzleDiameterMm: 0.4,
    buildVolumeMm: { x: 220, y: 220, z: 240 },
    materials: ['PLA', 'PETG', 'ABS', 'TPU'],
  },
  anycubic_kobra2: {
    id: 'anycubic_kobra2',
    brand: 'Anycubic',
    model: 'Kobra 2',
    nozzleDiameterMm: 0.4,
    buildVolumeMm: { x: 220, y: 220, z: 250 },
    materials: ['PLA', 'PETG', 'TPU'],
  },
  prusa_mini: {
    id: 'prusa_mini',
    brand: 'Prusa',
    model: 'MINI+',
    nozzleDiameterMm: 0.4,
    buildVolumeMm: { x: 180, y: 180, z: 180 },
    materials: ['PLA', 'PETG', 'ABS', 'TPU'],
  },
} as const;

export type MachineId = keyof typeof registry;

const all: Machine[] = Object.values(registry) as Machine[];
const ids: MachineId[] = Object.keys(registry) as MachineId[];
const defaultId: MachineId = 'bambu_p1s';

export function useMachineRegistry() {
  const byId = (id: MachineId) => registry[id] as Machine | undefined;
  return { all, ids, byId, defaultId };
}

export default useMachineRegistry;
