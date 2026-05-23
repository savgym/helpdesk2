-- AlterTable
-- Runs in a separate transaction so 'NEW' enum value is already committed.
ALTER TABLE "Ticket" ALTER COLUMN "status" SET DEFAULT 'NEW';
