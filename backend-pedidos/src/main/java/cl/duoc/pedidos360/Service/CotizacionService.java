package cl.duoc.pedidos360.Service;

import cl.duoc.pedidos360.model.Cotizacion;
import cl.duoc.pedidos360.model.EventoHistorial;
import cl.duoc.pedidos360.repository.CotizacionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Set;

@Service
public class CotizacionService {

    /** Estados que cuentan como "cotización viva" para detectar duplicados. */
    static final List<String> ACTIVAS = List.of(Cotizacion.PENDIENTE, Cotizacion.CONTACTADO, Cotizacion.ACEPTADA);
    /** Estados que salen de la bandeja y quedan en el Archivo. */
    static final List<String> ARCHIVADAS = List.of(Cotizacion.RECHAZADA, Cotizacion.CONVERTIDA);
    private static final Set<String> EDITABLES =
            Set.of(Cotizacion.PENDIENTE, Cotizacion.CONTACTADO, Cotizacion.ACEPTADA, Cotizacion.RECHAZADA);

    @Autowired
    private CotizacionRepository repository;

    @Autowired
    private HistorialService historial;

    public List<Cotizacion> bandeja() {
        return repository.findByEstadoNotInOrderByFechaCreacionDescIdDesc(ARCHIVADAS);
    }

    public List<Cotizacion> archivo() {
        return repository.findByEstadoInOrderByFechaCierreDescIdDesc(ARCHIVADAS);
    }

    public Cotizacion obtener(Long id) {
        return repository.findById(id).orElseThrow(() -> new NoSuchElementException("Cotización no encontrada: " + id));
    }

    @Transactional
    public Cotizacion crear(Cotizacion c, String usuario) {
        validar(c);
        normalizar(c);
        if (existeIgualActiva(c)) {
            throw new CotizacionDuplicadaException("Ya existe una cotización vigente para " + c.getCliente()
                    + " con el mismo producto, comuna y cantidad.");
        }
        c.setId(null);
        c.setEstado(Cotizacion.PENDIENTE);
        c.setFechaCreacion(LocalDateTime.now());
        c.setFechaAceptacion(null);
        c.setAceptadaPor(null);
        c.setFechaCierre(null);
        c.setPedidoTracking(null);
        c.setCreadaPor(usuario);
        Cotizacion guardada = repository.save(c);
        historial.registrar(EventoHistorial.COTIZACION, guardada.getId(), "CREADA",
                "Solicitud de " + c.getCantidad() + " x " + c.getProducto() + " para " + c.getComuna() + ", " + c.getRegion(), usuario);
        return guardada;
    }

    @Transactional
    public Cotizacion cambiarEstado(Long id, String nuevoEstado, String usuario) {
        if (nuevoEstado == null || !EDITABLES.contains(nuevoEstado)) {
            throw new IllegalArgumentException("Estado no válido: " + nuevoEstado);
        }
        Cotizacion c = obtener(id);
        if (Cotizacion.CONVERTIDA.equals(c.getEstado())) {
            throw new IllegalStateException("La cotización ya se convirtió en la guía " + c.getPedidoTracking() + " y no se puede modificar.");
        }
        String anterior = c.getEstado();
        if (anterior.equals(nuevoEstado)) return c;

        c.setEstado(nuevoEstado);
        if (Cotizacion.ACEPTADA.equals(nuevoEstado)) {
            c.setFechaAceptacion(LocalDateTime.now());
            c.setAceptadaPor(usuario);
        }
        c.setFechaCierre(Cotizacion.RECHAZADA.equals(nuevoEstado) ? LocalDateTime.now() : null);
        Cotizacion guardada = repository.save(c);

        String accion = Cotizacion.ACEPTADA.equals(nuevoEstado) ? "ACEPTADA"
                : Cotizacion.RECHAZADA.equals(nuevoEstado) ? "RECHAZADA" : "ESTADO";
        historial.registrar(EventoHistorial.COTIZACION, id, accion, "De " + anterior + " a " + nuevoEstado, usuario);
        return guardada;
    }

    /** Comprueba que la cotización puede originar una guía (debe estar aceptada). */
    public Cotizacion validarParaGuia(Long id) {
        Cotizacion c = obtener(id);
        if (!Cotizacion.ACEPTADA.equals(c.getEstado())) {
            throw new IllegalStateException(Cotizacion.CONVERTIDA.equals(c.getEstado())
                    ? "Esta cotización ya generó la guía " + c.getPedidoTracking() + "."
                    : "La cotización debe estar aceptada por el cliente para generar la guía.");
        }
        return c;
    }

