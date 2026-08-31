# FABRE AUTOMATION - Supabase Architecture & Edge Functions Guide
**Release 6 | Supabase Edge Functions Deployment**

---

## 1. Visão Geral do Backend

O backend oficial do **FABRE AUTOMATION** é executado como **Edge Functions server-side em ambiente Deno** no Supabase, conectado diretamente ao banco de dados relacional **Supabase PostgreSQL**.

Toda a infraestrutura foi projetada com:
- **Zero Secrets no Frontend:** Nenhuma chave mestra ou segredo de canal reside no cliente React.
- **Idempotência Estrita:** Garantia de deduplicação de eventos via `external_event_id` na tabela `messages`.
- **Validação Criptográfica:** Handshake GET e verificação de assinatura HMAC-SHA256 para webhooks da Meta.
- **Isolamento de Funções:** 4 funções independentes com código compartilhado em `_shared/`.

---

## 2. Estrutura de Edge Functions (`/supabase/functions/`)

```
supabase/
├── config.toml                     # Configuração oficial da Supabase CLI
├── deploy.sh                       # Script automatizado de deploy
├── schema.sql                      # Schema DDL (11 tabelas, índices e RLS)
└── functions/
    ├── _shared/                    # Módulos compartilhados (NÃO deployar como função)
    │   ├── cors.ts                 # Cabeçalhos e pre-flight OPTIONS
    │   ├── errors.ts               # Respostas padronizadas de erro e sucesso
    │   ├── idempotency.ts          # Verificação de unicidade no PostgreSQL
    │   ├── logger.ts               # Logger higienizado (redige segredos)
    │   └── supabaseServer.ts       # Cliente Supabase com Service Role Key
    ├── health-check/               # Auditoria de conectividade e readiness
    │   └── index.ts
    ├── meta-webhook/               # Ingestão de mensagens do Instagram Direct / Messenger
    │   └── index.ts
    ├── whatsapp-webhook/           # Ingestão de mensagens da WhatsApp Business API
    │   └── index.ts
    └── ai-completion/              # Pipeline de IA (desativada nesta Release)
        └── index.ts
```

---

## 3. Matriz de Edge Functions

| Função | Endpoint Relativo | JWT Verification | Métodos | Finalidade Principal |
| :--- | :--- | :---: | :---: | :--- |
| **`health-check`** | `/functions/v1/health-check` | `false` | `GET` | Diagnóstico de conectividade DB e runtime Deno |
| **`meta-webhook`** | `/functions/v1/meta-webhook` | `false` | `GET, POST` | Handshake Meta e Ingestão do Instagram Direct |
| **`whatsapp-webhook`** | `/functions/v1/whatsapp-webhook` | `false` | `GET, POST` | Handshake Meta e Ingestão do WhatsApp Cloud |
| **`ai-completion`** | `/functions/v1/ai-completion` | `false` | `POST` | Processamento de IA (desativada na Release 6) |

---

## 4. Como Fazer o Deploy via Supabase CLI

### Pré-requisitos
1. Ter a **Supabase CLI** instalada na máquina de desenvolvimento:
   ```bash
   # Via npm:
   npm install -g supabase

   # Ou via Homebrew (macOS / Linux):
   brew install supabase/tap/supabase
   ```

2. Autenticar sua conta Supabase:
   ```bash
   supabase login
   ```

3. Vincular ao seu projeto Supabase:
   ```bash
   supabase link --project-ref <SEU_PROJECT_REF_ID>
   ```

---

### Passo 1: Cadastrar os Segredos (Secrets) no Supabase

Cadastre as variáveis server-side no ambiente do Supabase (NUNCA commitar valores reais no Git):

```bash
supabase secrets set \
  SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOi..." \
  META_APP_SECRET="sua_chave_secreta_do_app_meta" \
  META_WEBHOOK_VERIFY_TOKEN="seu_token_de_verificacao_personalizado" \
  WHATSAPP_ACCESS_TOKEN="seu_token_de_acesso_whatsapp" \
  OPENAI_API_KEY="sk-..."
```

*(Ou configure diretamente pelo Dashboard em: **Project Settings > Edge Functions > Add Secret**)*

---

### Passo 2: Executar o Deploy das Edge Functions

Execute o deploy individual de cada função:

```bash
# 1. Health Check
supabase functions deploy health-check --no-verify-jwt

# 2. Meta Webhook (Instagram Direct & Messenger)
supabase functions deploy meta-webhook --no-verify-jwt

# 3. WhatsApp Webhook
supabase functions deploy whatsapp-webhook --no-verify-jwt

# 4. AI Completion
supabase functions deploy ai-completion --no-verify-jwt
```

Ou execute o script automatizado:
```bash
chmod +x supabase/deploy.sh
./supabase/deploy.sh
```

---

## 5. Verificação e Teste Pós-Deploy

### 1. Testar Health Check:
```bash
curl -X GET "https://<SEU_PROJECT_REF>.supabase.co/functions/v1/health-check"
```
*Resposta esperada: `200 OK` com `{"status": "ok", "supabaseConnected": true}`*

### 2. Testar Handshake do Webhook Meta:
```bash
curl -X GET "https://<SEU_PROJECT_REF>.supabase.co/functions/v1/meta-webhook?hub.mode=subscribe&hub.verify_token=SEU_TOKEN&hub.challenge=1158201244"
```
*Resposta esperada: `200 OK` com body `1158201244`*
