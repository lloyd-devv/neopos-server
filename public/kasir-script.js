const USERS = { "admin": "123" };
let products = [], history = [], cart = [];

// --- INIT ---
window.onload = () => {
    // Load Tema
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    document.getElementById('themeSelect').value = savedTheme;

    if(sessionStorage.getItem('isLoggedIn')) {
        document.getElementById('login-screen').classList.add('hidden');
        loadData().then(() => nav('dashboard')); // Default ke Dashboard
    }
};

// --- NAVIGATION SPA ---
function nav(pageId) {
    // Sembunyikan semua halaman
    document.querySelectorAll('.page-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active-nav'));

    // Tampilkan halaman yang dipilih
    document.getElementById('page-' + pageId).classList.remove('hidden');
    document.getElementById('nav-' + pageId)?.classList.add('active-nav');

    // Refresh data khusus
    if(pageId === 'dashboard') calcDashboard();
    if(pageId === 'stock') renderStockTable();
    if(pageId === 'history') renderHistoryTable();
}

// --- TEMA ---
function setTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
}

// --- DATA ---
async function loadData() {
    try {
        const res = await fetch('/api/init');
        const data = await res.json();
        products = data.products || [];
        history = data.history || [];
        renderProducts();
    } catch(e) { console.error(e); }
}

function handleLogin(e) {
    e.preventDefault();
    if(USERS[document.getElementById('username').value] === document.getElementById('password').value) {
        sessionStorage.setItem('isLoggedIn', 'true');
        location.reload();
    } else Swal.fire('Error', 'Login Gagal', 'error');
}

// --- POS & CART ---
function renderProducts() {
    const s = document.getElementById('search').value.toLowerCase();
    const grid = document.getElementById('grid');
    grid.innerHTML = products.map(p => {
        if(p.name && !p.name.toLowerCase().includes(s)) return '';
        return `
        <div onclick="addToCart(${p.id})" class="theme-panel p-3 rounded-xl cursor-pointer hover:border-blue-500 border border-transparent transition">
            <div class="flex justify-between mb-2">
                <i class="fa-solid fa-box text-blue-500"></i>
                <span class="text-xs font-bold ${p.stock<=5?'text-red-500':'text-emerald-500'}">${p.stock}</span>
            </div>
            <div class="font-bold theme-text text-sm truncate">${p.name}</div>
            <div class="text-xs theme-text-muted">Rp ${p.price.toLocaleString()}</div>
        </div>`;
    }).join('');
}

function addToCart(id) {
    const p = products.find(i => i.id === id);
    if(p.stock <= 0) return Swal.fire('Habis', '', 'warning');
    const ex = cart.find(i => i.id === id);
    if(ex) { if(ex.qty < p.stock) ex.qty++; } else { cart.push({...p, qty: 1}); }
    renderCart();
}

function renderCart() {
    const list = document.getElementById('cartList');
    let subtotal = 0;
    list.innerHTML = cart.map((i, idx) => {
        subtotal += i.price * i.qty;
        return `
        <div class="flex justify-between items-center bg-slate-500/10 p-2 rounded mb-1">
            <div><div class="font-bold text-xs theme-text">${i.name}</div><div class="text-[10px] theme-text-muted">${i.qty} x ${i.price}</div></div>
            <button onclick="cart.splice(${idx},1);renderCart()" class="text-red-500"><i class="fa-solid fa-trash"></i></button>
        </div>`;
    }).join('');
    
    // Hitung Diskon
    const discountInput = document.getElementById('inputDiscount').value;
    const discount = parseInt(discountInput) || 0;
    const finalTotal = Math.max(0, subtotal - discount);

    document.getElementById('totalDisplay').innerText = 'Rp ' + finalTotal.toLocaleString();
    document.getElementById('cartCount').innerText = cart.length;
    return finalTotal; // Return total akhir untuk checkout
}

