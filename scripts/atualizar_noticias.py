"""Recolhe do Google Notícias as notícias sobre PMA, gestação de substituição,
infertilidade, adoção e famílias LGBTQIA+ e grava-as em noticias.json.
Corre automaticamente no GitHub (ver .github/workflows/noticias.yml).
Para mudar os temas ou as fontes, edite as PESQUISAS abaixo."""
import json, re, sys, time, urllib.parse, urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime

MAXIMO = 8
DIAS_MAXIMO = 120
EXCLUIR = re.compile(r"people\.com|ew\.com|thegrio|pagesix|usmagazine|eonline|tmz|dailymail|hellomagazine|okmagazine|etonline|justjared|nypost|thesun\.co|mirror\.co|express\.co|vietnam\.vn|aol\.com", re.I)
INGLES = 'IVF OR "assisted reproduction" OR surrogacy OR "fertility treatment" OR "same-sex parents" OR "LGBTQ parents" OR "LGBTQ families"'
REFERENCIA = " OR ".join("site:" + s for s in [
    "bbc.com", "bbc.co.uk", "theguardian.com", "reuters.com", "apnews.com", "npr.org", "dw.com", "euronews.com",
    "statnews.com", "theconversation.com", "nature.com", "nytimes.com", "washingtonpost.com", "cnn.com",
    "aljazeera.com", "france24.com", "theatlantic.com", "time.com", "nbcnews.com", "cbsnews.com",
    "independent.co.uk", "scientificamerican.com", "newscientist.com", "kffhealthnews.org", "19thnews.org"])

PESQUISAS = {
    "portugal": {
        "consultas": ['"procriação medicamente assistida" OR "gestação de substituição" OR "barrigas de aluguer" OR "barriga de aluguer" OR infertilidade OR "fertilização in vitro" OR "adoção de crianças" OR homoparentais OR "famílias LGBT" when:120d'],
        "params": "hl=pt-PT&gl=PT&ceid=PT:pt-150",
        "so_portugal": True,
        "tema": re.compile(r"procria|\bPMA\b|gesta[çc][ãa]o de substitui|barrigas? de aluguer|infertil|fertilidade|fertiliza[çc][ãa]o|in vitro|embri[ãa]o|embri[õo]es|ado[çc][ãa]o|adot|homoparent|LGBT|parentalidade", re.I),
    },
    "mundo": {
        # primeiro fontes de referência; se forem poucas, completa com a pesquisa geral
        "consultas": ["(" + INGLES + ") (" + REFERENCIA + ")", INGLES + " when:30d"],
        "params": "hl=en-US&gl=US&ceid=US:en",
        "so_portugal": False,
        "tema": re.compile(r"\bIVF\b|in vitro|surroga|fertility|infertil|embryo|assisted reproduc|egg freez|sperm donor|same-sex (parent|couple)|LGBTQ?\+? (parent|famil)|adoption", re.I),
    },
}

def rss(q, params):
    url = "https://news.google.com/rss/search?q=" + urllib.parse.quote(q) + "&" + params
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) concecoes.pt", "Accept": "application/rss+xml, application/xml"})
    for tentativa in range(4):  # o Google às vezes responde 503; tenta de novo com pausa
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read()
        except Exception as e:
            if tentativa == 3: raise
            print("nova tentativa:", e, file=sys.stderr)
            time.sleep(10 * (tentativa + 1))

def ler(xml, p):
    out, vistos = [], set()
    limite = datetime.now(timezone.utc) - timedelta(days=DIAS_MAXIMO)
    for it in ET.fromstring(xml).iter("item"):
        src = it.find("source")
        fonte = (src.text or "").strip() if src is not None else ""
        host = urllib.parse.urlparse(src.get("url", "") if src is not None else "").hostname or ""
        if EXCLUIR.search(host): continue
        if p["so_portugal"] != host.endswith(".pt"): continue
        titulo = re.sub(r"[​-‍﻿]", "", (it.findtext("title") or "")).strip()
        if fonte and titulo.endswith(" - " + fonte): titulo = titulo[: -(len(fonte) + 3)]
        link = (it.findtext("link") or "").strip()
        try: data = parsedate_to_datetime(it.findtext("pubDate"))
        except Exception: continue
        if not titulo or not link.startswith("https://") or data < limite: continue
        if not p["tema"].search(titulo): continue
        chave = re.sub(r"\W+", " ", titulo.lower())[:60]
        if chave in vistos: continue
        vistos.add(chave)
        out.append({"titulo": titulo, "fonte": fonte, "link": link, "data": data.astimezone(timezone.utc).isoformat()})
    out.sort(key=lambda n: n["data"], reverse=True)
    return out

def main(destino):
    res = {}
    for k, p in PESQUISAS.items():
        lista = []
        for q in p["consultas"]:
            if len(lista) >= MAXIMO: break
            try: novos = ler(rss(q, p["params"]), p)
            except Exception as e:
                print(k, "erro:", e, file=sys.stderr); continue
            links = {n["link"] for n in lista}
            lista += [n for n in novos if n["link"] not in links][: MAXIMO - len(lista)]
        res[k] = sorted(lista, key=lambda n: n["data"], reverse=True)
    try: antigo = json.load(open(destino, encoding="utf-8"))
    except Exception: antigo = {}
    for k in res:  # se uma recolha falhar, mantém as notícias anteriores
        if not res[k] and antigo.get(k): res[k] = antigo[k]
    if not any(res.values()):
        print("Nenhuma notícia recolhida; ficheiro mantido.", file=sys.stderr); return
    if all(res[k] == antigo.get(k) for k in res):
        print("Sem notícias novas."); return
    res = {"atualizado": datetime.now(timezone.utc).replace(microsecond=0).isoformat(), **res}
    with open(destino, "w", encoding="utf-8") as f:
        json.dump(res, f, ensure_ascii=False, indent=1)
    print({k: len(v) for k, v in res.items() if k != "atualizado"})

if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "noticias.json")
