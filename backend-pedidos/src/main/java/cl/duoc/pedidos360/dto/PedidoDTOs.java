package cl.duoc.pedidos360.dto;

import cl.duoc.pedidos360.model.EstadoPedido;
import java.util.List;

public class PedidoDTOs {

    public static class CrearPedidoRequest {
        private String clienteNombre;
        private String direccionEntrega;
        private String telefonoContacto;
        private List<ItemPedidoRequest> items;

        public CrearPedidoRequest() {}

        public String getClienteNombre() { return clienteNombre; }
        public void setClienteNombre(String clienteNombre) { this.clienteNombre = clienteNombre; }

        public String getDireccionEntrega() { return direccionEntrega; }
        public void setDireccionEntrega(String direccionEntrega) { this.direccionEntrega = direccionEntrega; }

        public String getTelefonoContacto() { return telefonoContacto; }
        public void setTelefonoContacto(String telefonoContacto) { this.telefonoContacto = telefonoContacto; }

        public List<ItemPedidoRequest> getItems() { return items; }
        public void setItems(List<ItemPedidoRequest> items) { this.items = items; }
    }

    public static class ItemPedidoRequest {
        private Long productoId;
        private Integer cantidad;

        public ItemPedidoRequest() {}

        public Long getProductoId() { return productoId; }
        public void setProductoId(Long productoId) { this.productoId = productoId; }

        public Integer getCantidad() { return cantidad; }
        public void setCantidad(Integer cantidad) { this.cantidad = cantidad; }
    }

    public static class CambiarEstadoRequest {
        private EstadoPedido nuevoEstado;
        private String courier;

        public CambiarEstadoRequest() {}

        public EstadoPedido getNuevoEstado() { return nuevoEstado; }
        public void setNuevoEstado(EstadoPedido nuevoEstado) { this.nuevoEstado = nuevoEstado; }

        public String getCourier() { return courier; }
        public void setCourier(String courier) { this.courier = courier; }
    }

    public static class ReportarIncidenciaRequest {
        private String tipo;
        private String descripcion;

        public ReportarIncidenciaRequest() {}

        public String getTipo() { return tipo; }
        public void setTipo(String tipo) { this.tipo = tipo; }

        public String getDescripcion() { return descripcion; }
        public void setDescripcion(String descripcion) { this.descripcion = descripcion; }
    }

    public static class DashboardMetricasResponse {
        private long totalPedidos;
        private long pendientes;
        private long enRuta;
        private long entregados;
        private long conIncidencias;
        private long alertasStock;

        public DashboardMetricasResponse() {}

        public long getTotalPedidos() { return totalPedidos; }
        public void setTotalPedidos(long totalPedidos) { this.totalPedidos = totalPedidos; }

        public long getPendientes() { return pendientes; }
        public void setPendientes(long pendientes) { this.pendientes = pendientes; }

        public long getEnRuta() { return enRuta; }
        public void setEnRuta(long enRuta) { this.enRuta = enRuta; }

        public long getEntregados() { return entregados; }
        public void setEntregados(long entregados) { this.entregados = entregados; }

        public long getConIncidencias() { return conIncidencias; }
        public void setConIncidencias(long conIncidencias) { this.conIncidencias = conIncidencias; }

        public long getAlertasStock() { return alertasStock; }
        public void setAlertasStock(long alertasStock) { this.alertasStock = alertasStock; }
    }
}