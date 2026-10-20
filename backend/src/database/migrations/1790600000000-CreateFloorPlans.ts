import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFloorPlans1790600000000 implements MigrationInterface {
  name = 'CreateFloorPlans1790600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "floor_plans" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "eventId" uuid NOT NULL, "nome" character varying(60) NOT NULL, "documento" jsonb NOT NULL DEFAULT '{"mesas": [], "zonas": []}', "version" integer NOT NULL DEFAULT 0, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_floor_plans" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_floor_plans_event_nome" ON "floor_plans" ("eventId", "nome")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_floor_plans_event" ON "floor_plans" ("eventId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "floor_plans" ADD CONSTRAINT "FK_floor_plans_event" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // Backfill: uma linha "Principal" por evento que tivesse planta com
    // conteúdo (ou versão gravada, para manter a continuidade do optimistic
    // locking). Eventos sem planta ficam sem linhas — a primeira é criada
    // quando o utilizador abre a planta.
    await queryRunner.query(
      `INSERT INTO "floor_plans" ("eventId", "nome", "documento", "version", "createdAt", "updatedAt")
       SELECT e."id", 'Principal',
              CASE
                WHEN jsonb_typeof(e."floorPlan") = 'array'
                  THEN jsonb_build_object('mesas', e."floorPlan", 'zonas', '[]'::jsonb)
                ELSE e."floorPlan"
              END,
              e."floorPlanVersion", now(), now()
       FROM "events" e
       WHERE e."floorPlan" IS NOT NULL
         AND (
           e."floorPlanVersion" > 0
           OR (jsonb_typeof(e."floorPlan") = 'array'
               AND CASE WHEN jsonb_typeof(e."floorPlan") = 'array'
                        THEN jsonb_array_length(e."floorPlan") ELSE 0 END > 0)
           OR (jsonb_typeof(e."floorPlan") = 'object'
               AND e."floorPlan" <> '{"mesas": [], "zonas": []}'::jsonb)
         )`,
    );

    await queryRunner.query(
      `ALTER TABLE "events" ALTER COLUMN "floorPlan" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "events" ALTER COLUMN "floorPlan" DROP DEFAULT`,
    );
    await queryRunner.query(
      `UPDATE "events" SET "floorPlan" = NULL, "floorPlanVersion" = 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "events" e SET "floorPlan" = fp."documento", "floorPlanVersion" = fp."version"
       FROM "floor_plans" fp
       WHERE fp."eventId" = e."id" AND fp."nome" = 'Principal'`,
    );
    await queryRunner.query(
      `UPDATE "events" SET "floorPlan" = '{"mesas": [], "zonas": []}' WHERE "floorPlan" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "events" ALTER COLUMN "floorPlan" SET DEFAULT '{"mesas": [], "zonas": []}'`,
    );
    await queryRunner.query(
      `ALTER TABLE "events" ALTER COLUMN "floorPlan" SET NOT NULL`,
    );
    await queryRunner.query(`DROP TABLE "floor_plans"`);
  }
}
