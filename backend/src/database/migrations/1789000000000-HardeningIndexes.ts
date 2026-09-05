import { MigrationInterface, QueryRunner } from 'typeorm';

export class HardeningIndexes1789000000000 implements MigrationInterface {
  name = 'HardeningIndexes1789000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Tabela de refresh tokens (rotação de sessões)
    await queryRunner.query(
      `CREATE TABLE "refresh_tokens" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "userId" uuid NOT NULL, "tokenHash" character varying(64) NOT NULL, "expiresAt" TIMESTAMP NOT NULL, "revokedAt" TIMESTAMP, "replacedByTokenId" uuid, "isUsed" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_refresh_tokens" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_refresh_tokens_hash" ON "refresh_tokens" ("tokenHash")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_refresh_tokens_user" ON "refresh_tokens" ("userId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_refresh_tokens_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // orders.balanceId passa a PK estrangeira com SET NULL
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "FK_orders_balance" FOREIGN KEY ("balanceId") REFERENCES "balances"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_orders_balance" ON "orders" ("balanceId")`);

    // balance_movements.orderId passa a uuid e ganha índice
    await queryRunner.query(
      `ALTER TABLE "balance_movements" ALTER COLUMN "orderId" TYPE uuid USING ("orderId"::uuid)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_balance_movements_order" ON "balance_movements" ("orderId")`,
    );

    // event_users: par (event, user) único
    await queryRunner.query(`DROP INDEX "IDX_event_users_event_user"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_event_users_event_user" ON "event_users" ("eventId", "userId")`,
    );

    // balances: um saldo por utilizador/evento
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_balances_user_event" ON "balances" ("userId", "eventId")`,
    );

    // order_items: índice no orderId para junções rápidas
    await queryRunner.query(`CREATE INDEX "IDX_order_items_order" ON "order_items" ("orderId")`);

    // cash_closures: FKs a eventos e utilizadores
    await queryRunner.query(
      `ALTER TABLE "cash_closures" ADD CONSTRAINT "FK_cash_closures_event" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "cash_closures" ADD CONSTRAINT "FK_cash_closures_opened_by" FOREIGN KEY ("openedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "cash_closures" DROP CONSTRAINT "FK_cash_closures_opened_by"`);
    await queryRunner.query(`ALTER TABLE "cash_closures" DROP CONSTRAINT "FK_cash_closures_event"`);

    await queryRunner.query(`DROP INDEX "IDX_order_items_order"`);
    await queryRunner.query(`DROP INDEX "UQ_balances_user_event"`);
    await queryRunner.query(`DROP INDEX "UQ_event_users_event_user"`);
    await queryRunner.query(`CREATE INDEX "IDX_event_users_event_user" ON "event_users" ("eventId", "userId")`);

    await queryRunner.query(`DROP INDEX "IDX_balance_movements_order"`);
    await queryRunner.query(`ALTER TABLE "balance_movements" ALTER COLUMN "orderId" TYPE character varying USING ("orderId"::text)`);

    await queryRunner.query(`DROP INDEX "IDX_orders_balance"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "FK_orders_balance"`);

    await queryRunner.query(`ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_refresh_tokens_user"`);
    await queryRunner.query(`DROP INDEX "UQ_refresh_tokens_hash"`);
    await queryRunner.query(`DROP INDEX "IDX_refresh_tokens_user"`);
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
  }
}