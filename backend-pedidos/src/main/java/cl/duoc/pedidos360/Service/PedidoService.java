package cl.duoc.pedidos360.Service;

import cl.duoc.pedidos360.model.Cotizacion;
import cl.duoc.pedidos360.model.EventoHistorial;
import cl.duoc.pedidos360.model.Pedido;
import cl.duoc.pedidos360.repository.PedidoRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class PedidoService {

    private static final String ENTREGADO = "Entregado";

    @Autowired
    private PedidoRepository pedidoRepository;

    @Autowired
    private HistorialService historial;

    @Autowired
    private CotizacionService cotizacionService;

    /** Órdenes de trabajo (no eliminadas ni entregadas). */
    public List<Pedido> listarActivos() {
        return pedidoRepository.findActivos();
    }

    /** Archivo de órdenes: entregadas y eliminadas. */
    public List<Pedido> listarArchivados() {
        return pedidoRepository.findArchivados();
    }

    public Pedido buscarPorTracking(String tracking) {
        return pedidoRepository.findByTracking(tracking)
                .orElseThrow(() -> new RuntimeException("Envío no encontrado: " + tracking));
    }

    public List<EventoHistorial> historial(Long id) {
        return historial.listar(EventoHistorial.PEDIDO, id);
    }

    @Transactional
    public Pedido guardarOActualizar(Pedido pedido, String usuario) {
        if (pedido.getId() == null) {
            if (pedido.getTracking() == null || pedido.getTracking().isBlank()) {
                pedido.setTracking("TRK-CL-" + (int)(1000 + Math.random() * 9000));
            }
            if (pedido.getEstado() == null || pedido.getEstado().isBlank()) {
                pedido.setEstado("En Preparacion");
            }
            // Los datos de trazabilidad los pone el servidor, no el cliente
            pedido.setFechaCreacion(LocalDateTime.now());
            pedido.setCreadoPor(usuario);
            pedido.setEliminado(false);
            pedido.setFechaEliminacion(null);
            pedido.setEliminadoPor(null);
            pedido.setFechaCierre(null);
            pedido.setAceptadaPor(null);
            pedido.setFechaAceptacion(null);

            Long origen = pedido.getCotizacionOrigenId();
            if (origen != null) {
                // Falla (409) si la cotización no está aceptada o ya generó una guía: evita guías duplicadas
                Cotizacion cot = cotizacionService.validarParaGuia(origen);
                pedido.setAceptadaPor(cot.getAceptadaPor());
                pedido.setFechaAceptacion(cot.getFechaAceptacion());
            }
            Pedido guardado = pedidoRepository.save(pedido);

            String detalle = origen != null
                    ? "Guía generada desde la cotización #" + origen + ", aceptada por "
                        + (guardado.getAceptadaPor() != null ? guardado.getAceptadaPor() : "el administrador")
                    : "Orden creada";
            historial.registrar(EventoHistorial.PEDIDO, guardado.getId(), "CREADA", detalle, usuario);
            if (origen != null) {
                cotizacionService.marcarConvertida(origen, guardado.getTracking(), usuario);
            }
            return guardado;
        }
        return editar(pedido, usuario);
    }

    /** Edita los datos de una orden existente sin tocar fecha de creación, origen ni marcas de eliminación. */
    private Pedido editar(Pedido datos, String usuario) {
        Pedido actual = pedidoRepository.findById(datos.getId()).orElse(null);
        if (actual == null) {
            return pedidoRepository.save(datos);
        }
        String estadoAnterior = actual.getEstado();
        actual.setCliente(datos.getCliente());
        actual.setProducto(datos.getProducto());
        actual.setCantidad(datos.getCantidad());
        actual.setTotal(datos.getTotal());
        actual.setCourier(datos.getCourier());
        actual.setDestino(datos.getDestino());
        actual.setIncidencia(datos.getIncidencia());
        if (datos.getEstado() != null && !datos.getEstado().isBlank()) {
            actual.setEstado(datos.getEstado());
        }
        if (ENTREGADO.equals(actual.getEstado()) && !ENTREGADO.equals(estadoAnterior)) {
            actual.setFechaCierre(LocalDateTime.now());
        }
        Pedido guardado = pedidoRepository.save(actual);
        historial.registrar(EventoHistorial.PEDIDO, guardado.getId(), "EDITADA", "Datos de la orden editados", usuario);
        if (estadoAnterior != null && !estadoAnterior.equals(guardado.getEstado())) {
            historial.registrar(EventoHistorial.PEDIDO, guardado.getId(),
                    ENTREGADO.equals(guardado.getEstado()) ? "ENTREGADA" : "ESTADO",
                    "De " + estadoAnterior + " a " + guardado.getEstado(), usuario);
        }
        return guardado;
    }

    @Transactional
    public Pedido actualizarEstado(Long id, String nuevoEstado, String usuario) {
        Pedido pedido = buscar(id);
        String anterior = pedido.getEstado();
        pedido.setEstado(nuevoEstado);
        if (ENTREGADO.equals(nuevoEstado) && !ENTREGADO.equals(anterior)) {
            pedido.setFechaCierre(LocalDateTime.now());
        } else if (!ENTREGADO.equals(nuevoEstado)) {
            pedido.setFechaCierre(null);
        }
        Pedido guardado = pedidoRepository.save(pedido);
        if (anterior == null || !anterior.equals(nuevoEstado)) {
            historial.registrar(EventoHistorial.PEDIDO, id,
                    ENTREGADO.equals(nuevoEstado) ? "ENTREGADA" : "ESTADO",
                    "De " + anterior + " a " + nuevoEstado, usuario);
        }
        return guardado;
    }

    @Transactional
    public Pedido actualizarIncidencia(Long id, String motivo, String usuario) {
        Pedido pedido = buscar(id);
        boolean hayMotivo = motivo != null && !motivo.isBlank();
        pedido.setIncidencia(hayMotivo ? motivo : null);
        pedido.setEstado(hayMotivo ? "Incidencia en Ruta" : "En Transito");
        Pedido guardado = pedidoRepository.save(pedido);
        historial.registrar(EventoHistorial.PEDIDO, id,
                hayMotivo ? "INCIDENCIA" : "INCIDENCIA_RESUELTA",
                hayMotivo ? motivo : "Incidencia resuelta; vuelve a En Transito", usuario);
        return guardado;
    }

    /** Eliminación lógica: la orden sale de Control de Órdenes y queda en el Archivo. */
    @Transactional
    public void eliminarPedido(Long id, String usuario) {
        Pedido pedido = buscar(id);
        if (Boolean.TRUE.equals(pedido.getEliminado())) return;
        pedido.setEliminado(true);
        pedido.setFechaEliminacion(LocalDateTime.now());
        pedido.setEliminadoPor(usuario);
        pedidoRepository.save(pedido);
        historial.registrar(EventoHistorial.PEDIDO, id, "ELIMINADA",
                "Eliminada desde Control de Órdenes (queda en el Archivo)", usuario);
    }

    private Pedido buscar(Long id) {
        return pedidoRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Pedido no encontrado"));
    }
}
