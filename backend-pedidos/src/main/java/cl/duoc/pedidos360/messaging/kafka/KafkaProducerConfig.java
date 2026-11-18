package cl.duoc.pedidos360.messaging.kafka;

import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.common.serialization.StringSerializer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.core.DefaultKafkaProducerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.core.ProducerFactory;

import java.util.HashMap;
import java.util.Map;

/**
 * Productor Kafka. Solo se crea si app.kafka.enabled=true, asi el backend desplegado en Azure
 * (que no ve el cluster local) sigue funcionando igual que antes.
 */
@Configuration
@ConditionalOnProperty(name = "app.kafka.enabled", havingValue = "true")
public class KafkaProducerConfig {

    @Value("${app.kafka.bootstrap-servers}")
    private String bootstrapServers;

    /** Conexion segura opcional (p. ej. Azure Event Hubs: SASL_SSL + PLAIN). Si estan vacias, se conecta sin seguridad como en Docker. */
    @Value("${app.kafka.security-protocol:}")
    private String securityProtocol;

    @Value("${app.kafka.sasl-mechanism:}")
    private String saslMechanism;

    @Value("${app.kafka.sasl-jaas-config:}")
    private String saslJaasConfig;

    /** Alternativa sin "$" en la variable de entorno: Azure App Service reemplaza "$ConnectionString" por vacio.
     *  Con la cadena de conexion de Event Hubs aqui, el usuario "$ConnectionString" se arma en el codigo. */
    @Value("${app.kafka.sasl-password:}")
    private String saslPassword;

    /** Ajustes del productor que Event Hubs no admite igual que un Kafka propio (idempotencia, compresion)
     *  y espera maxima de conexion. Por defecto quedan como en el cluster Docker. */
    @Value("${app.kafka.idempotence:true}")
    private boolean idempotencia;

    @Value("${app.kafka.compression:gzip}")
    private String compresion;

    @Value("${app.kafka.max-block-ms:3000}")
    private int maxBlockMs;

    private void aplicarSeguridad(Map<String, Object> props) {
        if (!securityProtocol.isBlank()) props.put("security.protocol", securityProtocol);
        if (!saslMechanism.isBlank()) props.put("sasl.mechanism", saslMechanism);
        if (!saslPassword.isBlank()) {
            props.put("sasl.jaas.config", "org.apache.kafka.common.security.plain.PlainLoginModule required "
                    + "username=\"$ConnectionString\" password=\"" + saslPassword + "\";");
        } else if (!saslJaasConfig.isBlank()) {
            props.put("sasl.jaas.config", saslJaasConfig);
        }
    }

    @Bean
    public ProducerFactory<String, String> producerFactory() {
        Map<String, Object> props = new HashMap<>();
        props.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        props.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        props.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        // Un mensaje se da por recibido solo cuando las replicas sincronizadas lo tienen (min.insync.replicas=2)
        props.put(ProducerConfig.ACKS_CONFIG, "all");
        props.put(ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG, idempotencia);
        props.put(ProducerConfig.CLIENT_ID_CONFIG, "pedidos360-productor");
        // Reintentos ante fallas temporales; con idempotencia no se duplican mensajes ni se pierde el orden
        props.put(ProducerConfig.RETRIES_CONFIG, 5);
        props.put(ProducerConfig.RETRY_BACKOFF_MS_CONFIG, 300);
        props.put(ProducerConfig.MAX_IN_FLIGHT_REQUESTS_PER_CONNECTION, 5);
        // Agrupa mensajes unos milisegundos y los comprime (gzip) para enviar menos datos por la red
        props.put(ProducerConfig.LINGER_MS_CONFIG, 5);
        props.put(ProducerConfig.BATCH_SIZE_CONFIG, 32768);
        props.put(ProducerConfig.COMPRESSION_TYPE_CONFIG, compresion);
        // Si Kafka no responde, no dejar colgada la peticion del usuario
        props.put(ProducerConfig.MAX_BLOCK_MS_CONFIG, maxBlockMs);
        props.put(ProducerConfig.REQUEST_TIMEOUT_MS_CONFIG, 5000);
        props.put(ProducerConfig.DELIVERY_TIMEOUT_MS_CONFIG, 10000);
        aplicarSeguridad(props);
        return new DefaultKafkaProducerFactory<>(props);
    }

    @Bean
    public KafkaTemplate<String, String> kafkaTemplate(ProducerFactory<String, String> producerFactory) {
        return new KafkaTemplate<>(producerFactory);
    }
}
