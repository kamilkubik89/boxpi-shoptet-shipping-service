(function () {
  'use strict';

  const Widget = {
    config: {
      apiBaseUrl: '/api/shipping',
      carrier: 'PACKETA-POINT-SK',
      priceVatIncl: '2.90',
      currency: 'EUR',
      debug: false,
      selectors: {
        shippingRequestCode: '[data-boxpi-shipping-request-code]',
        shippingGuid: '[data-boxpi-shipping-guid]',
        eshopId: '[data-boxpi-eshop-id]'
      }
    },
    state: {
      points: [],
      filtered: [],
      selectedId: null,
      selectedPoint: null,
      modalOpen: false,
      search: ''
    },
    init: function () {
      this.ensureHiddenFields();
      this.injectStyles();
      this.mount();
    },
    log: function () {
      if (this.config.debug) console.log.apply(console, ['[BoxpiWidget]'].concat([].slice.call(arguments)));
    },
    getEshopId: function () {
      const attr = document.querySelector(this.config.selectors.eshopId);
      return attr ? Number(attr.getAttribute('data-boxpi-eshop-id')) : Number(window.BOXPI_ESHOP_ID || 0);
    },
    getShippingRequestCode: function () {
      const attr = document.querySelector(this.config.selectors.shippingRequestCode);
      return attr ? attr.getAttribute('data-boxpi-shipping-request-code') : window.BOXPI_SHIPPING_REQUEST_CODE;
    },
    getShippingGuid: function () {
      const attr = document.querySelector(this.config.selectors.shippingGuid);
      return attr ? attr.getAttribute('data-boxpi-shipping-guid') : window.BOXPI_SHIPPING_GUID;
    },
    ensureHiddenFields: function () {
      ['point_id', 'point_name', 'point_city', 'point_address', 'point_zip', 'point_json'].forEach(function (name) {
        const id = 'boxpi_' + name;
        if (!document.getElementById(id)) {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.id = id;
          input.name = id;
          document.body.appendChild(input);
        }
      });
    },
    mount: function () {
      if (document.getElementById('boxpi-widget-root')) return;
      const root = document.createElement('div');
      root.id = 'boxpi-widget-root';
      root.innerHTML = '<div class="boxpi-card"><div class="boxpi-head"><div><div class="boxpi-title">Boxpi pickup point</div><div class="boxpi-sub">Vyber výdajné miesto pre túto dopravu</div></div><button class="boxpi-btn boxpi-btn-primary" id="boxpi-open-btn" type="button">Vybrať výdajné miesto</button></div><div id="boxpi-selected" class="boxpi-selected boxpi-hidden"></div></div>';
      (document.querySelector('.shipping-method') || document.body).appendChild(root);
      document.getElementById('boxpi-open-btn').addEventListener('click', this.openModal.bind(this));
    },
    openModal: async function () {
      if (this.state.modalOpen) return;
      this.state.modalOpen = true;
      await this.loadPoints();
      const overlay = document.createElement('div');
      overlay.id = 'boxpi-overlay';
      overlay.className = 'boxpi-overlay';
      overlay.innerHTML = '<div class="boxpi-modal"><div class="boxpi-modal-head"><h3>Výber výdajného miesta</h3><button type="button" id="boxpi-close" class="boxpi-x">×</button></div><div class="boxpi-toolbar"><input id="boxpi-search" class="boxpi-input" placeholder="Hľadať podľa názvu, mesta alebo adresy" /><button id="boxpi-clear-search" class="boxpi-btn" type="button">Vymazať</button></div><div id="boxpi-list" class="boxpi-list"></div><div class="boxpi-footer"><button class="boxpi-btn" id="boxpi-cancel" type="button">Zavrieť</button><button class="boxpi-btn boxpi-btn-primary" id="boxpi-confirm" type="button" disabled>Potvrdiť výber</button></div></div>';
      document.body.appendChild(overlay);
      document.getElementById('boxpi-close').addEventListener('click', this.closeModal.bind(this));
      document.getElementById('boxpi-cancel').addEventListener('click', this.closeModal.bind(this));
      document.getElementById('boxpi-clear-search').addEventListener('click', () => {
        this.state.search = '';
        document.getElementById('boxpi-search').value = '';
        this.state.filtered = this.state.points.slice();
        this.renderList();
      });
      document.getElementById('boxpi-search').addEventListener('input', (e) => {
        this.state.search = (e.target.value || '').toLowerCase();
        this.state.filtered = this.state.points.filter((p) => [p.name, p.city, p.address, p.zip].join(' ').toLowerCase().includes(this.state.search));
        this.renderList();
      });
      document.getElementById('boxpi-confirm').addEventListener('click', this.confirmSelection.bind(this));
      this.renderList();
    },
    closeModal: function () {
      const overlay = document.getElementById('boxpi-overlay');
      if (overlay) overlay.remove();
      this.state.modalOpen = false;
    },
    loadPoints: async function () {
      const eshopId = this.getEshopId();
      const url = this.config.apiBaseUrl + '/pickup-points?eshopId=' + encodeURIComponent(eshopId) + '&carrier=' + encodeURIComponent(this.config.carrier);
      const res = await fetch(url, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Pickup points load failed');
      const data = await res.json();
      this.state.points = data.points || [];
      this.state.filtered = this.state.points.slice();
    },
    renderList: function () {
      const list = document.getElementById('boxpi-list');
      if (!list) return;
      if (!this.state.filtered.length) {
        list.innerHTML = '<div class="boxpi-empty">Nenašli sa žiadne výdajné miesta.</div>';
        return;
      }
      list.innerHTML = this.state.filtered.map((p) => '<button type="button" class="boxpi-point ' + (this.state.selectedId === p.id ? 'selected' : '') + '" data-id="' + this.escape(p.id) + '"><div class="boxpi-point-name">' + this.escape(p.name) + '</div><div class="boxpi-point-meta">' + this.escape([p.address, p.city, p.zip].filter(Boolean).join(', ')) + '</div>' + (p.openingHours ? '<div class="boxpi-point-hours">' + this.escape(p.openingHours) + '</div>' : '') + '</button>').join('');
      Array.prototype.forEach.call(list.querySelectorAll('.boxpi-point'), (el) => {
        el.addEventListener('click', () => {
          this.state.selectedId = el.getAttribute('data-id');
          this.state.selectedPoint = this.state.points.find((p) => p.id === this.state.selectedId) || null;
          document.getElementById('boxpi-confirm').disabled = !this.state.selectedPoint;
          this.renderList();
        });
      });
    },
    confirmSelection: async function () {
      if (!this.state.selectedPoint) return;
      this.writeInputs(this.state.selectedPoint);
      await this.sendQuote(this.state.selectedPoint);
      this.renderSelected(this.state.selectedPoint);
      this.closeModal();
    },
    sendQuote: async function (point) {
      const body = {
        eshopId: this.getEshopId(),
        shippingRequestCode: this.getShippingRequestCode(),
        shippingGuid: this.getShippingGuid(),
        pickupPointId: point.id,
        pickupPoint: point,
        priceVatIncl: this.config.priceVatIncl,
        currency: this.config.currency
      };
      const res = await fetch(this.config.apiBaseUrl + '/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'same-origin'
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || 'Quote request failed');
      }
      return res.json();
    },
    writeInputs: function (point) {
      document.getElementById('boxpi_point_id').value = point.id || '';
      document.getElementById('boxpi_point_name').value = point.name || '';
      document.getElementById('boxpi_point_city').value = point.city || '';
      document.getElementById('boxpi_point_address').value = point.address || '';
      document.getElementById('boxpi_point_zip').value = point.zip || '';
      document.getElementById('boxpi_point_json').value = JSON.stringify(point);
    },
    renderSelected: function (point) {
      const box = document.getElementById('boxpi-selected');
      box.classList.remove('boxpi-hidden');
      box.innerHTML = '<strong>Vybrané:</strong> ' + this.escape(point.name) + '<br><span>' + this.escape([point.address, point.city, point.zip].filter(Boolean).join(', ')) + '</span>';
    },
    injectStyles: function () {
      if (document.getElementById('boxpi-styles')) return;
      const style = document.createElement('style');
      style.id = 'boxpi-styles';
      style.textContent = '.boxpi-card{border:1px solid #e5e7eb;border-radius:16px;padding:16px;background:#fff;box-shadow:0 10px 30px rgba(0,0,0,.06);margin:16px 0;font-family:Arial,sans-serif}.boxpi-head{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap}.boxpi-title{font-size:18px;font-weight:700}.boxpi-sub{font-size:13px;color:#6b7280;margin-top:4px}.boxpi-btn{border:1px solid #d1d5db;border-radius:12px;padding:10px 14px;background:#fff;cursor:pointer}.boxpi-btn-primary{background:#111827;color:#fff;border-color:#111827}.boxpi-selected{margin-top:14px;padding:12px;border-radius:12px;background:#f9fafb}.boxpi-hidden{display:none}.boxpi-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:999999}.boxpi-modal{width:min(900px,95vw);max-height:90vh;overflow:auto;background:#fff;border-radius:20px;padding:18px}.boxpi-modal-head{display:flex;justify-content:space-between;align-items:center}.boxpi-x{border:none;background:none;font-size:28px;cursor:pointer}.boxpi-toolbar{display:flex;gap:8px;margin:12px 0}.boxpi-input{flex:1;padding:12px 14px;border:1px solid #d1d5db;border-radius:12px}.boxpi-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.boxpi-point{padding:14px;border:1px solid #e5e7eb;border-radius:16px;background:#fff;text-align:left;cursor:pointer}.boxpi-point.selected{border-color:#111827;box-shadow:0 0 0 3px rgba(17,24,39,.08)}.boxpi-point-name{font-weight:700}.boxpi-point-meta,.boxpi-point-hours{font-size:13px;color:#4b5563;margin-top:6px}.boxpi-footer{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}.boxpi-empty{padding:20px;text-align:center;color:#6b7280}@media(max-width:768px){.boxpi-list{grid-template-columns:1fr}}';
      document.head.appendChild(style);
    },
    escape: function (value) {
      return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { Widget.init(); });
  } else {
    Widget.init();
  }

  window.BoxpiShippingWidget = Widget;
})();
