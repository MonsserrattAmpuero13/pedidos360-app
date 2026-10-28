#!/bin/sh
# Crea exchanges, colas, DLQ y bindings por la API HTTP de RabbitMQ.
API="http://rabbit1:15672/api"
AUTH="$RABBITMQ_USER:$RABBITMQ_PASS"
put() { curl -sf -u "$AUTH" -H "content-type: application/json" -X PUT "$API/$1" -d "$2" >/dev/null && echo "ok $1" || echo "FALLO $1"; }
post() { curl -sf -u "$AUTH" -H "content-type: application/json" -X POST "$API/$1" -d "$2" >/dev/null && echo "ok $1" || echo "FALLO $1"; }

# esperar a que el nodo 2 este en el cluster
for i in $(seq 1 30); do
  n=$(curl -sf -u "$AUTH" "$API/nodes" | grep -o '"name"' | wc -l)
  [ "$n" -ge 2 ] && break; sleep 3
done

# Exchanges: direct, topic y el dead letter exchange (direct)
put exchanges/%2F/pedidos.direct '{"type":"direct","durable":true}'
put exchanges/%2F/eventos.topic  '{"type":"topic","durable":true}'
put exchanges/%2F/pedidos.dlx    '{"type":"direct","durable":true}'

# Colas principales con dead letter exchange y TTL de reintento opcional
for q in pedidos-creados notificaciones alertas-stock; do
  put queues/%2F/$q.dlq '{"durable":true}'
  put queues/%2F/$q "{\"durable\":true,\"arguments\":{\"x-dead-letter-exchange\":\"pedidos.dlx\",\"x-dead-letter-routing-key\":\"$q.dlq\"}}"
  post bindings/%2F/e/pedidos.dlx/q/$q.dlq "{\"routing_key\":\"$q.dlq\"}"
done

# Bindings: direct por clave exacta, topic por patron
post bindings/%2F/e/pedidos.direct/q/pedidos-creados '{"routing_key":"pedido.creado"}'
post bindings/%2F/e/eventos.topic/q/notificaciones   '{"routing_key":"pedido.*"}'
post bindings/%2F/e/eventos.topic/q/alertas-stock    '{"routing_key":"stock.#"}'

# Politica: alta disponibilidad entre los dos nodos (colas espejadas)
put policies/%2F/ha-todas '{"pattern":"^(pedidos-creados|notificaciones|alertas-stock)(\\.dlq)?$","apply-to":"queues","definition":{"ha-mode":"all","ha-sync-mode":"automatic"}}'
echo "Configuracion terminada"
