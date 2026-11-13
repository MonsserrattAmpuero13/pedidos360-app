package cl.duoc.pedidos360.Service;

import cl.duoc.pedidos360.messaging.kafka.AlertaStockEvent;
import cl.duoc.pedidos360.messaging.kafka.KafkaEventPublisher;
import cl.duoc.pedidos360.model.MovimientoStock;
import cl.duoc.pedidos360.model.Producto;
import cl.duoc.pedidos360.repository.MovimientoStockRepository;
import cl.duoc.pedidos360.repository.ProductoRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.NoSuchElementException;

@Service
public class InventarioService {

    @Autowired
    private ProductoRepository productoRepository;

    @Autowired
    private KafkaEventPublisher kafkaPublisher;

    @Autowired
    private MovimientoStockRepository movimientos;

    public List<Producto> listarTodos() {
        return productoRepository.findAll();
    }

    public List<Producto> listarAlertasQuiebre() {
        return productoRepository.findProductosBajoStockMinimo();
    }

    public Producto guardar(Producto producto) {
        return productoRepository.save(producto);
    }

    public Producto buscarPorId(Long id) {
        return productoRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Producto no encontrado con ID: " + id));
    }

    @Transactional
    public Producto actualizar(Long id, Producto datos) {
        Producto producto = buscarPorId(id);
        producto.setSku(datos.getSku());
        producto.setNombre(datos.getNombre());
        producto.setDescripcion(datos.getDescripcion());
        producto.setCategoria(datos.getCategoria());
        producto.setPrecio(datos.getPrecio());
        int antes = producto.getStockActual() == null ? 0 : producto.getStockActual();
        if (datos.getStockActual() != null) {
            producto.setStockActual(datos.getStockActual());
            registrar(producto, MovimientoStock.AJUSTE, antes, datos.getStockActual(), null, null, null);
        }
        producto.setStockMinimo(datos.getStockMinimo());
        producto.setImagen(datos.getImagen());
        return productoRepository.save(producto);
    }

    @Transactional
    public void eliminar(Long id) {
        productoRepository.delete(buscarPorId(id));
    }

    public Producto actualizarStock(Long id, Integer nuevoStock) {
        return actualizarStock(id, nuevoStock, null);
    }

    @Transactional
    public Producto actualizarStock(Long id, Integer nuevoStock, String usuario) {
        if (nuevoStock == null || nuevoStock < 0) {
            throw new IllegalArgumentException("El stock debe ser un numero mayor o igual a 0");
        }
        Producto producto = buscarPorId(id);
        int antes = producto.getStockActual() == null ? 0 : producto.getStockActual();
        producto.setStockActual(nuevoStock);
        registrar(producto, MovimientoStock.AJUSTE, antes, nuevoStock, null, null, usuario);
        Producto guardado = productoRepository.save(producto);
        avisarSiBajoMinimo(guardado);
        return guardado;
    }

    /**
     * Encuentra el producto de una cotización: por id, luego por SKU y, para cotizaciones antiguas, por nombre.
     * Si no lo encuentra falla, en vez de dejar pasar la guía sin revisar el stock.
     */
    public Producto resolverProducto(Long id, String sku, String nombre) {
        if (id != null) {
            var porId = productoRepository.findById(id);
            if (porId.isPresent()) return porId.get();
        }
        if (sku != null && !sku.isBlank()) {
            var porSku = productoRepository.findBySku(sku.trim());
            if (porSku.isPresent()) return porSku.get();
        }
        if (nombre != null && !nombre.isBlank()) {
            String buscado = nombre.trim().toLowerCase();
            List<Producto> todos = productoRepository.findAll();
            for (Producto p : todos) {
                if (p.getNombre() != null && p.getNombre().trim().equalsIgnoreCase(buscado)) return p;
            }
            for (Producto p : todos) {
                String n = p.getNombre() == null ? "" : p.getNombre().toLowerCase();
                if (!n.isEmpty() && (n.contains(buscado) || buscado.contains(n))) return p;
            }
        }
        throw new IllegalStateException("No se encontró el producto «" + nombre
                + "» en el catálogo, por lo que no se puede verificar el stock. Revisa el catálogo antes de generar la guía.");
    }

    /** Descuenta stock de forma atomica; si no alcanza, lanza IllegalStateException (la API responde 409). */
    public Producto descontarStock(Long id, Integer cantidad) {
        return descontarStock(id, cantidad, null, null, null);
    }

    /** Igual que el anterior, pero deja registrado a qué orden (tracking) y cliente corresponde el descuento. */
    @Transactional
    public Producto descontarStock(Long id, Integer cantidad, String referencia, String cliente, String usuario) {
        if (cantidad == null || cantidad <= 0) {
            throw new IllegalArgumentException("La cantidad debe ser mayor a 0");
        }
        Producto producto = buscarPorId(id);
        if (producto.getStockActual() < cantidad) {
            throw new IllegalStateException("Stock insuficiente para: " + producto.getNombre()
                    + ". Disponible: " + producto.getStockActual() + ", solicitado: " + cantidad);
        }
        int antes = producto.getStockActual();
        producto.setStockActual(antes - cantidad);
        registrar(producto, MovimientoStock.DESCUENTO, antes, antes - cantidad, referencia, cliente, usuario);
        Producto guardado = productoRepository.save(producto);
        avisarSiBajoMinimo(guardado);
        return guardado;
    }

    public List<MovimientoStock> movimientosDe(Long productoId) {
        buscarPorId(productoId);
        return movimientos.findByProductoIdOrderByFechaDescIdDesc(productoId);
    }

    private void registrar(Producto p, String tipo, int antes, int despues, String ref, String cliente, String usuario) {
        if (antes == despues) return;
        movimientos.save(new MovimientoStock(p.getId(), tipo, antes, despues, ref, cliente, usuario));
    }

    /** Publica en Kafka (topico alertas-stock) cuando el producto queda en o bajo su stock minimo. */
    private void avisarSiBajoMinimo(Producto p) {
        if (p.getStockActual() != null && p.getStockMinimo() != null && p.getStockActual() <= p.getStockMinimo()) {
            kafkaPublisher.alertaStock(new AlertaStockEvent(
                    p.getId(), p.getSku(), p.getNombre(), p.getStockActual(), p.getStockMinimo()));
        }
    }
}
