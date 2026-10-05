-- Duelo de Cartas online: salas, jogadores e convites (mesmo molde do Tabuleiro)
-- CreateEnum
CREATE TYPE "DuelRoomStatus" AS ENUM ('LOBBY', 'PLAYING', 'FINISHED');

-- CreateTable
CREATE TABLE "duel_rooms" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "host_id" INTEGER NOT NULL,
    "status" "DuelRoomStatus" NOT NULL DEFAULT 'LOBBY',
    "config" JSONB NOT NULL,
    "state" JSONB,
    "series" JSONB,
    "teams" JSONB,
    "acks" JSONB NOT NULL DEFAULT '[]',
    "log" JSONB NOT NULL DEFAULT '[]',
    "version" INTEGER NOT NULL DEFAULT 1,
    "due_at" TIMESTAMP(3),
    "deadline_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "duel_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "duel_room_players" (
    "id" SERIAL NOT NULL,
    "room_id" INTEGER NOT NULL,
    "user_id" INTEGER,
    "slot" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "bot" TEXT,
    "replaced" BOOLEAN NOT NULL DEFAULT false,
    "afk_strikes" INTEGER NOT NULL DEFAULT 0,
    "deck_slot" INTEGER,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "duel_room_players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "duel_invites" (
    "id" SERIAL NOT NULL,
    "room_id" INTEGER NOT NULL,
    "from_user_id" INTEGER NOT NULL,
    "to_user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "duel_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "duel_rooms_code_key" ON "duel_rooms"("code");

-- CreateIndex
CREATE INDEX "duel_rooms_status_updated_at_idx" ON "duel_rooms"("status", "updated_at");

-- CreateIndex
CREATE INDEX "duel_room_players_user_id_idx" ON "duel_room_players"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "duel_room_players_room_id_slot_key" ON "duel_room_players"("room_id", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "duel_room_players_room_id_user_id_key" ON "duel_room_players"("room_id", "user_id");

-- CreateIndex
CREATE INDEX "duel_invites_to_user_id_created_at_idx" ON "duel_invites"("to_user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "duel_invites_room_id_to_user_id_key" ON "duel_invites"("room_id", "to_user_id");

-- AddForeignKey
ALTER TABLE "duel_rooms" ADD CONSTRAINT "duel_rooms_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duel_room_players" ADD CONSTRAINT "duel_room_players_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "duel_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duel_room_players" ADD CONSTRAINT "duel_room_players_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duel_invites" ADD CONSTRAINT "duel_invites_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "duel_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duel_invites" ADD CONSTRAINT "duel_invites_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duel_invites" ADD CONSTRAINT "duel_invites_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

