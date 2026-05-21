-- AlterEnum
ALTER TYPE "TicketStatus" ADD VALUE 'NEW';
ALTER TYPE "TicketStatus" ADD VALUE 'PROCESSING';

-- AlterTable
ALTER TABLE "Ticket" ALTER COLUMN "status" SET DEFAULT 'NEW';
