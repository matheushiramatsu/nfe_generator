# NF-e Lab

Aplicação web para criar, validar e gerenciar **XMLs de NF-e de homologação**, sem login e sem transmissão à SEFAZ. Frontend React/TypeScript, API FastAPI e PostgreSQL, com execução integrada por Docker Compose.

## Começar com Docker

Requisitos: Git e Docker Desktop/Engine com Docker Compose v2. Inicie o Docker antes de executar os comandos.

```bash
git clone https://github.com/matheushiramatsu/nfe_generator.git
cd nfe_generator
cp .env.example .env
docker compose up --build
```

No PowerShell, use `Copy-Item .env.example .env` em vez de `cp` se preferir. A cópia é opcional para o ambiente local: o Compose fornece os mesmos padrões.

- Aplicação: http://localhost:5173
- API / Swagger: http://localhost:8000/docs
- OpenAPI: http://localhost:8000/openapi.json
- Health check: http://localhost:8000/api/health

O Compose sobe frontend, backend e PostgreSQL, aguarda os health checks e aplica as migrations antes de iniciar a API. As portas são publicadas somente em `127.0.0.1`. O PostgreSQL fica na rede interna do Compose e persiste no volume `postgres_data`. `docker compose down` preserva esse volume; não use `down -v` se quiser manter os cadastros e notas.

O ambiente começa vazio. Cadastre suas informações ou clique em **Adicionar dados de teste** no dashboard para criar um emitente, dois destinatários e quatro produtos claramente fictícios.

## O que está implementado

- Dashboard com notas de hoje/mês, erros, cadastros e últimos documentos.
- CRUD de emitentes, destinatários CPF/CNPJ e produtos; emitente padrão; consulta de CEP via ViaCEP com edição manual.
- Emissão em cinco etapas, preenchimento por cadastro, destinatário novo dentro da emissão, edição de snapshots e múltiplos itens/pagamentos.
- Cálculos decimais, tributos, descontos, frete, seguro e despesas centralizados no backend.
- Geração automática com limites de quantidade/valor, dados cadastrados ou fallback fictício explícito e nova combinação antes de emitir.
- Validação por campo, erros bloqueantes e alertas; geração XML e validação XSD oficial do conteúdo fiscal `infNFe`.
- XML formatado com realce de sintaxe, busca, cópia, download XML e JSON.
- Histórico com filtros de período, emitente, destinatário, documento, número, série, status e origem; paginação, exclusão e duplicação independente.
- Tema claro/escuro, layout responsivo, configurações e modo desenvolvedor.
- API documentada, migrations, logs estruturados, limite de requisições e pipeline CI.

## Limites fiscais desta versão

**Esta aplicação não emite uma NF-e autorizada.** Ela gera um documento de teste sem assinatura digital, protocolo ou autorização. Não implementa certificado A1, comunicação SEFAZ, DANFE, eventos ou produção.

O pacote oficial incluído é **PL 010f v1.04**, publicado em 31/08/2026, leiaute 4.00. Fonte, data e hash constam em [backend/schemas/README.md](backend/schemas/README.md).

O XSD oficial do elemento `NFe` exige `ds:Signature`. Por isso, o MVP valida **exatamente a declaração oficial `TNFe/infNFe`**, exposta como raiz por um adaptador, mantendo os arquivos oficiais inalterados. Apenas os nomes das restrições `xs:unique` da declaração copiada são renomeados para evitar colisão com as mesmas declarações incluídas; seus seletores e regras são preservados. **Não há assinatura fictícia, não se informa que o documento completo passou no XSD de NFe assinada e não há validação criptográfica.** A API retorna `xsd_scope: infNFe`, e a interface comunica o escopo.

Perfil implementado:

| Recurso | Suporte |
|---|---|
| Documento | Modelo 55, saída normal, emissão normal, ambiente 2 |
| Operação | Interna e interestadual; sem conversão entre unidades comercial/tributável |
| Identificação | CPF e CNPJ numéricos, com verificação matemática; sem consulta cadastral real |
| ICMS Simples/MEI | CSOSN 102, 103, 300, 400 e 900 |
| ICMS regime normal | CST 00, 20, 40, 41, 50 e 90 |
| IPI | Tributados 00/49/50/99 e não tributados 01/02/03/04/05/51/52/53/54/55 |
| PIS/COFINS | Alíquota 01/02 e não tributados 04/05/06/07/08/09 |
| Pagamentos | Dinheiro, cheque, boleto, depósito, PIX, transferência, fidelidade e outros com descrição |
| ST/FCP | Campos e cálculo preparados; geração bloqueada enquanto não houver mapeador do perfil |

