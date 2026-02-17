const USERS = { "admin": "123", "manager": "9999" }; // User Login
const MANAGER_PIN = "9999"; // PIN Hapus Riwayat
let products = [], history = [], cart = [], payMethod = 'TUNAI';
let salesChart = null;

// --- INIT SYSTEM ---
window.onload = () => {
    // 1. Theme
    const theme = localStorage.getItem('theme') || 'dark';
    setTheme(theme);
    document.getElementById('themeSelect').value = theme;

    // 2. Auth Check
    if(sessionStorage.getItem('isLoggedIn')) {
        document.getElementById('login-screen').classList.add('hidden');
        loadData().then(() => nav('dashboard'));
    }
};

// --- AUTH ---
function handleLogin(e) {
    e.preventDefault();
    const u = document.getElementById('username').value.trim();
    const p = document.getElementById('password').value.trim();
    
    if(USERS[u] && USERS[u] === p) {
        sessionStorage.setItem('isLoggedIn', 'true');
        sessionStorage.setItem('role', u === 'manager' ? 'manager' : 'staff');
        Swal.fire({icon:'success', title:'Selamat Datang', showConfirmButton:false, timer:800}).then(() => location.reload());
    } else {
        Swal.fire('Akses Ditolak', 'Username atau Password salah!', 'error');
    }
}
function handleLogout() { sessionStorage.clear(); location.reload(); }

// --- CORE NAVIGATION ---
function nav(pageId) {
    document.querySelectorAll('.page-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    
    document.getElementById('page-' + pageId).classList.remove('hidden');
    document.getElementById('nav-' + pageId)?.classList.add('active');
    
    // Auto-Refresh Specific Data
    if(pageId === 'dashboard') calcDashboard();
    if(pageId === 'stock') renderStockTable();
    if(pageId === 'history') renderHistoryTable();
}

function setTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
}

// --- DATA SYNC ---
async function loadData() {
    try {
        const res = await fetch('/api/init');
        if(!res.ok) throw new Error("Server Error");
        const data = await res.json();
        products = data.products || [];
        history = data.history || [];
        renderProducts();
    } catch(e) {
        Swal.fire('Koneksi Gagal', 'Tidak dapat terhubung ke Database Neon.', 'error');
    }
}

// --- KASIR & CART LOGIC ---
function renderProducts() {
    const s = document.getElementById('search').value.toLowerCase();
    const grid = document.getElementById('grid');
    const activeCat = document.querySelector('.cat-pill.active')?.innerText.toLowerCase() || 'semua';
    
    grid.innerHTML = products.map(p => {
        if(p.name && !p.name.toLowerCase().includes(s)) return '';
        if(activeCat !== 'semua' && activeCat === 'makanan' && p.category !== 'food') return '';
        if(activeCat !== 'semua' && activeCat === 'minuman' && p.category !== 'drink') return '';
        if(activeCat !== 'semua' && activeCat === 'snack' && p.category !== 'snack') return '';

        return `
        <div onclick="addToCart(${p.id})" class="card p-4 cursor-pointer hover:border-[var(--accent)] transition group relative overflow-hidden ${p.stock<=0?'opacity-50 grayscale':''}">
            <div class="flex justify-between items-start mb-3">
                <div class="w-10 h-10 rounded-full bg-[var(--bg-input)] flex items-center justify-center text-[var(--accent)] group-hover:bg-[var(--accent)] group-hover:text-white transition">
                    <i class="fa-solid fa-utensils"></i>
                </div>
                <span class="text-xs font-bold px-2 py-1 rounded ${p.stock<=5?'bg-red-500/20 text-red-500':'bg-emerald-500/20 text-emerald-500'}">${p.stock}</span>
            </div>
            <div class="font-bold text-sm mb-1 truncate">${p.name}</div>
            <div class="text-[var(--accent)] font-bold text-xs">Rp ${p.price.toLocaleString()}</div>
        </div>`;
    }).join('');
}

