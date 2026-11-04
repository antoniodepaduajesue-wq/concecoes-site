// Cloudflare Pages Function: GET /api/noticias
// Junta automaticamente notícias do Google Notícias sobre PMA, gestação de substituição,
// infertilidade e adoção, em dois grupos: imprensa portuguesa e imprensa internacional.
// O resultado fica em cache 3 horas, por isso o site atualiza-se sozinho várias vezes por dia.

const PESQUISAS = {
  portugal: {
    q: '"procriação medicamente assistida" OR "gestação de substituição" OR "barrigas de aluguer" OR "barriga de aluguer" OR infertilidade OR "fertilização in vitro" OR "adoção de crianças" OR homoparentais OR "famílias LGBT" when:120d',
    params: 'hl=pt-PT&gl=PT&ceid=PT:pt-150',
    soPortugal: true,
    tema: /procria|\bPMA\b|gesta[çc][ãa]o de substitui|barrigas? de aluguer|infertil|fertilidade|fertiliza[çc][ãa]o|in vitro|embri[ãa]o|embri[õo]es|ado[çc][ãa]o|adot|homoparent|LGBT|parentalidade/i,
  },
  mundo: {
    q: '(IVF OR "assisted reproduction" OR surrogacy OR "fertility treatment" OR "same-sex parents" OR "LGBTQ parents" OR "LGBTQ families") (site:bbc.com OR site:bbc.co.uk OR site:theguardian.com OR site:reuters.com OR site:apnews.com OR site:npr.org OR site:dw.com OR site:euronews.com OR site:statnews.com OR site:theconversation.com OR site:nature.com OR site:nytimes.com OR site:washingtonpost.com OR site:cnn.com OR site:aljazeera.com OR site:france24.com OR site:theatlantic.com OR site:time.com OR site:nbcnews.com OR site:cbsnews.com OR site:abcnews.go.com OR site:independent.co.uk OR site:scientificamerican.com OR site:newscientist.com OR site:medscape.com OR site:kffhealthnews.org OR site:19thnews.org OR site:them.us OR site:advocate.com)',
    complemento: 'IVF OR "assisted reproduction" OR surrogacy OR "fertility treatment" OR "same-sex parents" OR "LGBTQ parents" OR "LGBTQ families" when:30d',
    params: 'hl=en-US&gl=US&ceid=US:en',
    soPortugal: false,
    tema: /\bIVF\b|in vitro|surroga|fertility|infertil|embryo|assisted reproduc|egg freez|sperm donor|same-sex (parent|couple)|LGBTQ?\+? (parent|famil)|adoption/i,
  },
};
const MAXIMO = 8;
const DIAS_MAXIMO = 120;
// Fontes de celebridades e entretenimento, que não interessam aqui.
const EXCLUIR = /people\.com|ew\.com|thegrio|pagesix|usmagazine|eonline|tmz|dailymail|hellomagazine|okmagazine|etonline|justjared|nypost|thesun\.co|mirror\.co|express\.co|vietnam\.vn|aol\.com/i;
const CACHE_SEGUNDOS = 3 * 60 * 60;

function limpar(s) {
  return (s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&amp;/g, '&')
    .replace(/[​-‍﻿]/g, '')
    .trim();
}
function campo(item, tag) {
  const m = item.match(new RegExp('<' + tag + '(\\s[^>]*)?>([\\s\\S]*?)</' + tag + '>'));
  return m ? limpar(m[2]) : '';
}
function anfitriao(url) {
  try { return new URL(url).hostname.toLowerCase(); } catch (e) { return ''; }
}

function lerRSS(xml, soPortugal, tema) {
  const itens = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  const vistos = new Set();
  const out = [];
  for (const it of itens) {
    const fonte = campo(it, 'source');
    const srcUrl = (it.match(/<source[^>]*url="([^"]+)"/) || [])[1] || '';
    const host = anfitriao(srcUrl);
    if (EXCLUIR.test(host)) continue;
    if (soPortugal && !host.endsWith('.pt')) continue;
    if (!soPortugal && host.endsWith('.pt')) continue;
    let titulo = campo(it, 'title');
    if (fonte && titulo.endsWith(' - ' + fonte)) titulo = titulo.slice(0, -(fonte.length + 3));
    const link = campo(it, 'link');
    const data = new Date(campo(it, 'pubDate'));
    if (tema && !tema.test(titulo)) continue;
    if (Date.now() - new Date(campo(it, 'pubDate')) > DIAS_MAXIMO * 864e5) continue;
    if (!titulo || !/^https:\/\//.test(link) || isNaN(data)) continue;
    const chave = titulo.toLowerCase().replace(/[^a-z0-9à-ü]+/g, ' ').slice(0, 60);
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    out.push({ titulo, fonte, link, data: data.toISOString() });
  }
  out.sort((a, b) => b.data.localeCompare(a.data));
  return out;
}

async function rss(q, params) {
  const url = 'https://news.google.com/rss/search?q=' + encodeURIComponent(q) + '&' + params;
  const r = await fetch(url, { cf: { cacheTtl: CACHE_SEGUNDOS, cacheEverything: true }, headers: { 'User-Agent': 'concecoes.pt noticias' } });
  if (!r.ok) throw new Error('RSS ' + r.status);
  return r.text();
}

// Primeiro as fontes de referência; se forem poucas, completa com a pesquisa geral.
async function buscar(p) {
  let lista = lerRSS(await rss(p.q, p.params), p.soPortugal, p.tema);
  if (p.complemento && lista.length < MAXIMO) {
    try {
      const extra = lerRSS(await rss(p.complemento, p.params), p.soPortugal, p.tema);
      const vistos = new Set(lista.map(n => n.link));
      lista = lista.concat(extra.filter(n => !vistos.has(n.link)).slice(0, MAXIMO - lista.length));
    } catch (e) {}
  }
  return lista.slice(0, MAXIMO).sort((a, b) => b.data.localeCompare(a.data));
}

export async function onRequestGet(context) {
  const cache = caches.default;
  const chaveCache = new Request(new URL('/api/noticias?v=1', context.request.url).toString());
  const emCache = await cache.match(chaveCache);
  if (emCache) return emCache;

  const [pt, mu] = await Promise.allSettled([buscar(PESQUISAS.portugal), buscar(PESQUISAS.mundo)]);
  const corpo = {
    atualizado: new Date().toISOString(),
    portugal: pt.status === 'fulfilled' ? pt.value : [],
    mundo: mu.status === 'fulfilled' ? mu.value : [],
  };
  const ok = corpo.portugal.length || corpo.mundo.length;
  const resp = new Response(JSON.stringify(corpo), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=' + (ok ? 1800 : 60),
      'Access-Control-Allow-Origin': '*',
    },
  });
  if (ok) {
    const paraCache = resp.clone();
    paraCache.headers.set('Cache-Control', 'public, max-age=' + CACHE_SEGUNDOS);
    context.waitUntil(cache.put(chaveCache, paraCache));
  }
  return resp;
}
