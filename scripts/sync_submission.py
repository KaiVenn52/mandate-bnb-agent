"""Keep the public submission package identical to its editable source."""
from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
source = root / 'docs/MANDATE-submission-package.html'
html = source.read_text(encoding='utf-8')
assert 'Job #873' in html
for href in re.findall(r'href="([^"]+)"', html):
    if 'bscscan.com' in href:
        assert re.fullmatch(r'https://testnet\.bscscan\.com/tx/0x[0-9a-fA-F]{64}', href), href
target = root / 'public/evidence/submission-package.html'
target.write_text(html, encoding='utf-8')
print('Public submission copy synchronized; explorer transaction links validated.')
