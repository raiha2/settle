import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  CirclePlus,
  Copy,
  Link2,
  Plus,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
  WalletCards,
  WandSparkles,
} from 'lucide-react';
import {
  allocateChange,
  calculateChange,
  calculateEffectiveContributions,
  calculateSettlement,
  formatMoney,
  parseMoneyToCents,
  type ChangeReturn,
  type Currency,
  type Person,
  type Settlement,
} from './lib/settle';

type Screen = 'welcome' | 'calculator' | 'result';
type FormPerson = { id: string; name: string; paid: string };
type FormErrors = { bill?: string; people?: string; payments?: string };

const currencies: Currency[] = [
  { code: 'PKR', symbol: '₨' },
  { code: 'USD', symbol: '$' },
  { code: 'GBP', symbol: '£' },
  { code: 'EUR', symbol: '€' },
];

const defaultPeople: FormPerson[] = [
  { id: 'person-1', name: 'You', paid: '' },
  { id: 'person-2', name: 'Aisha', paid: '' },
  { id: 'person-3', name: 'Sam', paid: '' },
];

function App() {
  const [screen, setScreen] = useState<Screen>('welcome');
  const [currency, setCurrency] = useState<Currency>(currencies[0]);
  const [billInput, setBillInput] = useState('');
  const [people, setPeople] = useState<FormPerson[]>(defaultPeople);
  const [errors, setErrors] = useState<FormErrors>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [changeReturns, setChangeReturns] = useState<ChangeReturn[]>([]);
  const [resultPeople, setResultPeople] = useState<Person[]>([]);
  const [resultTotal, setResultTotal] = useState(0);
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  const hasMeaningfulData =
    billInput.trim() !== '' ||
    people.some((person, index) => person.name !== defaultPeople[index]?.name || person.paid !== '');

  const updatePerson = (id: string, key: 'name' | 'paid', value: string) => {
    setPeople((current) => current.map((person) => (person.id === id ? { ...person, [key]: value } : person)));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[`${id}-${key}`];
      delete next.payments;
      return next;
    });
    setErrors((current) => ({ ...current, people: undefined, payments: undefined }));
  };

  const addPerson = () => {
    setPeople((current) => [
      ...current,
      { id: `person-${Date.now()}`, name: '', paid: '' },
    ]);
  };

  const removePerson = (id: string) => {
    if (people.length <= 2) return;
    setPeople((current) => current.filter((person) => person.id !== id));
  };

  const finishCalculation = (totalCents: number, parsedPeople: Person[]) => {
    setResultPeople(parsedPeople);
    setResultTotal(totalCents);
    const changeTotal = calculateChange(totalCents, parsedPeople);
    const calculatedChange = allocateChange(changeTotal, parsedPeople);
    const effectiveContributions = calculateEffectiveContributions(parsedPeople, calculatedChange);
    setChangeReturns(calculatedChange);
    setSettlements(calculateSettlement(totalCents, effectiveContributions));
    setScreen('result');
    setCopied(false);
    setShared(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const calculate = () => {
    const nextErrors: FormErrors = {};
    const nextFieldErrors: Record<string, string> = {};
    const totalCents = parseMoneyToCents(billInput);

    if (totalCents === null || totalCents <= 0) {
      nextErrors.bill = 'Enter a bill total greater than 0.';
    }
    if (people.length < 2) nextErrors.people = 'Add at least two people.';

    const parsedPeople: Person[] = people.map((person) => {
      const name = person.name.trim();
      const paidCents = parseMoneyToCents(person.paid);
      if (!name) nextFieldErrors[`${person.id}-name`] = 'Add a name.';
      if (paidCents === null) nextFieldErrors[`${person.id}-paid`] = 'Enter 0 or an amount.';
      return { id: person.id, name, paid: paidCents ?? 0 };
    });

    const allPaymentsEntered = people.every((person) => person.paid.trim() !== '');
    if (!allPaymentsEntered) nextErrors.payments = 'Add what everyone paid. Use 0 for anyone who paid nothing.';

    const paidTotal = parsedPeople.reduce((sum, person) => sum + person.paid, 0);
    if (totalCents !== null && allPaymentsEntered && paidTotal < totalCents) {
      nextErrors.payments = `Payments are short by ${formatMoney(totalCents - paidTotal, currency.symbol)}. The bill is ${formatMoney(totalCents, currency.symbol)}, but only ${formatMoney(paidTotal, currency.symbol)} was handed over.`;
    }

    setErrors(nextErrors);
    setFieldErrors(nextFieldErrors);
    if (Object.keys(nextErrors).length || Object.keys(nextFieldErrors).length || totalCents === null) return;

    finishCalculation(totalCents, parsedPeople);
  };

  const startNewBill = () => {
    if (hasMeaningfulData && !window.confirm('Start a new bill? Your current entries will be cleared.')) return;
    setBillInput('');
    setPeople(defaultPeople.map((person) => ({ ...person })));
    setErrors({});
    setFieldErrors({});
    setSettlements([]);
    setChangeReturns([]);
    setResultPeople([]);
    setResultTotal(0);
    setCopied(false);
    setShared(false);
    setScreen('calculator');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const settlementText = useMemo(() => {
    const changeText = changeReturns.length
      ? [
          `Change received: ${formatMoney(changeReturns.reduce((sum, change) => sum + change.amount, 0), currency.symbol)}`,
          ...changeReturns.map(({ person, amount }) => `${person.name} gets back ${formatMoney(amount, currency.symbol)}`),
        ].join('\n')
      : '';
    const transferText = settlements.length
      ? settlements
          .map(({ from, to, amount }) => `${from.name} pays ${to.name} ${formatMoney(amount, currency.symbol)}`)
          .join('\n')
      : '';
    return [changeText, transferText].filter(Boolean).join('\n\n') || 'Everyone is settled up.';
  }, [changeReturns, currency.symbol, settlements]);

  const copyResults = async () => {
    const cashHandedOver = resultPeople.reduce((sum, person) => sum + person.paid, 0);
    const text = [
      'SETTLE — Group Bill',
      `Bill: ${formatMoney(resultTotal, currency.symbol)}`,
      `Cash handed over: ${formatMoney(cashHandedOver, currency.symbol)}`,
      '',
      settlementText,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  const shareResults = async () => {
    const cashHandedOver = resultPeople.reduce((sum, person) => sum + person.paid, 0);
    const text = [
      'SETTLE — Group Bill',
      `Bill: ${formatMoney(resultTotal, currency.symbol)}`,
      `Cash handed over: ${formatMoney(cashHandedOver, currency.symbol)}`,
      '',
      settlementText,
    ].join('\n');
    if (navigator.share) {
      await navigator.share({ title: 'SETTLE', text }).catch(() => undefined);
      setShared(true);
      window.setTimeout(() => setShared(false), 2200);
      return;
    }
    await copyResults();
  };

  if (screen === 'welcome') {
    return <Welcome onStart={() => setScreen('calculator')} />;
  }

  return (
    <main className="app-shell">
      <div className="mx-auto min-h-[100dvh] w-full max-w-6xl px-5 pb-12 sm:px-8">
        <Header onNewBill={startNewBill} showNew />
        {screen === 'calculator' ? (
          <Calculator
            currency={currency}
            setCurrency={setCurrency}
            billInput={billInput}
            setBillInput={(value) => {
              setBillInput(value);
              setErrors((current) => ({ ...current, bill: undefined, payments: undefined }));
            }}
            people={people}
            updatePerson={updatePerson}
            addPerson={addPerson}
            removePerson={removePerson}
            errors={errors}
            fieldErrors={fieldErrors}
            onCalculate={calculate}
          />
        ) : (
          <Results
            currency={currency}
            total={resultTotal}
            people={resultPeople}
            changeReturns={changeReturns}
            settlements={settlements}
            settlementText={settlementText}
            copied={copied}
            shared={shared}
            onCopy={copyResults}
            onShare={shareResults}
            onEdit={() => setScreen('calculator')}
            onNewBill={startNewBill}
          />
        )}
      </div>
    </main>
  );
}

function Header({ onNewBill, showNew }: { onNewBill: () => void; showNew: boolean }) {
  return (
    <header className="flex items-center justify-between py-6 sm:py-8">
      <div className="flex items-center gap-2.5" data-testid="brand-settle">
        <span className="grid size-9 place-items-center rounded-xl bg-secondary text-primary-foreground shadow-sm">
          <WalletCards size={18} strokeWidth={2.5} />
        </span>
        <span className="wordmark text-[1.55rem] font-bold leading-none">SETTLE</span>
      </div>
      {showNew && (
        <button className="btn btn-quiet text-sm" onClick={onNewBill} data-testid="button-start-new-header">
          <RotateCcw size={15} />
          New bill
        </button>
      )}
    </header>
  );
}

function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <main className="app-shell">
      <div className="mx-auto flex min-h-[100dvh] max-w-6xl flex-col px-5 sm:px-8">
        <Header onNewBill={onStart} showNew={false} />
        <section className="flex flex-1 items-center py-12 sm:py-16">
          <div className="grid w-full items-center gap-14 lg:grid-cols-[1.08fr_.92fr] lg:gap-20">
            <div className="settle-in">
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3.5 py-2 text-xs font-bold uppercase tracking-[.16em] text-secondary">
                <Sparkles size={14} className="text-primary" />
                A tiny bill companion
              </div>
              <h1 className="display max-w-xl text-[clamp(3.3rem,8vw,6.8rem)] font-semibold leading-[.91] text-foreground">
                Stop doing<br /><span className="text-primary">group-bill</span> math.
              </h1>
              <p className="mt-7 max-w-md text-lg leading-8 text-muted-foreground">
                Add what everyone paid. We’ll figure out the rest.
                Clear transfers, no account, no awkward spreadsheet.
              </p>
              <button className="btn btn-primary mt-9 min-w-48" onClick={onStart} data-testid="button-start-bill">
                Start a bill
                <ArrowRight size={18} />
              </button>
              <p className="mt-5 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Check size={14} className="text-secondary" />
                Everything stays in your browser
              </p>
            </div>
            <div className="relative mx-auto w-full max-w-[26rem] settle-in settle-in-delay-2">
              <div className="absolute -right-5 -top-7 size-20 rounded-full bg-accent/70 blur-[1px] sm:-right-8" />
              <div className="float-soft relative rounded-[2rem] border border-border bg-card p-5 shadow-[0_22px_60px_hsl(229_34%_18%/.13)] sm:p-7">
                <div className="mb-8 flex items-start justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[.15em] text-muted-foreground">Friday dinner</p>
                    <p className="display mt-2 text-3xl font-semibold">₨ 5,700.00</p>
                  </div>
                  <span className="rounded-full bg-accent px-3 py-1.5 text-xs font-bold text-accent-foreground">4 friends</span>
                </div>
                <div className="space-y-3.5">
                  <MockRow name="You" amount="₨ 3,000" tint="bg-primary" />
                  <MockRow name="Aisha" amount="₨ 1,200" tint="bg-secondary" />
                  <MockRow name="Sam" amount="₨ 1,500" tint="bg-accent" />
                  <MockRow name="Rafi" amount="₨ 0" tint="bg-muted" />
                </div>
                <div className="mt-7 rounded-xl bg-secondary px-4 py-3.5 text-primary-foreground">
                  <div className="flex items-center justify-between text-xs opacity-75">
                    <span>One clean answer</span><ArrowRight size={14} />
                  </div>
                  <p className="mt-1.5 text-sm font-bold">Rafi pays You ₨ 1,425.00</p>
                </div>
              </div>
              <div className="absolute -bottom-5 -left-5 -z-0 size-24 rounded-full border-[14px] border-primary/20 sm:-left-10" />
            </div>
          </div>
        </section>
        <footer className="flex items-center justify-between border-t border-border/70 py-5 text-xs text-muted-foreground">
          <span>Made for the “who owes who?” moment.</span>
          <span className="hidden sm:block">No sign in · No tracking</span>
        </footer>
      </div>
    </main>
  );
}

function MockRow({ name, amount, tint }: { name: string; amount: string; tint: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className={`size-8 rounded-full ${tint} grid place-items-center text-[11px] font-bold text-foreground`}>
          {name.slice(0, 1)}
        </span>
        <span className="text-sm font-semibold">{name}</span>
      </div>
      <span className="text-sm font-medium text-muted-foreground">{amount}</span>
    </div>
  );
}

type CalculatorProps = {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  billInput: string;
  setBillInput: (value: string) => void;
  people: FormPerson[];
  updatePerson: (id: string, key: 'name' | 'paid', value: string) => void;
  addPerson: () => void;
  removePerson: (id: string) => void;
  errors: FormErrors;
  fieldErrors: Record<string, string>;
  onCalculate: () => void;
};

function Calculator({
  currency,
  setCurrency,
  billInput,
  setBillInput,
  people,
  updatePerson,
  addPerson,
  removePerson,
  errors,
  fieldErrors,
  onCalculate,
}: CalculatorProps) {
  return (
    <section className="mx-auto max-w-4xl pb-8 pt-5 sm:pt-10">
      <div className="settle-in mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-[.17em] text-primary">New bill</p>
          <h1 className="display text-4xl font-semibold leading-none sm:text-5xl" data-testid="text-calculator-title">Let’s settle up.</h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">A couple of details, then you can get back to the good part.</p>
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_1.17fr]">
          <div className="space-y-5">
            <section className="card settle-in settle-in-delay-1 p-5 sm:p-6">
              <SectionHeading number="01" title="The bill" />
              <label className="mt-6 block text-sm font-semibold" htmlFor="bill-total">Total bill</label>
              <div className="mt-2 flex gap-2">
                <CurrencySelect currency={currency} setCurrency={setCurrency} />
                <input
                  id="bill-total"
                  className="field money-field text-xl font-bold"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={billInput}
                  onChange={(event) => setBillInput(event.target.value)}
                  data-testid="input-bill-total"
                  aria-invalid={Boolean(errors.bill)}
                />
              </div>
              {errors.bill && <p className="error-note" data-testid="error-bill-total">{errors.bill}</p>}
               <p className="mt-3 text-xs leading-5 text-muted-foreground">Use up to two decimal places. Extra cash is okay — we’ll show the change back.</p>
            </section>
            <section className="card settle-in settle-in-delay-2 p-5 sm:p-6">
              <SectionHeading number="02" title="The currency" />
              <div className="mt-5 grid grid-cols-4 gap-2">
                {currencies.map((option) => (
                  <button
                    key={option.code}
                    className={`rounded-lg border px-2 py-3 text-center text-xs font-bold transition-colors ${currency.code === option.code ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card/50 text-muted-foreground hover:border-primary/50'}`}
                    onClick={() => setCurrency(option)}
                    data-testid={`button-currency-${option.code.toLowerCase()}`}
                    aria-pressed={currency.code === option.code}
                  >
                    <span className="block text-base">{option.symbol}</span>
                    {option.code}
                  </button>
                ))}
              </div>
            </section>
            <div className="hidden rounded-xl border border-dashed border-border p-4 text-xs leading-5 text-muted-foreground lg:block">
              <div className="flex items-center gap-2 font-bold text-foreground"><WandSparkles size={14} className="text-primary" /> The nice bit</div>
              <p className="mt-2">SETTLE matches who paid too much with who paid too little, using as few transfers as possible.</p>
            </div>
          </div>
          <section className="card settle-in settle-in-delay-2 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <SectionHeading number="03" title="Who handed over what?" />
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-bold text-muted-foreground">{people.length} people</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">Add everyone, including anyone who paid nothing. If the group handed over too much, we’ll split the change back.</p>
            <div className="mt-6 space-y-3">
              {people.map((person, index) => (
                <PersonRow
                  key={person.id}
                  person={person}
                  index={index}
                  canRemove={people.length > 2}
                  fieldErrors={fieldErrors}
                  onChange={updatePerson}
                  onRemove={removePerson}
                  currency={currency}
                />
              ))}
            </div>
            {errors.payments && <p className="error-note mt-4 rounded-lg bg-destructive/10 p-3" data-testid="error-payments">{errors.payments}</p>}
            {errors.people && <p className="error-note mt-4" data-testid="error-people">{errors.people}</p>}
            <button className="btn btn-outline mt-5 w-full border-dashed text-sm" onClick={addPerson} data-testid="button-add-person">
              <CirclePlus size={17} className="text-primary" />
              Add another person
            </button>
            <button className="btn btn-secondary mt-4 w-full" onClick={onCalculate} data-testid="button-calculate">
              Show me the answer
              <ArrowRight size={18} />
            </button>
          </section>
      </div>
    </section>
  );
}

function SectionHeading({ number, title }: { number: string; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-bold tracking-[.15em] text-primary">{number}</span>
      <h2 className="text-lg font-bold">{title}</h2>
    </div>
  );
}

function CurrencySelect({ currency, setCurrency }: { currency: Currency; setCurrency: (currency: Currency) => void }) {
  return (
    <label className="relative flex min-w-[5.5rem] items-center">
      <select
        className="field appearance-none pr-8 font-bold"
        value={currency.code}
        onChange={(event) => setCurrency(currencies.find((item) => item.code === event.target.value) ?? currencies[0])}
        data-testid="select-currency"
        aria-label="Currency"
      >
        {currencies.map((item) => <option key={item.code} value={item.code}>{item.code}</option>)}
      </select>
      <ChevronDown size={15} className="pointer-events-none absolute right-3 text-muted-foreground" />
    </label>
  );
}

function PersonRow({
  person,
  index,
  canRemove,
  fieldErrors,
  onChange,
  onRemove,
  currency,
}: {
  person: FormPerson;
  index: number;
  canRemove: boolean;
  fieldErrors: Record<string, string>;
  onChange: (id: string, key: 'name' | 'paid', value: string) => void;
  onRemove: (id: string) => void;
  currency: Currency;
}) {
  const nameError = fieldErrors[`${person.id}-name`];
  const paidError = fieldErrors[`${person.id}-paid`];
  return (
    <div className="group rounded-xl border border-border/80 bg-background/45 p-3">
      <div className="flex items-center gap-2">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-accent-foreground">{index + 1}</span>
        <div className="min-w-0 flex-1">
          <input
            className="field min-h-11 border-0 bg-transparent px-2 py-1.5 font-semibold shadow-none focus:bg-card"
            placeholder={`Person ${index + 1}`}
            value={person.name}
            onChange={(event) => onChange(person.id, 'name', event.target.value)}
            data-testid={`input-person-name-${person.id}`}
            aria-label={`Person ${index + 1} name`}
            aria-invalid={Boolean(nameError)}
          />
        </div>
        <div className="relative w-[7.8rem] shrink-0">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">{currency.symbol}</span>
          <input
            className="field money-field min-h-11 pl-7 pr-2 text-sm font-bold"
            inputMode="decimal"
            placeholder="0.00"
            value={person.paid}
            onChange={(event) => onChange(person.id, 'paid', event.target.value)}
            data-testid={`input-person-paid-${person.id}`}
            aria-label={`${person.name || `Person ${index + 1}`} handed over amount`}
            aria-invalid={Boolean(paidError)}
          />
        </div>
        <button
          className={`grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive ${!canRemove ? 'invisible' : ''}`}
          onClick={() => onRemove(person.id)}
          disabled={!canRemove}
          aria-label={`Remove ${person.name || `person ${index + 1}`}`}
          data-testid={`button-remove-person-${person.id}`}
        >
          <Trash2 size={16} />
        </button>
      </div>
      {(nameError || paidError) && <p className="error-note ml-9">{nameError || paidError}</p>}
    </div>
  );
}

function Results({
  currency,
  total,
  people,
  changeReturns,
  settlements,
  settlementText,
  copied,
  shared,
  onCopy,
  onShare,
  onEdit,
  onNewBill,
}: {
  currency: Currency;
  total: number;
  people: Person[];
  changeReturns: ChangeReturn[];
  settlements: Settlement[];
  settlementText: string;
  copied: boolean;
  shared: boolean;
  onCopy: () => void;
  onShare: () => void;
  onEdit: () => void;
  onNewBill: () => void;
}) {
  const sharePerPerson = people.length ? Math.floor(total / people.length) : 0;
  const cashHandedOver = people.reduce((sum, person) => sum + person.paid, 0);
  const changeTotal = changeReturns.reduce((sum, change) => sum + change.amount, 0);
  return (
    <section className="mx-auto max-w-3xl pb-10 pt-8 sm:pt-14">
      <div className="settle-in text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-accent text-secondary shadow-sm"><Check size={27} strokeWidth={2.5} /></div>
        <p className="mt-6 text-xs font-bold uppercase tracking-[.17em] text-primary">The answer</p>
        <h1 className="display mt-3 text-5xl font-semibold leading-none sm:text-6xl" data-testid="text-results-title">You’re all settled.</h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-muted-foreground">Here’s the shortest path from “I’ll work it out later” to done.</p>
      </div>
      <div className="card settle-in settle-in-delay-1 mt-9 overflow-hidden">
        <div className="border-b border-border bg-secondary px-5 py-5 text-primary-foreground sm:px-7">
           <div className="flex items-center justify-between text-xs font-medium opacity-75"><span>Total bill</span><span>{people.length} people</span></div>
          <p className="display mt-2 text-4xl font-semibold" data-testid="text-result-total">{formatMoney(total, currency.symbol)}</p>
           <div className="mt-3 flex items-center justify-between border-t border-primary-foreground/15 pt-3 text-xs opacity-75">
             <span>Cash handed over</span>
             <span className="font-bold">{formatMoney(cashHandedOver, currency.symbol)}</span>
           </div>
           <p className="mt-2 text-xs opacity-75">{formatMoney(sharePerPerson, currency.symbol)} each, split evenly</p>
        </div>
        <div className="p-5 sm:p-7">
           <div className="space-y-4" data-testid="list-settlements">
             {changeReturns.length > 0 && (
               <div className="rounded-xl border border-accent/60 bg-accent/25 p-4" data-testid="change-summary">
                 <div className="flex items-start justify-between gap-3">
                   <div>
                   <p className="text-xs font-bold uppercase tracking-[.14em] text-secondary">Change received</p>
                     <p className="mt-1 text-lg font-bold">{formatMoney(changeTotal, currency.symbol)} total</p>
                   </div>
                   <span className="grid size-9 place-items-center rounded-full bg-accent text-secondary"><RotateCcw size={16} /></span>
                 </div>
                 <p className="mt-2 text-xs leading-5 text-muted-foreground">Returned only to the people who handed over cash, in proportion to what they contributed.</p>
                 <p className="mt-4 text-xs font-bold uppercase tracking-[.14em] text-muted-foreground">Change returned to</p>
                 <div className="mt-2 space-y-2">
                   {changeReturns.map(({ person, amount }) => (
                     <div className="flex items-center justify-between gap-3 text-sm" key={person.id}>
                       <span className="font-semibold">{person.name} gets back</span>
                       <span className="font-bold tabular-nums">{formatMoney(amount, currency.symbol)}</span>
                    </div>
                   ))}
                 </div>
               </div>
             )}
             {settlements.length > 0 && (
               <div className="space-y-3">
                  <p className="text-xs font-bold uppercase tracking-[.14em] text-muted-foreground">Final settlement</p>
                 {settlements.map((settlement, index) => (
                   <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background/55 p-4" key={`${settlement.from.id}-${settlement.to.id}-${index}`} data-testid={`settlement-${index}`}>
                     <div className="flex min-w-0 items-center gap-3">
                       <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-bold text-primary">{settlement.from.name.slice(0, 1)}</span>
                       <div className="min-w-0">
                         <p className="truncate text-sm font-bold">{settlement.from.name} <span className="font-normal text-muted-foreground">pays</span></p>
                         <p className="flex items-center gap-1.5 text-sm font-bold text-secondary"><ArrowRight size={13} /> {settlement.to.name}</p>
                       </div>
                     </div>
                     <span className="shrink-0 text-lg font-bold tabular-nums">{formatMoney(settlement.amount, currency.symbol)}</span>
                   </div>
                 ))}
               </div>
             )}
             {!settlements.length && !changeReturns.length && (
               <div className="rounded-xl bg-accent/45 px-5 py-7 text-center" data-testid="status-no-payments">
                 <Check size={24} className="mx-auto text-secondary" />
                 <p className="mt-3 font-bold">No payments needed.</p>
                 <p className="mt-1 text-sm text-muted-foreground">Everyone paid their fair share already.</p>
               </div>
             )}
             {changeReturns.length > 0 && !settlements.length && (
               <div className="rounded-xl bg-accent/45 px-5 py-5 text-center" data-testid="status-no-transfers">
                 <Check size={24} className="mx-auto text-secondary" />
                 <p className="mt-3 font-bold">No payments between people.</p>
                 <p className="mt-1 text-sm text-muted-foreground">Once the change is returned, everyone has paid their fair share.</p>
               </div>
             )}
           </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button className="btn btn-secondary flex-1" onClick={onShare} data-testid="button-share-results">
              {shared ? <Check size={17} /> : <Send size={17} />}
              {shared ? 'Shared' : 'Share result'}
            </button>
            <button className="btn btn-outline flex-1" onClick={onCopy} data-testid="button-copy-results">
              {copied ? <Check size={17} /> : <Copy size={17} />}
              {copied ? 'Copied' : 'Copy transfers'}
            </button>
          </div>
        </div>
      </div>
      <div className="settle-in settle-in-delay-2 mt-5 grid gap-5 sm:grid-cols-[1fr_auto]">
        <div className="card p-5">
          <p className="text-xs font-bold uppercase tracking-[.14em] text-muted-foreground">Quick summary</p>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div><p className="text-2xl font-bold">{people.length}</p><p className="text-xs text-muted-foreground">people included</p></div>
            <div><p className="text-2xl font-bold">{settlements.length}</p><p className="text-xs text-muted-foreground">transfers to make</p></div>
          </div>
        </div>
        <div className="flex gap-2 sm:flex-col">
          <button className="btn btn-outline flex-1 text-sm sm:min-w-36" onClick={onEdit} data-testid="button-edit-bill"><ArrowLeft size={15} /> Edit bill</button>
          <button className="btn btn-primary flex-1 text-sm sm:min-w-36" onClick={onNewBill} data-testid="button-start-new-result"><Plus size={16} /> New bill</button>
        </div>
      </div>
      <div className="mt-7 text-center">
        <p className="inline-flex items-center gap-2 text-xs text-muted-foreground"><Link2 size={13} /> No accounts. No bill history. Just the answer.</p>
      </div>
    </section>
  );
}

export default App;