package cl.duoc.pedidos360.Service;

import cl.duoc.pedidos360.model.Pedido;
import cl.duoc.pedidos360.repository.PedidoRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class PedidoService {

    @Autowired
    private PedidoRepository pedidoRepository;

    public List<Pedido> listarTodos() {
        return pedidoRepository.findAll();
    }

    public Pedido buscarPorTracking(String tracking) {
        return pedidoRepository.findByTracking(tracking)
                .orElseThrow(() -> new RuntimeException("Envío no encontrado con tracking: " + tracking));
    }

    @Transactional
    public Pedido crearPedido(Pedido pedido) {
        if (pedido.getTracking() == null || pedido.getTracking().isBlank()) {
            pedido.setTracking("P360-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        }
        if (pedido.getEstado() == null || pedido.getEstado().isBlank()) {
            pedido.setEstado("PENDIENTE");
        }
        return pedidoRepository.save(pedido);
    }

    @Transactional
    public Pedido actualizarEstado(Long id, String nuevoEstado, String courier) {
        Pedido pedido = pedidoRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Pedido no encontrado con ID: " + id));

        pedido.setEstado(nuevoEstado);
        if (courier != null && !courier.isBlank()) {
            pedido.setCourier(courier);
        }
        return pedidoRepository.save(pedido);
    }

    @Transactional
    public Pedido reportarIncidencia(Long id, String descripcionIncidencia) {
        Pedido pedido = pedidoRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Pedido no encontrado con ID: " + id));

        pedido.setEstado("INCIDENCIA");
        pedido.setIncidencia(descripcionIncidencia);
        return pedidoRepository.save(pedido);
    }
}