-- Modo Tabuleiro online: salas, jogadores, convites e contador de vitórias
CREATE TYPE "BoardRoomStatus" AS ENUM ('LOBBY', 'PLAYING', 'FINISHED');

ALTER TABLE "users" ADD COLUMN "board_wins" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "board_rooms" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "host_id" INTEGER NOT NULL,
    "scenario_id" INTEGER NOT NULL,
    "status" "BoardRoomStatus" NOT NULL DEFAULT 'LOBBY',
    "config" JSONB NOT NULL,
    "state" JSONB,
    "pool" JSONB,
    "reveal" JSONB,
    "log" JSONB NOT NULL DEFAULT '[]',
    "version" INTEGER NOT NULL DEFAULT 1,
    "due_at" TIMESTAMP(3),
    "deadline_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "board_rooms_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "board_room_players" (
    "id" SERIAL NOT NULL,
    "room_id" INTEGER NOT NULL,
    "user_id" INTEGER,
    "slot" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "pawn" TEXT NOT NULL,
    "bot" TEXT,
    "replaced" BOOLEAN NOT NULL DEFAULT false,
    "afk_strikes" INTEGER NOT NULL DEFAULT 0,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "board_room_players_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "board_invites" (
    "id" SERIAL NOT NULL,
    "room_id" INTEGER NOT NULL,
    "from_user_id" INTEGER NOT NULL,
    "to_user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "board_invites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "board_rooms_code_key" ON "board_rooms"("code");
CREATE INDEX "board_rooms_status_updated_at_idx" ON "board_rooms"("status", "updated_at");
CREATE UNIQUE INDEX "board_room_players_room_id_slot_key" ON "board_room_players"("room_id", "slot");
CREATE UNIQUE INDEX "board_room_players_room_id_user_id_key" ON "board_room_players"("room_id", "user_id");
CREATE INDEX "board_room_players_user_id_idx" ON "board_room_players"("user_id");
CREATE UNIQUE INDEX "board_invites_room_id_to_user_id_key" ON "board_invites"("room_id", "to_user_id");
CREATE INDEX "board_invites_to_user_id_created_at_idx" ON "board_invites"("to_user_id", "created_at");

ALTER TABLE "board_rooms" ADD CONSTRAINT "board_rooms_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "board_rooms" ADD CONSTRAINT "board_rooms_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "board_room_players" ADD CONSTRAINT "board_room_players_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "board_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "board_room_players" ADD CONSTRAINT "board_room_players_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "board_invites" ADD CONSTRAINT "board_invites_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "board_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "board_invites" ADD CONSTRAINT "board_invites_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "board_invites" ADD CONSTRAINT "board_invites_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
