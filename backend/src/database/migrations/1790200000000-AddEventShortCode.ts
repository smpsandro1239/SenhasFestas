import { MigrationInterface, QueryRunner } from 'typeorm';
import { gerarShortCode, escolherShortCode } from '../../common/short-code';

export class AddEventShortCode1790200000000 implements MigrationInterface {
  name = 'AddEventShortCode1790200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "events" ADD COLUMN "shortCode" varchar(32)`);

    const eventos: Array<{ id: string; name: string }> = await queryRunner.query(
      `SELECT "id", "name" FROM "events" ORDER BY "id"`,
    );
    const usados = new Set<string>();
    for (const evento of eventos) {
      const base = gerarShortCode(evento.name ?? '', evento.id);
      const shortCode = escolherShortCode(base, (cand) => usados.has(cand));
      usados.add(shortCode);
      await queryRunner.query(`UPDATE "events" SET "shortCode" = $1 WHERE "id" = $2`, [
        shortCode,
        evento.id,
      ]);
    }

    await queryRunner.query(`ALTER TABLE "events" ALTER COLUMN "shortCode" SET NOT NULL`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_events_shortCode" ON "events" ("shortCode")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_events_shortCode"`);
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "shortCode"`);
  }
}
