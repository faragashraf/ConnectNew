const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '5mb' }));

// path to the nswag services JSON inside the repo
const assetRel = 'src/app/shared/services/Nswag/nswag-services.json';

function resolveAsset() {
  return path.resolve(process.cwd(), assetRel);
}

app.get('/nswag', (req, res) => {
  try {
    const filePath = resolveAsset();
    if (!fs.existsSync(filePath)) return res.status(404).send({ error: 'file not found' });
    const content = fs.readFileSync(filePath, 'utf8');
    return res.send(JSON.parse(content));
  } catch (e) {
    console.error(e);
    return res.status(500).send({ error: e.message });
  }
});

app.post('/nswag', (req, res) => {
  try {
    const configs = req.body;
    if (!Array.isArray(configs)) return res.status(400).send({ error: 'array expected' });

    const filePath = resolveAsset();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(filePath, JSON.stringify(configs, null, 2), 'utf8');
    return res.send({ ok: true, path: filePath });
  } catch (e) {
    console.error(e);
    return res.status(500).send({ error: e.message });
  }
});

const port = process.env.SAVE_NSWAG_PORT || 3002;
app.listen(port, () => console.log('save-nswag-server listening on', port));
