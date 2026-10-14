import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEventFloorPlan1790400000000 implements MigrationInterface {
  name = 'AddEventFloorPlan1790400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "events" ADD COLUMN "floorPlan" jsonb NOT NULL DEFAULT '[]'`,
    );
    await queryRunner.query(
      `ALTER TABLE "events" ADD COLUMN "floorPlanVersion" integer NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "floorPlanVersion"`);
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "floorPlan"`);
  }
}
