-- CreateEnum
CREATE TYPE "Type" AS ENUM ('yellow', 'red');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'SUPER_ADVISOR', 'PLAYER');

-- CreateEnum
CREATE TYPE "Foot" AS ENUM ('left', 'right', 'both');

-- CreateEnum
CREATE TYPE "Position" AS ENUM ('stricker', 'shadow_stricker', 'winger', 'central_attack_middle_fielder', 'right_attack_middle_fielder', 'left_attack_middle_fielder', 'central_defensive_middle_fielder', 'left_defensive_middle_fielder', 'right_defensive_middle_fielder', 'center_back', 'left_wing_back', 'left_full_back', 'right_wing_back', 'right_full_back');

-- CreateTable
CREATE TABLE "Season" (
    "id" SERIAL NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_Date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "League" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "nation_id" INTEGER NOT NULL,

    CONSTRAINT "League_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Country" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,

    CONSTRAINT "Country_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "date_of_birth" TIMESTAMP(3) NOT NULL,
    "password" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "country_id" INTEGER NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" SERIAL NOT NULL,
    "team_name" TEXT NOT NULL,
    "founded" TIMESTAMP(3) NOT NULL,
    "short_name" TEXT NOT NULL,
    "league_id" INTEGER NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "season_id" INTEGER NOT NULL,
    "home_team_id" INTEGER NOT NULL,
    "away_team_id" INTEGER NOT NULL,

    CONSTRAINT "match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "player_name" TEXT NOT NULL,
    "jersey_number" INTEGER NOT NULL,
    "position" "Position" NOT NULL,
    "date_of_birth" TIMESTAMP(3) NOT NULL,
    "preferred_foot" "Foot" NOT NULL,
    "height" INTEGER NOT NULL,
    "weight" INTEGER NOT NULL,
    "nation_id" INTEGER NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team_season_stats" (
    "season_id" INTEGER NOT NULL,
    "team_id" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "Player_season_stats" (
    "id" SERIAL NOT NULL,
    "avg_xG" INTEGER,
    "avg_xA" INTEGER,
    "avg_goals" INTEGER,
    "avg_assist" INTEGER,
    "avg_tackle_success_rate" INTEGER,
    "avg_passing_accuracy" INTEGER,
    "avg_clearance" INTEGER,
    "avg_sprint" INTEGER,
    "avg_clear_cut_chance_rate" INTEGER,
    "games_played" INTEGER,
    "goals_per_game" INTEGER,
    "avg_fouls_commited" INTEGER,
    "avg_shot_allowed" INTEGER,
    "avg_shot_blocked" INTEGER,
    "avg_crosses_completed" INTEGER,
    "avg_penalty_conversion_rate" INTEGER,
    "avg_interception" INTEGER,
    "avg_free_kick_conversion_rate" INTEGER,
    "season_id" INTEGER NOT NULL,
    "player_id" TEXT NOT NULL,

    CONSTRAINT "Player_season_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player_match_stats" (
    "id" SERIAL NOT NULL,
    "xG" INTEGER,
    "xA" INTEGER,
    "goals" INTEGER,
    "assist" INTEGER,
    "tackle_success_rate" INTEGER,
    "passing_accuracy" INTEGER,
    "clearance" INTEGER,
    "sprint" INTEGER,
    "clear_cut_chance_rate" INTEGER,
    "fouls_commited" INTEGER,
    "shot_allowed" INTEGER,
    "shot_blocked" INTEGER,
    "crosses_completed" INTEGER,
    "penalty_conversion_rate" INTEGER,
    "interception" INTEGER,
    "free_kick_conversion_rate" INTEGER,
    "match_id" INTEGER NOT NULL,
    "player_id" TEXT NOT NULL,

    CONSTRAINT "Player_match_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team_match_stats" (
    "id" SERIAL NOT NULL,
    "possesion" INTEGER NOT NULL,
    "shots" INTEGER NOT NULL,
    "shots_on_target" INTEGER NOT NULL,
    "shots_off_target" INTEGER NOT NULL,
    "key_passess" INTEGER NOT NULL,
    "passes" INTEGER NOT NULL,
    "pass_accuracy" INTEGER NOT NULL,
    "fouls" INTEGER NOT NULL,
    "yellow_cards" INTEGER NOT NULL,
    "red_cards" INTEGER NOT NULL,
    "xG" INTEGER NOT NULL,
    "corners" INTEGER NOT NULL,
    "offsides" INTEGER NOT NULL,
    "tackles" INTEGER NOT NULL,
    "interceptions" INTEGER NOT NULL,
    "clearances" INTEGER NOT NULL,
    "blocked_shots" INTEGER NOT NULL,
    "team_id" INTEGER NOT NULL,
    "match_id" INTEGER NOT NULL,

    CONSTRAINT "Team_match_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" SERIAL NOT NULL,
    "match_id" INTEGER NOT NULL,
    "scorer_id" TEXT NOT NULL,
    "assist_id" TEXT NOT NULL,
    "team_id" INTEGER NOT NULL,

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Card" (
    "id" SERIAL NOT NULL,
    "type" "Type" NOT NULL,
    "minutes" INTEGER NOT NULL,
    "match_id" INTEGER NOT NULL,
    "player_id" TEXT NOT NULL,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team_player" (
    "season_id" INTEGER NOT NULL,
    "team_id" INTEGER NOT NULL,
    "player_id" TEXT NOT NULL,

    CONSTRAINT "Team_player_pkey" PRIMARY KEY ("team_id","player_id","season_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Country_name_key" ON "Country"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Country_code_key" ON "Country"("code");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_nickname_key" ON "User"("nickname");

-- CreateIndex
CREATE UNIQUE INDEX "Team_team_name_key" ON "Team"("team_name");

-- CreateIndex
CREATE UNIQUE INDEX "Team_short_name_key" ON "Team"("short_name");

-- CreateIndex
CREATE UNIQUE INDEX "Team_season_stats_season_id_team_id_key" ON "Team_season_stats"("season_id", "team_id");

-- CreateIndex
CREATE UNIQUE INDEX "Player_season_stats_season_id_player_id_key" ON "Player_season_stats"("season_id", "player_id");

-- CreateIndex
CREATE UNIQUE INDEX "Team_match_stats_team_id_match_id_key" ON "Team_match_stats"("team_id", "match_id");

-- AddForeignKey
ALTER TABLE "League" ADD CONSTRAINT "League_nation_id_fkey" FOREIGN KEY ("nation_id") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match" ADD CONSTRAINT "match_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match" ADD CONSTRAINT "Match_away_team_fkey" FOREIGN KEY ("away_team_id") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match" ADD CONSTRAINT "Match_home_team_fkey" FOREIGN KEY ("home_team_id") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_nation_id_fkey" FOREIGN KEY ("nation_id") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team_season_stats" ADD CONSTRAINT "Team_season_stats_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team_season_stats" ADD CONSTRAINT "Team_season_stats_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player_season_stats" ADD CONSTRAINT "Player_season_stats_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player_season_stats" ADD CONSTRAINT "Player_season_stats_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player_match_stats" ADD CONSTRAINT "Player_match_stats_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player_match_stats" ADD CONSTRAINT "Player_match_stats_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team_match_stats" ADD CONSTRAINT "Team_match_stats_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team_match_stats" ADD CONSTRAINT "Team_match_stats_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_scorer_id_fkey" FOREIGN KEY ("scorer_id") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_assist_id_fkey" FOREIGN KEY ("assist_id") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team_player" ADD CONSTRAINT "Team_player_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team_player" ADD CONSTRAINT "Team_player_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team_player" ADD CONSTRAINT "Team_player_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
