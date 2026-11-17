import { MigrationInterface, QueryRunner } from 'typeorm';

export class OrderItemsProductOrderIndex1790700000000 implements MigrationInterface {
  name = 'OrderItemsProductOrderIndex1790700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // A consulta de sugestões procura primeiro os pedidos que contêm o produto
    // de referência e, depois, agrega os restantes artigos desses pedidos.
    // O índice composto evita percorrer toda a tabela order_items por productId.
    await queryRunner.query(
      'CREATE INDEX "IDX_order_items_product_order" ON "order_items" ("productId", "orderId")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "IDX_order_items_product_order"');
  }
}