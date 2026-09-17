-- ==============================================================================
-- FABRE AUTOMATION - MIGRATION: Multitenant Unique Constraint em channel_connections
-- Migration ID: 20260917000000_fix_channel_connections_multitenant_unique.sql
-- ==============================================================================
-- Contexto e Causa Raiz:
-- A tabela public.channel_connections foi inicialmente criada com uma restrição
-- UNIQUE global na coluna 'channel' (ex: channel_connections_channel_key),
-- enquanto a Edge Function 'instagram-oauth' (e o modelo multitenant) executa
-- .upsert(payload, { onConflict: "workspace_id,channel" }).
-- No PostgreSQL, o upsert com onConflict ("workspace_id,channel") requer uma restrição
-- ou índice UNIQUE cobrindo estritamente (workspace_id, channel).
-- Além disso, em um ambiente SaaS multitenant, múltiplos workspaces podem conectar
-- suas próprias contas de Instagram/WhatsApp/Messenger de forma independente.
--
-- Objetivos desta Migration:
-- 1. Garantir que a coluna 'workspace_id' UUID NOT NULL exista na tabela (com verificação segura de nullability).
-- 2. Localizar e remover com segurança qualquer UNIQUE constraint ou índice legado
--    que restrinja apenas a coluna 'channel'.
-- 3. Validar de forma fail-closed se existem duplicidades em (workspace_id, channel).
--    Se existirem duplicidades, a migration é IMEDIATAMENTE ABORTADA sem apagar dados.
-- 4. Criar a restrição UNIQUE composta: UNIQUE (workspace_id, channel).
-- 5. Recarregar o cache do schema no PostgREST.
-- ==============================================================================

-- 1. Garantir a existência e a obrigatoriedade (NOT NULL) da coluna workspace_id
DO $$
DECLARE
    v_col_exists BOOLEAN;
    v_is_nullable TEXT;
    v_null_count INTEGER;
BEGIN
    -- 1.1 Verificar se a coluna workspace_id existe na tabela public.channel_connections
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'channel_connections'
          AND column_name = 'workspace_id'
    ) INTO v_col_exists;

    IF NOT v_col_exists THEN
        -- Se não existe, cria como UUID NOT NULL com default seguro do workspace padrão
        ALTER TABLE public.channel_connections
        ADD COLUMN workspace_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
        
        RAISE NOTICE 'Coluna workspace_id (UUID NOT NULL) adicionada com sucesso em public.channel_connections.';
    ELSE
        -- 1.2 Se a coluna já existe, verificar se ela é nullable
        SELECT is_nullable
        INTO v_is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'channel_connections'
          AND column_name = 'workspace_id';

        IF v_is_nullable = 'YES' THEN
            -- Valida se existem registros com workspace_id NULL antes de aplicar NOT NULL
            SELECT COUNT(*)
            INTO v_null_count
            FROM public.channel_connections
            WHERE workspace_id IS NULL;

            IF v_null_count > 0 THEN
                RAISE EXCEPTION 'MIGRATION ABORTADA POR SEGURANÇA: Existem % registro(s) em public.channel_connections com workspace_id NULL. Nenhum dado foi apagado nem alterado arbitrariamente. Corrija manualmente os registros atribuindo o workspace correto antes de reaplicar a migration.', v_null_count;
            ELSE
                -- Nenhum valor NULL: seguro aplicar NOT NULL sem perda de dados
                ALTER TABLE public.channel_connections
                ALTER COLUMN workspace_id SET NOT NULL;

                RAISE NOTICE 'Coluna workspace_id atualizada para NOT NULL com sucesso em public.channel_connections.';
            END IF;
        ELSE
            RAISE NOTICE 'Coluna workspace_id já existe e já está configurada como NOT NULL em public.channel_connections.';
        END IF;
    END IF;
END $$;

-- 2. Localizar e remover dinamicamente qualquer restrição ou índice UNIQUE global restrito apenas a 'channel'
DO $$
DECLARE
    r_constraint RECORD;
    r_index RECORD;
