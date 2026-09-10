# Proveniência do schema NF-e

Pacote: **PL 010f v1.04**, NF-e 4.00, NT 2025.002 v1.50 e NT 2026.007 v1.00.
Publicado no Portal Nacional da NF-e em **31/08/2026**; consultado e baixado em **10/09/2026**.

- [Listagem oficial](https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=BMPFMBoln3w%3D)
- [Download oficial do pacote](https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=8ITFuBLltXs=)
- SHA-256 de `PL_010f.zip`: `B8589490A58A09A993A80E6AC4D7ED10F20892061ECFC56719337098D4B95998`
- Diretório extraído: `PL_010f/PL_010f_v1.04`.

Os arquivos XSD são distribuídos pelo portal oficial, com autoria e avisos originais preservados. O arquivo ZIP original foi mantido para auditoria. Nenhum XSD oficial foi modificado.

`app/services/xml.py` valida a declaração oficial de `infNFe` por um adaptador em memória. O elemento NFe completo exige assinatura digital, fora do MVP. Leia o escopo detalhado no README principal antes de usar as exportações.
