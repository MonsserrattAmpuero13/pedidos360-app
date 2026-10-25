package cl.duoc.pedidos360.messaging.kafka;

import cl.duoc.pedidos360.messaging.PedidoEvent;
import org.junit.jupiter.api.Test;
import org.springframework.kafka.core.KafkaTemplate;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

import java.util.concurrent.CompletableFuture;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class KafkaEventPublisherTest {

    private final ObjectMapper mapper = JsonMapper.builder().build();

    @SuppressWarnings("unchecked")
    private KafkaTemplate<String, String> plantilla() {
        return mock(KafkaTemplate.class);
    }

    @Test
    void pedidoCreadoSePublicaEnSuTopicoConElTrackingComoClave() {
        KafkaTemplate<String, String> template = plantilla();
        when(template.send(anyString(), anyString(), anyString())).thenReturn(new CompletableFuture<>());
        KafkaEventPublisher publisher = new KafkaEventPublisher(template, mapper);

        publisher.pedidoCreado(new PedidoEvent(1L, "TRK-1", "Cliente", "Santiago", 1000));

        verify(template).send(eq("pedidos-creados"), eq("TRK-1"), contains("\"tracking\":\"TRK-1\""));
    }

    @Test
    void alertaStockSePublicaEnSuTopicoConElSkuComoClave() {
        KafkaTemplate<String, String> template = plantilla();
        when(template.send(anyString(), anyString(), anyString())).thenReturn(new CompletableFuture<>());
        KafkaEventPublisher publisher = new KafkaEventPublisher(template, mapper);

        publisher.alertaStock(new AlertaStockEvent(5L, "ASEO-001", "Detergente", 3, 10));

        verify(template).send(eq("alertas-stock"), eq("ASEO-001"), contains("\"stockActual\":3"));
    }

    @Test
    void conKafkaDesactivadoNoHaceNadaYNoFalla() {
        KafkaEventPublisher publisher = new KafkaEventPublisher((KafkaTemplate<String, String>) null, mapper);

        assertDoesNotThrow(() -> publisher.pedidoCreado(new PedidoEvent(1L, "TRK-1", "C", "D", 1)));
    }

    @Test
    void siKafkaFallaElPedidoNoSeAfecta() {
        KafkaTemplate<String, String> template = plantilla();
        when(template.send(anyString(), anyString(), anyString())).thenThrow(new RuntimeException("Kafka caido"));
        KafkaEventPublisher publisher = new KafkaEventPublisher(template, mapper);

        assertDoesNotThrow(() -> publisher.pedidoCreado(new PedidoEvent(1L, "TRK-1", "C", "D", 1)));
    }
}
