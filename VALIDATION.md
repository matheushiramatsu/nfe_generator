# Validação da entrega

Execução local em 10/09/2026, Windows, Python 3.12 e Node.js.

| Verificação | Resultado |
|---|---|
| Backend `pytest -q` | 50 testes passaram |
| Backend `ruff check .` | Passou |
| Backend `ruff format --check .` | Passou |
| Frontend `npm test` | 6 testes passaram |
| Frontend `npm run lint` | Passou |
| Frontend `npm run build` | TypeScript + build Vite passaram |
| Alembic `upgrade head` em SQLite | Passou |
| `docker compose config --quiet` | Passou |
| Navegador desktop | Dashboard, dados fictícios, geração automática, validação, XML, busca de tag e duplicação testados |
| Navegador 390 × 844 | Dashboard responsivo, sem transbordamento horizontal da página |

No teste pela interface, uma nota automática de R$ 555,18 foi duplicada. Alterar a quantidade do primeiro item de 2 para 3 recalculou o total para R$ 744,95. Após ajustar o pagamento, a cópia foi gerada como nota #2, preservando a primeira nota.

Há avisos de depreciação das bibliotecas Starlette/httpx/anyio e avisos de anotação de tree-shaking do Zod no build; não impedem os testes ou o build.

O Docker Desktop local não disponibilizou o engine durante a verificação inicial. A configuração foi validada; a execução real dos containers e a integração PostgreSQL também possuem verificações no workflow `.github/workflows/ci.yml`. A primeira execução da CI passou em todos os jobs, incluindo o smoke PostgreSQL com oito gerações concorrentes: https://github.com/matheushiramatsu/nfe_generator/actions/runs/34497084078. O workflow também foi ampliado para subir os três containers, consultar a API por meio do proxy do frontend e executar o smoke dentro do container.

Não foram testados assinatura, autorização SEFAZ, regras fiscais fora do perfil do MVP ou produção — essas funcionalidades não estão implementadas. O teste XSD cobre `infNFe`, como descrito no README.
