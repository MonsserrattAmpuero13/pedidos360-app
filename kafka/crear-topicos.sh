#!/usr/bin/env bash
# Crea (o deja ajustados) los tópicos de Pedidos 360 con sus parámetros de administración.
# Es idempotente: se puede ejecutar varias veces sin romper nada.
#
# Requisitos: el clúster levantado (docker compose -f docker-compose.kafka.yml up -d).
# Uso:        bash crear-topicos.sh
#
# En el clúster, KAFKA_AUTO_CREATE_TOPICS_ENABLE=false: ningún tópico se crea solo,
# por eso los de negocio y sus DLT se declaran aquí.

set -euo pipefail

CONTENEDOR="${KAFKA_CONTAINER:-kafka1}"
BROKERS="${KAFKA_INTERNAL_BROKERS:-kafka1:29092,kafka2:29092,kafka3:29092}"

PARTICIONES=3        # una por cada broker: permite repartir la carga entre consumidores del mismo grupo
REPLICAS=3           # cada partición vive en los 3 brokers
MIN_ISR=2            # con acks=all, un mensaje se confirma si al menos 2 réplicas lo tienen

DIA_MS=86400000
RET_7_DIAS=$((7 * DIA_MS))      # 604800000
RET_3_DIAS=$((3 * DIA_MS))      # 259200000
RET_30_DIAS=$((30 * DIA_MS))    # 2592000000

# nombre | retention.ms | cleanup.policy | para qué sirve
TOPICOS=(
  "pedidos-creados|${RET_7_DIAS}|delete|Un evento por pedido creado. 7 días para poder reprocesar notificaciones."
  "alertas-stock|${RET_3_DIAS}|compact,delete|Alertas de stock bajo el mínimo. Clave = SKU: la compactación conserva la alerta más reciente de cada producto."
  "pedidos-creados.DLT|${RET_30_DIAS}|delete|Mensajes de pedidos-creados que no se pudieron procesar. 30 días para revisarlos."
  "alertas-stock.DLT|${RET_30_DIAS}|delete|Mensajes de alertas-stock que no se pudieron procesar. 30 días para revisarlos."
)

kafka() { docker exec "${CONTENEDOR}" "$@"; }

echo "Brokers: ${BROKERS}  (contenedor ${CONTENEDOR})"
echo

for fila in "${TOPICOS[@]}"; do
  IFS='|' read -r nombre retencion limpieza descripcion <<< "${fila}"
  echo "→ ${nombre}  [${PARTICIONES} particiones, ${REPLICAS} réplicas, retención ${retencion} ms, limpieza ${limpieza}]"
  echo "  ${descripcion}"

  # 1) Crear si no existe
  kafka kafka-topics --bootstrap-server "${BROKERS}" --create --if-not-exists \
    --topic "${nombre}" --partitions "${PARTICIONES}" --replication-factor "${REPLICAS}"

  # 2) Dejar la configuración como está declarada aquí (también si el tópico ya existía)
  kafka kafka-configs --bootstrap-server "${BROKERS}" --alter \
    --entity-type topics --entity-name "${nombre}" \
    --add-config "retention.ms=${retencion},cleanup.policy=[${limpieza}],min.insync.replicas=${MIN_ISR}"
  echo
done

echo "Resultado:"
# Solo la primera línea de cada tópico (nombre, particiones, réplicas y configuración)
kafka kafka-topics --bootstrap-server "${BROKERS}" --describe \
  | grep -E '^Topic: (pedidos-creados|alertas-stock)' || true
