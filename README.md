# Projeto Conceções — site

Site público do Projeto Conceções (concecoes.pt): encontros mensais na CooLabora (Covilhã) e investigação de doutoramento de António Oliveira (UBI, bolsa FCT 2024.01020.BDANA).

- `index.html` — o site completo, num único ficheiro.
- Os textos estão no bloco `<script type="application/json" id="conteudo">`, perto do fim do ficheiro.
- Publicado automaticamente pelo Cloudflare Pages a cada alteração no ramo `main`.
- `noticias.json` — notícias mostradas no separador Informação (Portugal e mundo). É atualizado automaticamente quatro vezes por dia pela tarefa `.github/workflows/noticias.yml`, que corre `scripts/atualizar_noticias.py` (recolha no Google Notícias). Para mudar temas ou fontes, edite as PESQUISAS no início desse script. Para atualizar já, use "Run workflow" no separador Actions do GitHub.
