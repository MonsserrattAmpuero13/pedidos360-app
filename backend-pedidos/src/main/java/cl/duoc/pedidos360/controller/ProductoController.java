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
    private InventarioService inventarioService;

    @GetMapping
    public ResponseEntity<List<Producto>> listarTodos() {
        return ResponseEntity.ok(inventarioService.listarTodos());
    }

    @GetMapping("/alertas")
    public ResponseEntity<List<Producto>> listarAlertas() {
        return ResponseEntity.ok(inventarioService.listarAlertasQuiebre());
    }

    @PostMapping
    public ResponseEntity<Producto> crear(@RequestBody Producto producto) {
        return ResponseEntity.ok(inventarioService.guardar(producto));
    }

    @PatchMapping("/{id}/stock")
    public ResponseEntity<Producto> ajustarStock(@PathVariable Long id, @RequestBody Map<String, Integer> body) {
        return ResponseEntity.ok(inventarioService.actualizarStock(id, body.get("stock")));
    }
}