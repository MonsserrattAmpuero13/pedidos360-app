package cl.duoc.pedidos360.Service;

import cl.duoc.pedidos360.model.Cotizacion;
import cl.duoc.pedidos360.model.Pedido;
import cl.duoc.pedidos360.model.Producto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class GuiaServiceTest {

    private CotizacionService cotizaciones;
    private InventarioService inventario;
    private PedidoService pedidos;
    private GuiaService service;

    @BeforeEach
    void preparar() {
        cotizaciones = mock(CotizacionService.class);
        inventario = mock(InventarioService.class);
        pedidos = mock(PedidoService.class);
        service = new GuiaService();
        ReflectionTestUtils.setField(service, "cotizaciones", cotizaciones);
        ReflectionTestUtils.setField(service, "inventario", inventario);
        ReflectionTestUtils.setField(service, "pedidos", pedidos);
        when(pedidos.guardarOActualizar(any(Pedido.class), any())).thenAnswer(inv -> inv.getArgument(0));
    }

    private Cotizacion aceptada() {
        Cotizacion c = new Cotizacion();
        c.setId(7L);
        c.setCliente("Minimarket Don Juan");
        c.setProducto("Arroz Grado 1 Saco 10kg");
        c.setProductoId(3L);
        c.setCantidad(10);
        c.setRegion("Metropolitana");
        c.setComuna("Maipú");
        c.setTotalEst(115000.0);
        c.setEstado(Cotizacion.ACEPTADA);
        return c;
    }

    private Producto producto() {
        Producto p = mock(Producto.class);
        when(p.getId()).thenReturn(3L);
        when(p.getPrecio()).thenReturn(new BigDecimal("11500"));
        return p;
    }

    @Test
    void descuentaElStockYCreaLaGuiaConLosDatosDeLaCotizacion() {
        Cotizacion cot = aceptada();
        Producto p = producto();
        when(cotizaciones.validarParaGuia(7L)).thenReturn(cot);
        when(inventario.resolverProducto(3L, null, "Arroz Grado 1 Saco 10kg")).thenReturn(p);
        when(inventario.descontarStock(eq(3L), eq(10), any(), any(), any())).thenReturn(p);

        Pedido guia = service.generarDesdeCotizacion(7L, null, "admin");

        verify(inventario).descontarStock(eq(3L), eq(10), any(), any(), any());
        assertEquals("Minimarket Don Juan", guia.getCliente());
        assertEquals("10x Arroz Grado 1 Saco 10kg", guia.getProducto());
        assertEquals("Maipú, Metropolitana", guia.getDestino());
        assertEquals("Blue Express", guia.getCourier());
        assertEquals(115000.0, guia.getTotal());
        assertEquals(7L, guia.getCotizacionOrigenId());
    }

    @Test
    void siNoHayStockNoSeCreaLaGuia() {
        Cotizacion cot = aceptada();
        Producto p = producto();
        when(cotizaciones.validarParaGuia(7L)).thenReturn(cot);
        when(inventario.resolverProducto(any(), any(), any())).thenReturn(p);
        when(inventario.descontarStock(eq(3L), eq(10), any(), any(), any())).thenThrow(new IllegalStateException("Stock insuficiente"));

        assertThrows(IllegalStateException.class, () -> service.generarDesdeCotizacion(7L, null, "admin"));
        verify(pedidos, never()).guardarOActualizar(any(), any());
    }

    @Test
    void siElProductoNoSeEncuentraNoSeDejaPasarSinRevisarStock() {
        when(cotizaciones.validarParaGuia(7L)).thenReturn(aceptada());
        when(inventario.resolverProducto(any(), any(), any())).thenThrow(new IllegalStateException("No se encontró el producto"));

        assertThrows(IllegalStateException.class, () -> service.generarDesdeCotizacion(7L, null, "admin"));
        verify(inventario, never()).descontarStock(any(), any(), any(), any(), any());
    }

    @Test
    void usaElCourierIndicado() {
        Cotizacion cot = aceptada();
        Producto p = producto();
        when(cotizaciones.validarParaGuia(7L)).thenReturn(cot);
        when(inventario.resolverProducto(any(), any(), any())).thenReturn(p);
        when(inventario.descontarStock(eq(3L), eq(10), any(), any(), any())).thenReturn(p);

        Pedido guia = service.generarDesdeCotizacion(7L, "Chilexpress", "admin");

        assertEquals("Chilexpress", guia.getCourier());
    }
}
