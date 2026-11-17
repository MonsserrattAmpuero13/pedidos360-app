package cl.duoc.pedidos360.repository;

import cl.duoc.pedidos360.model.Cotizacion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Collection;
import java.util.List;

@Repository
public interface CotizacionRepository extends JpaRepository<Cotizacion, Long> {
    List<Cotizacion> findByEstadoNotInOrderByFechaCreacionDescIdDesc(Collection<String> estados);
    List<Cotizacion> findByEstadoInOrderByFechaCierreDescIdDesc(Collection<String> estados);
    boolean existsByClienteIgnoreCaseAndProductoIgnoreCaseAndComunaIgnoreCaseAndCantidadAndEstadoIn(
            String cliente, String producto, String comuna, Integer cantidad, Collection<String> estados);
}