Entradas, devoluções, ajustes, referências fiscais, exportação, DIFAL, IBS/CBS/IS, CNPJ alfanumérico e cartões com integração são evoluções pendentes. Operações e combinações tributárias sem mapeamento são recusadas com mensagem específica. A existência de um grupo no XSD oficial não significa que o módulo o implementa. A validação estrutural não consulta tabelas vigentes de NCM/CFOP/municípios nem todas as regras de autorização da SEFAZ.

O gerador com limites de valor seleciona produtos sem repetição, varia quantidade e preço apenas no snapshot e exige produtos sem IPI/ST para garantir a faixa exata. Cadastros incompatíveis são recusados, não alterados silenciosamente. Dados fictícios usam nomes de teste e e-mails `example.invalid`; documentos são apenas matematicamente válidos e podem coincidir com documentos reais. Não representam registros oficiais.

## Execução sem Docker

Requisitos: Python 3.12+ e Node.js 22+. PostgreSQL é recomendado; SQLite é oferecido apenas para desenvolvimento local rápido e testes unitários.

```bash
python -m venv .venv
# Linux/macOS
source .venv/bin/activate
# PowerShell
# .\.venv\Scripts\Activate.ps1
pip install -r backend/requirements.lock
cd backend
alembic upgrade head
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Em outro terminal, na raiz:

```bash
cd frontend
npm ci
npm run dev
```

O Vite encaminha `/api` para `127.0.0.1:8000`. Abra http://127.0.0.1:5173. Para desenvolvimento com recarga do backend, adicione `--reload` ao comando Uvicorn.

Sem `DATABASE_URL`, o backend usa `sqlite:///./nfe.db` no diretório de execução. Para PostgreSQL local, configure `backend/.env`:

```dotenv
DATABASE_URL=postgresql+psycopg://usuario:senha@localhost:5432/nfe_lab
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
REQUESTS_PER_MINUTE=240
```

Use um banco dedicado ao projeto e execute `alembic upgrade head`. Credenciais não devem ser versionadas. A senha de exemplo no Compose é exclusiva para desenvolvimento local.

## Arquitetura

```text
backend/
  app/
    api/              REST, DTOs, tratamento de requisições
    domain/           modelos, documentos, cálculos e validação fiscal
    persistence/      entidades SQLAlchemy, sessões e repositórios
    services/         gerador automático, XML/XSD e contrato SefazProvider
    config.py         variáveis de ambiente
    main.py           composição da aplicação, segurança e logs
  migrations/         Alembic, revisão inicial explícita
  schemas/            pacote XSD oficial e proveniência
  scripts/            smoke de PostgreSQL com concorrência
  tests/              domínio e integração HTTP
frontend/
  src/
    pages/            dashboard, cadastros, emissão, histórico, configurações
    components/       campos, etapas, revisão e componentes de interface
    services/         cliente HTTP e formatação
    hooks/            carregamento assíncrono com cancelamento
    types/            contratos TypeScript
```

A interface não calcula impostos. Ela envia o DTO para `/calculate`; o backend usa `Decimal` com arredondamento `ROUND_HALF_UP` por item. Valores monetários são serializados como strings; quantidades admitem quatro casas e preços unitários dez. Bases e valores tributários nulos significam cálculo automático; valores informados são preservados para testes.

Cadastros são fontes reutilizáveis. Cada nota guarda snapshots independentes de emitente, destinatário, itens, tributos, transporte e pagamento. Alterar ou excluir um cadastro não modifica notas já geradas. Duplicar retorna um novo DTO sem número, com nova data de emissão. A gravação reserva numeração por CNPJ/série no banco e possui restrição de unicidade.

### Entidades

`issuers`, `recipients`, `products`, `invoices`, `invoice_items`, `invoice_payments`, `invoice_transport`, `invoice_tax`, `application_settings`, `invoice_sequences`.

As notas possuem colunas pesquisáveis e itens/pagamentos/tributos/transporte separados, com snapshots JSON para campos extensíveis. O XML final é armazenado adicionalmente. Não há dependência do XML para reconstruir ou duplicar a nota. Tentativas bloqueadas por validação de domínio/XSD ficam no histórico; requisições rejeitadas na desserialização do DTO não são persistidas.

### Evolução

Adicione novos DTOs e regras em `domain`, um serviço próprio para o documento fiscal, os repositórios necessários e rotas específicas; inclua migrations e testes. Não reutilize o mapeador NF-e para outros leiautes. `SefazProvider` é a fronteira para assinatura/autorização/consulta/eventos futuros. O comparador pode consumir as exportações XML/JSON sem mudar o fluxo atual.

Autenticação e multiempresa não estão implementadas. O ponto de extensão é a dependência de sessão/contexto nas rotas, seguida de `tenant_id` nas entidades e filtros obrigatórios nos repositórios. Não publique a aplicação abertamente sem implementar esse controle.

### Atualização de schema

