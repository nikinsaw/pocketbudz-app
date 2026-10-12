import type { PrismaClient } from '@prisma/client';
import { createAccountService } from './account/service.js';
import { createAllowanceService } from './allowances/service.js';
import { createDashboardService } from './dashboard/service.js';
import type { GoogleVerifier } from './auth/googleVerifier.js';
import { createAuthService } from './auth/service.js';
import { createEnvelopeService } from './envelopes/service.js';
import { createHouseholdService } from './households/service.js';
import { createImportService } from './importer/service.js';
import { createIncomeService } from './income/service.js';
import { createMemberService } from './members/service.js';
import { createTransactionService } from './transactions/service.js';
import { createVisibilityService } from './visibility/service.js';

// Single composition root: server.ts and the tests both build the app from this,
// so adding a module means touching only this file and its own routes.
export function createServices(prisma: PrismaClient, verifyGoogle: GoogleVerifier) {
  return {
    auth: createAuthService(prisma, verifyGoogle),
    households: createHouseholdService(prisma),
    envelopes: createEnvelopeService(prisma),
    transactions: createTransactionService(prisma),
    income: createIncomeService(prisma),
    visibility: createVisibilityService(prisma),
    allowances: createAllowanceService(prisma),
    members: createMemberService(prisma),
    importer: createImportService(prisma),
    account: createAccountService(prisma),
    dashboard: createDashboardService(prisma),
  };
}

export type Services = ReturnType<typeof createServices>;
