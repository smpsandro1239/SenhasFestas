import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuditLogFields1789500000000 implements MigrationInterface {
  name = 'AddAuditLogFields1789500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "audit_logs" RENAME COLUMN "userId" TO "actorId"`);
    await queryRunner.query(`ALTER TABLE "audit_logs" ALTER COLUMN "actorId" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "audit_logs" ALTER COLUMN "resourceId" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "audit_logs" ALTER COLUMN "resource" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "audit_logs" ADD COLUMN "actorRole" character varying`);
    await queryRunner.query(`ALTER TABLE "audit_logs" ADD COLUMN "entity" character varying`);
    await queryRunner.query(`ALTER TABLE "audit_logs" ADD COLUMN "entityId" uuid`);
    await queryRunner.query(`ALTER TABLE "audit_logs" ADD COLUMN "eventId" uuid`);
    await queryRunner.query(`ALTER TABLE "audit_logs" ADD COLUMN "before" jsonb`);
    await queryRunner.query(`ALTER TABLE "audit_logs" ADD COLUMN "after" jsonb`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_entity" ON "audit_logs" ("entity")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_actor" ON "audit_logs" ("actorId")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_event" ON "audit_logs" ("eventId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_audit_logs_event"`);
    await queryRunner.query(`DROP INDEX "IDX_audit_logs_actor"`);
    await queryRunner.query(`DROP INDEX "IDX_audit_logs_entity"`);
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP COLUMN "after"`);
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP COLUMN "before"`);
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP COLUMN "eventId"`);
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP COLUMN "entityId"`);
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP COLUMN "entity"`);
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP COLUMN "actorRole"`);
    await queryRunner.query(`ALTER TABLE "audit_logs" RENAME COLUMN "actorId" TO "userId"`);
    await queryRunner.query(`ALTER TABLE "audit_logs" ALTER COLUMN "userId" SET NOT NULL`);
  }
}
