// GANTI BAGIAN RENDER PRODUCTS DENGAN KODE INI
function renderProducts() {
    const s = document.getElementById('search').value.toLowerCase();
    const grid = document.getElementById('grid');
    const activeCat = document.querySelector('.cat-pill.active')?.innerText.toLowerCase() || 'semua';
    
    // Logic Filter
    const filtered = products.filter(p => {
        if(p.name && !p.name.toLowerCase().includes(s)) return false;
        if(activeCat !== 'semua' && activeCat === 'makanan' && p.category !== 'food') return false;
        if(activeCat !== 'semua' && activeCat === 'minuman' && p.category !== 'drink') return false;
        if(activeCat !== 'semua' && activeCat === 'snack' && p.category !== 'snack') return false;
        return true;
    });

    if (filtered.length === 0) {
        grid.innerHTML = `<div class="col-span-full text-center py-20 text-[var(--text-secondary)]">
            <i class="fa-solid fa-utensils text-4xl mb-4 opacity-30"></i>
            <p>Tidak ada produk yang ditemukan.</p>
        </div>`;
        return;
    }

    grid.innerHTML = filtered.map(p => {
        // PERBAIKAN DESAIN KARTU
        // 1. Min-height agar seragam
        // 2. Teks Nama (line-clamp-2) agar bisa 2 baris dan tidak terpotong
        // 3. Layout Flex column yang rapi
        return `
        <div onclick="addToCart(${p.id})" class="card p-0 cursor-pointer hover:border-[var(--accent)] transition group relative overflow-hidden flex flex-col h-full ${p.stock<=0?'opacity-50 grayscale':''}">
            
            <div class="p-4 pb-2 flex justify-between items-start">
                <div class="w-10 h-10 rounded-xl bg-[var(--bg-input)] flex items-center justify-center text-[var(--accent)] group-hover:bg-[var(--accent)] group-hover:text-white transition shadow-sm">
                    <i class="fa-solid ${p.icon || 'fa-box'}"></i>
                </div>
                <span class="text-[10px] font-bold px-2 py-1 rounded-md border ${p.stock<=5?'bg-red-500/10 text-red-500 border-red-500/20':'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'}">
                    Stok: ${p.stock}
                </span>
            </div>

            <div class="px-4 flex-1">
                <div class="font-bold text-sm leading-tight text-[var(--text-primary)] line-clamp-2 min-h-[2.5em] flex items-center">
                    ${p.name}
                </div>
                <div class="text-[10px] text-[var(--text-secondary)] uppercase mt-1 tracking-wide">${p.category}</div>
            </div>

            <div class="p-4 pt-2 mt-2 border-t border-[var(--border)] bg-[var(--bg-input)]/30">
                <div class="text-[var(--accent)] font-extrabold text-sm flex justify-between items-center">
                    <span>Rp ${p.price.toLocaleString()}</span>
                    <i class="fa-solid fa-plus-circle text-lg opacity-0 group-hover:opacity-100 transition transform group-hover:scale-110"></i>
                </div>
            </div>
        </div>`;
    }).join('');
}

// ... (SISA KODE SAMA SEPERTI SEBELUMNYA, PASTIKAN KONEKSI DB LOAD DATA DLL ADA) ...
// Agar aman, saya tulis ulang Full Script-nya di bawah ini:

const USERS = { "admin": "123", "manager": "9999" }; 
const MANAGER_PIN = "9999"; 
let products = [], history = [], cart = [], payMethod = 'TUNAI';
let salesChart = null;

window.onload = () => {
    const theme = localStorage.getItem('theme') || 'dark';
    setTheme(theme);
    document.getElementById('themeSelect').value = theme;

    if(sessionStorage.getItem('isLoggedIn')) {
        document.getElementById('login-screen').classList.add('hidden');
        loadData().then(() => nav('dashboard'));
    }
};

function handleLogin(e) {
    e.preventDefault();
    const u = document.getElementById('username').value.trim();
    const p = document.getElementById('password').value.trim();
    if(USERS[u] && USERS[u] === p) {
        sessionStorage.setItem('isLoggedIn', 'true');
        Swal.fire({icon:'success', title:'Selamat Datang', showConfirmButton:false, timer:800}).then(() => location.reload());
    } else { Swal.fire('Akses Ditolak', 'Cek Username/Password', 'error'); }
}
function handleLogout() { sessionStorage.clear(); location.reload(); }

function nav(pageId) {
    document.querySelectorAll('.page-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById('page-' + pageId).classList.remove('hidden');
    document.getElementById('nav-' + pageId)?.classList.add('active');
    
    // Auto Close Mobile Sidebar
    if(window.innerWidth < 1024) document.getElementById('sidebar').classList.add('hidden');

    if(pageId === 'dashboard') calcDashboard();
    if(pageId === 'stock') renderStockTable();
    if(pageId === 'history') renderHistoryTable();
}

function setTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
}

