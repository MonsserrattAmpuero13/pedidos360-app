package cl.duoc.pedidos360.Service;

import cl.duoc.pedidos360.model.Producto;
import cl.duoc.pedidos360.repository.ProductoRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
public class InventarioService {

    @Autowired
    private ProductoRepository productoRepository;

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
                .orElseThrow(() -> new RuntimeException("Producto no encontrado con ID: " + id));
    }

    @Transactional
    public Producto actualizarStock(Long id, Integer nuevoStock) {
        Producto producto = buscarPorId(id);
        producto.setStockActual(nuevoStock);
        return productoRepository.save(producto);
    }

    @Transactional
    public void descontarStock(Long id, Integer cantidad) {
        Producto producto = buscarPorId(id);
        if (producto.getStockActual() < cantidad) {
            throw new RuntimeException("Stock insuficiente para: " + producto.getNombre() + 
                                       ". Disponible: " + producto.getStockActual() + ", Solicitado: " + cantidad);
        }
        producto.setStockActual(producto.getStockActual() - cantidad);
        productoRepository.save(producto);
    }
}