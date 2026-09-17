import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  allocateChange,
  calculateChange,
  calculateEffectiveContributions,
  calculateSettlement,
  type Person,
} from './settle';

const person = (id: string, name: string, paid: number): Person => ({ id, name, paid });

describe('change ownership and settlement', () => {
  it('keeps exact payments unchanged', () => {
    const people = [
      person('a', 'Person 1', 50_000),
      person('b', 'Person 2', 50_000),
    ];

    assert.equal(calculateChange(100_000, people), 0);
    assert.deepEqual(allocateChange(0, people), []);
    assert.deepEqual(calculateSettlement(100_000, people), []);
  });

  it('returns all change to the one original contributor', () => {
    const people = [
      person('a', 'Person 1', 100_000),
      person('b', 'Person 2', 0),
      person('c', 'Person 3', 0),
    ];
    const change = calculateChange(90_000, people);
    const returns = allocateChange(change, people);
    const effective = calculateEffectiveContributions(people, returns);

    assert.equal(change, 10_000);
    assert.deepEqual(returns.map(({ person: contributor, amount }) => [contributor.id, amount]), [['a', 10_000]]);
    assert.deepEqual(effective.map(({ id, paid }) => [id, paid]), [
      ['a', 90_000],
      ['b', 0],
      ['c', 0],
    ]);
    assert.deepEqual(
      calculateSettlement(90_000, effective).map(({ from, to, amount }) => [from.id, to.id, amount]),
      [
        ['b', 'a', 30_000],
        ['c', 'a', 30_000],
      ],
    );
  });

  it('allocates change proportionally and does not give it to non-contributors', () => {
    const people = [
      person('a', 'Person 1', 100_000),
      person('b', 'Person 2', 100_000),
      person('c', 'Person 3', 0),
    ];
    const change = calculateChange(130_000, people);
    const returns = allocateChange(change, people);
    const effective = calculateEffectiveContributions(people, returns);
    const settlements = calculateSettlement(130_000, effective);

    assert.equal(change, 70_000);
    assert.deepEqual(returns.map(({ person: contributor, amount }) => [contributor.id, amount]), [
      ['a', 35_000],
      ['b', 35_000],
    ]);
    assert.deepEqual(effective.map(({ id, paid }) => [id, paid]), [
      ['a', 65_000],
      ['b', 65_000],
      ['c', 0],
    ]);
    assert.equal(settlements.length, 2);
    assert.ok(settlements.every(({ from }) => from.id === 'c'));
    assert.deepEqual(
      settlements.map(({ to, amount }) => [to.id, amount]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
      [
        ['a', 21_666],
        ['b', 21_667],
      ],
    );
    assert.equal(settlements.reduce((sum, settlement) => sum + settlement.amount, 0), 43_333);
  });

  it('preserves the original equal-split example', () => {
    const people = [
      person('raiha', 'Raiha', 50_000),
      person('ali', 'Ali', 7_000),
      person('sara', 'Sara', 0),
      person('hiba', 'Hiba', 0),
    ];

    assert.deepEqual(
      calculateSettlement(57_000, people)
        .map(({ from, to, amount }) => [from.id, to.id, amount])
        .sort((a, b) => Number(b[2]) - Number(a[2])),
      [
        ['sara', 'raiha', 14_250],
        ['hiba', 'raiha', 14_250],
        ['ali', 'raiha', 7_250],
      ],
    );
  });
});