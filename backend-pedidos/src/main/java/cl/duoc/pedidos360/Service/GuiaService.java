package cl.duoc.pedidos360.Service;

import cl.duoc.pedidos360.model.Cotizacion;
import cl.duoc.pedidos360.model.Pedido;
import cl.duoc.pedidos360.model.Producto;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Genera una guía a partir de una cotización aceptada en un solo paso: revisa y descuenta el stock,
 * crea la orden y deja la cotización como convertida. Si algo falla, la transacción se revierte completa.
 */
@Service
public class GuiaService {

    static final String COURIER_POR_DEFECTO = "Blue Express";

    @Autowired
    private CotizacionService cotizaciones;

    @Autowired
    private InventarioService inventario;

    @Autowired
    private PedidoService pedidos;

    @Transactional
    public Pedido generarDesdeCotizacion(Long cotizacionId, String courier, String usuario) {
        Cotizacion cot = cotizaciones.validarParaGuia(cotizacionId);
        Producto producto = inventario.resolverProducto(cot.getProductoId(), cot.getSku(), cot.getProducto());

        // El tracking se define antes para dejar el descuento de stock vinculado a esta orden
        String tracking = PedidoService.nuevoTracking();

        // Lanza IllegalStateException (409) si el stock no alcanza
        Producto actualizado = inventario.descontarStock(
                producto.getId(), cot.getCantidad(), tracking, cot.getCliente(), usuario);

        double total = cot.getTotalEst() != null
                ? cot.getTotalEst()
                : actualizado.getPrecio().doubleValue() * cot.getCantidad();

        Pedido pedido = new Pedido();
        pedido.setTracking(tracking);
        pedido.setCliente(cot.getCliente());
        pedido.setProducto(cot.getCantidad() + "x " + cot.getProducto());
        pedido.setCantidad(cot.getCantidad());
        pedido.setTotal(total);
        pedido.setCourier(courier != null && !courier.isBlank() ? courier : COURIER_POR_DEFECTO);
        pedido.setDestino(cot.getComuna() + ", " + cot.getRegion());
        pedido.setCotizacionOrigenId(cot.getId());
        return pedidos.guardarOActualizar(pedido, usuario);
    }
}
