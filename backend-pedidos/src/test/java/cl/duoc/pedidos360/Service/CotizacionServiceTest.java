package cl.duoc.pedidos360.Service;

import cl.duoc.pedidos360.model.Cotizacion;
import cl.duoc.pedidos360.repository.CotizacionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CotizacionServiceTest {

    private CotizacionRepository repository;
    private HistorialService historial;
    private CotizacionService service;

    @BeforeEach
    void preparar() {
        repository = mock(CotizacionRepository.class);
        historial = mock(HistorialService.class);
        service = new CotizacionService();
        ReflectionTestUtils.setField(service, "repository", repository);
        ReflectionTestUtils.setField(service, "historial", historial);
        when(repository.save(any(Cotizacion.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private Cotizacion nueva() {
        Cotizacion c = new Cotizacion();
        c.setCliente("  Minimarket Don Juan ");
        c.setProducto("Arroz Grado 1 Saco 10kg");
        c.setCantidad(3);
        c.setRegion("Metropolitana");
        c.setComuna("Maipú");
        c.setTotalEst(34500.0);
        return c;
    }

    private void hayDuplicada(boolean si) {
        when(repository.existsByClienteIgnoreCaseAndProductoIgnoreCaseAndComunaIgnoreCaseAndCantidadAndEstadoIn(
                anyString(), anyString(), anyString(), any(), anyCollection())).thenReturn(si);
    }

    @Test
    void crearGuardaFechaEstadoPendienteYDejaHistorial() {
        hayDuplicada(false);

        Cotizacion c = service.crear(nueva(), "admin");

        assertEquals("Minimarket Don Juan", c.getCliente());
        assertEquals(Cotizacion.PENDIENTE, c.getEstado());
        assertNotNull(c.getFechaCreacion());
        assertEquals("admin", c.getCreadaPor());
        verify(historial).registrar(eq("COTIZACION"), any(), eq("CREADA"), any(), eq("admin"));
    }

    @Test
    void crearRechazaUnaCotizacionIgualVigente() {
        hayDuplicada(true);

        assertThrows(CotizacionDuplicadaException.class, () -> service.crear(nueva(), "admin"));
        verify(repository, never()).save(any());
    }

    @Test
    void crearExigeLosDatosObligatorios() {
        Cotizacion sinComuna = nueva();
        sinComuna.setComuna(" ");
        assertThrows(IllegalArgumentException.class, () -> service.crear(sinComuna, "admin"));

        Cotizacion sinCantidad = nueva();
        sinCantidad.setCantidad(0);
        assertThrows(IllegalArgumentException.class, () -> service.crear(sinCantidad, "admin"));
    }

    @Test
    void aceptarRegistraQuienYCuando() {
        Cotizacion c = nueva();
        c.setEstado(Cotizacion.CONTACTADO);
        when(repository.findById(1L)).thenReturn(Optional.of(c));

        Cotizacion r = service.cambiarEstado(1L, Cotizacion.ACEPTADA, "admin");

        assertEquals(Cotizacion.ACEPTADA, r.getEstado());
        assertEquals("admin", r.getAceptadaPor());
        assertNotNull(r.getFechaAceptacion());
        verify(historial).registrar(eq("COTIZACION"), any(), eq("ACEPTADA"), any(), eq("admin"));
    }

    @Test
    void rechazarLaDejaListaParaElArchivo() {
        Cotizacion c = nueva();
        when(repository.findById(1L)).thenReturn(Optional.of(c));

        Cotizacion r = service.cambiarEstado(1L, Cotizacion.RECHAZADA, "admin");

        assertEquals(Cotizacion.RECHAZADA, r.getEstado());
        assertNotNull(r.getFechaCierre());
    }

    @Test
    void unaCotizacionConvertidaNoSeModifica() {
        Cotizacion c = nueva();
        c.setEstado(Cotizacion.CONVERTIDA);
        c.setPedidoTracking("TRK-CL-1234");
        when(repository.findById(1L)).thenReturn(Optional.of(c));

        assertThrows(IllegalStateException.class, () -> service.cambiarEstado(1L, Cotizacion.PENDIENTE, "admin"));
    }

    @Test
    void soloSePuedeGenerarGuiaDeUnaCotizacionAceptada() {
        Cotizacion c = nueva();
        c.setEstado(Cotizacion.PENDIENTE);
        when(repository.findById(1L)).thenReturn(Optional.of(c));

        assertThrows(IllegalStateException.class, () -> service.validarParaGuia(1L));
    }

    @Test
    void marcarConvertidaGuardaLaGuiaYCierra() {
        Cotizacion c = nueva();
        c.setEstado(Cotizacion.ACEPTADA);
        when(repository.findById(1L)).thenReturn(Optional.of(c));

        Cotizacion r = service.marcarConvertida(1L, "TRK-CL-1234", "admin");

        assertEquals(Cotizacion.CONVERTIDA, r.getEstado());
        assertEquals("TRK-CL-1234", r.getPedidoTracking());
        assertNotNull(r.getFechaCierre());
    }

    @Test
    void devolverABandejaSoloFuncionaConRechazadas() {
        Cotizacion rechazada = nueva();
        rechazada.setEstado(Cotizacion.RECHAZADA);
        when(repository.findById(1L)).thenReturn(Optional.of(rechazada));
        hayDuplicada(false);

        Cotizacion r = service.devolverABandeja(1L, "admin");
        assertEquals(Cotizacion.PENDIENTE, r.getEstado());
        assertNull(r.getFechaCierre());

        Cotizacion convertida = nueva();
        convertida.setEstado(Cotizacion.CONVERTIDA);
        when(repository.findById(2L)).thenReturn(Optional.of(convertida));
        assertThrows(IllegalStateException.class, () -> service.devolverABandeja(2L, "admin"));
    }
}
