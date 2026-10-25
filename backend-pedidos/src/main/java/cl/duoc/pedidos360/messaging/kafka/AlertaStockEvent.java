package cl.duoc.pedidos360.messaging.kafka;

/** Evento que se publica en el topico "alertas-stock" cuando un producto queda en o bajo su stock minimo. */
public record AlertaStockEvent(Long productoId, String sku, String nombre, int stockActual, int stockMinimo) {}