Baixe o pacote oficial, mantenha sua proveniência/hash e configure `SCHEMA_DIRECTORY` para o diretório dos XSDs. Reinicie a API (o schema é carregado e mantido em cache), adapte o mapeador e execute a suíte. `layout` é configurável entre as versões efetivamente suportadas — atualmente apenas 4.00. A interface nunca oferece uma versão sem implementação.

## APIs principais

A documentação completa e automática está em `/docs` e `/openapi.json`.

| Método | Caminho | Finalidade |
|---|---|---|
| GET/POST | `/api/issuers`, `/api/recipients`, `/api/products` | Listar/buscar e cadastrar |
| PUT/DELETE | `/api/{cadastro}/{id}` | Editar/excluir cadastro |
| GET | `/api/templates` | DTOs vazios com padrões do ambiente |
| GET/PUT | `/api/settings` | Configurações |
| GET | `/api/addresses/{cep}` | Consulta ViaCEP com timeout |
| POST | `/api/test-data` | Criar conjunto fictício explícito |
| POST | `/api/invoices/calculate` | Valores dos itens e totais |
| POST | `/api/invoices/validate` | Validação do domínio e XSD de infNFe |
| POST | `/api/invoices/generate-random` | Combinação para revisão, sem persistir nota |
| POST | `/api/invoices/generate` | Validar, gerar e persistir (`/api/invoices` é alias) |
| GET | `/api/invoices` | Histórico filtrado e paginado |
| GET/DELETE | `/api/invoices/{id}` | Detalhes ou exclusão |
| POST | `/api/invoices/{id}/duplicate` | Novo DTO independente, sem salvar automaticamente |
| GET | `/api/invoices/{id}/xml` e `/json` | Exportar arquivos |
| GET | `/api/dashboard` | Indicadores e notas recentes |

Falhas retornam `detail` como mensagem ou lista de `{path, message, severity}`. Erros fiscais impedem exportação; alertas permitem continuar. Conflitos de numeração retornam HTTP 409. XMLs usam nome `NFe-HOM-{chave}.xml`.

## Segurança e logs

- Ambiente 2 e modelo 55 são restritos no DTO; campos extras são recusados.
- Inputs validados no servidor, tamanho máximo de requisição 2 MB, strings limitadas e rejeição de controles XML.
- XML gerado com biblioteca de elementos (escaping automático). Parser sem DTD, sem expansão de entidades e sem rede. Importação de XML externo não é disponibilizada.
- Limite em memória de 240 requisições/minuto por IP, configurável. Para múltiplos workers, use gateway/Redis e identidade confiável do cliente. Não confie em cabeçalhos de IP enviados pelo cliente.
- CORS explícito; portas locais; credenciais somente no servidor; ORM parametrizado; sem logs de payloads ou documentos.
- Logs JSON registram evento, módulo, operação, ID interno e status. Falhas inesperadas não retornam stack traces ao usuário.
- Dados persistidos não são criptografados pelo aplicativo; use armazenamento protegido no host. Não há mecanismo de recuperação após exclusão pela interface.

## Testes e qualidade

```bash
cd backend
pytest -q
ruff check .
ruff format --check .
cd ../frontend
npm test
npm run lint
npm run build
```

Os testes abrangem CPF/CNPJ, arredondamento, tributos e overrides, totais, precisão, caracteres XML, XSD oficial, variações de CST/CSOSN, CPF destinatário, transporte, pagamentos, gerador com limites, serialização, API, CRUD, conflitos, histórico, exportações e duplicação.

Para verificar migrations e concorrência com PostgreSQL dedicado:

```bash
cd backend
alembic upgrade head
python scripts/postgres_smoke.py
```

O smoke gera e exclui somente suas próprias notas fictícias, deixando a sequência avançada. Nunca use esse comando contra um banco de produção. O CI executa testes, lint, builds, migrations PostgreSQL e o smoke com oito gerações concorrentes.

`requirements.txt` registra as dependências diretas e `requirements.lock` fixa o ambiente Python completo. `package-lock.json` fixa as dependências do frontend. Atualize os locks junto com qualquer alteração de dependência.

## Git e contribuição

O repositório remoto original estava vazio. A implementação inicial foi organizada em commits de backend, frontend e infraestrutura/documentação.

```bash
git clone https://github.com/matheushiramatsu/nfe_generator.git
git switch -c codex/minha-funcionalidade
# implemente e execute os testes
git add caminho/dos/arquivos
git diff --cached --check
git commit -m "feat: descreva a funcionalidade implementada"
git push -u origin codex/minha-funcionalidade
```

Verifique o diff antes de enviar e nunca inclua `.env`, bases locais, certificados, tokens, dependências ou arquivos gerados. Consulte [VALIDATION.md](VALIDATION.md) para os resultados da entrega inicial.
