package cl.duoc.pedidos360.repository;

import cl.duoc.pedidos360.model.Incidencia;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface IncidenciaRepository extends JpaRepository<Incidencia, Long> {
    List<Incidencia> findByResueltaFalse();
    List<Incidencia> findByPedidoId(Long pedidoId);
}