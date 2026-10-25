package cl.duoc.pedidos360.messaging.kafka;

import cl.duoc.pedidos360.messaging.PedidoEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

/**
 * Publica eventos de negocio en Kafka. Convive con el publicador de Service Bus (no lo reemplaza).
 * Si Kafka esta desactivado o caido, el pedido se guarda igual y solo se registra el error.
 */
@Service
public class KafkaEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(KafkaEventPublisher.class);

    private final KafkaTemplate<String, String> template; // null si app.kafka.enabled=false
    private final ObjectMapper mapper;

    @Value("${app.kafka.topic.pedidos-creados:pedidos-creados}")
    private String topicPedidos = "pedidos-creados";

    @Value("${app.kafka.topic.alertas-stock:alertas-stock}")
    private String topicAlertas = "alertas-stock";

    @Autowired
    public KafkaEventPublisher(ObjectProvider<KafkaTemplate<String, String>> template, ObjectMapper mapper) {
        this(template.getIfAvailable(), mapper);
    }

    KafkaEventPublisher(KafkaTemplate<String, String> template, ObjectMapper mapper) {
        this.template = template;
        this.mapper = mapper;
    }

    /** La clave es el tracking: todos los eventos de un mismo pedido caen en la misma particion (y en orden). */
    public void pedidoCreado(PedidoEvent evento) {
        publicar(topicPedidos, evento.tracking(), evento);
    }

    /** La clave es el SKU: las alertas de un mismo producto quedan en orden dentro de su particion. */
    public void alertaStock(AlertaStockEvent evento) {
        publicar(topicAlertas, evento.sku(), evento);
    }

    private void publicar(String topic, String clave, Object evento) {
        if (template == null) {
            log.debug("Kafka desactivado: no se publica en {}", topic);
            return;
        }
        try {
            String json = mapper.writeValueAsString(evento);
            template.send(topic, clave, json).whenComplete((resultado, error) -> {
                if (error != null) {
                    log.error("No se pudo publicar en Kafka ({}), clave {}", topic, clave, error);
                } else {
                    var meta = resultado.getRecordMetadata();
                    log.info("Kafka OK topic={} particion={} offset={} clave={}",
                            meta.topic(), meta.partition(), meta.offset(), clave);
                }
            });
        } catch (Exception e) {
            log.error("Error al enviar evento a Kafka ({}), clave {}", topic, clave, e);
        }
    }
}
