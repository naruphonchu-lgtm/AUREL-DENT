/* ==========================================================
   Body Scent — script.js (shared by every page)
   - product.html : product cards + filter  (#filter-bar, #product-list)
   - order.html   : prefill + submit order  (#orderForm, #customerName,
                    #contact, #items, #total, #note)
   - admin.html   : orders table from CSV   (#ordersTable tbody)
   Note: fetch() needs the site served over http(s), not opened as file://
   ========================================================== */

const ORDER_API_URL =
  'https://script.google.com/macros/s/AKfycbyvmbgM8fpdpw8Qo8vGnbzUqHy8WsF3Yt4xY5RVHPXXZ8FlKvxLyjmoQfRrTTIRawSv/exec';

const ORDERS_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vRjYdTbVfAVGNbocpWybQ6TYEnh0HBBYO0GRcmaHrAgumJhXAgTkAPGzh2c666VHpkNfIO5LXTOmayv/pub?gid=0&single=true&output=csv';

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('product-list')) initProductPage();
  if (document.getElementById('orderForm')) initOrderPage();
  if (document.querySelector('#ordersTable tbody')) initAdminPage();
});

/* ---------- helpers ---------- */

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// "Cool Mint" / "cool-mint" / "COOLMINT" -> "coolmint"
function normalizeKey(value) {
  return String(value || '').toLowerCase().replace(/[\s_-]+/g, '');
}

function formatPrice(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString('th-TH') : String(value);
}

/* ==========================================================
   1) product.html
   ========================================================== */

