const USERS = { "admin": "123", "kasir": "1" };
let products = [], history = [], cart = [];

window.onload = () => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    document.getElementById('themeSelect').value = savedTheme;

    if(sessionStorage.getItem('isLoggedIn')) {
        document.getElementById('login-screen').classList.add('hidden');
        loadData();
        nav('dashboard'); // Default ke Dashboard
    }
};

// --- SIDEBAR TOGGLE ---
function toggleSidebar() {
    const sb = document.getElementById('sidebar');
    sb.classList.toggle('hidden');
    sb.classList.toggle('flex');
}

// --- NAVIGATION ---
function nav(pageId) {
    // Hide all pages
    document.querySelectorAll('.page-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active-nav'));

    // Show selected page
    document.getElementById('page-' + pageId).classList.remove('hidden');
    document.getElementById('nav-' + pageId)?.classList.add('active-nav');

    // Close sidebar on mobile after click
    if(window.innerWidth < 768) {
        document.getElementById('sidebar').classList.add('hidden');
        document.getElementById('sidebar').classList.remove('flex');
    }

    if(pageId === 'dashboard') calcDashboard();
    if(pageId === 'stock') renderStockTable();
    if(pageId === 'history') renderHistoryTable();
}

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
        
        // Refresh tampilan jika data berubah
        if(!document.getElementById('page-pos').classList.contains('hidden')) renderProducts();
        if(!document.getElementById('page-dashboard').classList.contains('hidden')) calcDashboard();
        
    } catch(e) { console.error("Gagal koneksi:", e); }
}

function handleLogin(e) {
    e.preventDefault();
    const u = document.getElementById('username').value;
    const p = document.getElementById('password').value;
    if(USERS[u] === p) {
        sessionStorage.setItem('isLoggedIn', 'true');
        location.reload();
    } else Swal.fire('Error', 'Login Gagal', 'error');
}

function handleLogout() {
    sessionStorage.clear();
    location.reload();
}

// --- POS SYSTEM ---
function renderProducts() {
    const s = document.getElementById('search').value.toLowerCase();
    const grid = document.getElementById('grid');
    
    if(!products.length) return grid.innerHTML = '<div class="col-span-full text-center text-slate-500 mt-10">Belum ada produk. Tambahkan di menu Stok.</div>';

    grid.innerHTML = products.map(p => {
        if(p.name && !p.name.toLowerCase().includes(s)) return '';
        return `
        <div onclick="addToCart(${p.id})" class="theme-panel p-3 rounded-xl cursor-pointer theme-hover border border-transparent transition relative overflow-hidden group">
            <div class="flex justify-between items-start mb-2">
                <div class="w-8 h-8 rounded-full bg-blue-600/10 flex items-center justify-center text-blue-500 group-hover:bg-blue-600 group-hover:text-white transition">
                    <i class="fa-solid fa-box"></i>
                </div>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded ${p.stock<=5?'bg-red-500/20 text-red-500':'bg-emerald-500/20 text-emerald-500'}">${p.stock}</span>
            </div>
            <div class="font-bold theme-text text-sm truncate">${p.name}</div>
            <div class="text-xs theme-text-muted">Rp ${p.price.toLocaleString()}</div>
        </div>`;
    }).join('');
}

function addToCart(id) {
    const p = products.find(i => i.id === id);
    if(p.stock <= 0) return Swal.fire({toast:true, position:'top-end', icon:'warning', title:'Stok Habis', showConfirmButton:false, timer:1500});
    const ex = cart.find(i => i.id === id);
    if(ex) { if(ex.qty < p.stock) ex.qty++; } else { cart.push({...p, qty: 1}); }
    renderCart();
}

function renderCart() {
    const list = document.getElementById('cartList');
    let sub = 0;
    
    if(!cart.length) list.innerHTML = '<div class="text-center text-xs theme-text-muted mt-10">Keranjang Kosong</div>';
    else {
        list.innerHTML = cart.map((i, idx) => {
            sub += i.price * i.qty;
            return `
            <div class="flex justify-between items-center bg-slate-500/10 p-2 rounded mb-1">
                <div><div class="font-bold text-xs theme-text">${i.name}</div><div class="text-[10px] theme-text-muted">${i.qty} x ${i.price.toLocaleString()}</div></div>
                <button onclick="cart.splice(${idx},1);renderCart()" class="text-red-500 w-6 h-6 hover:bg-red-500/20 rounded flex items-center justify-center"><i class="fa-solid fa-trash text-xs"></i></button>
            </div>`;
        }).join('');
    }

    const disc = parseInt(document.getElementById('inputDiscount').value) || 0;
    const total = Math.max(0, sub - disc);
    
    document.getElementById('totalDisplay').innerText = 'Rp ' + total.toLocaleString();
    document.getElementById('cartCount').innerText = cart.length;
    return total;
}

