package cl.duoc.pedidos360.controller;

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

    @GetMapping
    public ResponseEntity<List<Pedido>> listarTodos() {
        return ResponseEntity.ok(pedidoService.listarTodos());
    }

    @GetMapping("/tracking/{tracking}")
    public ResponseEntity<Pedido> consultarTracking(@PathVariable String tracking) {
        return ResponseEntity.ok(pedidoService.buscarPorTracking(tracking));
    }

    @PostMapping
    public ResponseEntity<Pedido> crearPedido(@RequestBody Pedido pedido) {
        return ResponseEntity.status(HttpStatus.CREATED).body(pedidoService.crearPedido(pedido));
    }

    @PatchMapping("/{id}/estado")
    public ResponseEntity<Pedido> actualizarEstado(@PathVariable Long id, @RequestBody Map<String, String> body) {
        String nuevoEstado = body.get("estado");
        String courier = body.get("courier");
        return ResponseEntity.ok(pedidoService.actualizarEstado(id, nuevoEstado, courier));
    }

    @PostMapping("/{id}/incidencias")
    public ResponseEntity<Pedido> reportarIncidencia(@PathVariable Long id, @RequestBody Map<String, String> body) {
        String descripcion = body.get("descripcion");
        return ResponseEntity.ok(pedidoService.reportarIncidencia(id, descripcion));
    }
}