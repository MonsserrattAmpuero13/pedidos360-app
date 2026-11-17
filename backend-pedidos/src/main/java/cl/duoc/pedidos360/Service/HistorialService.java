package cl.duoc.pedidos360.Service;

import cl.duoc.pedidos360.model.EventoHistorial;
import cl.duoc.pedidos360.repository.EventoHistorialRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class HistorialService {

    @Autowired
    private EventoHistorialRepository repository;

    @Transactional
    public void registrar(String tipo, Long entidadId, String accion, String detalle, String usuario) {
        if (entidadId == null) return;
        String u = (usuario == null || usuario.isBlank()) ? "sistema" : usuario.trim();
        repository.save(new EventoHistorial(tipo, entidadId, accion, detalle, u));
    }

    public List<EventoHistorial> listar(String tipo, Long entidadId) {
        return repository.findByTipoAndEntidadIdOrderByFechaAscIdAsc(tipo, entidadId);
    }
}
