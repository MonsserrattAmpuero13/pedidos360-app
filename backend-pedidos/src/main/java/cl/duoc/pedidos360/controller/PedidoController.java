package cl.duoc.pedidos360.controller;
import cl.duoc.pedidos360.messaging.PedidoEvent;
import cl.duoc.pedidos360.messaging.PedidoEventPublisher;
import cl.duoc.pedidos360.messaging.kafka.KafkaEventPublisher;
import cl.duoc.pedidos360.model.EventoHistorial;
import cl.duoc.pedidos360.model.Pedido;
import cl.duoc.pedidos360.Service.CotizacionDuplicadaException;
import cl.duoc.pedidos360.Service.PedidoService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/pedidos")
@CrossOrigin(origins = "*")
public class PedidoController {

    private static final String USUARIO = "X-Usuario";

    @Autowired
    private PedidoService pedidoService;

    @Autowired
    private PedidoEventPublisher publisher;

    @Autowired
    private KafkaEventPublisher kafkaPublisher;

    /** Órdenes de trabajo: sin las eliminadas ni las entregadas (esas están en el Archivo). */
    @GetMapping
    public ResponseEntity<List<Pedido>> listarTodos() {
        return ResponseEntity.ok(pedidoService.listarActivos());
    }

    @GetMapping("/archivo")
    public ResponseEntity<List<Pedido>> archivo() {
        return ResponseEntity.ok(pedidoService.listarArchivados());
    }

    @GetMapping("/{id}/historial")
    public ResponseEntity<List<EventoHistorial>> historial(@PathVariable Long id) {
        return ResponseEntity.ok(pedidoService.historial(id));
    }

    @PostMapping
    public ResponseEntity<?> guardar(@RequestBody Pedido pedido,
                                     @RequestHeader(value = USUARIO, required = false) String usuario,
                                     Authentication auth) {
        Pedido guardado;
        try {
            guardado = pedidoService.guardarOActualizar(pedido, UsuarioUtil.actual(usuario, auth));
        } catch (CotizacionDuplicadaException | IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("mensaje", e.getMessage()));
        }
        PedidoEvent evento = new PedidoEvent(
                guardado.getId(),
                guardado.getTracking(),
                guardado.getCliente(),
                guardado.getDestino(),
                guardado.getTotal());
        publisher.pedidoCreado(evento);        // Azure Service Bus
        kafkaPublisher.pedidoCreado(evento);   // Apache Kafka
        return ResponseEntity.status(HttpStatus.CREATED).body(guardado);
    }

    @PatchMapping("/{id}/estado")
    public ResponseEntity<Pedido> actualizarEstado(@PathVariable Long id, @RequestBody Map<String, String> body,
                                                   @RequestHeader(value = USUARIO, required = false) String usuario,
                                                   Authentication auth) {
        return ResponseEntity.ok(pedidoService.actualizarEstado(id, body.get("estado"), UsuarioUtil.actual(usuario, auth)));
    }

    @PatchMapping("/{id}/incidencia")
    public ResponseEntity<Pedido> actualizarIncidencia(@PathVariable Long id, @RequestBody Map<String, String> body,
                                                       @RequestHeader(value = USUARIO, required = false) String usuario,
                                                       Authentication auth) {
        return ResponseEntity.ok(pedidoService.actualizarIncidencia(id, body.get("incidencia"), UsuarioUtil.actual(usuario, auth)));
    }

    /** Eliminación lógica: la orden queda guardada en el Archivo. */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable Long id,
                                         @RequestHeader(value = USUARIO, required = false) String usuario,
                                         Authentication auth) {
        pedidoService.eliminarPedido(id, UsuarioUtil.actual(usuario, auth));
        return ResponseEntity.noContent().build();
    }
}
