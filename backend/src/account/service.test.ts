import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../db.js';
import { createEnvelopeService } from '../envelopes/service.js';
import { makeHousehold, makeUser, resetDb } from '../households/testUtils.js';
import { createImportService } from '../importer/service.js';
import { createIncomeService } from '../income/service.js';
import { createTransactionService } from '../transactions/service.js';
import { createVisibilityService } from '../visibility/service.js';
import { createAccountService } from './service.js';

const account = createAccountService(prisma);
const envelopes = createEnvelopeService(prisma);
const transactions = createTransactionService(prisma);
const income = createIncomeService(prisma);
const visibility = createVisibilityService(prisma);
const fields = { categoryKey: 'food', icon: '🍕', title: 'Food', colorKey: 'food', type: 'spending', budgetLimit: 800050 };
const tx = (merchant: string, extra = {}) => ({ envelopeId: null, merchant, category: 'Food', amount: 19999, date: '2026-10-02', ...extra });

beforeEach(() => resetDb(prisma));
afterAll(() => prisma.$disconnect());

async function setup() {
  const owner = await makeUser(prisma, 'owner');
  const spender = await makeUser(prisma, 'spender');
  const household = await makeHousehold(prisma, [
    { userId: owner.id, role: 'OWNER' },
    { userId: spender.id, role: 'SPENDER' },
  ]);
  await prisma.consentRecord.create({ data: { userId: spender.id, version: '2026-10-v1' } });
  return { owner, spender, household };
}

describe('household export', () => {
  it("contains the caller's own data in rupees, plus shared envelopes", async () => {
    const { owner, spender, household } = await setup();
    const shared = await envelopes.create(owner.id, household.id, { ...fields, title: 'Rent', scope: 'SHARED' });
    await envelopes.create(spender.id, household.id, { ...fields, title: 'Pocket money', scope: 'PERSONAL' });
    await transactions.create(spender.id, household.id, tx('Cafe', { envelopeId: shared.id }));
    await transactions.create(spender.id, household.id, tx('Game'));

    const data = await account.exportHousehold(spender.id, household.id);
    expect(data.role).toBe('SPENDER');
    expect(data.envelopes.map((e) => [e.title, e.scope, e.budgetLimit]).sort()).toEqual([
      ['Pocket money', 'PERSONAL', 8000.5],
      ['Rent', 'SHARED', 8000.5],
    ]);
    expect(data.transactions.map((t) => [t.merchant, t.amount, t.envelope]).sort()).toEqual([
      ['Cafe', 199.99, 'Rent'],
      ['Game', 199.99, null],
    ]);
    expect(data.monthlyIncome).toBeNull();
  });

  it("never includes anyone else's private spending, envelopes or income", async () => {
    const { owner, spender, household } = await setup();
    await income.create(owner.id, household.id, { label: 'Salary', amount: 5000000 });
    await envelopes.create(owner.id, household.id, { ...fields, title: 'Owner secret', scope: 'PERSONAL' });
    await transactions.create(owner.id, household.id, tx('Owner private'));
    await visibility.set(spender.id, household.id, 'everyone', 'FULL');
    await transactions.create(spender.id, household.id, tx('Spender private'));

    const data = await account.exportHousehold(spender.id, household.id);
    expect(data.transactions.map((t) => t.merchant)).toEqual(['Spender private']);
    expect(data.envelopes).toEqual([]);
    expect(data.incomeSources).toEqual([]);
    expect(JSON.stringify(data)).not.toContain('Owner');
    expect(data.sharingSettings).toEqual([{ with: 'everyone', level: 'FULL' }]);
  });

  it('an earner exports their income as a monthly total', async () => {
    const { owner, household } = await setup();
    await income.create(owner.id, household.id, { label: 'Salary', amount: 5000000 });
    await income.create(owner.id, household.id, { label: 'Freelance', amount: 250050 });
    const data = await account.exportHousehold(owner.id, household.id);
    expect(data.monthlyIncome).toBe(52500.5);
    expect(data.incomeSources.map((i) => i.label)).toEqual(['Salary', 'Freelance']);
  });

  it('404s for non-members', async () => {
    const { household } = await setup();
    const outsider = await makeUser(prisma, 'outsider');
    await expect(account.exportHousehold(outsider.id, household.id)).rejects.toMatchObject({ status: 404 });
  });

  it('can be fed straight back into the solo import (round trip)', async () => {
    const { spender, household } = await setup();
    await envelopes.create(spender.id, household.id, { ...fields, scope: 'PERSONAL' });
    await transactions.create(spender.id, household.id, tx('Cafe'));
    const data = await account.exportHousehold(spender.id, household.id);

    const fresh = await makeUser(prisma, 'fresh');
    const home2 = await makeHousehold(prisma, [{ userId: fresh.id, role: 'SPENDER' }]);
    await createImportService(prisma).importSolo(fresh.id, home2.id, {
      envelopeScope: 'PERSONAL',
      monthlyIncome: data.monthlyIncome,
      envelopes: data.envelopes,
      transactions: data.transactions,
    });
    const copied = await prisma.transaction.findFirstOrThrow({ where: { householdId: home2.id }, include: { envelope: true } });
    expect([copied.merchant, copied.amount, copied.envelope?.title]).toEqual(['Cafe', 19999, 'Food']);
  });
});

describe('account export', () => {
  it('includes the profile, agreements and every current household', async () => {
    const { spender, household } = await setup();
    await transactions.create(spender.id, household.id, tx('Cafe'));
    const data = await account.exportAccount(spender.id);
    expect(data.account).toMatchObject({ email: 'spender@example.com', name: 'spender' });
    expect(data.agreements.map((a) => a.version)).toEqual(['2026-10-v1']);
    expect(data.households).toHaveLength(1);
    expect(data.households[0].transactions).toHaveLength(1);
  });

  it('is empty of households for a solo-mode account and 404s for unknown or deleted ones', async () => {
    const solo = await makeUser(prisma, 'solo');
    expect((await account.exportAccount(solo.id)).households).toEqual([]);
    await expect(account.exportAccount('nope')).rejects.toMatchObject({ status: 404 });
    await prisma.user.update({ where: { id: solo.id }, data: { deletedAt: new Date() } });
    await expect(account.exportAccount(solo.id)).rejects.toMatchObject({ status: 404 });
  });
});
