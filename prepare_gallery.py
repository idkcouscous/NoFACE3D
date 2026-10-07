"""Sample locally downloaded BIGDETAIL images and write a static 720p gallery.

Fetch source files using the shared Portal service before running this script.
"""
import argparse
import json
from pathlib import Path
import random
import re

from PIL import Image, ImageOps


def prepare(source, destination, seed):
    source = source.resolve()
    destination = destination.resolve()
    if destination == source or source in destination.parents:
        raise ValueError('Keep generated output outside the source image directory')
    candidates = sorted(p for p in source.rglob('*') if p.is_file()
                        and p.suffix.lower() in {'.png', '.jpg', '.jpeg', '.webp'})
    if len(candidates) < 99:
        raise ValueError(f'Need at least 99 source images; found {len(candidates)}')
    selected = random.Random(seed).sample(candidates, 99)
    output = destination / 'assets' / 'bigdetail-gallery'
    output.mkdir(parents=True, exist_ok=True)
    manifest = {'seed': seed, 'images': []}
    for index, path in enumerate(selected, 1):
        with Image.open(path) as original:
            picture = ImageOps.exif_transpose(original).convert('RGBA')
            picture.thumbnail((1280, 720), Image.Resampling.LANCZOS)
            background = Image.new('RGB', picture.size, 'white')
            background.paste(picture, mask=picture.getchannel('A'))
            name = f'{index:03d}.jpg'
            background.save(output / name, quality=85, optimize=True, progressive=True)
        manifest['images'].append({
            'src': f'assets/bigdetail-gallery/{name}',
            'label': re.sub(r'[_-]+', ' ', path.stem).strip(),
            'width': background.width,
            'height': background.height,
            'source_file': str(path.relative_to(source)),
        })
    (destination / 'bigdetail-gallery.json').write_text(
        json.dumps(manifest, indent=2) + '\n')
    print(f'Prepared 99 images, seed {seed}, '
          f'{sum(p.stat().st_size for p in output.glob("*.jpg")):,} bytes')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('destination', type=Path)
    parser.add_argument('--seed', type=int,
                        default=random.SystemRandom().randrange(2**32))
    args = parser.parse_args()
    prepare(args.source, args.destination, args.seed)
