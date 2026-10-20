package cl.duoc.pedidos360.messaging;

import com.azure.messaging.servicebus.ServiceBusClientBuilder;
import com.azure.messaging.servicebus.ServiceBusSenderClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ServiceBusConfig {

    @Value("${spring.cloud.azure.servicebus.connection-string}")
    private String connectionString;

    @Value("${app.servicebus.topic}")
    private String topic;

    @Bean
    public ServiceBusSenderClient pedidosSender() {
        return new ServiceBusClientBuilder()
                .connectionString(connectionString)
                .sender()
                .topicName(topic)
                .buildClient();
    }
}