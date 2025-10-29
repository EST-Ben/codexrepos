from __future__ import annotations

import pytest

from server.machines import machine_summaries, resolve_machine


def test_resolve_machine_by_id() -> None:
    machine = resolve_machine('bambu_p1p')
    assert machine['model'] == 'P1P'


def test_resolve_machine_by_alias() -> None:
    machine = resolve_machine('A1 mini')
    assert machine['id'] == 'bambu_a1_mini'


def test_resolve_machine_fuzzy() -> None:
    machine = resolve_machine('Voron 2.4 Kit')
    assert machine['id'] == 'voron_24_kit'


def test_machine_summaries_sorted() -> None:
    summaries = machine_summaries()
    brands = [item.get('brand') for item in summaries]
    assert brands == sorted(brands, key=lambda value: (value or '').lower())


def test_resolve_machine_missing() -> None:
    with pytest.raises(KeyError):
        resolve_machine('non-existent-machine')
