package cl.duoc.pedidos360.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/** Registro de un hecho ocurrido sobre una cotización o un pedido (quién, qué y cuándo). */
@Entity
@Table(name = "historial_eventos")
public class EventoHistorial {

    public static final String PEDIDO = "PEDIDO";
    public static final String COTIZACION = "COTIZACION";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 20)
    private String tipo;

    @Column(nullable = false)
    private Long entidadId;

    @Column(nullable = false, length = 40)
    private String accion;

    @Column(length = 500)
    private String detalle;

    @Column(length = 150)
    private String usuario;

    @Column(nullable = false)
    private LocalDateTime fecha;

    public EventoHistorial() {}

    public EventoHistorial(String tipo, Long entidadId, String accion, String detalle, String usuario) {
        this.tipo = tipo;
        this.entidadId = entidadId;
        this.accion = accion;
        this.detalle = detalle;
        this.usuario = usuario;
        this.fecha = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public String getTipo() { return tipo; }
    public Long getEntidadId() { return entidadId; }
    public String getAccion() { return accion; }
    public String getDetalle() { return detalle; }
    public String getUsuario() { return usuario; }
    public LocalDateTime getFecha() { return fecha; }
}
