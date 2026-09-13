import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserAccessCode1789800000000 implements MigrationInterface {
  name = 'AddUserAccessCode1789800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "access_code" VARCHAR(6)`);

    const users: { id: string }[] = await queryRunner.query(`SELECT id FROM "users"`);
    for (const user of users) {
      let atribuido = false;
      for (let tentativa = 0; tentativa < 100 && !atribuido; tentativa++) {
        const codigo = String(Math.floor(100000 + Math.random() * 900000));
        const duplicados: { id: string }[] = await queryRunner.query(
          `SELECT id FROM "users" WHERE "access_code" = '${codigo}' LIMIT 1`,
        );
        if (duplicados.length === 0) {
          await queryRunner.query(
            `UPDATE "users" SET "access_code" = '${codigo}' WHERE "id" = '${user.id}'`,
          );
          atribuido = true;
        }
      }
    }

    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_users_access_code" ON "users" ("access_code")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_users_access_code"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "access_code"`);
  }
}