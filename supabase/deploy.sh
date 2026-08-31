#!/usr/bin/env bash
# ==============================================================================
# FABRE AUTOMATION - Supabase Edge Functions Deployment Script
# Release 6: Edge Functions Deployment
# ==============================================================================
set -e

echo "🚀 FABRE AUTOMATION - Iniciando Deploy das Edge Functions no Supabase..."

# 1. Verificar instalação da Supabase CLI
if ! command -v supabase &> /dev/null; then
    echo "❌ Erro: Supabase CLI não encontrada."
    echo "Instale via npm: npm install -g supabase"
    echo "Ou via Homebrew / Scoop / Shell: brew install supabase/tap/supabase"
    exit 1
fi

echo "✅ Supabase CLI detectada: $(supabase --version)"

# 2. Deploy individual das 4 Edge Functions do FABRE AUTOMATION
echo "📦 [1/4] Publicando health-check..."
supabase functions deploy health-check --no-verify-jwt

echo "📦 [2/4] Publicando meta-webhook..."
supabase functions deploy meta-webhook --no-verify-jwt

echo "📦 [3/4] Publicando whatsapp-webhook..."
supabase functions deploy whatsapp-webhook --no-verify-jwt

echo "📦 [4/4] Publicando ai-completion..."
supabase functions deploy ai-completion --no-verify-jwt

echo ""
echo "🎉 DEPLOY CONCLUÍDO COM SUCESSO!"
echo "As 4 Edge Functions do FABRE AUTOMATION estão ativas no Supabase."
