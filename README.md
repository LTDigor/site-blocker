# Site Blocker

## Язык / Language

[Русская версия](#русская-версия) | [English Version](#english-version)

## Русская версия

Недавно у меня появилась идея для реально крутого приложения, которое изменило бы жизнь миллионов пользователей. Для реализации я воспользовался ИИ. Знаете сколько занял у меня весь процесс разработки — от первого промта до готового приложения? 47 секунд. Не минут. Не часов. Не дней.

Это — не провокация, это — новая реальность. Сейчас не нужно иметь образование или навыки, чтобы воплотить свои идеи в жизнь. Не нужны разработчики, тестировщики, аналитики. Не нужны бигтехи и корпорации. Достаточно одной хорошей идеи.

Сейчас 60% моих навыков не стоят ничего, зато остальные 40% стоят на 60% больше. Мы на пороге больших перемен, к которым нужно быть готовым ЗАРАНЕЕ. Так что не нужно прокачивать харды. Прокачивайте свое окружение, свои связи, свою сеть контактов.

### Что делает расширение

URL Image Blocker блокирует сайты и отдельные URL-адреса из списка. Если пользователь пытается открыть заблокированный адрес, расширение перенаправляет вкладку на страницу блокировки.

### Как установить расширение в браузер

1. Скачайте или склонируйте проект на компьютер.
2. Откройте Google Chrome, Microsoft Edge или Firefox.
3. Перейдите на страницу расширений:
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`
   - Firefox: `about:debugging#/runtime/this-firefox`
4. Включите режим разработчика.
5. В Chrome/Edge нажмите `Загрузить распакованное расширение`; в Firefox нажмите `Load Temporary Add-on`.
6. Выберите папку проекта `site-blocker` в Chrome/Edge или файл `manifest.json` внутри проекта в Firefox.
7. Расширение появится в списке установленных расширений.

### Как пользоваться

1. Нажмите на иконку расширения в панели браузера.
2. Введите домен или URL, который нужно заблокировать.
3. Нажмите `Add`.
4. Чтобы быстро заблокировать текущий сайт, нажмите `Add current site`.
5. В блоке `Block image` нажмите `Choose local image`, чтобы заменить картинку на странице блокировки. Кнопка `Reset` возвращает стандартную картинку.
6. Если вы открыли заблокированный сайт, в popup появится кнопка `Unblock 10 min`. Перед временной разблокировкой нужно решить математический пример.
7. Чтобы удалить сайт из списка блокировки, нажмите `×` рядом с правилом и решите математический пример. Без правильного ответа сайт не удалится.

Математические примеры специально сделаны не одношаговыми: они могут включать умножение, деление, скобки, сложение и вычитание.

Примеры записей:

- `example.com` — блокирует весь домен.
- `example.com/news` — блокирует путь, начинающийся с `/news`.
- `example.com/^articles/[0-9]+` — блокирует путь по регулярному выражению.

### Структура проекта

- `manifest.json` — конфигурация расширения.
- `src/background/` — service worker и логика блокировки.
- `src/popup/` — интерфейс popup-окна расширения.
- `src/blocked/` — страница, которая показывается вместо заблокированного сайта.
- `assets/images/` — изображения и медиафайлы.

## English Version

Recently, I had an idea for a genuinely cool app that could change the lives of millions of users. To build it, I used AI. Do you know how long the entire development process took me, from the first prompt to the finished application? 47 seconds. Not minutes. Not hours. Not days.

This is not a provocation. This is the new reality. Today, you do not need formal education or technical skills to bring your ideas to life. You do not need developers, testers, or analysts. You do not need big tech companies or corporations. One good idea is enough.

Right now, 60% of my skills are worth nothing, while the remaining 40% are worth 60% more. We are on the edge of major changes, and we need to be ready IN ADVANCE. So do not focus on leveling up hard skills. Level up your environment, your connections, and your network.

### What the extension does

URL Image Blocker blocks websites and specific URLs from a custom list. When a user tries to open a blocked address, the extension redirects the tab to a blocking page.

### How to install the extension in your browser

1. Download or clone the project to your computer.
2. Open Google Chrome, Microsoft Edge, or Firefox.
3. Go to the extensions page:
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`
   - Firefox: `about:debugging#/runtime/this-firefox`
4. Turn on developer mode.
5. In Chrome/Edge, click `Load unpacked`; in Firefox, click `Load Temporary Add-on`.
6. Select the `site-blocker` project folder in Chrome/Edge or the `manifest.json` file inside the project in Firefox.
7. The extension will appear in your list of installed extensions.

### How to use it

1. Click the extension icon in the browser toolbar.
2. Enter the domain or URL you want to block.
3. Click `Add`.
4. To block the site you're on right now, click `Add current site`.
5. In `Block image`, click `Choose local image` to replace the image shown on the block page. `Reset` restores the default image.
6. When you are on a blocked site, the popup shows `Unblock 10 min`. You must solve a math challenge before the temporary unblock is applied.
7. To remove a site from the block list, click `×` next to the rule and solve the math challenge. The site is not removed until the answer is correct.

Math challenges are intentionally multi-step: they can include multiplication, division, parentheses, addition, and subtraction.

Blocked site examples:

- `example.com` blocks the entire domain.
- `example.com/news` blocks any path that starts with `/news`.
- `example.com/^articles/[0-9]+` blocks paths using a regular expression.

### Project structure

- `manifest.json` contains the extension configuration.
- `src/background/` contains the service worker and blocking logic.
- `src/popup/` contains the extension popup UI.
- `src/blocked/` contains the page shown instead of a blocked website.
- `assets/images/` contains images and media files.
- `assets/icons/` contains packaged extension icons.
- `store-assets/` contains Chrome Web Store listing assets that are not included in the extension package.

### Packaging and Chrome Web Store release

Run tests and build the release ZIP:

```sh
npm test
npm run package
```

Packages are created at `dist/site-blocker-chromium-v<version>.zip` and `dist/site-blocker-firefox-v<version>.zip`. See `docs/chrome-web-store.md` for the first manual Chrome Web Store setup, required GitHub secrets, and tag-based release workflow.