async function checkout() {
    const total = renderCart();
    if(total === 0 && cart.length === 0) return;

    const { value: bayar } = await Swal.fire({
        title: `Total: Rp ${total.toLocaleString()}`,
        input: 'number',
        inputLabel: 'Masukkan Nominal Bayar',
        confirmButtonText: 'BAYAR & CETAK',
        confirmButtonColor: '#2563eb'
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
            discount: discount
        };

        try {
            await fetch('/api/checkout', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(trx)
            });

            // Print
            document.getElementById('p-no').innerText = trx.id;
            document.getElementById('p-date').innerText = new Date().toLocaleDateString();
            document.getElementById('p-items').innerHTML = cart.map(i => `<tr><td>${i.name}</td><td align="right">${i.qty}x${i.price.toLocaleString()}</td></tr>`).join('');
            document.getElementById('p-footer').innerHTML = `
                <div class="flex justify-between"><span>SUB</span><span>${(total+discount).toLocaleString()}</span></div>
                <div class="flex justify-between"><span>DISC</span><span>-${discount.toLocaleString()}</span></div>
                <div class="flex justify-between"><span>TOT</span><span>${total.toLocaleString()}</span></div>
                <div class="flex justify-between"><span>PAY</span><span>${parseInt(bayar).toLocaleString()}</span></div>
                <div class="flex justify-between"><span>CHG</span><span>${(parseInt(bayar)-total).toLocaleString()}</span></div>
            `;

            cart = []; document.getElementById('inputDiscount').value = '';
            renderCart(); loadData();
            setTimeout(() => window.print(), 500);
        } catch(e) { Swal.fire('Error', 'Gagal Transaksi', 'error'); }
    } else if (bayar) {
        Swal.fire('Error', 'Uang Kurang', 'error');
    }
}

// --- DASHBOARD ---
function calcDashboard() {
    const today = new Date().toDateString();
    let income = 0, sold = 0, count = 0;
    
    history.forEach(t => {
        if(new Date(t.date).toDateString() === today) {
            income += t.total;
            count++;
            try {
                const items = typeof t.items === 'string' ? JSON.parse(t.items) : t.items;
                items.forEach(i => sold += i.qty);
            } catch(e) {}
        }
    });

    document.getElementById('dash-income').innerText = 'Rp ' + income.toLocaleString();
    document.getElementById('dash-sold').innerText = sold;
    document.getElementById('dash-trx').innerText = count;

    document.getElementById('dash-recent-list').innerHTML = history.slice(0, 5).map(t => `
        <div class="flex justify-between border-b border-slate-700/50 pb-2 mb-2">
            <div><div class="font-bold theme-text text-sm">${t.id}</div><div class="text-[10px] theme-text-muted">${new Date(t.date).toLocaleTimeString()}</div></div>
            <div class="font-bold text-emerald-500">Rp ${t.total.toLocaleString()}</div>
        </div>
    `).join('');
}

// --- TABLES ---
function renderHistoryTable() {
    document.getElementById('historyTableBody').innerHTML = history.map(t => `
        <tr class="theme-text text-sm hover:bg-slate-500/5 transition">
            <td class="p-4">${new Date(t.date).toLocaleString()}</td>
            <td class="p-4 font-bold text-emerald-500">Rp ${t.total.toLocaleString()}</td>
            <td class="p-4 text-center"><button onclick="delHistory('${t.id}')" class="text-red-500 hover:text-red-400"><i class="fa-solid fa-trash"></i></button></td>
        </tr>
    `).join('');
}

function renderStockTable() {
    document.getElementById('stockTableBody').innerHTML = products.map(p => `
        <tr class="theme-text text-sm hover:bg-slate-500/5 transition">
            <td class="p-4">${p.name}</td>
            <td class="p-4 font-bold ${p.stock<=5?'text-red-500':'text-emerald-500'}">${p.stock}</td>
            <td class="p-4 text-center"><button onclick="delProd(${p.id})" class="text-red-500 hover:text-red-400"><i class="fa-solid fa-trash"></i></button></td>
        </tr>
    `).join('');
}

async function addNewProduct() {
    const n = document.getElementById('newName').value;
    const p = document.getElementById('newPrice').value;
    const s = document.getElementById('newStock').value;
    if(n && p) { await fetch('/api/products', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name:n, price:p, stock:s, category:'food'})}); loadData(); renderStockTable(); }
}
async function delProd(id) { if(confirm('Hapus?')) await fetch(`/api/products/${id}`, {method:'DELETE'}); loadData(); renderStockTable(); }
async function delHistory(id) { if(confirm('Hapus?')) await fetch(`/api/history/${id}`, {method:'DELETE'}); loadData(); renderHistoryTable(); }
