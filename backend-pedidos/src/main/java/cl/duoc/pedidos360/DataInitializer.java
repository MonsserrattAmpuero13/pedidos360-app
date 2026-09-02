package cl.duoc.pedidos360;

import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class DataInitializer {

    @Bean
    CommandLineRunner initDatabase(PedidoRepository repository) {
        return args -> {
            // Solo inserta si la base de datos está vacía para no duplicar en reinicios
            if (repository.count() == 0) {
                repository.save(new Pedido(
                    "TRK-CL-9021",
                    "Juan Pérez",
                    "Notebook Lenovo ThinkPad E14",
                    1,
                    680000.0,
                    "Blue Express",
                    "Santiago Centro",
                    "Entregado",
                    null
                ));

                repository.save(new Pedido(
                    "TRK-CL-4105",
                    "María López",
                    "Monitor Samsung 27 Curvo 144Hz",
                    2,
                    360000.0,
                    "Chilexpress",
                    "Pudahuel",
                    "En Reparto",
                    null
                ));

                repository.save(new Pedido(
                    "TRK-CL-7732",
                    "Carlos Silva",
                    "Teclado Mecánico Logitech MX",
                    1,
                    89990.0,
                    "Flota Propia",
                    "Maipú",
                    "Incidencia en Ruta",
                    "Dirección inaccesible - Sin timbre"
                ));
            }
        };
    }
}