async function checkout() {
    const total = renderCart();
    if(total === 0 && cart.length === 0) return;

    const { value: bayar } = await Swal.fire({
        title: `Total: Rp ${total.toLocaleString()}`,
        input: 'number',
        inputLabel: 'Masukkan Nominal Bayar',
        confirmButtonText: 'BAYAR'
    });

    if (bayar && parseInt(bayar) >= total) {
        const discount = parseInt(document.getElementById('inputDiscount').value) || 0;
        const trx = {
            id: 'INV-' + Date.now().toString().slice(-6),
            date: new Date().toISOString(),
            cashier: 'Admin',
            total: total,
            method: 'TUNAI',
            items: cart,
            discount: discount // Kirim data diskon ke server
        };

        await fetch('/api/checkout', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(trx)
        });

        // Print Struk Logic
        document.getElementById('p-no').innerText = trx.id;
        document.getElementById('p-date').innerText = new Date().toLocaleDateString();
        document.getElementById('p-items').innerHTML = cart.map(i => `<tr><td>${i.name}</td><td align="right">${i.qty}x${i.price}</td></tr>`).join('');
        document.getElementById('p-footer').innerHTML = `
            <div class="flex justify-between"><span>SUBTOTAL</span><span>${(total+discount).toLocaleString()}</span></div>
            <div class="flex justify-between"><span>DISKON</span><span>-${discount.toLocaleString()}</span></div>
            <div class="flex justify-between"><span>TOTAL</span><span>${total.toLocaleString()}</span></div>
            <div class="flex justify-between"><span>BAYAR</span><span>${parseInt(bayar).toLocaleString()}</span></div>
            <div class="flex justify-between"><span>KEMBALI</span><span>${(parseInt(bayar)-total).toLocaleString()}</span></div>
        `;

        cart = []; document.getElementById('inputDiscount').value = ''; 
        renderCart(); loadData();
        window.print();
    }
}

// --- DASHBOARD LOGIC ---
function calcDashboard() {
    const today = new Date().toDateString();
    let income = 0;
    let sold = 0;
    
    // Filter history hari ini
    const todayTrx = history.filter(t => new Date(t.date).toDateString() === today);
    
    todayTrx.forEach(t => {
        income += t.total;
        try {
            const items = typeof t.items === 'string' ? JSON.parse(t.items) : t.items;
            items.forEach(i => sold += i.qty);
        } catch(e) {}
    });

    document.getElementById('dash-income').innerText = 'Rp ' + income.toLocaleString();
    document.getElementById('dash-sold').innerText = sold;
    document.getElementById('dash-trx').innerText = todayTrx.length;

    // List transaksi terakhir di dashboard
    document.getElementById('dash-recent-list').innerHTML = history.slice(0, 5).map(t => `
        <div class="flex justify-between border-b border-slate-700 pb-2">
            <div><div class="font-bold theme-text text-sm">${t.id}</div><div class="text-[10px] theme-text-muted">${new Date(t.date).toLocaleTimeString()}</div></div>
            <div class="font-bold text-emerald-500">Rp ${t.total.toLocaleString()}</div>
        </div>
    `).join('');
}

// --- RIWAYAT & STOK ---
function renderHistoryTable() {
    document.getElementById('historyTableBody').innerHTML = history.map(t => `
        <tr class="theme-text text-sm hover:bg-slate-500/5">
            <td class="p-4">${new Date(t.date).toLocaleString()}</td>
            <td class="p-4 font-bold text-emerald-500">Rp ${t.total.toLocaleString()}</td>
            <td class="p-4 text-center"><button onclick="delHistory('${t.id}')" class="text-red-500"><i class="fa-solid fa-trash"></i></button></td>
        </tr>
    `).join('');
}

function renderStockTable() {
    document.getElementById('stockTableBody').innerHTML = products.map(p => `
        <tr class="theme-text text-sm hover:bg-slate-500/5">
            <td class="p-4">${p.name}</td>
            <td class="p-4 font-bold ${p.stock<=5?'text-red-500':'text-emerald-500'}">${p.stock}</td>
            <td class="p-4 text-center"><button onclick="delProd(${p.id})" class="text-red-500"><i class="fa-solid fa-trash"></i></button></td>
        </tr>
    `).join('');
}

async function addNewProduct() { /* Logic sama seperti sebelumnya, sesuaikan ID input */ 
    const n = document.getElementById('newName').value, p = document.getElementById('newPrice').value, s = document.getElementById('newStock').value;
    if(n && p) { await fetch('/api/products', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name:n, price:p, stock:s, category:'food'})}); loadData(); renderStockTable(); }
}
async function delProd(id) { if(confirm('Hapus?')) await fetch(`/api/products/${id}`, {method:'DELETE'}); loadData(); renderStockTable(); }
async function delHistory(id) { if(confirm('Hapus?')) await fetch(`/api/history/${id}`, {method:'DELETE'}); loadData(); renderHistoryTable(); }
