-- CreateEnum
CREATE TYPE "note_color" AS ENUM ('yellow', 'green', 'red');

-- AlterTable
ALTER TABLE "leads" ADD COLUMN "note_color" "note_color";
