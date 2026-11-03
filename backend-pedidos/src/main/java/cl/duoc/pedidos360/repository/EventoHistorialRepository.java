package cl.duoc.pedidos360.repository;

import cl.duoc.pedidos360.model.EventoHistorial;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface EventoHistorialRepository extends JpaRepository<EventoHistorial, Long> {
    List<EventoHistorial> findByTipoAndEntidadIdOrderByFechaAscIdAsc(String tipo, Long entidadId);
}
