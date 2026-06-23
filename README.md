# SCAIA

Sistema de Controle de Atividades Inadimplentes, desenvolvido em HTML, CSS e JavaScript puro.

## Como usar

1. Abra o arquivo `index.html` em um navegador moderno.
2. Entre com **João Vitor / joao123** ou **Dani / dani123**. Também é possível cadastrar outro professor.
3. Cadastre os alunos e suas atividades pelo formulário.
4. Use os filtros e a busca para localizar registros.
5. Clique em **Gerar relatório** e depois em **Imprimir / Salvar PDF** para exportar.

Os dados ficam armazenados somente no navegador por meio de LocalStorage. Cada professor possui seus próprios registros. As contas são locais e foram pensadas para organização prática, não para proteger dados sensíveis em computadores compartilhados.

## Arquivos

- `index.html`: estrutura da interface.
- `styles.css`: identidade visual e responsividade.
- `app.js`: cadastro, edição, exclusão, filtros, indicadores, relatório e persistência.
