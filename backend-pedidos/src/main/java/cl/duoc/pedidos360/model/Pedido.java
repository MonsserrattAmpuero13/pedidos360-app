package cl.duoc.pedidos360.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "pedidos")
public class Pedido {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String tracking;

    @Column(nullable = false)
    private String cliente;

    @Column(nullable = false)
    private String producto;

    @Column(nullable = false)
    private Integer cantidad;

    @Column(nullable = false)
    private Double total;

    @Column(nullable = false)
    private String courier;

    @Column(nullable = false)
    private String destino;

    @Column(nullable = false)
    private String estado;

    @Column(length = 500)
    private String incidencia;

    // --- Trazabilidad ---
    private LocalDateTime fechaCreacion;

    @Column(length = 150)
    private String creadoPor;

    /** Cotización de la que nació la guía (si corresponde) y quién la aceptó. */
    private Long cotizacionOrigenId;

    @Column(length = 150)
    private String aceptadaPor;

    private LocalDateTime fechaAceptacion;

    /** Cuándo se entregó. */
    private LocalDateTime fechaCierre;

    /** Eliminación lógica: la orden sale de Control de Órdenes pero queda en el Archivo. */
    private Boolean eliminado = false;

    private LocalDateTime fechaEliminacion;

    @Column(length = 150)
    private String eliminadoPor;

    @PrePersist
    void alCrear() {
        if (fechaCreacion == null) fechaCreacion = LocalDateTime.now();
        if (eliminado == null) eliminado = false;
    }

    public Pedido() {}

    public Pedido(String tracking, String cliente, String producto, Integer cantidad, Double total, String courier, String destino, String estado, String incidencia) {
        this.tracking = tracking;
        this.cliente = cliente;
        this.producto = producto;
        this.cantidad = cantidad;
        this.total = total;
        this.courier = courier;
        this.destino = destino;
        this.estado = estado;
        this.incidencia = incidencia;
    }

    // Getters y Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getTracking() { return tracking; }
    public void setTracking(String tracking) { this.tracking = tracking; }

    public String getCliente() { return cliente; }
    public void setCliente(String cliente) { this.cliente = cliente; }

    public String getProducto() { return producto; }
    public void setProducto(String producto) { this.producto = producto; }

    public Integer getCantidad() { return cantidad; }
    public void setCantidad(Integer cantidad) { this.cantidad = cantidad; }

    public Double getTotal() { return total; }
    public void setTotal(Double total) { this.total = total; }

    public String getCourier() { return courier; }
    public void setCourier(String courier) { this.courier = courier; }

    public String getDestino() { return destino; }
    public void setDestino(String destino) { this.destino = destino; }

    public String getEstado() { return estado; }
    public void setEstado(String estado) { this.estado = estado; }

    public String getIncidencia() { return incidencia; }
    public void setIncidencia(String incidencia) { this.incidencia = incidencia; }

    public LocalDateTime getFechaCreacion() { return fechaCreacion; }
    public void setFechaCreacion(LocalDateTime v) { this.fechaCreacion = v; }

    public String getCreadoPor() { return creadoPor; }
    public void setCreadoPor(String v) { this.creadoPor = v; }

    public Long getCotizacionOrigenId() { return cotizacionOrigenId; }
    public void setCotizacionOrigenId(Long v) { this.cotizacionOrigenId = v; }

    public String getAceptadaPor() { return aceptadaPor; }
    public void setAceptadaPor(String v) { this.aceptadaPor = v; }

    public LocalDateTime getFechaAceptacion() { return fechaAceptacion; }
    public void setFechaAceptacion(LocalDateTime v) { this.fechaAceptacion = v; }

    public LocalDateTime getFechaCierre() { return fechaCierre; }
    public void setFechaCierre(LocalDateTime v) { this.fechaCierre = v; }

    public Boolean getEliminado() { return eliminado; }
    public void setEliminado(Boolean v) { this.eliminado = v; }

    public LocalDateTime getFechaEliminacion() { return fechaEliminacion; }
    public void setFechaEliminacion(LocalDateTime v) { this.fechaEliminacion = v; }

    public String getEliminadoPor() { return eliminadoPor; }
    public void setEliminadoPor(String v) { this.eliminadoPor = v; }
}
