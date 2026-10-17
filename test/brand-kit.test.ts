import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const brandDir = join(root, "public/brand");

function pngSize(file: string) {
  const buf = readFileSync(file);
  assert.equal(buf.toString("ascii", 1, 4), "PNG");
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

test("brand kit is the only logo set and matches the file contract", () => {
  const kit = JSON.parse(readFileSync(join(brandDir, "brand.json"), "utf8"));
  assert.equal(kit.name, "Apixis Wallet");
  assert.equal(kit.domain, "wallet.apixis.dev");
  assert.equal(kit.tagline, "One balance. Every Apixis possibility.");
  assert.deepEqual(kit.fonts, []);
  assert.equal(kit.colors.primary, "#63f6f0");
  assert.equal(kit.colors.accent, "#ffd783");
  assert.equal(kit.colors.background, "#080914");
  assert.equal(kit.colors.text, "#edf4ff");

  const expected = [
    "logo-full.png",
    "logo-full-white.png",
    "mark.png",
    "mark-white.png",
    "favicon.ico",
    "favicon-32.png",
    "apple-touch-icon.png",
    "icon-192.png",
    "icon-512.png",
    "og-image.png",
  ];
  for (const name of expected) {
    assert.equal(kit.files[name], `/brand/${name}`);
    assert.equal(statSync(join(brandDir, name)).isFile(), true);
  }

  const names = readdirSync(brandDir).sort();
  assert.deepEqual(names, [...expected, "README.md", "brand.json"].sort());

  const full = pngSize(join(brandDir, "logo-full.png"));
  assert.ok(full.width >= 1024, "logo-full is at least 1024px wide");
  assert.ok(full.width > full.height, "logo-full is horizontal");
  const mark = pngSize(join(brandDir, "mark.png"));
  assert.ok(Math.min(mark.width, mark.height) >= 512, "mark is at least 512px");
  assert.deepEqual(pngSize(join(brandDir, "apple-touch-icon.png")), { width: 180, height: 180 });
  assert.deepEqual(pngSize(join(brandDir, "favicon-32.png")), { width: 32, height: 32 });
  assert.deepEqual(pngSize(join(brandDir, "icon-192.png")), { width: 192, height: 192 });
  assert.deepEqual(pngSize(join(brandDir, "icon-512.png")), { width: 512, height: 512 });
  assert.deepEqual(pngSize(join(brandDir, "og-image.png")), { width: 1200, height: 630 });

  const ico = readFileSync(join(brandDir, "favicon.ico"));
  assert.equal(ico.readUInt16LE(0), 0);
  assert.equal(ico.readUInt16LE(2), 1);
  assert.ok(ico.readUInt16LE(4) >= 1);

  const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
  const manifest = readFileSync(join(root, "app/manifest.ts"), "utf8");
  const header = readFileSync(join(root, "components/WalletScreen.tsx"), "utf8");
  for (const source of [layout, manifest, header]) {
    assert.match(source, /\/brand\//);
    assert.doesNotMatch(source, /apixis-family-logo/);
    assert.doesNotMatch(source, /\.svg/);
  }
  assert.match(header, /\/brand\/logo-full\.png/);
  assert.match(layout, /\/brand\/og-image\.png/);
  assert.match(layout, /\/brand\/favicon-32\.png/);
  assert.match(layout, /\/brand\/apple-touch-icon\.png/);
  assert.match(manifest, /\/brand\/icon-192\.png/);
  assert.match(manifest, /\/brand\/icon-512\.png/);

  const banned = [".svg", ".jpg", ".jpeg", ".webp"];
  for (const name of names) {
    assert.equal(banned.some((ext) => name.endsWith(ext)), false, name);
  }
  for (const file of readdirSync(join(root, "app"))) {
    assert.equal(/\.(png|ico|svg|jpg|jpeg|webp)$/i.test(file), false, file);
  }
});
