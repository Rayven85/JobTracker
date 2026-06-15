-- CreateEnum
CREATE TYPE "ExtractionStatus" AS ENUM ('PENDING', 'READY', 'EMPTY', 'FAILED');

-- AlterTable
ALTER TABLE "resumes" ADD COLUMN     "extractionStatus" "ExtractionStatus" NOT NULL DEFAULT 'PENDING';

-- Backfill existing rows from their parsedText so they don't show as "processing"
UPDATE "resumes" SET "extractionStatus" = 'READY' WHERE "parsedText" IS NOT NULL AND length(trim("parsedText")) > 0;
UPDATE "resumes" SET "extractionStatus" = 'EMPTY' WHERE "parsedText" IS NOT NULL AND length(trim("parsedText")) = 0;
