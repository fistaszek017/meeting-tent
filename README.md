# The Meeting Tent — losowanie par

Prosta aplikacja webowa (czysty HTML/CSS/JS, bez zależności) do losowania uczestników w pary. Gotowa do postawienia na GitHub Pages.

## Funkcje

- **Wczytywanie z CSV** — jedno imię w wierszu (liczy się pierwsza kolumna; nagłówek typu `imie`/`name` jest pomijany). Można też dopisywać osoby ręcznie.
- **localStorage** — lista uczestników i ustalone pary są zapamiętywane w przeglądarce.
- **Jednorazowe wyłączanie** — w zakładce „Uczestnicy” kliknięcie osoby wyłącza ją z *najbliższego* losowania. Po zakończonym losowaniu wszyscy wyłączeni automatycznie wracają do puli.
- **Ukryte pary ustalone** — na dole zakładki „Uczestnicy” jest dyskretna gwiazdka (✦). Po jej kliknięciu otwiera się sekcja, w której można połączyć dwie osoby — w losowaniu na pewno trafią na siebie. Pozostali losowani są normalnie. Jeśli któraś osoba z ustalonej pary jest wyłączona, para w tym losowaniu nie obowiązuje.
- **Krótka animacja losowania** — chwila migających imion i karty par odsłaniają się jedna po drugiej.
- Przy nieparzystej liczbie uczestników jedna osoba dołącza losowo jako trzecia do którejś pary.

## Uruchomienie lokalne

Wystarczy otworzyć `index.html` w przeglądarce albo:

```bash
python -m http.server 8000
```

i wejść na `http://localhost:8000`.

## Publikacja na GitHub Pages

1. Wypchnij repozytorium na GitHub.
2. W ustawieniach repozytorium: **Settings → Pages → Source: Deploy from a branch**, gałąź `main`, folder `/ (root)`.
3. Strona będzie dostępna pod `https://<użytkownik>.github.io/<repozytorium>/`.

## Przykładowy plik

W repozytorium jest `przyklad.csv` z przykładową listą imion do testów.
