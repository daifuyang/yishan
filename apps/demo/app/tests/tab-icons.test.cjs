const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const test = require("node:test");
const { loadTs, appRoot } = require("./helpers/load-ts.cjs");

function paeth(left, above, upperLeft) {
  const prediction = left + above - upperLeft;
  const a = Math.abs(prediction - left);
  const b = Math.abs(prediction - above);
  const c = Math.abs(prediction - upperLeft);
  return a <= b && a <= c ? left : b <= c ? above : upperLeft;
}

test("every registered tab icon is an 81px transparent PNG with the correct color", () => {
  const tabBar = loadTs("src/constants/index.ts").TAB_BAR;
  for (const tab of tabBar.list) {
    for (const icon of [tab.iconPath, tab.selectedIconPath]) {
      const png = fs.readFileSync(path.join(appRoot, "src", icon));
      const width = png.readUInt32BE(16);
      const height = png.readUInt32BE(20);
      assert.equal(width, 81);
      assert.equal(height, 81);
      assert.equal(png[24], 8, "8-bit channels");
      assert.equal(png[25], 6, "RGBA PNG");
      assert.equal(png[28], 0, "Non-interlaced PNG");
      const chunks = [];
      for (let offset = 8; offset < png.length; ) {
        const size = png.readUInt32BE(offset);
        if (png.toString("ascii", offset + 4, offset + 8) === "IDAT")
          chunks.push(png.subarray(offset + 8, offset + 8 + size));
        offset += size + 12;
      }
      const filtered = zlib.inflateSync(Buffer.concat(chunks));
      const stride = width * 4 + 1;
      const pixels = Buffer.alloc(width * height * 4);
      const expectedColor = Buffer.from(
        (icon === tab.selectedIconPath ? tabBar.selectedColor : tabBar.color).slice(1),
        "hex",
      );
      let visible = 0;
      let opaque = 0;
      for (let y = 0; y < height; y++) {
        const filter = filtered[y * stride];
        assert.ok(filter <= 4, "Standard PNG filter");
        for (let byte = 0; byte < width * 4; byte++) {
          const index = y * width * 4 + byte;
          const left = byte >= 4 ? pixels[index - 4] : 0;
          const above = y > 0 ? pixels[index - width * 4] : 0;
          const upperLeft = y > 0 && byte >= 4 ? pixels[index - width * 4 - 4] : 0;
          const predictor = [
            0,
            left,
            above,
            Math.floor((left + above) / 2),
            paeth(left, above, upperLeft),
          ][filter];
          pixels[index] = (filtered[y * stride + 1 + byte] + predictor) & 255;
        }
        for (let x = 0; x < width; x++) {
          const index = (y * width + x) * 4;
          const alpha = pixels[index + 3];
          if (alpha > 0) visible++;
          if (alpha === 255) {
            opaque++;
            assert.deepEqual(pixels.subarray(index, index + 3), expectedColor, icon);
          }
          if (x === 0 || y === 0 || x === width - 1 || y === height - 1)
            assert.equal(alpha, 0, `${icon} has transparent edges`);
        }
      }
      assert.ok(visible > 0, `${icon} is fully transparent`);
      assert.ok(opaque > 0, `${icon} has no opaque pixels`);
    }
  }
});
