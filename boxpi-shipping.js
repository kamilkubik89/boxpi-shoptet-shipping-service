(function () {
  "use strict";

  const BoxpiShippingWidget = {
    config: {
      apiBaseUrl: "/api/shipping",
      carrier: "PACKETA-POINT-SK",
      debug: true,
      selectors: {
        mountTarget:
          ".shipping-method, .order-delivery-methods, .cart-delivery, .co-box, form, body",
        shippingInputs:
          'input[type="radio"][name*="shipping"], input[type="radio"][name*="delivery"], input[type="radio"]',
      },
      texts: {
        openButton: "Vybrať výdajné miesto",
        changeButton: "Zmeniť výdajné miesto",
        clearButton: "Vymazať",
        modalTitle: "Výber výdajného miesta",
        searchPlaceholder: "Hľadať podľa názvu, mesta alebo adresy",
        close: "Zavrieť",
        confirm: "Potvrdiť výber",
        selectedPoint: "Vybrané miesto",
        noResults: "Nenašli sa žiadne výdajné miesta.",
        loading: "Načítavam výdajné miesta...",
        retry: "Skúsiť znova",
        searchLabel: "Vyhľadávanie",
        openingHours: "Otváracie hodiny",
        emptyState: "Po zvolení dopravy klikni na tlačidlo a vyber si výdajné miesto.",
      },
    },

    state: {
      initialized: false,
      modalOpen: false,
      allPoints: [],
      filteredPoints: [],
      selectedPoint: null,
      selectedCardId: null,
      searchTerm: "",
      loading: false,
      error: null,
      activeCarrier: null,
      root: null,
    },

    init: function () {
      if (this.state.initialized) return;
      this.state.initialized = true;

      this.log("Initializing widget");
      this.injectStyles();
      this.ensureHiddenInputs();
      this.restoreSelectedPoint();
      this.mount();
      this.bindShippingMethodListeners();
      this.observeDomChanges();
    },

    log: function () {
      if (!this.config.debug) return;
      const args = Array.prototype.slice.call(arguments);
      console.log.apply(console, ["[BoxpiShippingWidget]"].concat(args));
    },

    ensureHiddenInputs: function () {
      const fields = [
        { id: "boxpi-point-id", name: "boxpi_point_id" },
        { id: "boxpi-point-name", name: "boxpi_point_name" },
        { id: "boxpi-point-city", name: "boxpi_point_city" },
        { id: "boxpi-point-address", name: "boxpi_point_address" },
        { id: "boxpi-point-zip", name: "boxpi_point_zip" },
        { id: "boxpi-point-carrier", name: "boxpi_point_carrier" },
        { id: "boxpi-point-json", name: "boxpi_point_json" },
      ];

      fields.forEach(function (field) {
        let input = document.getElementById(field.id);
        if (!input) {
          input = document.createElement("input");
          input.type = "hidden";
          input.id = field.id;
          input.name = field.name;
          document.body.appendChild(input);
        }
      });
    },

    restoreSelectedPoint: function () {
      try {
        const raw = localStorage.getItem("boxpi_selected_point");
        if (!raw) return;

        const parsed = JSON.parse(raw);
        if (parsed && parsed.id) {
          this.state.selectedPoint = parsed;
          this.state.selectedCardId = parsed.id;
          this.writePointToInputs(parsed);
        }
      } catch (error) {
        this.log("Failed restoring selected point", error);
      }
    },

    persistSelectedPoint: function (point) {
      try {
        localStorage.setItem("boxpi_selected_point", JSON.stringify(point));
      } catch (error) {
        this.log("Failed persisting point", error);
      }
    },

    clearPersistedSelectedPoint: function () {
      try {
        localStorage.removeItem("boxpi_selected_point");
      } catch (error) {
        this.log("Failed clearing persisted point", error);
      }
    },

    dispatchChange: function (element) {
      if (!element) return;
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    },

    writePointToInputs: function (point) {
      const setValue = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.value = value || "";
      };

      setValue("boxpi-point-id", point.id || "");
      setValue("boxpi-point-name", point.name || "");
      setValue("boxpi-point-city", point.city || "");
      setValue("boxpi-point-address", point.address || "");
      setValue("boxpi-point-zip", point.zip || "");
      setValue("boxpi-point-carrier", point.carrier || this.config.carrier);
      setValue("boxpi-point-json", JSON.stringify(point));

      this.dispatchChange(document.getElementById("boxpi-point-json"));
    },

    clearInputs: function () {
      [
        "boxpi-point-id",
        "boxpi-point-name",
        "boxpi-point-city",
        "boxpi-point-address",
        "boxpi-point-zip",
        "boxpi-point-carrier",
        "boxpi-point-json",
      ].forEach(function (id) {
        const el = document.getElementById(id);
        if (el) el.value = "";
      });
    },

    mount: function () {
      const existing = document.getElementById("boxpi-widget-root");
      if (existing) {
        this.state.root = existing;
        this.renderSummary();
        return;
      }

      const root = document.createElement("div");
      root.id = "boxpi-widget-root";
      root.className = "boxpi-widget-root";

      const target = this.findMountTarget();
      target.appendChild(root);

      this.state.root = root;
      this.renderSummary();
    },

    findMountTarget: function () {
      const selectors = this.config.selectors.mountTarget.split(",");
      for (let i = 0; i < selectors.length; i += 1) {
        const el = document.querySelector(selectors[i].trim());
        if (el) return el;
      }
      return document.body;
    },

    renderSummary: function () {
      if (!this.state.root) return;

      const point = this.state.selectedPoint;
      const hasPoint = !!point;

      this.state.root.innerHTML = `
        <div class="boxpi-card">
          <div class="boxpi-card-header">
            <div>
              <div class="boxpi-title">Boxpi Pickup Point</div>
              <div class="boxpi-subtitle">${
                hasPoint
                  ? this.escapeHtml(this.config.texts.selectedPoint)
                  : "Výdajné miesto ešte nie je zvolené"
              }</div>
            </div>
            <div class="boxpi-actions">
              <button type="button" class="boxpi-btn boxpi-btn-primary" id="boxpi-open-btn">
                ${
                  hasPoint
                    ? this.escapeHtml(this.config.texts.changeButton)
                    : this.escapeHtml(this.config.texts.openButton)
                }
              </button>
              ${
                hasPoint
                  ? `<button type="button" class="boxpi-btn boxpi-btn-secondary" id="boxpi-clear-btn">${this.escapeHtml(
                      this.config.texts.clearButton
                    )}</button>`
                  : ""
              }
            </div>
          </div>

          ${
            hasPoint
              ? `
            <div class="boxpi-selected">
              <div class="boxpi-selected-name">${this.escapeHtml(
                point.name || ""
              )}</div>
              <div class="boxpi-selected-meta">${this.escapeHtml(
                point.address || ""
              )}${point.address && point.city ? ", " : ""}${this.escapeHtml(
                  point.city || ""
                )}${point.zip ? " " + this.escapeHtml(point.zip) : ""}</div>
              ${
                point.openingHours
                  ? `<div class="boxpi-selected-hours"><strong>${this.escapeHtml(
                      this.config.texts.openingHours
                    )}:</strong> ${this.escapeHtml(point.openingHours)}</div>`
                  : ""
              }
            </div>
          `
              : `<div class="boxpi-empty">${this.escapeHtml(
                  this.config.texts.emptyState
                )}</div>`
          }
        </div>
      `;

      const openBtn = document.getElementById("boxpi-open-btn");
      if (openBtn) {
        openBtn.addEventListener("click", this.openModal.bind(this));
      }

      const clearBtn = document.getElementById("boxpi-clear-btn");
      if (clearBtn) {
        clearBtn.addEventListener("click", () => {
          this.state.selectedPoint = null;
          this.state.selectedCardId = null;
          this.clearInputs();
          this.clearPersistedSelectedPoint();
          this.renderSummary();
        });
      }
    },

    openModal: async function () {
      if (this.state.modalOpen) return;
      this.state.modalOpen = true;

      this.createModalShell();
      await this.loadPoints();
      this.renderModalContent();
    },

    closeModal: function () {
      const overlay = document.getElementById("boxpi-modal-overlay");
      if (overlay) overlay.remove();
      this.state.modalOpen = false;
      this.state.searchTerm = "";
      this.state.error = null;
    },

    createModalShell: function () {
      const old = document.getElementById("boxpi-modal-overlay");
      if (old) old.remove();

      const overlay = document.createElement("div");
      overlay.id = "boxpi-modal-overlay";
      overlay.className = "boxpi-modal-overlay";
      overlay.innerHTML = `
        <div class="boxpi-modal" role="dialog" aria-modal="true" aria-labelledby="boxpi-modal-title">
          <div class="boxpi-modal-header">
            <h2 id="boxpi-modal-title">${this.escapeHtml(
              this.config.texts.modalTitle
            )}</h2>
            <button type="button" class="boxpi-icon-btn" id="boxpi-close-top" aria-label="${this.escapeHtml(
              this.config.texts.close
            )}">×</button>
          </div>
          <div class="boxpi-modal-body" id="boxpi-modal-body"></div>
          <div class="boxpi-modal-footer">
            <button type="button" class="boxpi-btn boxpi-btn-secondary" id="boxpi-close-bottom">${this.escapeHtml(
              this.config.texts.close
            )}</button>
            <button type="button" class="boxpi-btn boxpi-btn-primary" id="boxpi-confirm-btn" disabled>${this.escapeHtml(
              this.config.texts.confirm
            )}</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      document
        .getElementById("boxpi-close-top")
        .addEventListener("click", this.closeModal.bind(this));
      document
        .getElementById("boxpi-close-bottom")
        .addEventListener("click", this.closeModal.bind(this));

      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) this.closeModal();
      });

      document.getElementById("boxpi-confirm-btn").addEventListener("click", () => {
        const point =
          this.state.filteredPoints.find((p) => p.id === this.state.selectedCardId) ||
          this.state.allPoints.find((p) => p.id === this.state.selectedCardId);

        if (!point) return;

        this.state.selectedPoint = point;
        this.writePointToInputs(point);
        this.persistSelectedPoint(point);
        this.renderSummary();
        this.closeModal();
      });
    },

    renderModalContent: function () {
      const body = document.getElementById("boxpi-modal-body");
      const confirmBtn = document.getElementById("boxpi-confirm-btn");
      if (!body || !confirmBtn) return;

      confirmBtn.disabled = !this.state.selectedCardId;

      if (this.state.loading) {
        body.innerHTML = `
          <div class="boxpi-state">
            <div class="boxpi-spinner"></div>
            <div>${this.escapeHtml(this.config.texts.loading)}</div>
          </div>
        `;
        return;
      }

      if (this.state.error) {
        body.innerHTML = `
          <div class="boxpi-state">
            <div class="boxpi-error-title">Nepodarilo sa načítať dáta</div>
            <div>${this.escapeHtml(this.state.error)}</div>
            <button type="button" class="boxpi-btn boxpi-btn-primary" id="boxpi-retry-btn">
              ${this.escapeHtml(this.config.texts.retry)}
            </button>
          </div>
        `;
        document.getElementById("boxpi-retry-btn").addEventListener("click", async () => {
          await this.loadPoints();
          this.renderModalContent();
        });
        return;
      }

      body.innerHTML = `
        <div class="boxpi-search-wrap">
          <label class="boxpi-search-label" for="boxpi-search-input">${this.escapeHtml(
            this.config.texts.searchLabel
          )}</label>
          <div class="boxpi-search-row">
            <input
              type="text"
              id="boxpi-search-input"
              class="boxpi-search-input"
              placeholder="${this.escapeHtml(this.config.texts.searchPlaceholder)}"
              value="${this.escapeHtml(this.state.searchTerm)}"
            />
            <button type="button" class="boxpi-btn boxpi-btn-secondary" id="boxpi-search-clear">Vymazať</button>
          </div>
        </div>
        <div class="boxpi-points-list" id="boxpi-points-list"></div>
      `;

      const searchInput = document.getElementById("boxpi-search-input");
      const clearBtn = document.getElementById("boxpi-search-clear");

      searchInput.addEventListener("input", (event) => {
        this.state.searchTerm = event.target.value || "";
        this.applySearch();
        this.renderPointsList();
      });

      clearBtn.addEventListener("click", () => {
        this.state.searchTerm = "";
        searchInput.value = "";
        this.applySearch();
        this.renderPointsList();
      });

      this.renderPointsList();
    },

    renderPointsList: function () {
      const list = document.getElementById("boxpi-points-list");
      const confirmBtn = document.getElementById("boxpi-confirm-btn");
      if (!list || !confirmBtn) return;

      confirmBtn.disabled = !this.state.selectedCardId;

      if (!this.state.filteredPoints.length) {
        list.innerHTML = `
          <div class="boxpi-state boxpi-empty-results">
            ${this.escapeHtml(this.config.texts.noResults)}
          </div>
        `;
        return;
      }

      list.innerHTML = this.state.filteredPoints
        .map((point) => {
          const isSelected = point.id === this.state.selectedCardId;
          return `
            <button
              type="button"
              class="boxpi-point-card ${isSelected ? "is-selected" : ""}"
              data-point-id="${this.escapeHtml(point.id)}"
            >
              <div class="boxpi-point-top">
                <div class="boxpi-point-name">${this.escapeHtml(point.name || "")}</div>
                <div class="boxpi-radio ${isSelected ? "is-selected" : ""}"></div>
              </div>
              <div class="boxpi-point-address">${this.escapeHtml(point.address || "")}</div>
              <div class="boxpi-point-meta">${this.escapeHtml(point.city || "")}${
                point.zip ? " " + this.escapeHtml(point.zip) : ""
              }</div>
              ${
                point.openingHours
                  ? `<div class="boxpi-point-hours"><strong>${this.escapeHtml(
                      this.config.texts.openingHours
                    )}:</strong> ${this.escapeHtml(point.openingHours)}</div>`
                  : ""
              }
            </button>
          `;
        })
        .join("");

      const cards = list.querySelectorAll(".boxpi-point-card");
      cards.forEach((card) => {
        card.addEventListener("click", () => {
          this.state.selectedCardId = card.getAttribute("data-point-id");
          this.renderPointsList();
        });
      });
    },

    applySearch: function () {
      const term = this.normalize(this.state.searchTerm);
      if (!term) {
        this.state.filteredPoints = this.state.allPoints.slice();
        return;
      }

      this.state.filteredPoints = this.state.allPoints.filter((point) => {
        const haystack = this.normalize(
          [
            point.id,
            point.name,
            point.city,
            point.address,
            point.zip,
            point.openingHours,
          ]
            .filter(Boolean)
            .join(" ")
        );
        return haystack.indexOf(term) !== -1;
      });
    },

    loadPoints: async function () {
      this.state.loading = true;
      this.state.error = null;
      this.renderModalContent();

      try {
        const carrier = this.getActiveCarrier();
        this.state.activeCarrier = carrier;

        const response = await fetch(
          this.config.apiBaseUrl + "/pickup-points?carrier=" + encodeURIComponent(carrier),
          {
            method: "GET",
            headers: {
              Accept: "application/json",
            },
            credentials: "same-origin",
          }
        );

        if (!response.ok) {
          throw new Error("HTTP " + response.status);
        }

        const payload = await response.json();
        const points = Array.isArray(payload.points) ? payload.points : [];

        this.state.allPoints = points
          .map((point) => ({
            id: String(point.id || point.code || ""),
            name: point.name || point.label || "Výdajné miesto",
            city: point.city || "",
            address: point.address || point.street || "",
            zip: point.zip || point.zipCode || "",
            carrier: point.carrier || carrier,
            openingHours: point.openingHours || point.open_hours || "",
            raw: point,
          }))
          .filter((point) => point.id);

        this.applySearch();

        if (this.state.selectedPoint && this.state.selectedPoint.id) {
          this.state.selectedCardId = this.state.selectedPoint.id;
        }
      } catch (error) {
        this.state.error = error && error.message ? error.message : "Unknown error";
        this.log("Load points failed", error);
      } finally {
        this.state.loading = false;
      }
    },

    getActiveCarrier: function () {
      const checked = document.querySelector(
        this.config.selectors.shippingInputs + ":checked"
      );

      if (checked) {
        return (
          checked.getAttribute("data-boxpi-carrier") ||
          checked.getAttribute("data-carrier") ||
          checked.value ||
          this.config.carrier
        );
      }

      return this.config.carrier;
    },

    bindShippingMethodListeners: function () {
      document.addEventListener("change", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) return;

        if (target.matches(this.config.selectors.shippingInputs)) {
          this.log("Shipping input changed", target.value);
        }
      });
    },

    observeDomChanges: function () {
      const observer = new MutationObserver(() => {
        if (!document.getElementById("boxpi-widget-root")) {
          this.mount();
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
    },

    normalize: function (value) {
      return String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
    },

    escapeHtml: function (value) {
      return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    },

    injectStyles: function () {
      if (document.getElementById("boxpi-widget-styles")) return;

      const style = document.createElement("style");
      style.id = "boxpi-widget-styles";
      style.textContent = `
        .boxpi-widget-root {
          margin: 16px 0;
          font-family: Inter, Arial, sans-serif;
        }

        .boxpi-card {
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          background: #ffffff;
          padding: 16px;
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
        }

        .boxpi-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          flex-wrap: wrap;
        }

        .boxpi-title {
          font-size: 16px;
          font-weight: 700;
          color: #111827;
        }

        .boxpi-subtitle {
          margin-top: 4px;
          font-size: 13px;
          color: #6b7280;
        }

        .boxpi-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .boxpi-btn {
          appearance: none;
          border: 1px solid #d1d5db;
          background: #fff;
          color: #111827;
          border-radius: 12px;
          padding: 10px 14px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .boxpi-btn:hover {
          transform: translateY(-1px);
        }

        .boxpi-btn-primary {
          background: #111827;
          color: #fff;
          border-color: #111827;
        }

        .boxpi-btn-secondary {
          background: #fff;
          color: #111827;
        }

        .boxpi-empty,
        .boxpi-selected {
          margin-top: 14px;
          padding: 14px;
          background: #f9fafb;
          border-radius: 12px;
          border: 1px solid #e5e7eb;
        }

        .boxpi-selected-name {
          font-size: 15px;
          font-weight: 700;
          color: #111827;
        }

        .boxpi-selected-meta,
        .boxpi-selected-hours {
          margin-top: 6px;
          font-size: 13px;
          color: #4b5563;
        }

        .boxpi-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(17, 24, 39, 0.55);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 999999;
          padding: 16px;
        }

        .boxpi-modal {
          width: 100%;
          max-width: 920px;
          max-height: 90vh;
          background: #fff;
          border-radius: 20px;
          box-shadow: 0 25px 60px rgba(0, 0, 0, 0.18);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .boxpi-modal-header,
        .boxpi-modal-footer {
          padding: 16px 20px;
          border-bottom: 1px solid #e5e7eb;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .boxpi-modal-footer {
          border-bottom: 0;
          border-top: 1px solid #e5e7eb;
          justify-content: flex-end;
        }

        .boxpi-modal-header h2 {
          margin: 0;
          font-size: 20px;
          line-height: 1.2;
          color: #111827;
        }

        .boxpi-modal-body {
          padding: 20px;
          overflow: auto;
          min-height: 300px;
        }

        .boxpi-icon-btn {
          width: 40px;
          height: 40px;
          border-radius: 999px;
          border: 1px solid #e5e7eb;
          background: #fff;
          font-size: 24px;
          line-height: 1;
          cursor: pointer;
        }

        .boxpi-search-wrap {
          margin-bottom: 16px;
        }

        .boxpi-search-label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: #374151;
          margin-bottom: 8px;
        }

        .boxpi-search-row {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .boxpi-search-input {
          flex: 1;
          width: 100%;
          min-width: 0;
          border: 1px solid #d1d5db;
          border-radius: 12px;
          padding: 12px 14px;
          font-size: 14px;
          outline: none;
        }

        .boxpi-search-input:focus {
          border-color: #111827;
          box-shadow: 0 0 0 3px rgba(17, 24, 39, 0.08);
        }

        .boxpi-points-list {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .boxpi-point-card {
          width: 100%;
          text-align: left;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          padding: 14px;
          background: #fff;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .boxpi-point-card:hover {
          border-color: #9ca3af;
          transform: translateY(-1px);
          box-shadow: 0 8px 18px rgba(0, 0, 0, 0.06);
        }

        .boxpi-point-card.is-selected {
          border-color: #111827;
          box-shadow: 0 0 0 3px rgba(17, 24, 39, 0.08);
        }

        .boxpi-point-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 8px;
        }

        .boxpi-point-name {
          font-size: 15px;
          font-weight: 700;
          color: #111827;
        }

        .boxpi-point-address,
        .boxpi-point-meta,
        .boxpi-point-hours {
          font-size: 13px;
          color: #4b5563;
          margin-top: 4px;
        }

        .boxpi-radio {
          width: 20px;
          height: 20px;
          border-radius: 999px;
          border: 2px solid #cbd5e1;
          flex: 0 0 auto;
        }

        .boxpi-radio.is-selected {
          border-color: #111827;
          background: radial-gradient(circle, #111827 45%, #fff 46%);
        }

        .boxpi-state {
          min-height: 220px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
          gap: 10px;
          color: #4b5563;
        }

        .boxpi-error-title {
          font-size: 16px;
          font-weight: 700;
          color: #111827;
        }

        .boxpi-spinner {
          width: 34px;
          height: 34px;
          border-radius: 999px;
          border: 3px solid #e5e7eb;
          border-top-color: #111827;
          animation: boxpi-spin 1s linear infinite;
        }

        @keyframes boxpi-spin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
          .boxpi-points-list {
            grid-template-columns: 1fr;
          }

          .boxpi-modal {
            max-width: 100%;
            max-height: 100vh;
            border-radius: 0;
          }

          .boxpi-modal-overlay {
            padding: 0;
          }

          .boxpi-modal-body {
            padding: 16px;
          }

          .boxpi-modal-header,
          .boxpi-modal-footer {
            padding: 14px 16px;
          }

          .boxpi-search-row {
            flex-direction: column;
            align-items: stretch;
          }

          .boxpi-card-header {
            flex-direction: column;
            align-items: stretch;
          }
        }
      `;

      document.head.appendChild(style);
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      BoxpiShippingWidget.init();
    });
  } else {
    BoxpiShippingWidget.init();
  }

  window.BoxpiShippingWidget = BoxpiShippingWidget;
})();