import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSoftDelete1789700000000 implements MigrationInterface {
  name = 'AddSoftDelete1789700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "deletedAt" TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE "events" ADD COLUMN "deletedAt" TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE "products" ADD COLUMN "deletedAt" TIMESTAMP`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "deletedAt"`);
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "deletedAt"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "deletedAt"`);
  }
}