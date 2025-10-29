from __future__ import annotations

from server.app.rules import RulesEngine
from server.models.api import AnalyzeRequestMeta, Prediction
from server.rules.suggest import suggest
from server.machines import resolve_machine


def test_rules_engine_clamps_to_machine_limits() -> None:
    machine = resolve_machine('bambu_p1p')
    engine = RulesEngine()
    parameters = {
        'nozzle_temp': 400.0,
        'bed_temp': 200.0,
        'print_speed': 400.0,
        'travel_speed': 500.0,
        'accel': 50000.0,
    }
    applied = engine.clamp_to_machine(machine, parameters, 'Intermediate')
    assert applied['clamped_to_machine_limits'] is True
    assert applied['parameters']['nozzle_temp'] <= machine['max_nozzle_temp_c']
    assert applied['parameters']['bed_temp'] <= machine['max_bed_temp_c']
    safe = machine['safe_speed_ranges']
    assert applied['parameters']['print_speed'] <= safe['print'][1]


def test_rules_engine_experience_filters() -> None:
    machine = resolve_machine('bambu_p1p')
    engine = RulesEngine()
    parameters = {
        'nozzle_temp': 220.0,
        'bed_temp': 60.0,
        'print_speed': 140.0,
        'accel': 4000.0,
    }
    beginner = engine.clamp_to_machine(machine, parameters, 'Beginner')
    assert 'accel' not in beginner['parameters']
    advanced = engine.clamp_to_machine(machine, parameters, 'Advanced')
    assert 'accel' in advanced['parameters']


def test_suggestions_respect_machine_bounds() -> None:
    meta = AnalyzeRequestMeta(machine_id='bambu_p1s', experience='Advanced', material='PLA')
    suggestions, low_confidence = suggest([Prediction(issue_id='under_extrusion', confidence=0.9)], meta)
    assert low_confidence is False
    machine = resolve_machine('bambu_p1s')
    max_nozzle = machine['max_nozzle_temp_c']
    max_print = machine['safe_speed_ranges']['print'][1]
    change_map = {change.param: change for change in suggestions[0].changes}
    assert change_map['nozzle_temp'].new_target <= max_nozzle
    assert change_map['print_speed'].new_target <= max_print
    assert suggestions[0].clamped_to_machine_limits is True
