# Código-fonte do Jungle Performance Analytics

Esta pasta guarda o código do painel e do coletor. O site publicado é o
`index.html` da raiz, montado a partir daqui. Nenhuma chave ou token fica aqui:
a chave da Riot e o token do GitHub ficam só na pasta do coletor no PC.

## Pastas

- `src/` — o painel (React + Recharts).
- `build.mjs` — monta o painel num único arquivo HTML.
- `site.config.json` — endereço, título e descrição do site público.
- `collector/` — o coletor em Python que baixa as partidas e publica `dados/`.
- `test/` — testes e scripts de conferência.

## Montar

```
npm install
node build.mjs           # versão para o painel do Claude
node build.mjs --site    # versão do site público (dist/site/index.html)
node test/engine.test.mjs
```

Para publicar o site, copie apenas `dist/site/index.html` para a raiz do
repositório. Não substitua os arquivos de `dados/`: quem atualiza é o coletor.
