package cl.duoc.pedidos360.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "cotizaciones")
public class Cotizacion {

    public static final String PENDIENTE = "PENDIENTE";
    public static final String CONTACTADO = "CONTACTADO";
    public static final String ACEPTADA = "ACEPTADA";
    public static final String RECHAZADA = "RECHAZADA";
    public static final String CONVERTIDA = "CONVERTIDA";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String cliente;

    private String email;

    @Column(nullable = false)
    private String producto;

    /** Producto del catálogo al que apunta la cotización (permite revisar y descontar stock sin adivinar por nombre). */
    private Long productoId;

    @Column(length = 40)
    private String sku;

    @Column(nullable = false)
    private Integer cantidad;

    @Column(nullable = false)
    private String region;

    @Column(nullable = false)
    private String comuna;

    private Double totalEst;

    @Column(nullable = false, length = 20)
    private String estado = PENDIENTE;

    private LocalDateTime fechaCreacion;

    /** Cuándo y quién la marcó como aceptada por el cliente. */
    private LocalDateTime fechaAceptacion;
    @Column(length = 150)
    private String aceptadaPor;

    /** Cuándo salió de la bandeja (convertida en guía o rechazada). */
    private LocalDateTime fechaCierre;

    /** Guía generada a partir de esta cotización. */
    @Column(length = 40)
    private String pedidoTracking;

    @Column(length = 150)
    private String creadaPor;

    @PrePersist
    void alCrear() {
        if (fechaCreacion == null) fechaCreacion = LocalDateTime.now();
        if (estado == null) estado = PENDIENTE;
    }

    public Cotizacion() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getCliente() { return cliente; }
    public void setCliente(String cliente) { this.cliente = cliente; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public Long getProductoId() { return productoId; }
    public void setProductoId(Long productoId) { this.productoId = productoId; }
    public String getSku() { return sku; }
    public void setSku(String sku) { this.sku = sku; }
    public String getProducto() { return producto; }
    public void setProducto(String producto) { this.producto = producto; }
    public Integer getCantidad() { return cantidad; }
    public void setCantidad(Integer cantidad) { this.cantidad = cantidad; }
    public String getRegion() { return region; }
    public void setRegion(String region) { this.region = region; }
    public String getComuna() { return comuna; }
    public void setComuna(String comuna) { this.comuna = comuna; }
    public Double getTotalEst() { return totalEst; }
    public void setTotalEst(Double totalEst) { this.totalEst = totalEst; }
    public String getEstado() { return estado; }
    public void setEstado(String estado) { this.estado = estado; }
    public LocalDateTime getFechaCreacion() { return fechaCreacion; }
    public void setFechaCreacion(LocalDateTime fechaCreacion) { this.fechaCreacion = fechaCreacion; }
    public LocalDateTime getFechaAceptacion() { return fechaAceptacion; }
    public void setFechaAceptacion(LocalDateTime fechaAceptacion) { this.fechaAceptacion = fechaAceptacion; }
    public String getAceptadaPor() { return aceptadaPor; }
    public void setAceptadaPor(String aceptadaPor) { this.aceptadaPor = aceptadaPor; }
    public LocalDateTime getFechaCierre() { return fechaCierre; }
    public void setFechaCierre(LocalDateTime fechaCierre) { this.fechaCierre = fechaCierre; }
    public String getPedidoTracking() { return pedidoTracking; }
    public void setPedidoTracking(String pedidoTracking) { this.pedidoTracking = pedidoTracking; }
    public String getCreadaPor() { return creadaPor; }
    public void setCreadaPor(String creadaPor) { this.creadaPor = creadaPor; }
}
