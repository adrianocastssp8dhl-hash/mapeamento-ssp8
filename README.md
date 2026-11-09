<!-- README — Mapeamento SSP8 | Versão 1.0 | 2026-11-09 -->

# Mapeamento SSP8

App web para registrar e acompanhar as bipagens de produtos por colaborador na unidade SSP8 (DHL Supply Chain, Caçapava). Ele substitui o lançamento manual na planilha "Mapeamento Geral" e espelha cada bipagem no Google Sheets.

## O que o app faz

- Registra bipagens (ID do produto, quantidade e colaborador) pela câmera do celular ou por digitação
- Lista, busca e filtra bipagens por texto, colaborador e período
- Permite consultar, editar e excluir cada bipagem
- Cadastra e renomeia colaboradores. Não é possível excluir um colaborador que tenha bipagens
- Mostra uma visão geral em tempo real com totais do dia e por colaborador
- Mostra a lista unificada de produtos com a contagem total por ID
- Interface responsiva em português

## Telas

- Visão geral: totais em tempo real
- Bipagens: lista, filtros, criação e edição
- Colaboradores: cadastro e gestão
- Produtos: contagem unificada por ID

## Integração com o Google Sheets

Cada bipagem criada, editada ou excluída no app é espelhada na aba `BIPAGENS DO APP` da planilha "Mapeamento Geral". Renomear um colaborador também atualiza as linhas dele nessa aba.

- O espelhamento é de mão única: app → planilha
- Se a gravação na planilha falhar, a operação no banco é cancelada. Assim app e planilha não ficam diferentes
- As abas originais (`CONSOLIDADO`, `LISTA UNIFICADA` e as abas dos colaboradores) não são alteradas pelo app
- A conexão usa o conector do Google Sheets do Replit
- O ID da planilha está em `artifacts/api-server/src/lib/google-sheets-sync.ts`

## Regras de negócio

- O ID do produto é guardado como texto para não perder zeros à esquerda. Normalmente tem 11 dígitos
- A quantidade aceita valores de 1 a 1.000.000
- Datas, filtros e totais diários seguem o fuso de São Paulo (America/Sao_Paulo)

## Tecnologias

- Frontend: React 19, Vite, Tailwind CSS, Radix UI, TanStack Query e leitura de código de barras com ZXing
- API: Node.js 24, Express 5, TypeScript 5.9
- Banco de dados: PostgreSQL com Drizzle ORM
- Contratos da API: OpenAPI, com hooks e validações Zod gerados pelo Orval
- Monorepo com pnpm workspaces, hospedado no Replit

## Estrutura do projeto

```
artifacts/
  mapeamento/        Frontend React (páginas em src/pages)
  api-server/        API Express (rotas em src/routes, integração com o Sheets em src/lib)
  mockup-sandbox/    Ambiente de protótipos de tela
lib/
  api-spec/          openapi.yaml, a fonte oficial dos contratos da API
  api-client-react/  Hooks React gerados a partir do OpenAPI
  api-zod/           Validações Zod geradas a partir do OpenAPI
  db/                Schema do banco (collaborators e scans)
scripts/             Scripts auxiliares
```

## Endpoints da API

Todos ficam sob o prefixo `/api`.

- `GET/POST /collaborators`: lista ou cria colaboradores
- `PUT/DELETE /collaborators/{id}`: renomeia ou exclui um colaborador
- `GET/POST /scans`: lista com filtros (`q`, `collaboratorId`, `dateFrom`, `dateTo`, `page`, `limit`) ou cria uma bipagem
- `GET/PUT/DELETE /scans/{id}`: consulta, edita ou exclui uma bipagem
- `GET /summary`: totais em tempo real
- `GET /products`: contagem unificada por produto
- `GET /healthz`: verificação de saúde da API

## Como rodar

O projeto foi feito para rodar no Replit. Lá, use os workflows gerenciados da API e do frontend. Eles definem a porta e o caminho base sozinhos.

Variável de ambiente obrigatória:

- `DATABASE_URL`: string de conexão do PostgreSQL

Comandos principais:

```bash
pnpm install                                        # instala as dependências (use apenas pnpm)
pnpm --filter @workspace/api-server run dev         # sobe a API
pnpm --filter @workspace/mapeamento run dev         # sobe o frontend
pnpm run typecheck                                  # verifica os tipos de todos os pacotes
pnpm run build                                      # verifica os tipos e gera o build
pnpm --filter @workspace/api-spec run codegen       # regenera hooks e validações após mudar o OpenAPI
pnpm --filter @workspace/db run push                # aplica mudanças do schema no banco (só em desenvolvimento)
```

## Cuidados ao alterar o código

- Depois de mudar o `openapi.yaml`, rode o codegen para atualizar hooks e validações
- Mudanças no banco começam em `lib/db/src/schema/`
- Não desative o `minimumReleaseAge` do `pnpm-workspace.yaml`. Ele protege contra pacotes maliciosos recém-publicados
- Para trazer para o Replit as alterações feitas no GitHub, use *Pull* na aba Git
