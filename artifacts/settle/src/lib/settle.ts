export type Person = {
  id: string;
  name: string;
  paid: number;
};

export type Currency = {
  code: string;
  symbol: string;
};

export type Settlement = {
  from: Person;
  to: Person;
  amount: number;
};

export type ChangeReturn = {
  person: Person;
  amount: number;
};

export function parseMoneyToCents(value: string): number | null {
  const cleaned = value.trim().replace(/,/g, '');
  if (!cleaned || !/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  const [whole, fraction = ''] = cleaned.split('.');
  const cents = Number(`${whole}${fraction.padEnd(2, '0')}`);
  return Number.isSafeInteger(cents) ? cents : null;
}

export function formatMoney(cents: number, symbol: string): string {
  return `${symbol}${(cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

type Share = { person: Person; shareCents: number };

/**
 * Calculates the cash returned by the counter. Change is returned cash, not
 * part of the shared expense.
 */
export function calculateChange(totalCents: number, people: Person[]): number {
  const paidTotal = people.reduce((sum, person) => sum + person.paid, 0);
  return Math.max(0, paidTotal - totalCents);
}

/**
 * Assigns change back only to the people who handed over cash, in proportion
 * to their original contribution. Largest-remainder rounding keeps the
 * allocation in whole cents and guarantees it sums to the change received.
 */
export function allocateChange(changeCents: number, people: Person[]): ChangeReturn[] {
  const paidTotal = people.reduce((sum, person) => sum + person.paid, 0);
  if (!people.length || changeCents <= 0 || paidTotal <= 0) return [];

  const allocations = people.map((person, index) => {
    const exactNumerator = person.paid * changeCents;
    return {
      person,
      index,
      amount: Math.floor(exactNumerator / paidTotal),
      remainder: exactNumerator % paidTotal,
    };
  });
  let remainder = changeCents - allocations.reduce((sum, change) => sum + change.amount, 0);
  const byLargestRemainder = [...allocations].sort(
    (a, b) => b.remainder - a.remainder || a.index - b.index,
  );
  for (let index = 0; index < remainder; index += 1) {
    byLargestRemainder[index].amount += 1;
  }

  return people
    .map((person) => allocations.find((change) => change.person.id === person.id)!)
    .filter((change) => change.amount > 0);
}

/**
 * Subtracts returned change from the original cash contributions. These are
 * the amounts that actually went toward the bill.
 */
export function calculateEffectiveContributions(
  people: Person[],
  changeReturns: ChangeReturn[],
): Person[] {
  const returnedByPerson = new Map(
    changeReturns.map((change) => [change.person.id, change.amount]),
  );
  return people.map((person) => ({
    ...person,
    paid: person.paid - (returnedByPerson.get(person.id) ?? 0),
  }));
}

export function calculateBalances(
  totalCents: number,
  people: Person[],
  shares?: Share[],
): Array<{ person: Person; balance: number }> {
  const defaultShare = Math.floor(totalCents / people.length);
  let remainder = totalCents % people.length;
  return people.map((person) => {
    const custom = shares?.find((share) => share.person.id === person.id);
    const shareCents = custom?.shareCents ?? defaultShare + (remainder-- > 0 ? 1 : 0);
    return { person, balance: person.paid - shareCents };
  });
}

/**
 * Splits a bill into exact integer cents, then matches debtors to creditors.
 * The optional shares argument keeps the calculation ready for unequal shares.
 */
export function calculateSettlement(
  totalCents: number,
  people: Person[],
  shares?: Share[],
): Settlement[] {
  if (!people.length || totalCents < 0) return [];

  const balances = calculateBalances(totalCents, people, shares);

  const debtors = balances
    .filter((entry) => entry.balance < 0)
    .map((entry) => ({ ...entry, amount: -entry.balance }))
    .sort((a, b) => b.amount - a.amount);
  const creditors = balances
    .filter((entry) => entry.balance > 0)
    .map((entry) => ({ ...entry, amount: entry.balance }))
    .sort((a, b) => b.amount - a.amount);

  const settlements: Settlement[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;
  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amount = Math.min(debtor.amount, creditor.amount);
    if (amount > 0) {
      settlements.push({ from: debtor.person, to: creditor.person, amount });
    }
    debtor.amount -= amount;
    creditor.amount -= amount;
    if (debtor.amount === 0) debtorIndex += 1;
    if (creditor.amount === 0) creditorIndex += 1;
  }
  return settlements;
}

export const calculateSettlements = calculateSettlement;