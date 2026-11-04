# Projeto Conceções — site

Site público do Projeto Conceções (concecoes.pt): encontros mensais na CooLabora (Covilhã) e investigação de doutoramento de António Oliveira (UBI, bolsa FCT 2024.01020.BDANA).

- `index.html` — o site completo, num único ficheiro.
- Os textos estão no bloco `<script type="application/json" id="conteudo">`, perto do fim do ficheiro.
- Publicado automaticamente pelo Cloudflare Pages a cada alteração no ramo `main`.
- `functions/api/noticias.js` — função do Cloudflare Pages que serve `/api/noticias`: recolhe do Google Notícias as notícias sobre PMA, gestação de substituição, infertilidade e adoção (imprensa portuguesa e internacional) e guarda-as em cache 3 horas. O separador Informação mostra-as automaticamente. Para mudar os temas ou as fontes, edite as pesquisas no topo desse ficheiro.
