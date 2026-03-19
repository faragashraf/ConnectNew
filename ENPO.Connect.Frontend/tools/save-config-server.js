const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '5mb' }));

// write to a safe JSON asset instead of modifying TypeScript source
const assetRel = 'src/assets/component-configs.json';

function resolveAsset() {
  return path.resolve(process.cwd(), assetRel);
}

app.post('/save-configs', (req, res) => {
  try {
    const configs = req.body.configs;
    if (!Array.isArray(configs)) return res.status(400).send({ error: 'configs array expected' });

    const filePath = resolveAsset();
    // ensure assets directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(filePath, JSON.stringify(configs, null, 2), 'utf8');
    return res.send({ ok: true, path: filePath });
  } catch (e) {
    console.error(e);
    return res.status(500).send({ error: e.message });
  }
});

const port = process.env.SAVE_CONFIG_PORT || 3001;
app.listen(port, () => console.log('save-config-server listening on', port));
