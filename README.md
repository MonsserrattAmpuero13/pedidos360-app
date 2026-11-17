# Pedidos 360

Sistema de control de órdenes y envíos con mensajería asíncrona sobre Azure Service Bus y Apache Kafka (ambos conviven; Kafka se agregó sin reemplazar a Service Bus).

## Componentes

| Carpeta / repositorio | Tecnología | Función |
|---|---|---|
| `frontend-pedidos` | Angular, login con Auth0 | Panel web (desplegado en Vercel) |
| `backend-pedidos` | Spring Boot 4.1.1, Java 17, JPA | API REST de pedidos y **productor** de eventos |
| [notificaciones-service](https://github.com/MonsserrattAmpuero13/notificaciones-service) | Spring Boot | **Consumidor** de eventos (ACK manual y DLQ) |
| [servicebus-admin-service](https://github.com/MonsserrattAmpuero13/servicebus-admin-service) | Spring Boot | **Administrador** de temas, suscripciones y colas |
| [kafka-admin-service](https://github.com/MonsserrattAmpuero13/kafka-admin-service) | Spring Boot | **Administrador** de Kafka: tópicos, retención y consumer groups (puerto 8083) |

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

## Apache Kafka (EP5)

Cada pedido creado se publica además en Kafka, junto al evento de Service Bus. Los cambios de stock bajo el mínimo generan una alerta.

```
backend-pedidos --(pedidos-creados, clave = tracking)--> Kafka (3 brokers) --> notificaciones-group
backend-pedidos --(alertas-stock, clave = sku)---------> Kafka (3 brokers) --> alertas-stock-group
```

| Tópico | Particiones | Réplicas | Retención | Limpieza | Clave | Consumer group |
|---|---|---|---|---|---|---|
| `pedidos-creados` | 3 | 3 | 7 días | `delete` | tracking | `notificaciones-group` |
| `alertas-stock` | 3 | 3 | 3 días | `compact,delete` | sku | `alertas-stock-group` |
| `pedidos-creados.DLT` | 3 | 3 | 30 días | `delete` | (la del mensaje original) | — |
| `alertas-stock.DLT` | 3 | 3 | 30 días | `delete` | (la del mensaje original) | — |

- Productor con `acks=all`, idempotencia, reintentos, `linger.ms` y compresión; consumidores con confirmación manual, reintentos y DLT.
- Si Kafka no responde, el pedido se guarda igual.
- Todos los tópicos tienen `min.insync.replicas=2`: con `acks=all`, un mensaje se confirma solo si al menos 2 de las 3 réplicas lo tienen.
- `alertas-stock` usa compactación porque la clave es el SKU: se conserva la alerta más reciente de cada producto.
- Los parámetros están declarados en [`kafka/crear-topicos.sh`](kafka/crear-topicos.sh). El clúster tiene desactivada la creación automática de tópicos, así que ese script es la fuente de verdad.

### Levantar el clúster (3 Zookeeper + 3 brokers + Kafka UI)

```
cd kafka
docker compose -f docker-compose.kafka.yml up -d
docker compose -f docker-compose.kafka-ui.yml up -d
```

Kafka UI queda en http://localhost:8090.

### Crear los tópicos

Con el clúster arriba (es idempotente; también ajusta los tópicos que ya existan):

```
cd kafka
bash crear-topicos.sh
```

### Activar Kafka en el backend

Está desactivado por defecto para no afectar el despliegue en Azure.

| Variable | Valor |
|---|---|
| `KAFKA_ENABLED` | `true` |
| `KAFKA_BOOTSTRAP_SERVERS` | `localhost:9092,localhost:9093,localhost:9094` (por defecto) |

### RabbitMQ (broker adicional)

```
cd kafka
docker compose -f docker-compose.rabbitmq.yml up -d
```

Consola de administración en http://localhost:15672 (usuario `pedidos360`, clave `pedidos360-dev`; configurables con `RABBITMQ_USER` y `RABBITMQ_PASS`).

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
