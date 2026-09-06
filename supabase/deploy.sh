#!/usr/bin/env bash
# ==============================================================================
# FABRE AUTOMATION - Supabase Edge Functions Deployment Script
# Release: Edge Functions Deployment Infrastructure
# ==============================================================================
set -e

PROJECT_REF="${1:-}"

echo "🚀 FABRE AUTOMATION - Validação & Deploy das Edge Functions no Supabase..."

# 1. Verificar instalação da Supabase CLI
if ! command -v supabase &> /dev/null; then
    echo "❌ Erro: Supabase CLI não encontrada."
    echo "Instale via npm: npm install -g supabase"
    echo "Ou via Homebrew / Scoop / Shell: brew install supabase/tap/supabase"
    exit 1
fi

echo "✅ Supabase CLI detectada: $(supabase --version)"

# 2. Resolução do Project Ref
PROJECT_FLAG=""
if [ -n "$PROJECT_REF" ]; then
    echo "🎯 Projeto Supabase alvo especificado: $PROJECT_REF"
    PROJECT_FLAG="--project-ref $PROJECT_REF"
else
    echo "ℹ️ Nenhum project-ref informado como argumento. Usando projeto vinculado localmente (se houver)."
    echo "   Dica de segurança: execute './supabase/deploy.sh SEU_PROJECT_REF' para garantir o deploy no projeto correto."
fi

# 3. Deploy individual das 6 Edge Functions do FABRE AUTOMATION
echo "📦 [1/6] Publicando health-check..."
supabase functions deploy health-check --no-verify-jwt $PROJECT_FLAG

echo "📦 [2/6] Publicando meta-webhook..."
supabase functions deploy meta-webhook --no-verify-jwt $PROJECT_FLAG

echo "📦 [3/6] Publicando whatsapp-webhook..."
supabase functions deploy whatsapp-webhook --no-verify-jwt $PROJECT_FLAG

echo "📦 [4/6] Publicando ai-completion..."
supabase functions deploy ai-completion --no-verify-jwt $PROJECT_FLAG

echo "📦 [5/6] Publicando meta-send-message..."
supabase functions deploy meta-send-message --no-verify-jwt $PROJECT_FLAG

echo "📦 [6/6] Publicando meta-automation-send-message..."
supabase functions deploy meta-automation-send-message --no-verify-jwt $PROJECT_FLAG

echo ""
echo "🎉 DEPLOY CONCLUÍDO COM SUCESSO!"
echo "As 6 Edge Functions do FABRE AUTOMATION foram publicadas com sucesso."
