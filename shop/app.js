const $ = (s) => document.querySelector(s);
const eur = (n) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
const FREE_SHIPPING_FROM = 100, SHIPPING_COST = 4.9;

const state = { brands: new Set(), cats: new Set(), q: "", sort: "rel", cart: JSON.parse(localStorage.getItem("cart") || "[]") };
const save = () => localStorage.setItem("cart", JSON.stringify(state.cart));

// ---------- Filter ----------
function buildFilters() {
  const mk = (id, values, set) => {
    $(id).innerHTML = values.map((v) => `<label><input type="checkbox" value="${v}"> ${v}</label>`).join("");
    $(id).addEventListener("change", (e) => { e.target.checked ? set.add(e.target.value) : set.delete(e.target.value); render(); });
  };
  mk("#brand-filter", [...new Set(PRODUCTS.map((p) => p.brand))], state.brands);
  mk("#cat-filter", [...new Set(PRODUCTS.map((p) => p.cat))], state.cats);
}

const isLight = (hex) => { const n = parseInt(hex.slice(1), 16); return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 > 150; };
const picStyle = (p) => p.img ? `background-image:url('${p.img}')` : `background:${p.color}`;
const discount = (p) => Math.round((1 - p.price / p.old) * 100);

function render() {
  let list = PRODUCTS.filter((p) =>
    (!state.brands.size || state.brands.has(p.brand)) &&
    (!state.cats.size || state.cats.has(p.cat)) &&
    (`${p.brand} ${p.name} ${p.cat}`).toLowerCase().includes(state.q));
  if (state.sort === "asc") list.sort((a, b) => a.price - b.price);
  if (state.sort === "desc") list.sort((a, b) => b.price - a.price);
  if (state.sort === "sale") list.sort((a, b) => discount(b) - discount(a));
  $("#result-info").textContent = `${list.length} Produkte`;
  $("#grid").innerHTML = list.map((p) => `
    <article class="card" data-id="${p.id}">
      <div class="pic ${isLight(p.color) && !p.img ? "light" : ""}" style="${picStyle(p)}">
        <span class="badge">-${discount(p)}%</span>${p.img ? "" : p.brand}
      </div>
      <div class="info"><div class="b">${p.brand}</div><div class="n">${p.name}</div>
        <span class="price">${eur(p.price)}</span><span class="old">${eur(p.old)}</span></div>
    </article>`).join("") || "<p>Keine Treffer.</p>";
}

// ---------- Produkt-Dialog ----------
function openProduct(id) {
  const p = PRODUCTS.find((x) => x.id === id); let size = null;
  const d = $("#product-dialog");
  d.innerHTML = `
    <div class="pic ${isLight(p.color) && !p.img ? "light" : ""}" style="${picStyle(p)};border-radius:10px;aspect-ratio:16/9">${p.img ? "" : p.brand}</div>
    <p class="muted" style="margin-bottom:0">${p.brand} · ${p.cat}</p>
    <h2 style="margin:.2rem 0">${p.name}</h2>
    <p><span class="price" style="font-size:1.4rem">${eur(p.price)}</span><span class="old">${eur(p.old)}</span></p>
    <b>Größe wählen</b>
    <div class="sizes">${p.sizes.map((s) => `<button data-s="${s}">${s}</button>`).join("")}</div>
    <p class="muted">🚚 Lieferung in 2–4 Werktagen</p>
    <div class="actions"><button class="btn ghost" id="pd-close">Schließen</button><button class="btn" id="pd-add">In den Warenkorb</button></div>`;
  d.querySelector(".sizes").onclick = (e) => {
    if (!e.target.dataset.s) return; size = e.target.dataset.s;
    d.querySelectorAll(".sizes button").forEach((b) => b.classList.toggle("sel", b === e.target));
  };
  $("#pd-close").onclick = () => d.close();
  $("#pd-add").onclick = () => { if (!size) return toast("Bitte Größe wählen"); addToCart(p.id, size); d.close(); };
  d.showModal();
}

// ---------- Warenkorb ----------
function addToCart(id, size) {
  const l = state.cart.find((i) => i.id === id && i.size === size);
  l ? l.qty++ : state.cart.push({ id, size, qty: 1 });
  save(); renderCart(); toast("Zum Warenkorb hinzugefügt ✓"); toggleCart(true);
}
function totals() {
  const sub = state.cart.reduce((s, i) => s + PRODUCTS.find((p) => p.id === i.id).price * i.qty, 0);
  const ship = !sub || sub >= FREE_SHIPPING_FROM ? 0 : SHIPPING_COST;
  return { sub, ship, total: sub + ship };
}
function renderCart() {
  $("#cart-count").textContent = state.cart.reduce((s, i) => s + i.qty, 0);
  $("#cart-items").innerHTML = state.cart.map((i, idx) => {
    const p = PRODUCTS.find((x) => x.id === i.id);
    return `<div class="item"><div class="thumb" style="${picStyle(p)}"></div>
      <div class="t"><b>${p.brand}</b><br>${p.name}<br><span class="muted">Größe ${i.size}</span>
        <div class="qty"><button data-a="-" data-i="${idx}">−</button>${i.qty}<button data-a="+" data-i="${idx}">+</button></div></div>
      <div>${eur(p.price * i.qty)}</div></div>`;
  }).join("") || "<p class='muted'>Dein Warenkorb ist leer.</p>";
  const t = totals();
  $("#subtotal").textContent = eur(t.sub);
  $("#shipping").textContent = t.ship ? eur(t.ship) : "Gratis";
  $("#total").textContent = eur(t.total);
  $("#checkout-btn").disabled = !state.cart.length;
}
const toggleCart = (open) => { $("#cart").classList.toggle("open", open); $("#overlay").classList.toggle("on", open); };

// ---------- Checkout ----------
function addBusinessDays(d, n) { while (n) { d.setDate(d.getDate() + 1); if (d.getDay() % 6) n--; } return d; }
function openCheckout() {
  const fmt = (d) => d.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });
  $("#eta").textContent = `${fmt(addBusinessDays(new Date(), 2))} – ${fmt(addBusinessDays(new Date(), 4))}`;
  $("#checkout-dialog").showModal();
}
// HINWEIS: Hier ist noch KEINE echte Zahlung. Für den Livebetrieb Stripe/PayPal + Backend anbinden.
$("#checkout-form").addEventListener("submit", () => {
  state.cart = []; save(); renderCart(); toggleCart(false);
  toast("Danke für deine Bestellung! (Demo)");
});

function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("on"); setTimeout(() => t.classList.remove("on"), 2200); }

// ---------- Events ----------
$("#grid").addEventListener("click", (e) => { const c = e.target.closest(".card"); if (c) openProduct(+c.dataset.id); });
$("#search").addEventListener("input", (e) => { state.q = e.target.value.toLowerCase(); render(); });
$("#sort").addEventListener("change", (e) => { state.sort = e.target.value; render(); });
$("#cart-btn").onclick = () => toggleCart(true);
$("#cart-close").onclick = $("#overlay").onclick = () => toggleCart(false);
$("#cart-items").addEventListener("click", (e) => {
  const i = e.target.dataset.i; if (i === undefined) return;
  state.cart[i].qty += e.target.dataset.a === "+" ? 1 : -1;
  if (state.cart[i].qty <= 0) state.cart.splice(i, 1);
  save(); renderCart();
});
$("#checkout-btn").onclick = openCheckout;
$("#checkout-cancel").onclick = () => $("#checkout-dialog").close();
$("#year").textContent = new Date().getFullYear();

buildFilters(); render(); renderCart();
