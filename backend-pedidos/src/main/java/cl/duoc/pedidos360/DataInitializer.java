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
        // Catalogo inicial: se crea lo que falta y se actualizan datos descriptivos por SKU.
        // El stock solo se fija al crear el producto, para no pisar el stock real en cada reinicio.
        sincronizar("ASEO-001", "Detergente Industrial 5L", "Bidón concentrado para aseo profundo", "Aseo", "12990", 45, 10);
        sincronizar("ASEO-002", "Cloro Gel Desinfectante 1L", "Envase individual alta desinfección", "Aseo", "2490", 40, 15);
        sincronizar("ABAR-001", "Arroz Grado 1 Saco 10kg", "Grano selecto para abastecimiento", "Abarrotes", "11500", 120, 20);
        sincronizar("ABAR-002", "Aceite Vegetal Comestible Bidón 5L", "Aceite refinado para cocinas", "Abarrotes", "9890", 50, 12);
        sincronizar("BEB-001", "Bebida Cola Retornable 1.5L Pack 6", "Ideal para almacenes", "Bebidas", "7500", 80, 15);
        sincronizar("BEB-002", "Agua Mineral Sin Gas 500cc Pack 24", "Formato individual comercial", "Bebidas", "8900", 90, 20);
        sincronizar("LAC-001", "Leche Entera UHT 1L Caja 12", "Larga vida envasada", "Lácteos", "10990", 50, 10);
        sincronizar("FER-001", "Cinta de Embalaje Transparente 48mmx100m", "Alta resistencia industrial", "Ferretería y Empaque", "1990", 150, 30);
        sincronizar("FER-002", "Caja de Cartón Corrugado N4 Pack 10", "Para envíos y bodegaje", "Ferretería y Empaque", "8500", 75, 15);
        sincronizar("OFI-001", "Resma Papel Bond Oficio 500 Hojas", "Papel certificado impresión", "Oficina", "5900", 80, 20);

        if (pedidoRepository.count() == 0) {
            Pedido p1 = new Pedido("P360-TEST01", "Minimarket Don Pepe", "Detergente Industrial 5L", 2, 25980.0, "Carlos Transportes", "Av. San Martín 1042, Maipú", "EN_RUTA", null);
            Pedido p2 = new Pedido("P360-TEST02", "Almacén Los Aromos", "Arroz Grado 1 (1kg)", 10, 13500.0, "Juan Couriers", "Calle Las Flores 450, Puente Alto", "PENDIENTE", null);
            pedidoRepository.save(p1);
            pedidoRepository.save(p2);
        }
    }

    private void sincronizar(String sku, String nombre, String descripcion, String categoria,
                             String precio, int stock, int stockMinimo) {
        Producto p = productoRepository.findBySku(sku).orElseGet(() -> {
            Producto nuevo = new Producto();
            nuevo.setSku(sku);
            nuevo.setStockActual(stock);
            return nuevo;
        });
        p.setNombre(nombre);
        p.setDescripcion(descripcion);
        p.setCategoria(categoria);
        p.setPrecio(new BigDecimal(precio));
        p.setStockMinimo(stockMinimo);
        p.setImagen("productos/" + sku + ".svg");
        productoRepository.save(p);
    }
}
