package cl.duoc.pedidos360.messaging;

public record PedidoEvent(Long id, String tracking, String cliente, String destino, double total) {}
