package cl.duoc.pedidos360.Service;

import cl.duoc.pedidos360.model.Pedido;
import cl.duoc.pedidos360.repository.PedidoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PedidoServiceTest {

    private PedidoRepository repository;
    private PedidoService service;

    @BeforeEach
    void preparar() {
        repository = mock(PedidoRepository.class);
        service = new PedidoService();
        ReflectionTestUtils.setField(service, "pedidoRepository", repository);
        when(repository.save(any(Pedido.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    void generaTrackingYEstadoCuandoVienenVacios() {
        Pedido nuevo = new Pedido();

        Pedido guardado = service.guardarOActualizar(nuevo);

        assertTrue(guardado.getTracking().startsWith("TRK-CL-"));
        assertEquals("En Preparacion", guardado.getEstado());
    }

    @Test
    void conservaTrackingYEstadoCuandoVienenDefinidos() {
        Pedido nuevo = new Pedido();
        nuevo.setTracking("TRK-PROPIO-1");
        nuevo.setEstado("En Transito");

        Pedido guardado = service.guardarOActualizar(nuevo);

        assertEquals("TRK-PROPIO-1", guardado.getTracking());
        assertEquals("En Transito", guardado.getEstado());
    }

    @Test
    void actualizaElEstadoDeUnPedidoExistente() {
        Pedido existente = new Pedido();
        existente.setEstado("En Preparacion");
        when(repository.findById(1L)).thenReturn(Optional.of(existente));

        Pedido resultado = service.actualizarEstado(1L, "En Reparto");

        assertEquals("En Reparto", resultado.getEstado());
    }

    @Test
    void falloAlActualizarEstadoDeUnPedidoInexistente() {
        when(repository.findById(99L)).thenReturn(Optional.empty());

        assertThrows(RuntimeException.class, () -> service.actualizarEstado(99L, "En Reparto"));
    }

    @Test
    void registrarIncidenciaCambiaElEstado() {
        Pedido existente = new Pedido();
        when(repository.findById(1L)).thenReturn(Optional.of(existente));

        Pedido resultado = service.actualizarIncidencia(1L, "Direccion no encontrada");

        assertEquals("Direccion no encontrada", resultado.getIncidencia());
        assertEquals("Incidencia en Ruta", resultado.getEstado());
    }

    @Test
    void resolverIncidenciaLimpiaElMotivoYVuelveAEnTransito() {
        Pedido existente = new Pedido();
        existente.setIncidencia("Direccion no encontrada");
        when(repository.findById(1L)).thenReturn(Optional.of(existente));

        Pedido resultado = service.actualizarIncidencia(1L, "");

        assertNull(resultado.getIncidencia());
        assertEquals("En Transito", resultado.getEstado());
    }

    @Test
    void buscarPorTrackingInexistenteLanzaError() {
        when(repository.findByTracking("NO-EXISTE")).thenReturn(Optional.empty());

        assertThrows(RuntimeException.class, () -> service.buscarPorTracking("NO-EXISTE"));
    }

    @Test
    void eliminaElPedidoPorId() {
        service.eliminarPedido(5L);

        verify(repository).deleteById(5L);
    }
}
