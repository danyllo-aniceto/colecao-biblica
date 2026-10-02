-- Perguntas ligadas a um cenário da campanha
ALTER TABLE "questions" ADD COLUMN "scenario_id" INTEGER;

CREATE INDEX "questions_active_scenario_id_idx" ON "questions"("active", "scenario_id");

ALTER TABLE "questions" ADD CONSTRAINT "questions_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "scenarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
