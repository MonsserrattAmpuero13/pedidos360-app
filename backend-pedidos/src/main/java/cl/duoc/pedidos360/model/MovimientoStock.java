package cl.duoc.pedidos360.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/** Cada cambio de stock de un producto: cuánto se movió, cómo quedó y a qué pedido corresponde. */
@Entity
@Table(name = "movimientos_stock")
public class MovimientoStock {

    public static final String DESCUENTO = "DESCUENTO";
    public static final String AJUSTE = "AJUSTE";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long productoId;

    @Column(nullable = false, length = 20)
    private String tipo;

    /** Unidades movidas, con signo: negativo al descontar, positivo al sumar. */
    @Column(nullable = false)
    private Integer cantidad;

    @Column(nullable = false)
    private Integer stockAntes;

    @Column(nullable = false)
    private Integer stockDespues;

    /** Tracking de la orden que originó el movimiento (vacío en ajustes manuales). */
    @Column(length = 60)
    private String referencia;

    @Column(length = 150)
    private String cliente;

    @Column(length = 150)
    private String usuario;

    @Column(nullable = false)
    private LocalDateTime fecha;

    public MovimientoStock() {}

    public MovimientoStock(Long productoId, String tipo, int stockAntes, int stockDespues,
                           String referencia, String cliente, String usuario) {
        this.productoId = productoId;
        this.tipo = tipo;
        this.cantidad = stockDespues - stockAntes;
        this.stockAntes = stockAntes;
        this.stockDespues = stockDespues;
        this.referencia = referencia;
        this.cliente = cliente;
        this.usuario = usuario;
        this.fecha = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public Long getProductoId() { return productoId; }
    public String getTipo() { return tipo; }
    public Integer getCantidad() { return cantidad; }
    public Integer getStockAntes() { return stockAntes; }
    public Integer getStockDespues() { return stockDespues; }
    public String getReferencia() { return referencia; }
    public String getCliente() { return cliente; }
    public String getUsuario() { return usuario; }
    public LocalDateTime getFecha() { return fecha; }
}