function setCategory(cat) {
    document.querySelectorAll('.cat-pill').forEach(b => {
        b.classList.remove('active', 'bg-[var(--accent)]', 'text-white');
        b.classList.add('bg-[var(--bg-card)]');
    });
    // Find button based on text content logic or ID
    event.target.classList.add('active', 'bg-[var(--accent)]', 'text-white');
    event.target.classList.remove('bg-[var(--bg-card)]');
    renderProducts();
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
    
    if(!cart.length) list.innerHTML = '<div class="text-center text-xs text-[var(--text-secondary)] mt-10">Keranjang Kosong</div>';
    else {
        list.innerHTML = cart.map((i, idx) => {
            sub += i.price * i.qty;
            return `
            <div class="flex justify-between items-center bg-[var(--bg-input)] p-3 rounded-lg animate-fade-in">
                <div><div class="font-bold text-xs">${i.name}</div><div class="text-[10px] text-[var(--text-secondary)]">${i.qty} x ${i.price.toLocaleString()}</div></div>
                <button onclick="cart.splice(${idx},1);renderCart()" class="text-red-500 w-6 h-6 hover:bg-red-500/10 rounded"><i class="fa-solid fa-trash text-xs"></i></button>
            </div>`;
        }).join('');
    }

    const disc = parseInt(document.getElementById('inputDiscount').value) || 0;
    const total = Math.max(0, sub - disc);
    
    document.getElementById('subtotalDisplay').innerText = 'Rp ' + sub.toLocaleString();
    document.getElementById('totalDisplay').innerText = 'Rp ' + total.toLocaleString();
    document.getElementById('cartCount').innerText = cart.length;
    return total;
}

function setPayment(method) {
    payMethod = method;
    document.querySelectorAll('.pay-btn').forEach(b => {
        b.classList.remove('active', 'bg-[var(--accent)]', 'text-white');
        if(b.innerText.includes(method)) b.classList.add('active', 'bg-[var(--accent)]', 'text-white');
    });
}

// --- CHECKOUT & PRINT ---
async function checkout() {
    const total = renderCart();
    if(total === 0 && cart.length === 0) return Swal.fire('Keranjang Kosong', 'Pilih produk dulu', 'info');

    let bayar = total;
    if(payMethod === 'TUNAI') {
        const { value: uang } = await Swal.fire({title: `Total: Rp ${total.toLocaleString()}`, input: 'number', inputLabel: 'Uang Diterima', confirmButtonText: 'BAYAR', confirmButtonColor:'#3b82f6'});
        if(!uang || parseInt(uang) < total) return Swal.fire('Gagal', 'Uang Kurang!', 'error');
        bayar = parseInt(uang);
    }

    // Proses Transaksi
    const disc = parseInt(document.getElementById('inputDiscount').value) || 0;
    const trx = { id: 'TRX-'+Date.now().toString().slice(-6), date: new Date().toISOString(), cashier: sessionStorage.getItem('username'), total, method: payMethod, items: cart, discount: disc };

    Swal.fire({title:'Memproses...', didOpen:()=>Swal.showLoading()});
    try {
        await fetch('/api/checkout', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(trx)});
        
        // Setup Print
        document.getElementById('p-no').innerText = trx.id;
        document.getElementById('p-date').innerText = new Date().toLocaleString();
        document.getElementById('p-items').innerHTML = cart.map(i => `<tr><td>${i.name}</td><td align="right">${i.qty} x ${i.price.toLocaleString()}</td></tr>`).join('');
        document.getElementById('p-footer').innerHTML = `
            <div class="flex justify-between"><span>SUBTOTAL</span><span>${(total+disc).toLocaleString()}</span></div>
            <div class="flex justify-between"><span>DISKON</span><span>-${disc.toLocaleString()}</span></div>
            <div class="flex justify-between text-lg"><span>TOTAL</span><span>${total.toLocaleString()}</span></div>
            <div class="flex justify-between"><span>BAYAR (${payMethod})</span><span>${bayar.toLocaleString()}</span></div>
            <div class="flex justify-between"><span>KEMBALI</span><span>${(bayar-total).toLocaleString()}</span></div>
        `;

        cart = []; document.getElementById('inputDiscount').value = ''; renderCart(); loadData();
        Swal.close();
        setTimeout(() => window.print(), 500);
    } catch(e) { Swal.fire('Error', 'Gagal menyimpan transaksi', 'error'); }
}

