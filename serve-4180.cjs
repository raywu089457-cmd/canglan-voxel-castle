'use strict';
// ASCII-only launcher: starts the castle game on port 4180, exposed to LAN/Tailscale.
// Usage: node serve-4180.cjs
process.env.PORT = process.env.PORT || '4180';
process.env.HOST = process.env.HOST || '0.0.0.0';
require('./server.cjs');
