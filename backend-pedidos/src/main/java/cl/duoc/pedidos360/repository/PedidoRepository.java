package cl.duoc.pedidos360.repository;

import cl.duoc.pedidos360.model.Pedido;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface PedidoRepository extends JpaRepository<Pedido, Long> {
    Optional<Pedido> findByTracking(String tracking);
    List<Pedido> findByEstado(String estado);
    List<Pedido> findByCourier(String courier);
    long countByEstado(String estado);

    /** Órdenes de trabajo: no eliminadas y aún no entregadas. */
    @Query("select p from Pedido p where (p.eliminado is null or p.eliminado = false) and p.estado <> 'Entregado' order by p.id")
    List<Pedido> findActivos();

    /** Archivo: entregadas y eliminadas, lo más reciente primero. */
    @Query("select p from Pedido p where p.eliminado = true or p.estado = 'Entregado' order by p.id desc")
    List<Pedido> findArchivados();

    @Query("select count(p) from Pedido p where (p.eliminado is null or p.eliminado = false) and p.estado <> 'Entregado'")
    long countActivos();
}
