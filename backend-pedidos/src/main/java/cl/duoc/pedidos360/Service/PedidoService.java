package cl.duoc.pedidos360.Service;

import cl.duoc.pedidos360.model.Pedido;
import cl.duoc.pedidos360.repository.PedidoRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class PedidoService {

    @Autowired
    private PedidoRepository pedidoRepository;

    public List<Pedido> listarTodos() {
        return pedidoRepository.findAll();
    }

    public Pedido buscarPorTracking(String tracking) {
        return pedidoRepository.findByTracking(tracking)
                .orElseThrow(() -> new RuntimeException("Envío no encontrado: " + tracking));
    }

    @Transactional
    public Pedido guardarOActualizar(Pedido pedido) {
        if (pedido.getId() == null) {
            if (pedido.getTracking() == null || pedido.getTracking().isBlank()) {
                pedido.setTracking("TRK-CL-" + (int)(1000 + Math.random() * 9000));
            }
            if (pedido.getEstado() == null || pedido.getEstado().isBlank()) {
                pedido.setEstado("En Preparacion");
            }
        }
        return pedidoRepository.save(pedido);
    }

    @Transactional
    public Pedido actualizarEstado(Long id, String nuevoEstado) {
        Pedido pedido = pedidoRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Pedido no encontrado"));
        pedido.setEstado(nuevoEstado);
        return pedidoRepository.save(pedido);
    }

    @Transactional
    public Pedido actualizarIncidencia(Long id, String motivo) {
        Pedido pedido = pedidoRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Pedido no encontrado"));
        pedido.setIncidencia(motivo != null && !motivo.isBlank() ? motivo : null);
        pedido.setEstado(motivo != null && !motivo.isBlank() ? "Incidencia en Ruta" : "En Transito");
        return pedidoRepository.save(pedido);
    }

    @Transactional
    public void eliminarPedido(Long id) {
        pedidoRepository.deleteById(id);
    }
}