package cl.duoc.pedidos360.Service;

import cl.duoc.pedidos360.messaging.kafka.AlertaStockEvent;
import cl.duoc.pedidos360.messaging.kafka.KafkaEventPublisher;
import cl.duoc.pedidos360.model.Producto;
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
        if (datos.getStockActual() != null) {
            producto.setStockActual(datos.getStockActual());
        }
        producto.setStockMinimo(datos.getStockMinimo());
        producto.setImagen(datos.getImagen());
        return productoRepository.save(producto);
    }

    @Transactional
    public void eliminar(Long id) {
        productoRepository.delete(buscarPorId(id));
    }

    @Transactional
    public Producto actualizarStock(Long id, Integer nuevoStock) {
        if (nuevoStock == null || nuevoStock < 0) {
            throw new IllegalArgumentException("El stock debe ser un numero mayor o igual a 0");
        }
        Producto producto = buscarPorId(id);
        producto.setStockActual(nuevoStock);
        Producto guardado = productoRepository.save(producto);
        avisarSiBajoMinimo(guardado);
        return guardado;
    }

    /** Descuenta stock de forma atomica; si no alcanza, lanza IllegalStateException (la API responde 409). */
    @Transactional
    public Producto descontarStock(Long id, Integer cantidad) {
        if (cantidad == null || cantidad <= 0) {
            throw new IllegalArgumentException("La cantidad debe ser mayor a 0");
        }
        Producto producto = buscarPorId(id);
        if (producto.getStockActual() < cantidad) {
            throw new IllegalStateException("Stock insuficiente para: " + producto.getNombre()
                    + ". Disponible: " + producto.getStockActual() + ", solicitado: " + cantidad);
        }
        producto.setStockActual(producto.getStockActual() - cantidad);
        Producto guardado = productoRepository.save(producto);
        avisarSiBajoMinimo(guardado);
        return guardado;
    }

    /** Publica en Kafka (topico alertas-stock) cuando el producto queda en o bajo su stock minimo. */
    private void avisarSiBajoMinimo(Producto p) {
        if (p.getStockActual() != null && p.getStockMinimo() != null && p.getStockActual() <= p.getStockMinimo()) {
            kafkaPublisher.alertaStock(new AlertaStockEvent(
                    p.getId(), p.getSku(), p.getNombre(), p.getStockActual(), p.getStockMinimo()));
        }
    }
}
