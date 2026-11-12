// Stand-in for the Next.js app, used by scripts/ci/nginx-smoke.sh behind the real nginx config.
//   /ip     -> {"realIp": <X-Real-IP header received, or null>}
//   others  -> a JSON body of at least 20 KB, uncompressed, like the /api route handlers
import http from 'node:http';

const port = Number(process.env.PORT ?? 3000);
const big = JSON.stringify({ items: Array.from({ length: 800 }, (_, i) => ({ id: i, name: `Trophy number ${i}`, note: 'lorem ipsum dolor sit amet' })) });

http
  .createServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    if (req.url === '/ip') {
      res.end(JSON.stringify({ realIp: req.headers['x-real-ip'] ?? null }));
      return;
    }
    res.end(big);
  })
  .listen(port, '0.0.0.0', () => console.log(`stub app on ${port}`));
