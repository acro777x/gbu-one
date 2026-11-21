/**
 * Copies the GBU exam portal's TLS certificate chain into res/raw so
 * react-native-blob-util's `customCACerts` option can trust it.
 *
 * The portal's chain is valid, but older Android devices in the field do not
 * always ship the newer Let's Encrypt "YE1" intermediate. When the chain
 * cannot be completed the download fails with a generic "connection is not
 * secure" and a real date sheet never opens. Bundling the four public
 * certificates (downloaded from the host itself, no private keys) removes
 * that dependency on the device's CA store.
 *
 * The certs are scoped with `pinnedHosts` in PdfViewer.tsx: no other host
 * uses this trust store.
 */
const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('@expo/config-plugins');

const CERT_DIR = path.join(__dirname, '..', 'assets', 'certs');

function withGbuCerts(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const raw = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res', 'raw');
      if (!fs.existsSync(CERT_DIR)) return cfg;
      fs.mkdirSync(raw, { recursive: true });
      for (const name of fs.readdirSync(CERT_DIR)) {
        if (!name.endsWith('.pem')) continue;
        const target = path.join(raw, name.replace(/\.pem$/, ''));
        fs.copyFileSync(path.join(CERT_DIR, name), target);
      }
      return cfg;
    },
  ]);
}

module.exports = withGbuCerts;
