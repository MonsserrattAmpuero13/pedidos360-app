package cl.duoc.pedidos360.controller;

import cl.duoc.pedidos360.model.Producto;
import cl.duoc.pedidos360.Service.InventarioService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/productos")
@CrossOrigin(origins = "*")
public class ProductoController {

    @Autowired
    private InventarioService InventarioService;

    @GetMapping
    public ResponseEntity<List<Producto>> listarTodos() {
        return ResponseEntity.ok(InventarioService.listarTodos());
    }

    @GetMapping("/alertas")
    public ResponseEntity<List<Producto>> listarAlertas() {
        return ResponseEntity.ok(InventarioService.listarAlertasQuiebre());
    }

    @PostMapping
    public ResponseEntity<Producto> crear(@RequestBody Producto producto) {
        return ResponseEntity.ok(InventarioService.guardar(producto));
    }

    @PatchMapping("/{id}/stock")
    public ResponseEntity<Producto> ajustarStock(@PathVariable Long id, @RequestBody Map<String, Integer> body) {
        return ResponseEntity.ok(InventarioService.actualizarStock(id, body.get("stock")));
    }
}