package cl.duoc.pedidos360.controller;

import cl.duoc.pedidos360.dto.PedidoDTOs.DashboardMetricasResponse;
import cl.duoc.pedidos360.Service.ReporteService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/reportes")
@CrossOrigin(origins = "*")
public class ReporteController {

    @Autowired
    private ReporteService reporteService;

    @GetMapping("/metricas")
    public ResponseEntity<DashboardMetricasResponse> obtenerMetricas() {
        return ResponseEntity.ok(reporteService.obtenerMetricas());
    }
}