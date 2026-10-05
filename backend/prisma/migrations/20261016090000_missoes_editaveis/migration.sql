-- Missões diárias e semanais passam a ser cadastradas (seed + painel), com prêmio de moedas e/ou recompensa
CREATE TABLE "missions" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "target" INTEGER NOT NULL,
    "reward_coins" INTEGER NOT NULL DEFAULT 0,
    "reward_definition_id" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "system" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "missions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "missions_code_key" ON "missions"("code");

ALTER TABLE "missions" ADD CONSTRAINT "missions_reward_definition_id_fkey" FOREIGN KEY ("reward_definition_id") REFERENCES "reward_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
