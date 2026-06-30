# Site Blocker

Browser extension that blocks configured domains or URL paths and redirects
matching tabs to a local block page.

## Идея

Недавно у меня появилась идея для реально крутого приложения, которое изменило
бы жизнь миллионов пользователей. Для реализации я воспользовался ИИ. Знаете
сколько занял у меня весь процесс разработки - от первого промта до готового
приложения? 47 секунд. Не минут. Не часов. Не дней.

Это не провокация, это новая реальность. Сейчас не нужно иметь образование или
навыки, чтобы воплотить свои идеи в жизнь. Не нужны разработчики, тестировщики,
аналитики. Не нужны бигтехи и корпорации. Достаточно одной хорошей идеи.

Сейчас 60% моих навыков не стоят ничего, зато остальные 40% стоят на 60%
больше. Мы на пороге больших перемен, к которым нужно быть готовым ЗАРАНЕЕ.
Так что не нужно прокачивать харды. Прокачивайте свое окружение, свои связи,
свою сеть контактов.

## Install

1. Open the browser extension page:
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`
   - Firefox: `about:debugging#/runtime/this-firefox`
2. Enable developer mode.
3. Chrome/Edge: choose `Load unpacked` and select this repository.
4. Firefox: choose `Load Temporary Add-on` and select `manifest.json`.

## Use

1. Open the extension popup.
2. Add a domain or URL rule.
3. Use `Add current site` for the active tab.
4. Use `Choose local image` to change the block-page image.
5. Solve the math challenge to remove a rule or unblock for 10 minutes.

Rule examples:

- `example.com` - block the whole domain.
- `example.com/news` - block paths starting with `/news`.
- `example.com/^$` - block only the site root.
- `example.com/^articles/[0-9]+` - block a regex path.

## Project

- `manifest.json` - extension manifest.
- `src/background/` - service worker and blocking logic.
- `src/popup/` - popup UI.
- `src/blocked/` - block page.
- `assets/icons/` - packaged extension icons.
- `assets/images/` - block-page media.
- `store-assets/` - store listing assets, excluded from extension ZIPs.

## Test and Package

```bash
npm test
npm run package
```

Packages are written to `dist/`.

## Chrome Web Store Submission

Before resubmitting, publish `privacy.html` at a public HTTPS URL and enter that
URL in the Chrome Web Store Developer Dashboard privacy policy field. The
preferred URL is the GitHub Pages page for this repo:

```text
https://ltdigor.github.io/site-blocker/privacy.html
```

If GitHub Pages is not enabled yet, enable it for the repository root on the
primary branch after this file is pushed. As a fallback, the public GitHub page
for `PRIVACY.md` can be used, but a dedicated HTML page is easier for reviewers
to recognize as a direct policy page.

1. Open the item in the Developer Dashboard.
2. Go to the Privacy tab.
3. Paste the public privacy policy URL into the Privacy Policy box.
4. Open the saved URL in a signed-out or incognito browser session to confirm it
   is publicly accessible and points directly to the policy.
