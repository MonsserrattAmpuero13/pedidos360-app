package cl.duoc.pedidos360.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "incidencias")
public class Incidencia {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pedido_id", nullable = false)
    @JsonIgnore
    private Pedido pedido;

    @Column(nullable = false, length = 80)
    private String tipo;

    @Column(nullable = false, length = 500)
    private String descripcion;

    @Column(nullable = false)
    private LocalDateTime fechaReporte;

    @Column(nullable = false)
    private Boolean resuelta;

    public Incidencia() {}

    @PrePersist
    public void prePersist() {
        this.fechaReporte = LocalDateTime.now();
        if (this.resuelta == null) {
            this.resuelta = false;
        }
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Pedido getPedido() { return pedido; }
    public void setPedido(Pedido pedido) { this.pedido = pedido; }
    public String getTipo() { return tipo; }
    public void setTipo(String tipo) { this.tipo = tipo; }
    public String getDescripcion() { return descripcion; }
    public void setDescripcion(String descripcion) { this.descripcion = descripcion; }
    public LocalDateTime getFechaReporte() { return fechaReporte; }
    public void setFechaReporte(LocalDateTime fechaReporte) { this.fechaReporte = fechaReporte; }
    public Boolean getResuelta() { return resuelta; }
    public void setResuelta(Boolean resuelta) { this.resuelta = resuelta; }
}