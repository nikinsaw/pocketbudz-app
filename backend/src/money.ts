// All money is stored as integer paise in Postgres INT (32-bit) columns, so a
// single amount can't exceed 2^31 - 1 paise (about ₹2.14 crore). Cap input a
// little below that so validation fails with a 400 instead of the DB with a 500.
export const MAX_PAISE = 2_000_000_000;

export const rupeesToPaise = (rupees: number) => Math.round(rupees * 100);
