import { MigrationInterface, QueryRunner } from 'typeorm';

export class FloorPlanZonas1790500000000 implements MigrationInterface {
  name = 'FloorPlanZonas1790500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "events" ALTER COLUMN "floorPlan" SET DEFAULT '{"mesas": [], "zonas": []}'`,
    );
    await queryRunner.query(
      `UPDATE "events" SET "floorPlan" = jsonb_build_object('mesas', "floorPlan", 'zonas', '[]'::jsonb) WHERE jsonb_typeof("floorPlan") = 'array'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "events" SET "floorPlan" = COALESCE("floorPlan"->'mesas', '[]'::jsonb) WHERE jsonb_typeof("floorPlan") = 'object'`,
    );
    await queryRunner.query(`ALTER TABLE "events" ALTER COLUMN "floorPlan" SET DEFAULT '[]'`);
  }
}
