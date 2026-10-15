-- Salas da corrida online (até 4 jogadores): lobby, largada marcada pelo servidor, posição de cada corredor e tempo oficial conferido.
CREATE TYPE "RunnerRoomStatus" AS ENUM ('LOBBY', 'RACING', 'FINISHED');

CREATE TABLE "runner_rooms" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "host_id" INTEGER NOT NULL,
    "status" "RunnerRoomStatus" NOT NULL DEFAULT 'LOBBY',
    "level_slug" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "start_at" TIMESTAMP(3),
    "first_finish_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "runner_rooms_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "runner_room_players" (
    "id" SERIAL NOT NULL,
    "room_id" INTEGER NOT NULL,
    "user_id" INTEGER,
    "slot" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "character_slug" TEXT,
    "bot" TEXT,
    "x" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "y" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "form" TEXT NOT NULL DEFAULT 'RUN',
    "dead" BOOLEAN NOT NULL DEFAULT false,
    "deaths" INTEGER NOT NULL DEFAULT 0,
    "words" INTEGER NOT NULL DEFAULT 0,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "finished" BOOLEAN NOT NULL DEFAULT false,
    "finish_ticks" INTEGER,
    "out" BOOLEAN NOT NULL DEFAULT false,
    "reported_at" TIMESTAMP(3),
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "runner_room_players_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "runner_rooms_code_key" ON "runner_rooms"("code");
CREATE INDEX "runner_rooms_status_updated_at_idx" ON "runner_rooms"("status", "updated_at");
CREATE UNIQUE INDEX "runner_room_players_room_id_slot_key" ON "runner_room_players"("room_id", "slot");
CREATE UNIQUE INDEX "runner_room_players_room_id_user_id_key" ON "runner_room_players"("room_id", "user_id");
CREATE INDEX "runner_room_players_user_id_idx" ON "runner_room_players"("user_id");

ALTER TABLE "runner_rooms" ADD CONSTRAINT "runner_rooms_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "runner_room_players" ADD CONSTRAINT "runner_room_players_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "runner_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "runner_room_players" ADD CONSTRAINT "runner_room_players_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
