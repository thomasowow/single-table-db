import {
    createServer,
    type IncomingMessage,
    type ServerResponse,
} from 'node:http';
import pg from 'pg';

const hostname: string = '127.0.0.1';
const port: number = 3000;

const pool = new pg.Pool({
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 5432),
    database: process.env.DB_NAME ?? 'postgres',
    user: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
});

const recordsQuery = `
select jsonb_object_agg(f.name, p.value order by f.pos) as record
from string_to_table((select value from pairs where key = $1 || ':keys'), ',') with ordinality as f(name, pos)
join pairs p on split_part(p.key, ':', 1) = $1
            and split_part(p.key, ':', 2) ~ '^\\d+$'
            and split_part(p.key, ':', 3) = f.name
group by split_part(p.key, ':', 2)
`;

const resourcePath = /^\/([A-Za-z0-9_-]+)\/?$/;

const sendJson = (res: ServerResponse, statusCode: number, body: unknown) => {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(body));
};

const server = createServer(
    async (req: IncomingMessage, res: ServerResponse) => {
        const { pathname } = new URL(req.url ?? '/', `http://${hostname}`);

        const type = pathname.match(resourcePath)?.[1];

        if (req.method === 'GET' && type) {
            try {
                const result = await pool.query<{
                    record: Record<string, string>;
                }>(recordsQuery, [type]);

                sendJson(
                    res,
                    200,
                    result.rows.map((row) => row.record),
                );
            } catch (error) {
                console.error(error);

                sendJson(res, 500, { error: `Failed to fetch ${type}` });
            }
            return;
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Hello World');
    },
);

server.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
});
