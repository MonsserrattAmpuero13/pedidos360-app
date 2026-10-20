package cl.duoc.pedidos360.messaging;

import com.azure.messaging.servicebus.ServiceBusMessage;
import com.azure.messaging.servicebus.ServiceBusSenderClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

@Service
public class PedidoEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(PedidoEventPublisher.class);

    private final ServiceBusSenderClient sender;
    private final ObjectMapper mapper;

    public PedidoEventPublisher(ServiceBusSenderClient sender, ObjectMapper mapper) {
        this.sender = sender;
        this.mapper = mapper;
    }

    public void pedidoCreado(PedidoEvent evento) {
        try {
            ServiceBusMessage msg = new ServiceBusMessage(mapper.writeValueAsString(evento));
            msg.setSubject("pedido.creado");
            sender.sendMessage(msg);
            log.info("Evento pedido.creado enviado: {}", evento.tracking());
        } catch (Exception e) {
            log.error("No se pudo publicar el evento del pedido {}", evento.tracking(), e);
        }
    }
}
