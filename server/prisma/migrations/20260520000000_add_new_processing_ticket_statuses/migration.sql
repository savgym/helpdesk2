-- AlterEnum
-- NOTE: ADD VALUE runs in its own transaction so the new values are committed
-- before being referenced in the next migration.
ALTER TYPE "TicketStatus" ADD VALUE 'NEW';
ALTER TYPE "TicketStatus" ADD VALUE 'PROCESSING';
