-- A NULL viewerId means "everyone". Postgres treats NULLs as distinct in the
-- (ownerId, viewerId) unique constraint, so enforce one such row per owner here.
CREATE UNIQUE INDEX "VisibilityGrant_ownerId_everyone_key" ON "VisibilityGrant"("ownerId") WHERE "viewerId" IS NULL;
