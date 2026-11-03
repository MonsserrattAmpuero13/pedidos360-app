package cl.duoc.pedidos360.controller;

import org.springframework.security.core.Authentication;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

/** Determina quién realiza una acción, para dejarlo en el historial. */
final class UsuarioUtil {

    private UsuarioUtil() {}

    /**
     * El front envía el nombre de la sesión en la cabecera X-Usuario (codificado en URL).
     * Si no viene, se usa el identificador del token JWT.
     */
    static String actual(String cabecera, Authentication auth) {
        if (cabecera != null && !cabecera.isBlank()) {
            try {
                String nombre = URLDecoder.decode(cabecera.trim(), StandardCharsets.UTF_8);
                return nombre.length() > 150 ? nombre.substring(0, 150) : nombre;
            } catch (IllegalArgumentException e) {
                // cabecera mal codificada: se ignora
            }
        }
        if (auth != null && auth.getName() != null && !auth.getName().isBlank()) {
            return auth.getName();
        }
        return "sistema";
    }
}
