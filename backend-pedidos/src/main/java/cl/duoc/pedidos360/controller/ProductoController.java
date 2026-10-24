package cl.duoc.pedidos360.controller;

import cl.duoc.pedidos360.model.Producto;
import cl.duoc.pedidos360.Service.InventarioService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;

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
        return ResponseEntity.status(HttpStatus.CREATED).body(inventarioService.guardar(producto));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Producto> actualizar(@PathVariable Long id, @RequestBody Producto producto) {
        return ResponseEntity.ok(inventarioService.actualizar(id, producto));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable Long id) {
        inventarioService.eliminar(id);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{id}/stock")
    public ResponseEntity<Producto> ajustarStock(@PathVariable Long id, @RequestBody Map<String, Integer> body) {
        return ResponseEntity.ok(inventarioService.actualizarStock(id, body.get("stock")));
    }

    /** Descuenta stock al generar una guia. Responde 409 si el stock no alcanza. */
    @PostMapping("/{id}/descontar")
    public ResponseEntity<Producto> descontar(@PathVariable Long id, @RequestBody Map<String, Integer> body) {
        return ResponseEntity.ok(inventarioService.descontarStock(id, body.get("cantidad")));
    }

    // --- Errores controlados: la API devuelve un mensaje legible en vez de un 500 ---
    @ExceptionHandler(NoSuchElementException.class)
    public ResponseEntity<Map<String, String>> noEncontrado(NoSuchElementException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("mensaje", ex.getMessage()));
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, String>> conflicto(IllegalStateException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("mensaje", ex.getMessage()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> invalido(IllegalArgumentException ex) {
        return ResponseEntity.badRequest().body(Map.of("mensaje", ex.getMessage()));
    }
}
