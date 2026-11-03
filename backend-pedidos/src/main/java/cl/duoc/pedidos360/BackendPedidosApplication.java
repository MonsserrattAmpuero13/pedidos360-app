package cl.duoc.pedidos360;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import jakarta.annotation.PostConstruct;
import java.util.TimeZone;

@SpringBootApplication
public class BackendPedidosApplication {

	/** El servidor en Azure corre en UTC; las fechas del historial se guardan en hora de Chile. */
	@PostConstruct
	void zonaHoraria() {
		TimeZone.setDefault(TimeZone.getTimeZone("America/Santiago"));
	}

	public static void main(String[] args) {
		SpringApplication.run(BackendPedidosApplication.class, args);
	}

}