    @Transactional
    public Cotizacion marcarConvertida(Long id, String tracking, String usuario) {
        Cotizacion c = validarParaGuia(id);
        c.setEstado(Cotizacion.CONVERTIDA);
        c.setPedidoTracking(tracking);
        c.setFechaCierre(LocalDateTime.now());
        Cotizacion guardada = repository.save(c);
        historial.registrar(EventoHistorial.COTIZACION, id, "CONVERTIDA", "Guía generada: " + tracking, usuario);
        return guardada;
    }

    /** Devuelve una cotización rechazada a la bandeja. */
    @Transactional
    public Cotizacion devolverABandeja(Long id, String usuario) {
        Cotizacion c = obtener(id);
        if (!Cotizacion.RECHAZADA.equals(c.getEstado())) {
            throw new IllegalStateException(Cotizacion.CONVERTIDA.equals(c.getEstado())
                    ? "No se puede devolver: ya generó la guía " + c.getPedidoTracking() + " y se duplicaría."
                    : "La cotización ya está en la bandeja.");
        }
        if (existeIgualActiva(c)) {
            throw new CotizacionDuplicadaException("No se puede devolver: ya hay una cotización vigente igual en la bandeja.");
        }
        c.setEstado(Cotizacion.PENDIENTE);
        c.setFechaCierre(null);
        Cotizacion guardada = repository.save(c);
        historial.registrar(EventoHistorial.COTIZACION, id, "DEVUELTA", "Devuelta a la bandeja desde el Archivo", usuario);
        return guardada;
    }

    /** Importa cotizaciones que estaban solo en el navegador; omite las que ya existen. */
    @Transactional
    public List<Cotizacion> importar(List<Cotizacion> entrantes, String usuario) {
        List<Cotizacion> creadas = new ArrayList<>();
        if (entrantes == null) return creadas;
        for (Cotizacion e : entrantes) {
            try {
                validar(e);
            } catch (IllegalArgumentException ex) {
                continue;
            }
            normalizar(e);
            String estado = e.getEstado() != null && EDITABLES.contains(e.getEstado()) ? e.getEstado() : Cotizacion.PENDIENTE;
            LocalDateTime fecha = e.getFechaCreacion();
            if (existeIgualActiva(e)) continue;
            e.setId(null);
            e.setEstado(estado);
            e.setFechaCreacion(fecha != null ? fecha : LocalDateTime.now());
            e.setFechaAceptacion(Cotizacion.ACEPTADA.equals(estado) ? LocalDateTime.now() : null);
            e.setAceptadaPor(Cotizacion.ACEPTADA.equals(estado) ? usuario : null);
            e.setFechaCierre(Cotizacion.RECHAZADA.equals(estado) ? LocalDateTime.now() : null);
            e.setPedidoTracking(null);
            e.setCreadaPor(usuario);
            Cotizacion guardada = repository.save(e);
            historial.registrar(EventoHistorial.COTIZACION, guardada.getId(), "IMPORTADA",
                    "Importada desde el navegador (estado " + estado + ")", usuario);
            creadas.add(guardada);
        }
        return creadas;
    }

    private boolean existeIgualActiva(Cotizacion c) {
        return repository.existsByClienteIgnoreCaseAndProductoIgnoreCaseAndComunaIgnoreCaseAndCantidadAndEstadoIn(
                c.getCliente(), c.getProducto(), c.getComuna(), c.getCantidad(), ACTIVAS);
    }

    private void validar(Cotizacion c) {
        if (c == null || vacio(c.getCliente()) || vacio(c.getProducto()) || vacio(c.getRegion()) || vacio(c.getComuna())) {
            throw new IllegalArgumentException("Faltan datos obligatorios de la cotización (cliente, producto, región y comuna).");
        }
        if (c.getCantidad() == null || c.getCantidad() < 1) {
            throw new IllegalArgumentException("La cantidad debe ser al menos 1.");
        }
    }

    private void normalizar(Cotizacion c) {
        c.setCliente(c.getCliente().trim());
        c.setProducto(c.getProducto().trim());
        c.setRegion(c.getRegion().trim());
        c.setComuna(c.getComuna().trim());
        if (c.getEmail() != null) c.setEmail(c.getEmail().trim());
    }

    private boolean vacio(String s) {
        return s == null || s.isBlank();
    }
}
