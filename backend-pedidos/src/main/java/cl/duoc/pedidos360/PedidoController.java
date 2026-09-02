package cl.duoc.pedidos360;


import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/pedidos")
@CrossOrigin(origins = "*")
public class PedidoController {

    private final PedidoRepository repository;

    public PedidoController(PedidoRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    public List<Pedido> listarTodos() {
        return repository.findAll();
    }

    @PostMapping
    public Pedido crear(@RequestBody Pedido pedido) {
        return repository.save(pedido);
    }

    @PatchMapping("/{id}/estado")
    public ResponseEntity<Pedido> cambiarEstado(@PathVariable Long id, @RequestBody Map<String, String> payload) {
        return repository.findById(id).map(pedido -> {
            pedido.setEstado(payload.get("estado"));
            return ResponseEntity.ok(repository.save(pedido));
        }).orElse(ResponseEntity.notFound().build());
    }

    @PatchMapping("/{id}/incidencia")
    public ResponseEntity<Pedido> actualizarIncidencia(@PathVariable Long id, @RequestBody Map<String, String> payload) {
        return repository.findById(id).map(pedido -> {
            String incidencia = payload.get("incidencia");
            pedido.setIncidencia(incidencia);
            if (incidencia == null || incidencia.trim().isEmpty()) {
                pedido.setEstado("En Tránsito");
            } else {
                pedido.setEstado("Incidencia en Ruta");
            }
            return ResponseEntity.ok(repository.save(pedido));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable Long id) {
        if (repository.existsById(id)) {
            repository.deleteById(id);
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }
}