// --- DASHBOARD REALTIME ---
function calcDashboard() {
    const today = new Date().toDateString();
    let income = 0, sold = 0, count = 0;
    const dailyData = [0,0,0,0,0,0,0];
    const days = [];
    
    for(let i=6; i>=0; i--) { const d=new Date(); d.setDate(d.getDate()-i); days.push(d.toLocaleDateString('id-ID',{weekday:'short'})); }

    history.forEach(t => {
        const d = new Date(t.date);
        if(d.toDateString() === today) { income += t.total; count++; }
        
        // Chart Data logic (Simplified)
        const dayDiff = Math.floor((new Date() - d) / (1000 * 60 * 60 * 24));
        if(dayDiff >= 0 && dayDiff <= 6) dailyData[6-dayDiff] += t.total;

        try { if(d.toDateString() === today) JSON.parse(t.items).forEach(i => sold += i.qty); } catch(e){}
    });

    document.getElementById('dash-income').innerText = 'Rp ' + income.toLocaleString();
    document.getElementById('dash-sold').innerText = sold;
    document.getElementById('dash-trx').innerText = count;
    
    // Recent List
    document.getElementById('dash-recent-list').innerHTML = history.slice(0, 5).map(t => `
        <div class="flex justify-between items-center p-3 bg-[var(--bg-input)] rounded-lg">
            <div><div class="font-bold text-sm">${t.id}</div><div class="text-[10px] text-[var(--text-secondary)]">${new Date(t.date).toLocaleString()}</div></div>
            <div class="font-bold text-[var(--accent)]">Rp ${t.total.toLocaleString()}</div>
        </div>`).join('');

    // Chart
    const ctx = document.getElementById('salesChart');
    if(salesChart) salesChart.destroy();
    salesChart = new Chart(ctx, {
        type: 'bar',
        data: { labels: days, datasets: [{ label: 'Omzet', data: dailyData, backgroundColor: '#3b82f6', borderRadius:5 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins:{legend:{display:false}}, scales:{x:{grid:{display:false}}, y:{grid:{color:'#334155'}}} }
    });
}

// --- CRUD & VERIFIKASI PIN ---
async function delHistory(id) {
    const { value: pin } = await Swal.fire({
        title: 'Verifikasi Manager',
        text: 'Masukkan PIN untuk menghapus data ini',
        input: 'password',
        inputPlaceholder: 'PIN (Default: 9999)',
        showCancelButton: true,
        confirmButtonColor: '#ef4444'
    });

    if (pin === MANAGER_PIN) {
        await fetch(`/api/history/${id}`, {method:'DELETE'});
        loadData(); renderHistoryTable();
        Swal.fire('Terhapus', 'Data transaksi dihapus.', 'success');
    } else if (pin) {
        Swal.fire('Akses Ditolak', 'PIN Salah!', 'error');
    }
}

function renderHistoryTable() {
    document.getElementById('historyTableBody').innerHTML = history.map(t => `
        <tr class="hover:bg-[var(--bg-input)] transition">
            <td class="p-4">${new Date(t.date).toLocaleString()}</td>
            <td class="p-4 font-mono text-xs">${t.id}</td>
            <td class="p-4"><span class="px-2 py-1 rounded text-[10px] font-bold border ${t.method==='QRIS'?'border-purple-500 text-purple-500':'border-blue-500 text-blue-500'}">${t.method}</span></td>
            <td class="p-4 text-right font-bold">Rp ${t.total.toLocaleString()}</td>
            <td class="p-4 text-center"><button onclick="delHistory('${t.id}')" class="text-red-500 hover:scale-110 transition" title="Hapus (Butuh PIN)"><i class="fa-solid fa-trash-can"></i></button></td>
        </tr>
    `).join('');
}

// Stok & Produk Helper
async function addNewProduct() { /* (Logic sama seperti sebelumnya) */ 
    const n=document.getElementById('newName').value, p=document.getElementById('newPrice').value, s=document.getElementById('newStock').value, c=document.getElementById('newCategory').value;
    if(n&&p) { await fetch('/api/products',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:n,price:p,stock:s,category:c})}); loadData(); renderStockTable(); Swal.fire({toast:true,icon:'success',title:'Produk Ditambah',position:'top-end',timer:1500,showConfirmButton:false});}
}
async function delProd(id) { if(confirm('Hapus produk?')) { await fetch(`/api/products/${id}`,{method:'DELETE'}); loadData(); renderStockTable(); } }
function renderStockTable() {
    document.getElementById('stockTableBody').innerHTML = products.map(p => `
        <tr class="hover:bg-[var(--bg-input)] transition">
            <td class="p-4 font-bold">${p.name}</td>
            <td class="p-4 text-xs uppercase text-[var(--text-secondary)]">${p.category}</td>
            <td class="p-4">Rp ${p.price.toLocaleString()}</td>
            <td class="p-4 text-center font-bold ${p.stock<=5?'text-red-500':'text-emerald-500'}">${p.stock}</td>
            <td class="p-4 text-center"><button onclick="delProd(${p.id})" class="text-red-500"><i class="fa-solid fa-trash"></i></button></td>
        </tr>`).join('');
}
