# ПАНДА: этап 2 — первая Docker-сборка веб-приложения

**Статус:** конфигурация подготовлена в `migration/docker`; фактическая сборка на сервере ещё не выполнялась.
**Область:** только Next.js приложение. PostgreSQL, Supabase Auth, Storage, планировщик и HTTPS добавятся позднее.

## Файлы

- `Dockerfile`: Node.js 24 / Debian bookworm (glibc), `npm ci` с локальным `vendor/xlsx-0.20.3.tgz`, полный `npm run build` (регрессионные тесты, Sharp и Next.js), standalone runtime непривилегированного пользователя.
- `.dockerignore`: исключает секреты, `.git`, локальные сборки и зависимости. Не исключает `vendor`, `data`, `scripts`, `public`.
- `next.config.ts`: `output: "standalone"`; существующие редиректы сохранены.
- `compose.yaml`: **только** `panda-web`; проброс строго на `127.0.0.1:3000`, не в публичный интернет; проверки /login, отдельный cache volume; ещё не production.
- `.env.docker.example`: список начальных переменных без значений; требуется создать незакоммиченный `.env.docker`.

## Условия перед пробной сборкой

1. На тестовом Linux/CI получить Docker Engine и Docker Compose.
2. Использовать изолированные тестовые значения Supabase, **не** рабочие ключи и не рабочую БД для изменяющих запросов.
3. Проверить, что все файлы `public/panda` и `vendor/xlsx-0.20.3.tgz` присутствуют при сборке.
4. Переменные `NEXT_PUBLIC_SUPABASE_URL` и `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` встраиваются в браузерную сборку: при изменении внешнего адреса Supabase нужно **пересобрать образ**. Ключ `SUPABASE_SECRET_KEY` не передавать в Docker build аргументах.
5. Непосредственно на сервере выполнить:

```bash
cp .env.docker.example .env.docker
chmod 600 .env.docker
# Заполнить значения только тестовой среды через защищённый редактор.
docker compose --env-file .env.docker config --quiet
docker compose --env-file .env.docker build panda-web
docker compose --env-file .env.docker up -d panda-web
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker logs --tail 100 panda-web
curl -I http://127.0.0.1:3000/login
```

6. Успешный HTTP-ответ /login подтверждает только запуск сайта, **не** работу БД и всех модулей.

## Проверки и ограничения текущего этапа

- GitHub-сравнение подтверждает изменения **только** в ветке `migration/docker`; `main` не изменена.
- YAML-структура Compose проверена статически локальным PyYAML; это **не** заменяет `docker compose config` или фактическую сборку.
- Docker Engine в доступном проверочном окружении отсутствует; `docker build`/`compose up` ещё не выполнялись. Успешную контейнерную сборку **не** утверждаем.

## Нерешённые вопросы

- Требуется полная проверка компиляции на Docker / CI и поведения Sharp/XLSX.
- Жёсткие обращения к Vercel устранены в двух выявленных маршрутах: `app/api/wb/daily-sync/route.ts` и `app/api/yandex/daily-sync/route.ts`. Общая функция `lib/server/internal-origin.ts` требует `INTERNAL_APP_URL`; Compose указывает `http://panda-web:3000`. Следует прогнать регрессионные и интеграционные тесты перед включением cron.
- Системные секреты для production нужно хранить в защищённом хранилище/Compose Secrets, а динамические ключи маркетплейсов — в шифрованном хранилище, обновляемом из админки.
- Пока нет self-hosted Supabase и валидного публичного URL браузера; готовую сборку не считать готовой к cutover.
- Для входа из интернета понадобится локальный HTTPS reverse proxy, прямой публичный IP и firewall. Без VPN и внешних туннелей.
- Не запускать production cron параллельно со старой системой. Не отключать Vercel и облачный Supabase.

## Источники

- https://nextjs.org/docs/app/api-reference/config/next-config-js/output
- https://docs.docker.com/guides/nextjs/
- https://docs.docker.com/compose/how-tos/environment-variables/set-environment-variables/
