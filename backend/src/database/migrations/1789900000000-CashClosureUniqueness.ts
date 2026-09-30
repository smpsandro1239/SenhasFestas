import { MigrationInterface, QueryRunner } from 'typeorm';

export class CashClosureUniqueness1789900000000 implements MigrationInterface {
  name = 'CashClosureUniqueness1789900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "cash_closures" ADD COLUMN IF NOT EXISTS "closed_by_id" uuid`,
    );

    // Dedup defensivo: sem isto, o índice único abaixo falha e a migração
    // aborta se já existirem 2+ caixas abertas no mesmo evento em produção.
    // Não foi possível verificar os dados de produção antes do deploy (sem
    // acesso à BD), por isso a migração trata o caso em vez de o ignorar.
    // Mantém a mais recente; fecha as restantes sem inventar saldo — o
    // closing_balance 0 significa "desconhecido", e a nota diz porquê.
    const duplicados: { eventId: string }[] = await queryRunner.query(
      `SELECT "eventId" FROM "cash_closures" WHERE "status" = 'open' GROUP BY "eventId" HAVING COUNT(*) > 1`,
    );
    for (const { eventId } of duplicados) {
      const abertas: { id: string }[] = await queryRunner.query(
        `SELECT "id" FROM "cash_closures" WHERE "eventId" = $1 AND "status" = 'open' ORDER BY "openedAt" DESC, "createdAt" DESC`,
        [eventId],
      );
      for (const caixa of abertas.slice(1)) {
        await queryRunner.query(
          `UPDATE "cash_closures"
              SET "status" = 'closed',
                  "closedAt" = COALESCE("openedAt", CURRENT_TIMESTAMP),
                  "closingBalance" = 0,
                  "closed_by_id" = NULL,
                  "notes" = COALESCE("notes", '') || ' [A9] Fechada automaticamente: caixa duplicada no mesmo evento. Saldo real desconhecido (0 = sem registo).'
            WHERE "id" = $1`,
          [caixa.id],
        );
      }
    }

    // Uma caixa aberta por evento. Cobre a corrida que a validação da
    // aplicação não cobre: dois pedidos abrirCaixa quase simultâneos.
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cash_closures_unica_aberta" ON "cash_closures" ("eventId") WHERE "status" = 'open'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_cash_closures_unica_aberta"`);
    await queryRunner.query(`ALTER TABLE "cash_closures" DROP COLUMN IF EXISTS "closed_by_id"`);
  }
}