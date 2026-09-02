package cl.duoc.pedidos360;

import cl.duoc.pedidos360.model.Pedido;
import cl.duoc.pedidos360.model.Producto;
import cl.duoc.pedidos360.repository.PedidoRepository;
import cl.duoc.pedidos360.repository.ProductoRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

@Component
public class DataInitializer implements CommandLineRunner {

    @Autowired
    private ProductoRepository productoRepository;

    @Autowired
    private PedidoRepository pedidoRepository;

    @Override
    public void run(String... args) throws Exception {
        if (productoRepository.count() == 0) {
            productoRepository.save(new Producto(null, "ASEO-001", "Detergente Industrial 5L", "Bidón concentrado", "Aseo", new BigDecimal("12990"), 45, 10));
            productoRepository.save(new Producto(null, "ASEO-002", "Cloro Gel Desinfectante 1L", "Envase individual", "Aseo", new BigDecimal("2490"), 5, 15));
            productoRepository.save(new Producto(null, "ABAR-001", "Arroz Grado 1 (1kg)", "Bolsa individual", "Abarrotes", new BigDecimal("1350"), 120, 20));
            productoRepository.save(new Producto(null, "ABAR-002", "Aceite Vegetal 900ml", "Botella", "Abarrotes", new BigDecimal("2190"), 8, 12));
        }

        if (pedidoRepository.count() == 0) {
            Pedido p1 = new Pedido("P360-TEST01", "Minimarket Don Pepe", "Detergente Industrial 5L", 2, 25980.0, "Carlos Transportes", "Av. San Martín 1042, Maipú", "EN_RUTA", null);
            Pedido p2 = new Pedido("P360-TEST02", "Almacén Los Aromos", "Arroz Grado 1 (1kg)", 10, 13500.0, "Juan Couriers", "Calle Las Flores 450, Puente Alto", "PENDIENTE", null);
            pedidoRepository.save(p1);
            pedidoRepository.save(p2);
        }
    }
}