function initProductPage() {
  const listEl = document.getElementById('product-list');
  const barEl = document.getElementById('filter-bar');

  fetch('products.json')
    .then((res) => {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then((data) => {
      // Flavor (Spearmint / Cool Mint) comes from the product name,
      // because every product's "mood" is currently "fresh".
      const products = data.map((p) => {
        const flavor = String(p.name).replace(/^AUREL DENT\s+/i, '').trim();
        return { ...p, flavor, flavorKey: normalizeKey(flavor) };
      });

      // Filters: All + one per flavor (in order of first appearance)
      const filters = [{ key: 'all', label: 'ทั้งหมด' }];
      products.forEach((p) => {
        if (!filters.some((f) => f.key === p.flavorKey)) {
          filters.push({ key: p.flavorKey, label: p.flavor });
        }
      });

      // ?mood=xxx  (matches a flavor like "spearmint" / "coolmint", or a mood like "fresh")
      const param = normalizeKey(new URLSearchParams(window.location.search).get('mood'));
      let current = param || 'all';

      const matches = (p) =>
        current === 'all' || p.flavorKey === current || normalizeKey(p.mood) === current;

      function render() {
        listEl.replaceChildren();
        const shown = products.filter(matches);

        if (!shown.length) {
          listEl.appendChild(el('p', 'muted', 'ไม่พบสินค้าในหมวดนี้'));
        } else {
          shown.forEach((p) => listEl.appendChild(buildCard(p)));
        }

        if (barEl) {
          const activeKey = filters.some((f) => f.key === current) ? current : 'all';
          barEl.querySelectorAll('button').forEach((btn) => {
            btn.setAttribute('aria-pressed', String(btn.dataset.key === activeKey));
          });
        }
      }

      if (barEl) {
        barEl.replaceChildren();
        filters.forEach((f) => {
          const btn = el('button', 'chip', f.label);
          btn.type = 'button';
          btn.dataset.key = f.key;
          btn.addEventListener('click', () => {
            current = f.key;
            render();
          });
          barEl.appendChild(btn);
        });
      }

      render();
    })
    .catch((error) => {
      console.error(error);
      listEl.replaceChildren(el('p', 'muted', 'โหลดข้อมูลสินค้าไม่สำเร็จ กรุณารีเฟรชหน้าอีกครั้ง'));
    });
}

function buildCard(p) {
  const card = el('article', 'product-card');
  card.dataset.mood = p.mood;

  const media = el('div', 'product-card__media');
  const img = document.createElement('img');
  img.src = p.image;
  img.alt = p.name + ' ' + p.size;
  img.loading = 'lazy';
  media.appendChild(img);

  const body = el('div', 'product-card__body');
  body.appendChild(el('h3', 'product-card__name', p.name));
  body.appendChild(el('p', 'product-card__meta', p.size));

  const foot = el('div', 'product-card__foot');
  const price = el('span', 'price', formatPrice(p.price));
  price.appendChild(el('small', '', 'บาท'));
  foot.appendChild(price);

  // order.html?item=AUREL DENT Spearmint 30ml&price=49  (properly URL-encoded)
  const params = new URLSearchParams({
    item: p.name + ' ' + String(p.size).replace(/\s+/g, ''),
    price: p.price,
  });
  const btn = el('a', 'btn', 'สั่งซื้อ');
  btn.href = 'order.html?' + params.toString();
  foot.appendChild(btn);

  body.appendChild(foot);
  card.append(media, body);
  return card;
}

/* ==========================================================
   2) order.html
   ========================================================== */

function initOrderPage() {
  const form = document.getElementById('orderForm');
  const itemsInput = document.getElementById('items');
  const totalInput = document.getElementById('total');

  // Prefill from ?item=...&price=...
  const params = new URLSearchParams(window.location.search);
  const item = params.get('item');
  const price = params.get('price');
  if (item !== null && itemsInput) itemsInput.value = item;
  if (price !== null && totalInput) totalInput.value = price;   // total must always be filled

  const submitBtn = form.querySelector('[type="submit"]');

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const payload = {
      customerName: document.getElementById('customerName').value.trim(),
      contact: document.getElementById('contact').value.trim(),
      items: itemsInput.value.trim(),
      total: totalInput.value.trim(),
      note: document.getElementById('note').value.trim(),
    };

    if (submitBtn) submitBtn.disabled = true;

    fetch(ORDER_API_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
    .then(() => { window.location.href = 'thankyou.html'; })
    .catch(error => {
      console.error(error);
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
      if (submitBtn) submitBtn.disabled = false;
    });
  });
}

/* ==========================================================
   3) admin.html
   ========================================================== */

// Minimal CSV parser: quoted fields, "" escapes, commas/newlines inside quotes, CRLF/LF.
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field); field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      rows.push(row); row = [];
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }

  // drop completely empty lines
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

function initAdminPage() {
  const tbody = document.querySelector('#ordersTable tbody');
  const COLS = 6;

  function message(text) {
    const tr = document.createElement('tr');
    const td = el('td', 'muted', text);
    td.colSpan = COLS;
    tr.appendChild(td);
    tbody.replaceChildren(tr);
  }

  message('กำลังโหลดข้อมูล...');

  fetch(ORDERS_CSV_URL, { cache: 'no-store' })
    .then((res) => {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.text();
    })
    .then((text) => {
      // Row 1 = header. Columns: time, name, contact, items, total, note.
      // Orders are appended at the bottom of the sheet, so reverse = newest first.
      const rows = parseCSV(text).slice(1).reverse();

      if (!rows.length) { message('ยังไม่มีรายการสั่งซื้อ'); return; }

      const frag = document.createDocumentFragment();
      rows.forEach((r) => {
        const tr = document.createElement('tr');
        for (let i = 0; i < COLS; i++) {
          let value = (r[i] || '').trim();
          if (i === 4 && /^\d+(\.\d+)?$/.test(value)) value = formatPrice(value);
          tr.appendChild(el('td', '', value));
        }
        frag.appendChild(tr);
      });
      tbody.replaceChildren(frag);
    })
    .catch((error) => {
      console.error(error);
      message('โหลดข้อมูลไม่สำเร็จ กรุณารีเฟรชหน้าอีกครั้ง');
    });
}
