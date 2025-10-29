# Machine Registry Scaffold

This project bootstraps a React Native (Expo) client, FastAPI backend, and
data-driven machine registry.

The Expo app provides an onboarding flow where operators can multi-select their
machines, choose an experience level, and copy capability-aware tuning diffs for
popular slicers. The FastAPI service loads generated machine profiles, exposes
lookup and export endpoints, and ships with a deterministic diagnostics stub so
the pipeline can be demoed without a trained model.

## Generating machine profiles

Run `python scripts/build_machines.py` after editing the seed files under
`config/seeds/` to regenerate the JSON machine profiles.

## Repository layout

This repository includes all assets discussed during the staged scaffold:

- `app/` – Expo React Native client with onboarding, results, and Jest tests.
- `server/` – FastAPI backend, machine registry, rules engine, and API tests.
- `config/machines/` – Generated machine profiles plus `_schema.json`.
- `config/seeds/` – Editable YAML seeds for families and registry entries.
- `config/slicer_adapters/` – TypeScript maps for Cura, PrusaSlicer, Bambu Studio, and OrcaSlicer.
- `scripts/` – Build, validation, and mock inference helpers (with offline fallbacks).
- `types/` – Shared TypeScript contracts for machine profiles.

## How to add a new machine

1. Add or update the appropriate family entry in `config/seeds/families.yaml`
   if the machine shares defaults with existing profiles.
2. Append the machine definition to `config/seeds/registry.yaml` under the
   relevant manufacturer block. You can override any defaults directly in the
   registry entry.
3. Regenerate the machine JSON by running `python scripts/build_machines.py`.
4. Optionally run `python scripts/validate_machines.py` or the PyTest suite to
   ensure the new profile validates against the schema.
5. Commit the updated seeds and generated JSON files.