BEGIN
    -- 2.1 Identificar e remover constraints UNIQUE em channel_connections que cobrem apenas 'channel'
    FOR r_constraint IN (
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public'
          AND t.relname = 'channel_connections'
          AND c.contype = 'u'
          AND (
              SELECT array_agg(a.attname::text ORDER BY a.attnum)
              FROM pg_attribute a
              WHERE a.attrelid = t.oid
                AND a.attnum = ANY(c.conkey)
          ) = ARRAY['channel'::text]
    ) LOOP
        RAISE NOTICE 'Removendo constraint UNIQUE global legada em channel: %', r_constraint.conname;
        EXECUTE 'ALTER TABLE public.channel_connections DROP CONSTRAINT ' || quote_ident(r_constraint.conname);
    END LOOP;

    -- 2.2 Remoção explícita de segurança para nomes padrão conhecidos
    BEGIN
        ALTER TABLE public.channel_connections DROP CONSTRAINT IF EXISTS channel_connections_channel_key;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    -- 2.3 Remover índices UNIQUE manuais que cubram apenas 'channel' (e não sejam de uma constraint ativa)
    FOR r_index IN (
        SELECT i.relname AS index_name
        FROM pg_index x
        JOIN pg_class c ON c.oid = x.indrelid
        JOIN pg_class i ON i.oid = x.indexrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = 'channel_connections'
          AND x.indisunique = true
          AND NOT EXISTS (
              SELECT 1 FROM pg_constraint con WHERE con.conindid = x.indexrelid
          )
          AND (
              SELECT array_agg(a.attname::text ORDER BY a.attnum)
              FROM pg_attribute a
              WHERE a.attrelid = c.oid
                AND a.attnum = ANY(x.indkey)
          ) = ARRAY['channel'::text]
    ) LOOP
        RAISE NOTICE 'Removendo índice UNIQUE global legado em channel: %', r_index.index_name;
        EXECUTE 'DROP INDEX IF EXISTS public.' || quote_ident(r_index.index_name);
    END LOOP;

    BEGIN
        DROP INDEX IF EXISTS public.channel_connections_channel_key;
        DROP INDEX IF EXISTS public.idx_channel_connections_channel;
        DROP INDEX IF EXISTS public.idx_channel_connections_workspace_channel;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;
END $$;

-- 3. Verificação fail-closed: Checar se existem registros duplicados em (workspace_id, channel)
-- REGRA DE SEGURANÇA: Se existirem duplicidades, interrompe a migration imediatamente sem apagar dados!
DO $$
DECLARE
    v_dup_count INTEGER;
    v_dup_details TEXT;
BEGIN
    SELECT COUNT(*), string_agg(workspace_id::text || ' / ' || channel || ' (' || cnt || ' ocorrências)', '; ')
    INTO v_dup_count, v_dup_details
    FROM (
        SELECT workspace_id, channel, COUNT(*) AS cnt
        FROM public.channel_connections
        GROUP BY workspace_id, channel
        HAVING COUNT(*) > 1
    ) dups;

    IF v_dup_count > 0 THEN
        RAISE EXCEPTION 'MIGRATION ABORTADA POR SEGURANÇA: Foram encontradas duplicidades na chave (workspace_id, channel): %. Nenhum dado foi apagado. Corrija manualmente antes de reaplicar.', v_dup_details;
    ELSE
        RAISE NOTICE 'Validação de duplicidades concluída: zero duplicidades encontradas em (workspace_id, channel).';
    END IF;
END $$;

-- 4. Criar a constraint UNIQUE composta: UNIQUE (workspace_id, channel)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public'
          AND t.relname = 'channel_connections'
          AND c.contype = 'u'
          AND (
              SELECT array_agg(a.attname::text ORDER BY a.attname)
              FROM pg_attribute a
              WHERE a.attrelid = t.oid
                AND a.attnum = ANY(c.conkey)
          ) = ARRAY['channel'::text, 'workspace_id'::text]
    ) THEN
        RAISE NOTICE 'Adicionando constraint UNIQUE composta channel_connections_workspace_channel_key...';
        ALTER TABLE public.channel_connections
        ADD CONSTRAINT channel_connections_workspace_channel_key UNIQUE (workspace_id, channel);
    ELSE
        RAISE NOTICE 'Constraint UNIQUE composta em (workspace_id, channel) já está ativa.';
    END IF;
END $$;

-- 5. Notificar PostgREST para recarregar o schema cache imediatamente
NOTIFY pgrst, 'reload schema';
