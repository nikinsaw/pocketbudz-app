import type { Db } from './resolve.js';
import { levelsForOwner } from './resolve.js';

// Fixes who can see a private transaction (personal envelope or no envelope) as of
// now, from the owner's current sharing settings. Later setting changes don't touch
// these rows, so a change only applies to future transactions. Absent row = NONE.
// Shared-envelope spending is visible to the household and is never stamped.
export async function stampVisibility(
  db: Db,
  transactionId: string,
  owner: { id: string; householdId: string },
) {
  await db.transactionVisibility.deleteMany({ where: { transactionId } });
  const levels = await levelsForOwner(db, owner);
  const rows = levels
    .filter((entry) => entry.level !== 'NONE')
    .map((entry) => ({ transactionId, viewerId: entry.viewerId, level: entry.level }));
  if (rows.length > 0) {
    await db.transactionVisibility.createMany({ data: rows });
  }
}

export function clearVisibility(db: Db, transactionId: string) {
  return db.transactionVisibility.deleteMany({ where: { transactionId } });
}