async function loadData() {
    try {
        const res = await fetch('/api/init');
        if(!res.ok) throw new Error("Server Error");
        const data = await res.json();
        products = data.products || [];
        history = data.history || [];
        renderProducts();
    } catch(e) { Swal.fire('Koneksi Gagal', 'Cek Server/Database', 'error'); }
}

function setCategory(cat) {
    document.querySelectorAll('.cat-pill').forEach(b => {
        b.classList.remove('active', 'bg-[var(--accent)]', 'text-white'); // Hapus style aktif
        b.classList.add('bg-[var(--bg-card)]'); // Balikin ke style biasa
    });
    // Tambah style ke tombol yang diklik
    event.currentTarget.classList.add('active', 'bg-[var(--accent)]', 'text-white');
    event.currentTarget.classList.remove('bg-[var(--bg-card)]');
    renderProducts();
}

function addToCart(id) {
    const p = products.find(i => i.id === id);
    if(p.stock <= 0) return Swal.fire({toast:true, position:'top-end', icon:'warning', title:'Stok Habis', showConfirmButton:false, timer:1000});
    const ex = cart.find(i => i.id === id);
    if(ex) { if(ex.qty < p.stock) ex.qty++; } else { cart.push({...p, qty: 1}); }
    renderCart();
}

function renderCart() {
    const list = document.getElementById('cartList');
    let sub = 0;
    
    if(!cart.length) list.innerHTML = '<div class="flex flex-col items-center justify-center h-40 text-[var(--text-secondary)] opacity-50"><i class="fa-solid fa-basket-shopping text-4xl mb-2"></i><span class="text-xs">Keranjang Kosong</span></div>';
    else {
        list.innerHTML = cart.map((i, idx) => {
            sub += i.price * i.qty;
            return `
            <div class="flex justify-between items-center bg-[var(--bg-input)] p-3 rounded-xl mb-2 animate-fade-in border border-[var(--border)]">
                <div><div class="font-bold text-xs line-clamp-1">${i.name}</div><div class="text-[10px] text-[var(--text-secondary)]">${i.qty} x ${i.price.toLocaleString()}</div></div>
                <button onclick="cart.splice(${idx},1);renderCart()" class="text-red-500 w-7 h-7 hover:bg-red-500/10 rounded-lg flex items-center justify-center transition"><i class="fa-solid fa-trash text-xs"></i></button>
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

async function checkout() {
    const total = renderCart();
    if(total === 0 && cart.length === 0) return Swal.fire('Ops', 'Keranjang kosong', 'info');

    let bayar = total;
    if(payMethod === 'TUNAI') {
        const { value: uang } = await Swal.fire({title: `Total: Rp ${total.toLocaleString()}`, input: 'number', inputLabel: 'Uang Diterima', confirmButtonText: 'BAYAR', confirmButtonColor:'#3b82f6'});
        if(!uang || parseInt(uang) < total) return Swal.fire('Gagal', 'Uang Kurang!', 'error');
        bayar = parseInt(uang);
    }

    const disc = parseInt(document.getElementById('inputDiscount').value) || 0;
    const trx = { id: 'TRX-'+Date.now().toString().slice(-6), date: new Date().toISOString(), cashier: sessionStorage.getItem('username'), total, method: payMethod, items: cart, discount: disc };

    Swal.fire({title:'Memproses...', didOpen:()=>Swal.showLoading()});
    try {
        await fetch('/api/checkout', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(trx)});
        
        document.getElementById('p-no').innerText = trx.id;
        document.getElementById('p-date').innerText = new Date().toLocaleString();
        document.getElementById('p-items').innerHTML = cart.map(i => `<tr><td>${i.name}</td><td align="right">${i.qty} x ${i.price.toLocaleString()}</td></tr>`).join('');
        document.getElementById('p-footer').innerHTML = `
            <div class="flex justify-between"><span>SUBTOTAL</span><span>${(total+disc).toLocaleString()}</span></div>
            <div class="flex justify-between"><span>DISKON</span><span>-${disc.toLocaleString()}</span></div>
            <div class="flex justify-between text-lg border-t border-black pt-1 mt-1"><span>TOTAL</span><span>${total.toLocaleString()}</span></div>
            <div class="flex justify-between"><span>BAYAR</span><span>${bayar.toLocaleString()}</span></div>
            <div class="flex justify-between"><span>KEMBALI</span><span>${(bayar-total).toLocaleString()}</span></div>
        `;

        cart = []; document.getElementById('inputDiscount').value = ''; renderCart(); loadData();
        Swal.close();
        setTimeout(() => window.print(), 500);
    } catch(e) { Swal.fire('Error', 'Transaksi Gagal', 'error'); }
}

function calcDashboard() {
    const today = new Date().toDateString();
    let income = 0, sold = 0, count = 0;
    const dailyData = [0,0,0,0,0,0,0];
    const days = [];
    
    for(let i=6; i>=0; i--) { const d=new Date(); d.setDate(d.getDate()-i); days.push(d.toLocaleDateString('id-ID',{weekday:'short'})); }

    history.forEach(t => {
        const d = new Date(t.date);
        if(d.toDateString() === today) { income += t.total; count++; }
        const dayDiff = Math.floor((new Date() - d) / (1000 * 60 * 60 * 24));
        if(dayDiff >= 0 && dayDiff <= 6) dailyData[6-dayDiff] += t.total;
        try { if(d.toDateString() === today) JSON.parse(t.items).forEach(i => sold += i.qty); } catch(e){}
    });

    document.getElementById('dash-income').innerText = 'Rp ' + income.toLocaleString();
    document.getElementById('dash-sold').innerText = sold;
    document.getElementById('dash-trx').innerText = count;
    
    document.getElementById('dash-recent-list').innerHTML = history.slice(0, 5).map(t => `
        <div class="flex justify-between items-center p-3 bg-[var(--bg-input)] rounded-lg mb-2">
            <div><div class="font-bold text-xs">${t.id}</div><div class="text-[10px] text-[var(--text-secondary)]">${new Date(t.date).toLocaleTimeString()}</div></div>
            <div class="font-bold text-[var(--accent)] text-sm">Rp ${t.total.toLocaleString()}</div>
        </div>`).join('');

    const ctx = document.getElementById('salesChart');
    if(salesChart) salesChart.destroy();
    salesChart = new Chart(ctx, {
        type: 'bar',
        data: { labels: days, datasets: [{ label: 'Omzet', data: dailyData, backgroundColor: '#3b82f6', borderRadius:5 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins:{legend:{display:false}}, scales:{x:{grid:{display:false}}, y:{grid:{color:'#334155'}}} }
    });
}

async function delHistory(id) {
    const { value: pin } = await Swal.fire({ title: 'PIN Manager', input: 'password', showCancelButton: true });
    if (pin === MANAGER_PIN) {
        await fetch(`/api/history/${id}`, {method:'DELETE'}); loadData(); renderHistoryTable();
        Swal.fire('Terhapus', '', 'success');
    } else if(pin) Swal.fire('PIN Salah', '', 'error');
}

function renderHistoryTable() {
    document.getElementById('historyTableBody').innerHTML = history.map(t => `
        <tr class="hover:bg-[var(--bg-input)] transition border-b border-[var(--border)] last:border-0">
            <td class="p-4">${new Date(t.date).toLocaleString()}</td>
            <td class="p-4 font-mono text-xs">${t.id}</td>
            <td class="p-4"><span class="px-2 py-1 rounded text-[10px] font-bold border ${t.method==='QRIS'?'border-purple-500 text-purple-500':'border-blue-500 text-blue-500'}">${t.method}</span></td>
            <td class="p-4 text-right font-bold">Rp ${t.total.toLocaleString()}</td>
            <td class="p-4 text-center"><button onclick="delHistory('${t.id}')" class="text-red-500 hover:scale-110 transition"><i class="fa-solid fa-trash-can"></i></button></td>
        </tr>`).join('');
}

async function addNewProduct() { 
    const n=document.getElementById('newName').value, p=document.getElementById('newPrice').value, s=document.getElementById('newStock').value, c=document.getElementById('newCategory').value;
    if(n&&p) { await fetch('/api/products',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:n,price:p,stock:s,category:c})}); loadData(); renderStockTable(); Swal.fire({toast:true,icon:'success',title:'Produk Ditambah',position:'top-end',timer:1500,showConfirmButton:false});}
}
async function delProd(id) { if(confirm('Hapus produk?')) { await fetch(`/api/products/${id}`,{method:'DELETE'}); loadData(); renderStockTable(); } }
function renderStockTable() {
    document.getElementById('stockTableBody').innerHTML = products.map(p => `
        <tr class="hover:bg-[var(--bg-input)] transition border-b border-[var(--border)] last:border-0">
            <td class="p-4 font-bold">${p.name}</td>
            <td class="p-4 text-xs uppercase text-[var(--text-secondary)]">${p.category}</td>
            <td class="p-4">Rp ${p.price.toLocaleString()}</td>
            <td class="p-4 text-center font-bold ${p.stock<=5?'text-red-500':'text-emerald-500'}">${p.stock}</td>
            <td class="p-4 text-center"><button onclick="delProd(${p.id})" class="text-red-500 hover:bg-red-500/10 p-2 rounded"><i class="fa-solid fa-trash"></i></button></td>
        </tr>`).join('');
}
