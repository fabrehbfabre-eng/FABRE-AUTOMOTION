#!/usr/bin/env bash
# ==============================================================================
# FABRE AUTOMATION - Supabase Edge Functions Deployment Script
# Release: Edge Functions Deployment Infrastructure
# ==============================================================================
set -e

PROJECT_REF="${1:-}"

echo "🚀 FABRE AUTOMATION - Validação & Deploy das Edge Functions no Supabase..."

# 1. Verificar instalação da Supabase CLI
if command -v supabase &> /dev/null; then
    SUPABASE_BIN="supabase"
elif command -v npx &> /dev/null; then
    SUPABASE_BIN="npx supabase"
else
    echo "❌ Erro: Supabase CLI ou npx não encontrados."
    exit 1
fi

echo "✅ Supabase CLI detectada: $($SUPABASE_BIN --version)"

# 2. Resolução do Project Ref
PROJECT_FLAG=""
if [ -n "$PROJECT_REF" ]; then
    echo "🎯 Projeto Supabase alvo especificado: $PROJECT_REF"
    PROJECT_FLAG="--project-ref $PROJECT_REF"
else
    echo "ℹ️ Nenhum project-ref informado como argumento. Usando projeto vinculado localmente (se houver)."
    echo "   Dica de segurança: execute './supabase/deploy.sh SEU_PROJECT_REF' para garantir o deploy no projeto correto."
fi

# 3. Deploy individual das 7 Edge Functions do FABRE AUTOMATION
echo "📦 [1/7] Publicando health-check..."
$SUPABASE_BIN functions deploy health-check --no-verify-jwt $PROJECT_FLAG

echo "📦 [2/7] Publicando meta-webhook..."
$SUPABASE_BIN functions deploy meta-webhook --no-verify-jwt $PROJECT_FLAG

echo "📦 [3/7] Publicando whatsapp-webhook..."
$SUPABASE_BIN functions deploy whatsapp-webhook --no-verify-jwt $PROJECT_FLAG

echo "📦 [4/7] Publicando ai-completion..."
$SUPABASE_BIN functions deploy ai-completion --no-verify-jwt $PROJECT_FLAG

echo "📦 [5/7] Publicando meta-send-message..."
$SUPABASE_BIN functions deploy meta-send-message --no-verify-jwt $PROJECT_FLAG

echo "📦 [6/7] Publicando meta-automation-send-message..."
$SUPABASE_BIN functions deploy meta-automation-send-message --no-verify-jwt $PROJECT_FLAG

echo "📦 [7/8] Publicando automation-job-worker..."
$SUPABASE_BIN functions deploy automation-job-worker --no-verify-jwt $PROJECT_FLAG

echo "📦 [8/8] Publicando instagram-oauth..."
$SUPABASE_BIN functions deploy instagram-oauth --no-verify-jwt $PROJECT_FLAG

echo ""
echo "🎉 DEPLOY CONCLUÍDO COM SUCESSO!"
echo "As 8 Edge Functions do FABRE AUTOMATION foram publicadas com sucesso."
