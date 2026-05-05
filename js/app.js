const MAX_SELECTION = 4;

const pickerEl = document.getElementById("property-picker");
const hintEl = document.getElementById("selection-hint");
const resetBtnEl = document.getElementById("reset-selection");
const cardsEl = document.getElementById("selected-cards");
const tableHeadEl = document.querySelector("#comparison-table thead");
const tableBodyEl = document.querySelector("#comparison-table tbody");
document.getElementById("year").textContent = new Date().getFullYear();

let db = null;
let selectedIds = [];

init();

async function init() {
  db = await fetch("data/properties.json").then((r) => r.json());
  renderPicker();
  restoreFromUrl();
  updateUI();
}

function renderPicker() {
  pickerEl.innerHTML = "";
  db.properties.forEach((p) => {
    const label = document.createElement("label");
    label.className = "pick-item";
    label.innerHTML = `
      <input type="checkbox" value="${p.id}" />
      <div>
        <strong>${p.name}</strong>
        <span>${p.community}, ${p.city}</span>
      </div>`;

    const input = label.querySelector("input");
    input.addEventListener("change", () => {
      if (input.checked) {
        if (selectedIds.length >= MAX_SELECTION) {
          input.checked = false;
          hintEl.textContent = `Max ${MAX_SELECTION} plans selectable`;
          return;
        }
        selectedIds.push(p.id);
      } else {
        selectedIds = selectedIds.filter((id) => id !== p.id);
      }
      pushUrlState();
      updateUI();
    });

    pickerEl.appendChild(label);
  });
}

function updateUI() {
  hintEl.textContent = `${selectedIds.length}/${MAX_SELECTION} selected`;
  resetBtnEl.disabled = selectedIds.length === 0;
  const selected = db.properties.filter((p) => selectedIds.includes(p.id));
  document.querySelectorAll('.pick-item input').forEach((i) => {
    i.checked = selectedIds.includes(i.value);
    i.disabled = !i.checked && selectedIds.length >= MAX_SELECTION;
  });
  renderCards(selected);
  renderTable(selected);
}

function renderCards(selected) {
  cardsEl.innerHTML = "";
  selected.forEach((p) => {
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `
      <img src="${p.image}" alt="${p.name} master plan image" loading="lazy" />
      <div class="card-body">
        <h3>${p.name}</h3>
        <p class="meta">${p.developer} · ${p.community} · ${p.beds}</p>
        <a href="${p.affiliateUrl}" rel="nofollow sponsored" target="_blank">Official / Affiliate Link</a>
      </div>`;
    cardsEl.appendChild(card);
  });
}

function renderTable(selected) {
  tableHeadEl.innerHTML = "";
  tableBodyEl.innerHTML = "";

  if (selected.length === 0) {
    tableHeadEl.innerHTML = "<tr><th>Room</th><th>Select plans to compare</th></tr>";
    tableBodyEl.innerHTML = "<tr><td>Info</td><td>Pick up to 4 properties above.</td></tr>";
    return;
  }

  const roomNames = [...new Set(selected.flatMap((p) => Object.keys(p.rooms)))].sort();

  const headRow = document.createElement("tr");
  headRow.innerHTML = `<th>Room</th>${selected.map((p) => `<th>${p.name}</th>`).join("")}`;
  tableHeadEl.appendChild(headRow);

  roomNames.forEach((room) => {
    const tr = document.createElement("tr");
    const cells = selected
      .map((p) => `<td>${formatRoomValue(p.rooms[room] || "-")}</td>`)
      .join("");
    tr.innerHTML = `<td>${room}</td>${cells}`;
    tableBodyEl.appendChild(tr);
  });
}

function formatRoomValue(value) {
  const raw = String(value || "-").trim();
  if (!raw || raw === "-") return "-";
  if (/(m2|m²)/i.test(raw)) return raw;

  const match = raw.match(/([0-9]+(?:[.,][0-9]+)?)\s*[xX]\s*([0-9]+(?:[.,][0-9]+)?)/);
  if (!match) return raw;

  const width = Number(match[1].replace(",", "."));
  const length = Number(match[2].replace(",", "."));
  if (!Number.isFinite(width) || !Number.isFinite(length)) return raw;

  const area = (width * length).toFixed(2).replace(".", ",");
  return `${raw} (${area} m2)`;
}

function pushUrlState() {
  const url = new URL(window.location.href);
  if (selectedIds.length) {
    url.searchParams.set("compare", selectedIds.join(","));
  } else {
    url.searchParams.delete("compare");
  }
  window.history.replaceState({}, "", url);
}

function restoreFromUrl() {
  const url = new URL(window.location.href);
  const compareParam = url.searchParams.get("compare");
  if (!compareParam) return;
  const parsed = compareParam
    .split(",")
    .map((x) => x.trim())
    .filter((id) => db.properties.some((p) => p.id === id))
    .slice(0, MAX_SELECTION);
  selectedIds = parsed;
}

function clearSelection() {
  selectedIds = [];
  pushUrlState();
  updateUI();
}

resetBtnEl.addEventListener("click", clearSelection);
