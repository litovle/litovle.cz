# Vizuální pravidla Litovle.cz

Výchozím bodem je `../svoz_odpadu_litovel/DESIGN.md`. Tento dokument rozvíjí
společný jazyk obou webů; úpravy zde automaticky nemění web svozu odpadu.
Pravidla používá vyhledávání usnesení, detail usnesení, přehled roku, stránka
schůze a výpis i detail rozpočtových opatření.

Společné styly jsou v `assets/css/usneseni.css`. Šablony přehledu roku a schůze
používají kontejner `.usn-section`; účetní detail navíc `.usn-budget`.
Výsledkové řádky mají stejný vzhled v hledání, na stránce schůze i ve výpisu RO.

## Principy

- Hierarchii tvoří obsah, typografie a mezery. Každá sekce nemusí být kartou.
- Jeden významový celek má nejvýše jeden povrch. Panel neobsahuje další panel.
- Uvítání nabízí konkrétní témata a místa s krátkým vysvětlením. Počty dokumentů,
  zdroje a archiv jsou podpůrné informace.
- Objevování obsahu může mít jeden jemně tónovaný povrch a zelené zkratky.
  Stavové barvy mají vlastní význam a vždy také slovní označení.
- Nepoužíváme dekorativní štítky, gradienty, velké stíny, verzálky ani prostrkání.
- Oddělovače patří mezi datové řádky. Běžné sekce oddělujeme mezerou.

## Základní hodnoty

| Oblast | Pravidlo |
| --- | --- |
| Písmo | Systémové bezpatkové, základ 16px, řádkování textu 1,5–1,6 |
| Menší text | `--text-small`: 14px; metadata, drobečková navigace, poznámky |
| Běžný text | `--text-body`: 16px; obsah, ovládací prvky, náhledy; malé nadpisy tučně |
| Sekční nadpis | `--text-section`: 24px |
| Název stránky | `--text-title`: 32px; na telefonu 24px |
| Mezery | Sekce 32px; související části 16px; ovládací prvky 8px |
| Panel | Bílý povrch, odsazení 16px, zaoblení 12px |
| Ovládací prvky | Zaoblení 8px, šířka podle obsahu; pole mohou vyplnit dostupnou šířku |
| Velikost tlačítek | Výška 34px při ovládání myší, nejméně 44px pro hrubý ukazatel (`pointer: coarse`) |
| Odkazy a hlavní akce | Značková modrá `#0f46ab` |
| Text | Tmavý neutrální `#1f2933`, pomocný `#52606b` |
| Pozadí | Světlé neutrální `#f5f7f8`, panel `#fff` |
| Objevování | Povrch `#f0f4ec`, text `#294b35`, tlačítko `#2f5a41` s bílým textem |

Komponenty používají proměnné `--space-section`, `--space-panel`,
`--radius-panel`, `--radius-control`, `--control-height` a `--surface-panel`.
Při dalších úpravách nepřidáváme téměř shodné lokální varianty.

## Prvky a stavy

- **Sekce:** nadpis a obsah bez povrchu; výchozí způsob uspořádání informací.
- **Panel:** jeden samostatný interaktivní nebo významový celek. Uvítání může
  seskupit úvod a tematické zkratky; místa a data jsou samostatné sousední sekce.
- **Odkaz:** naviguje na stránku; v souvislém textu je podtržený.
- **Tlačítko:** provádí akci nebo mění hledání. Zkratky mají šířku podle názvu,
  zalamují se do řádků a nevytvářejí velké stejně široké dlaždice.
- **Volby:** zaškrtávací pole pro nezávislé výběry; nabídka pro jedno téma.
  Výběr vyjadřuje nativní zaškrtnutí nebo barevná výplň a příslušný ARIA stav.
- **Aktivní filtr:** kompaktní odstranitelné tlačítko se slovním popisem a křížkem.
- **Výsledek:** čitelný řádek s odkazem, metadaty a náhledem; bez samostatné karty.
- **Hover:** jemná změna pozadí, u odkazu podtržení. Žádný posun ani zvětšování.
- **Focus:** viditelný obrys 2px s odstupem 3px. Nikdy se pouze neodstraní.
- **Disabled:** nativní `disabled`, snížená sytost; načítání má textový stav.
- **Rozbalení:** popisek a směrová šipka vyjadřují akci; `aria-expanded` odpovídá
  viditelnosti. Pro jednoduché doplňující části používáme `details` / `summary`.

## Hustota a rozvržení

Filtry s různou výškou nesmějí vytvářet dlouhé prázdné sloupce. Krátké ovládací
skupiny jsou společně; seznam roků je pod nimi přes celou šířku. Prvních pět
roků a předvolby jsou dostupné ihned, další přes „Starší roky“. Vybrané starší
roky se při otevření filtrů automaticky odkryjí.

Na telefonu se podpůrné sekce řadí pod sebe. Zkratky zůstávají kompaktní,
ale mají pohodlnou dotykovou plochu. Dlouhé názvy se zalomí; obsah nesmí
vytvořit vodorovné posouvání.

## Kontrola změny

1. Je zřejmé, kde začít a co která volba udělá?
2. Jsou pomocné údaje méně výrazné než hlavní úloha?
3. Neobsahuje panel další kartu nebo dekorativní štítek?
4. Nejsou tlačítka zbytečně široká nebo vysoká?
5. Nevytváří dlouhý seznam prázdné místo vedle krátkého ovládacího prvku?
6. Funguje klávesnice, dotyk, dlouhé názvy a šířka 320px?
7. Odpovídají styly existujícím proměnným a pravidlům?

## Detail usnesení

Zpět na vyhledávání a drobečková navigace předcházejí jednomu bílému čtecímu
povrchu. V něm je vlevo zarovnaný název, kompaktní metadata, původní text a
nakonec odkaz na schůzi a poznámka o přepisu. Text má 16px a řádkování 1,6;
metadata a poznámky 14px. Znění usnesení se při vizuálních úpravách nemění.
Zdrojový odkaz uvádíme pouze tehdy, pokud ho poskytují existující podklady.

## Přehled roku, schůze a rozpočtová opatření

Roční přehled tvoří kompaktní rozbalovací řádky s viditelnou šipkou.
Název schůze má 16px, datum a počet usnesení 14px. Po rozbalení následují
odkazy na rozhodnutí; mezi schůzemi nejsou další karty ani prázdné bloky.

Stránka schůze a výpis RO používají stejné výsledkové řádky jako vyhledávání:
modrý odkaz, klidná metadata, text 16px a jemný oddělovač. Zkrácené náhledy mají
nejvýše tři řádky s výpustkou. Barevný překryv na konci textu nepoužíváme.
Usnesení s jednotlivými body ukazuje nejvýše první tři body v původním pořadí
s označením a), b), c) podle dat. Body mají stejný vzhled v hledání i na stránce
schůze; chybějící předmět nesmí skrýt jejich obsah. U delších seznamů následuje
počet dalších rozhodnutí, plný text je v detailu.

RO má stejně jako usnesení vlevo zarovnaný nadpis a bílý informační povrch.
Jednotlivé rozpočtové změny jsou samostatné bílé celky, každý se stabilním
odkazem a rozbalovacími účetními řádky. Uvnitř se nevkládají další karty.
Kladné a záporné částky mohou mít stavovou barvu; navigace zůstává modrá.
