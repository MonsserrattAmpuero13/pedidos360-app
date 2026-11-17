package cl.duoc.pedidos360.controller;

import cl.duoc.pedidos360.Service.CotizacionDuplicadaException;
import cl.duoc.pedidos360.Service.CotizacionService;
import cl.duoc.pedidos360.Service.GuiaService;
import cl.duoc.pedidos360.messaging.PedidoEvent;
import cl.duoc.pedidos360.messaging.PedidoEventPublisher;
import cl.duoc.pedidos360.messaging.kafka.KafkaEventPublisher;
import cl.duoc.pedidos360.model.Pedido;
import cl.duoc.pedidos360.Service.HistorialService;
import cl.duoc.pedidos360.model.Cotizacion;
import cl.duoc.pedidos360.model.EventoHistorial;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;

@RestController
@RequestMapping("/api/cotizaciones")
@CrossOrigin(origins = "*")
public class CotizacionController {

    private static final String USUARIO = "X-Usuario";

    @Autowired
    private CotizacionService service;

    @Autowired
    private HistorialService historial;

    @Autowired
    private GuiaService guias;

    @Autowired
    private PedidoEventPublisher publisher;

    @Autowired
    private KafkaEventPublisher kafkaPublisher;

    /** Bandeja de trabajo: cotizaciones pendientes, contactadas o aceptadas. */
    @GetMapping
    public List<Cotizacion> bandeja() {
        return service.bandeja();
    }

    /** Archivo: cotizaciones rechazadas o ya convertidas en guía. */
    @GetMapping("/archivo")
    public List<Cotizacion> archivo() {
        return service.archivo();
    }

    @GetMapping("/{id}")
    public Cotizacion detalle(@PathVariable Long id) {
        return service.obtener(id);
    }

    @GetMapping("/{id}/historial")
    public List<EventoHistorial> historial(@PathVariable Long id) {
        return historial.listar(EventoHistorial.COTIZACION, id);
    }

    @PostMapping
    public ResponseEntity<Cotizacion> crear(@RequestBody Cotizacion cotizacion,
                                            @RequestHeader(value = USUARIO, required = false) String usuario,
                                            Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(service.crear(cotizacion, UsuarioUtil.actual(usuario, auth)));
    }

    @PostMapping("/importar")
    public List<Cotizacion> importar(@RequestBody List<Cotizacion> cotizaciones,
                                     @RequestHeader(value = USUARIO, required = false) String usuario,
                                     Authentication auth) {
        return service.importar(cotizaciones, UsuarioUtil.actual(usuario, auth));
    }

    @PatchMapping("/{id}/estado")
    public Cotizacion cambiarEstado(@PathVariable Long id, @RequestBody Map<String, String> body,
                                    @RequestHeader(value = USUARIO, required = false) String usuario,
                                    Authentication auth) {
        return service.cambiarEstado(id, body.get("estado"), UsuarioUtil.actual(usuario, auth));
    }

    /**
     * Genera la guía de una cotización aceptada: revisa y descuenta stock, crea la orden y cierra la cotización.
     * Responde 409 con un mensaje claro si no hay stock suficiente o la cotización ya generó una guía.
     */
    @PostMapping("/{id}/generar-guia")
    public ResponseEntity<Pedido> generarGuia(@PathVariable Long id,
                                              @RequestBody(required = false) Map<String, String> body,
                                              @RequestHeader(value = USUARIO, required = false) String usuario,
                                              Authentication auth) {
        String courier = body != null ? body.get("courier") : null;
        Pedido pedido = guias.generarDesdeCotizacion(id, courier, UsuarioUtil.actual(usuario, auth));
        PedidoEvent evento = new PedidoEvent(
                pedido.getId(), pedido.getTracking(), pedido.getCliente(), pedido.getDestino(), pedido.getTotal());
        publisher.pedidoCreado(evento);        // Azure Service Bus
        kafkaPublisher.pedidoCreado(evento);   // Apache Kafka
        return ResponseEntity.status(HttpStatus.CREATED).body(pedido);
    }

    @PostMapping("/{id}/devolver")
    public Cotizacion devolver(@PathVariable Long id,
                               @RequestHeader(value = USUARIO, required = false) String usuario,
                               Authentication auth) {
        return service.devolverABandeja(id, UsuarioUtil.actual(usuario, auth));
    }

    @ExceptionHandler(CotizacionDuplicadaException.class)
    public ResponseEntity<Map<String, String>> duplicada(CotizacionDuplicadaException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("mensaje", e.getMessage()));
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, String>> conflicto(IllegalStateException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("mensaje", e.getMessage()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> invalida(IllegalArgumentException e) {
        return ResponseEntity.badRequest().body(Map.of("mensaje", e.getMessage()));
    }

    @ExceptionHandler(NoSuchElementException.class)
    public ResponseEntity<Map<String, String>> noEncontrada(NoSuchElementException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("mensaje", e.getMessage()));
    }
}
