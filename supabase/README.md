# FABRE AUTOMATION - Supabase Architecture & Persistence Guide
**Release 2 | Supabase Persistence Foundation**

---

## 1. Visão Geral

O Supabase PostgreSQL é o banco de dados relacional oficial do **FABRE AUTOMATION**.

A aplicação foi estruturada no padrão **Provider / Repository**, permitindo alternar de forma 100% transparente entre:
- **MockProvider (Demo Mode):** Modo local isolado em memória e cache, ativo quando as variáveis de ambiente ainda não foram configuradas.
- **SupabaseProvider (Connected Mode):** Persistência real em banco PostgreSQL oficial com Row Level Security (RLS) e consultas seguras.

---

## 2. Como Configurar no Supabase

### Passo 1: Executar o Script SQL
1. Acesse o [Supabase Dashboard](https://supabase.com/dashboard).
2. Abra o **SQL Editor**.
3. Copie todo o conteúdo do arquivo `supabase/schema.sql` e execute (`Run`).
4. O script criará:
   - 11 tabelas com chaves estrangeiras, índices e gatilhos de `updated_at`.
   - Políticas de Row Level Security (RLS).
   - Inserções iniciais dos canais de atendimento.

### Passo 2: Configurar as Variáveis de Ambiente
No seu arquivo `.env` (ou painel de configurações do AI Studio / container):

```env
# URL do projeto Supabase
VITE_SUPABASE_URL=https://seu-projeto.supabase.co

# Chave pública / Anon (Safe para o navegador)
VITE_SUPABASE_PUBLISHABLE_KEY=sbp_... ou eyJhbGciOi...
```

---

## 3. Segurança & Isolamento de Chaves

| Tipo de Chave | Onde Pode Ficar | Exposta no Frontend? | Finalidade |
| :--- | :--- | :---: | :--- |
| `VITE_SUPABASE_URL` | Client & Server | Sim (Segura) | Endereço do endpoint |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Client & Server | Sim (Protegida por RLS) | Operações do App autenticado |
| `SUPABASE_SECRET_KEY` / `service_role` | **Apenas Backend / Edge Functions** | **NUNCA** | Tarefas administrativas de alto privilégio |
| `OPENAI_API_KEY` | **Apenas Backend / Edge Functions** | **NUNCA** | Execução de IA e Embeddings |
| `META_APP_SECRET` | **Apenas Backend / Edge Functions** | **NUNCA** | Assinatura de Webhooks Meta |
| `META_ACCESS_TOKEN` / `WHATSAPP_TOKEN` | **Apenas Backend / Edge Functions** | **NUNCA** | Envio de mensagens em nome do canal |

---

## 4. Estrutura de Tabelas Criadas

1. `profiles`: Perfis de contatos, seguidores e operadores.
2. `conversations`: Conversas unificadas (Instagram Direct, WhatsApp, Messenger).
3. `messages`: Histórico de mensagens, mídias e eventos de sistema.
4. `automations`: Definição de regras de automação.
5. `automation_triggers`: Gatilhos associados a cada automação.
6. `automation_actions`: Ações sequenciais associadas a cada automação.
7. `knowledge_items`: Base de conhecimento para IA e operadores.
8. `channel_connections`: Status de conexão dos canais de mensageria.
9. `contact_tags`: Tags de segmentação de contatos.
10. `contact_tag_assignments`: Associação N:N entre contatos e tags.
11. `contact_notes`: Notas internas registradas por operadores sobre um contato.
