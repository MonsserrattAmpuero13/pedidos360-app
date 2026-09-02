package cl.duoc.pedidos360.repository;

import cl.duoc.pedidos360.model.Pedido;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface PedidoRepository extends JpaRepository<Pedido, Long> {
    Optional<Pedido> findByTracking(String tracking);
    List<Pedido> findByEstado(String estado);
    List<Pedido> findByCourier(String courier);
    long countByEstado(String estado);
}