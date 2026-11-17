package cl.duoc.pedidos360.Service;

import cl.duoc.pedidos360.model.Pedido;
import cl.duoc.pedidos360.repository.PedidoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PedidoServiceTest {

    private PedidoRepository repository;
    private PedidoService service;
    private HistorialService historial;
    private CotizacionService cotizaciones;

    @BeforeEach
    void preparar() {
        repository = mock(PedidoRepository.class);
        service = new PedidoService();
        historial = mock(HistorialService.class);
        cotizaciones = mock(CotizacionService.class);
        ReflectionTestUtils.setField(service, "pedidoRepository", repository);
        ReflectionTestUtils.setField(service, "historial", historial);
        ReflectionTestUtils.setField(service, "cotizacionService", cotizaciones);
        when(repository.save(any(Pedido.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    void generaTrackingYEstadoCuandoVienenVacios() {
        Pedido nuevo = new Pedido();

        Pedido guardado = service.guardarOActualizar(nuevo, "admin");

        assertTrue(guardado.getTracking().startsWith("TRK-CL-"));
        assertEquals("En Preparacion", guardado.getEstado());
    }

    @Test
    void conservaTrackingYEstadoCuandoVienenDefinidos() {
        Pedido nuevo = new Pedido();
        nuevo.setTracking("TRK-PROPIO-1");
        nuevo.setEstado("En Transito");

        Pedido guardado = service.guardarOActualizar(nuevo, "admin");

        assertEquals("TRK-PROPIO-1", guardado.getTracking());
        assertEquals("En Transito", guardado.getEstado());
    }

    @Test
    void actualizaElEstadoDeUnPedidoExistente() {
        Pedido existente = new Pedido();
        existente.setEstado("En Preparacion");
        when(repository.findById(1L)).thenReturn(Optional.of(existente));

        Pedido resultado = service.actualizarEstado(1L, "En Reparto", "admin");

        assertEquals("En Reparto", resultado.getEstado());
    }

    @Test
    void falloAlActualizarEstadoDeUnPedidoInexistente() {
        when(repository.findById(99L)).thenReturn(Optional.empty());

        assertThrows(RuntimeException.class, () -> service.actualizarEstado(99L, "En Reparto", "admin"));
    }

    @Test
    void registrarIncidenciaCambiaElEstado() {
        Pedido existente = new Pedido();
        when(repository.findById(1L)).thenReturn(Optional.of(existente));

        Pedido resultado = service.actualizarIncidencia(1L, "Direccion no encontrada", "admin");

        assertEquals("Direccion no encontrada", resultado.getIncidencia());
        assertEquals("Incidencia en Ruta", resultado.getEstado());
    }

    @Test
    void resolverIncidenciaLimpiaElMotivoYVuelveAEnTransito() {
        Pedido existente = new Pedido();
        existente.setIncidencia("Direccion no encontrada");
        when(repository.findById(1L)).thenReturn(Optional.of(existente));

        Pedido resultado = service.actualizarIncidencia(1L, "", "admin");

        assertNull(resultado.getIncidencia());
        assertEquals("En Transito", resultado.getEstado());
    }

    @Test
    void buscarPorTrackingInexistenteLanzaError() {
        when(repository.findByTracking("NO-EXISTE")).thenReturn(Optional.empty());

        assertThrows(RuntimeException.class, () -> service.buscarPorTracking("NO-EXISTE"));
    }

    @Test
    void eliminarEsLogicoYDejaConstanciaEnElHistorial() {
        Pedido existente = new Pedido();
        when(repository.findById(5L)).thenReturn(Optional.of(existente));

        service.eliminarPedido(5L, "admin");

        assertTrue(existente.getEliminado());
        assertEquals("admin", existente.getEliminadoPor());
        assertNotNull(existente.getFechaEliminacion());
        verify(repository).save(existente);
        verify(repository, never()).deleteById(any());
        verify(historial).registrar(eq("PEDIDO"), eq(5L), eq("ELIMINADA"), any(), eq("admin"));
    }

    @Test
    void laCreacionRegistraFechaYUsuarioAunqueElClienteLosEnvie() {
        Pedido nuevo = new Pedido();
        nuevo.setEliminado(true);
        nuevo.setCreadoPor("otro");

        Pedido guardado = service.guardarOActualizar(nuevo, "admin");

        assertNotNull(guardado.getFechaCreacion());
        assertEquals("admin", guardado.getCreadoPor());
        assertEquals(false, guardado.getEliminado());
    }

    @Test
    void marcarEntregadoGuardaLaFechaDeCierre() {
        Pedido existente = new Pedido();
        existente.setEstado("En Reparto");
        when(repository.findById(1L)).thenReturn(Optional.of(existente));

        Pedido resultado = service.actualizarEstado(1L, "Entregado", "admin");

        assertNotNull(resultado.getFechaCierre());
        verify(historial).registrar(eq("PEDIDO"), any(), eq("ENTREGADA"), any(), eq("admin"));
    }
}
