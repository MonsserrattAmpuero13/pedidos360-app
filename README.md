# Pedidos 360

Sistema de control de órdenes y envíos con mensajería asíncrona sobre Azure Service Bus.

## Componentes

| Carpeta / repositorio | Tecnología | Función |
|---|---|---|
| `frontend-pedidos` | Angular, login con Auth0 | Panel web (desplegado en Vercel) |
| `backend-pedidos` | Spring Boot 4.1.1, Java 17, JPA | API REST de pedidos y **productor** de eventos |
| [notificaciones-service](https://github.com/MonsserrattAmpuero13/notificaciones-service) | Spring Boot | **Consumidor** de eventos (ACK manual y DLQ) |
| [servicebus-admin-service](https://github.com/MonsserrattAmpuero13/servicebus-admin-service) | Spring Boot | **Administrador** de temas, suscripciones y colas |

## Arquitectura

```
Angular (Vercel) -> Azure API Management -> backend-pedidos (App Service) -> Azure SQL
                                                  |
                                                  | evento pedido.creado
                                                  v
                                    Azure Service Bus: topic pedidos-topic
                                                  |
                                    suscripción notificaciones-sub
                                                  v
                                       notificaciones-service
                                    (ACK, reintentos y DLQ)
```

Al crear un pedido, el backend lo guarda y publica un evento. Si el Service Bus falla, el pedido se guarda igual (mensajería desacoplada).

## Seguridad (JWT)

- El frontend inicia sesión con **Auth0** y envía `Authorization: Bearer <token>` en cada llamada.
- El backend valida el JWT como *resource server* de Spring Security (emisor y audiencia en `application.properties`).
- Sin token, `/api/**` responde `401`.

## Base de datos

Por defecto usa H2 local (para desarrollo). En la nube se conecta a **Azure SQL** mediante variables de entorno.

## Variables de entorno

| Variable | Uso |
|---|---|
| `SERVICEBUS_CONNECTION_STRING` | Cadena de conexión del namespace de Service Bus (obligatoria) |
| `DB_URL` | URL JDBC de la base (opcional; sin ella usa H2) |
| `DB_USER` | Usuario de la base (opcional) |
| `DB_PASSWORD` | Contraseña de la base (opcional) |

Las claves no se suben al repositorio.

## Ejecución local

```
export SERVICEBUS_CONNECTION_STRING="<cadena de conexión>"
cd backend-pedidos
./mvnw spring-boot:run
```

Frontend:

```
cd frontend-pedidos
npm install
npm start
```

## Pruebas

```
cd backend-pedidos
./mvnw test
```

Las pruebas unitarias del servicio de pedidos no requieren variables de entorno ni conexión externa.

## Equivalencias RabbitMQ → Azure Service Bus

| Concepto de la pauta (RabbitMQ) | Equivalente en Azure Service Bus |
|---|---|
| Exchange | Topic (`pedidos-topic`) |
| Queue | Suscripción (`notificaciones-sub`) o Queue |
| Binding | Suscripción asociada al topic |
| DLQ | Dead-letter queue integrada de cada suscripción |
| `@RabbitListener` | `ServiceBusProcessorClient` |
| ACK / NACK | `complete()` / `abandon()` / `deadLetter()` |
| Beans `Queue`, `Exchange`, `Binding` | Clases `config/ServiceBus*Config` |
| `RabbitAdminService` | `ServiceBusAdminService` |
