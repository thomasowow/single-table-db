# single-table

A learning experiment: every resource lives in one Postgres table with two columns, `pairs (key text, value text)`. The user is learning from it. Explain theory (syntax, features, trade-offs) and write full queries or code only when the user explicitly asks for them.

## Data model

- `<type>:<id>:<field>` holds one field of one record, e.g. `users:1:name` = `thomas`.
- `<type>:keys` lists the type's fields, comma-separated, in output order, e.g. `users:keys` = `id,name,email,created_at,updated_at`.
- The type name is plural and equals the URL segment (`users`, `companies`).
- Every value is `text`. Timestamps are ISO 8601 UTC strings (`2026-11-06T14:50:03.661Z`).
- The table is intentionally bare (no primary key, indexes or constraints), matching the experiment. Keep it that way unless the user asks to change it.
- Adding a field or a resource type is a data change only: update or insert the `:keys` row and the field rows. The app needs no code change.

## App (`index.ts`)

- Creates `pairs` on startup (`create table if not exists`), then serves `GET /<type>`, which returns every record of that type as a JSON array, built with `jsonb_object_agg` grouped by id.
- The type is passed as a query parameter and the path is validated by regex, so it never enters SQL text.

## Database access

- Postgres 18 runs from `docker/compose.yml` as container `docker-db-1`; credentials default to `postgres`/`postgres` on 127.0.0.1:5432.
- The `postgres` MCP server has write access. For psql features such as `\gexec` or `\timing`, use `docker exec -i docker-db-1 psql -U postgres`.

## Gotchas

- SQL in `index.ts` sits in a JS template literal, so `'^\\d+$'` there reaches Postgres as `^\d+$`. When copying that SQL to run directly, use a single backslash: with `standard_conforming_strings` on, `\\d` matches a literal backslash and the query returns no rows.
- Ids are text: order by `split_part(key, ':', 2)::int` for numeric order. An output alias works in `ORDER BY` only on its own, so repeat the expression when casting.
- At 100k users (500k rows), the endpoint query scans `pairs` twice and its sort spills to disk (`external merge`, ~650 ms); `LIMIT` does not shorten it because the sort consumes all input first.
