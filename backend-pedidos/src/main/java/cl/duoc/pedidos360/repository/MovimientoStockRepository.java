package cl.duoc.pedidos360.repository;

import cl.duoc.pedidos360.model.MovimientoStock;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MovimientoStockRepository extends JpaRepository<MovimientoStock, Long> {
    List<MovimientoStock> findByProductoIdOrderByFechaDescIdDesc(Long productoId);
}
