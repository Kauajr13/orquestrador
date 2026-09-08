#!/bin/bash

# Script de execução semanal para retrospectiva
# Chama a rotina principal em TypeScript e registra logs

LOG_FILE="logs/retrospectiva-semanal.log"
ROTINA_PRINCIPAL="lib/rotinas/retrospectiva-semanal.ts"

# Cria o diretório de logs se não existir
mkdir -p logs

# Função para registrar log
timestamp() {
  date '+%Y-%m-%d %H:%M:%S'
}

log() {
  echo "[$(timestamp)] $1" >> "$LOG_FILE"
}

# Início da execução
log "Iniciando retrospectiva semanal..."

# Verifica se o arquivo da rotina existe
if [ ! -f "$ROTINA_PRINCIPAL" ]; then
  log "ERRO: Rotina principal não encontrada em $ROTINA_PRINCIPAL"
  exit 1
fi

# Executa a rotina principal usando ts-node (ou node se já estiver compilado)
if command -v ts-node &> /dev/null; then
  log "Executando rotina com ts-node..."
  ts-node "$ROTINA_PRINCIPAL" >> "$LOG_FILE" 2>&1
  EXIT_CODE=$?
elif command -v node &> /dev/null; then
  log "Executando rotina com node..."
  node "$ROTINA_PRINCIPAL" >> "$LOG_FILE" 2>&1
  EXIT_CODE=$?
else
  log "ERRO: Nem ts-node nem node estão disponíveis para executar a rotina."
  exit 1
fi

# Verifica se a execução foi bem-sucedida
if [ $EXIT_CODE -ne 0 ]; then
  log "ERRO: Rotina falhou com código de saída $EXIT_CODE"
  exit 1
fi

log "Retrospectiva semanal concluída com sucesso."
exit 0