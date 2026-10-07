const grid = document.getElementById('bigdetail-image-grid');
const status = document.getElementById('bigdetail-images-status');
const previous = document.getElementById('bigdetail-images-last');
const next = document.getElementById('bigdetail-images-next');
const pageSize = 3;
let images = [];
let page = 0;

function render() {
  const start = page * pageSize;
  const items = images.slice(start, start + pageSize);
  const figures = items.map(item => {
    const figure = document.createElement('figure');
    const image = document.createElement('img');
    image.alt = item.label;
    image.width = item.width;
    image.height = item.height;
    image.decoding = 'async';
    image.addEventListener('error', () => {
      image.hidden = true;
      const message = document.createElement('p');
      message.className = 'image-gallery-error';
      message.textContent = 'Image unavailable.';
      figure.prepend(message);
    }, {once: true});
    image.src = item.src;
    const caption = document.createElement('figcaption');
    caption.textContent = item.label;
    figure.append(image, caption);
    return figure;
  });
  grid.replaceChildren(...figures);
  grid.setAttribute('aria-busy', 'false');
  status.textContent = `${start + 1}–${start + items.length} of ${images.length}`;
  previous.disabled = page === 0;
  next.disabled = start + pageSize >= images.length;
}

previous.addEventListener('click', () => {
  if (page > 0) { page -= 1; render(); }
});
next.addEventListener('click', () => {
  if ((page + 1) * pageSize < images.length) { page += 1; render(); }
});

try {
  const response = await fetch('bigdetail-gallery.json');
  if (!response.ok) throw new Error('Gallery manifest unavailable');
  const manifest = await response.json();
  if (!Array.isArray(manifest.images) || manifest.images.length !== 99) {
    throw new Error('Expected 99 images');
  }
  images = manifest.images;
  render();
} catch {
  grid.setAttribute('aria-busy', 'false');
  status.textContent = 'Images could not be loaded. Please reload the page.';
}
