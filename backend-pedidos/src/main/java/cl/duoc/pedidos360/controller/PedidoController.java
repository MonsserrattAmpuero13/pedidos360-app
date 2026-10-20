package cl.duoc.pedidos360.controller;
import cl.duoc.pedidos360.messaging.PedidoEvent;
import cl.duoc.pedidos360.messaging.PedidoEventPublisher;
import cl.duoc.pedidos360.model.Pedido;
import cl.duoc.pedidos360.Service.PedidoService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/pedidos")
@CrossOrigin(origins = "*")
public class PedidoController {

    @Autowired
    private PedidoService pedidoService;

    @Autowired
    private PedidoEventPublisher publisher;

    @GetMapping
    public ResponseEntity<List<Pedido>> listarTodos() {
        return ResponseEntity.ok(pedidoService.listarTodos());
    }

    @PostMapping
    public ResponseEntity<Pedido> guardar(@RequestBody Pedido pedido) {
        Pedido guardado = pedidoService.guardarOActualizar(pedido);
        publisher.pedidoCreado(new PedidoEvent(
                guardado.getId(),
                guardado.getTracking(),
                guardado.getCliente(),
                guardado.getDestino(),
                guardado.getTotal()));
        return ResponseEntity.status(HttpStatus.CREATED).body(guardado);
    }

    @PatchMapping("/{id}/estado")
    public ResponseEntity<Pedido> actualizarEstado(@PathVariable Long id, @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(pedidoService.actualizarEstado(id, body.get("estado")));
    }

    @PatchMapping("/{id}/incidencia")
    public ResponseEntity<Pedido> actualizarIncidencia(@PathVariable Long id, @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(pedidoService.actualizarIncidencia(id, body.get("incidencia")));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable Long id) {
        pedidoService.eliminarPedido(id);
        return ResponseEntity.noContent().build();
    }
}