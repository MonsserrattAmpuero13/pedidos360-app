package cl.duoc.pedidos360.Service;

import cl.duoc.pedidos360.dto.PedidoDTOs.DashboardMetricasResponse;
import cl.duoc.pedidos360.repository.PedidoRepository;
import cl.duoc.pedidos360.repository.ProductoRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class ReporteService {

    @Autowired
    private PedidoRepository pedidoRepository;

    @Autowired
    private ProductoRepository productoRepository;

    public DashboardMetricasResponse obtenerMetricas() {
        DashboardMetricasResponse res = new DashboardMetricasResponse();
        res.setTotalPedidos(pedidoRepository.count());
        res.setPendientes(pedidoRepository.countByEstado("PENDIENTE"));
        res.setEnRuta(pedidoRepository.countByEstado("EN_RUTA"));
        res.setEntregados(pedidoRepository.countByEstado("ENTREGADO"));
        res.setConIncidencias(pedidoRepository.countByEstado("INCIDENCIA"));
        res.setAlertasStock((long) productoRepository.findProductosBajoStockMinimo().size());
        return res;
    }
}