// GANTI SELURUH ISI FILE INI
const USERS = { "admin": "123", "fatiha": "111", "kasir": "1" };
let products = [], history = [], cart = [], payMethod = 'TUNAI';
let salesChart = null;

// --- INIT ---
window.onload = () => {
    if(sessionStorage.getItem('isLoggedIn')) {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        loadData();
    }
};

// --- RESPONSIVE UI LOGIC ---
function toggleSidebar() {
    const sb = document.getElementById('sidebar');
    const ov = document.getElementById('sidebar-overlay');
    // Cek apakah class -translate-x-full ada
    if(sb.classList.contains('-translate-x-full')) {
        sb.classList.remove('-translate-x-full');
        ov.classList.remove('hidden');
    } else {
        sb.classList.add('-translate-x-full');
        ov.classList.add('hidden');
    }
}

function toggleMobileCart() {
    const modal = document.getElementById('mobile-cart-modal');
    modal.classList.toggle('hidden');
}

// --- LOGIN ---
function handleLogin(e) {
    e.preventDefault();
    const u = document.getElementById('username').value;
    const p = document.getElementById('password').value;
    if(USERS[u] === p) {
        sessionStorage.setItem('isLoggedIn', 'true');
        sessionStorage.setItem('username', u);
        location.reload();
    } else {
        Swal.fire({icon:'error', title:'Gagal', text:'Username/Password Salah', timer:1500, showConfirmButton:false});
    }
}

function handleLogout() {
    sessionStorage.clear();
    location.reload();
}

function updatePayBtn(btn) {
    document.querySelectorAll('.pay-btn').forEach(b => {
        b.classList.remove('active', 'ring-2', 'ring-blue-500', 'bg-slate-700');
        b.classList.add('bg-slate-800');
    });
    // Update semua tombol (baik di desktop maupun mobile modal)
    const method = btn.innerText.includes('QRIS') ? 'QRIS' : 'TUNAI';
    payMethod = method;
    
    // Cari tombol yang sesuai di semua tempat dan highlight
    document.querySelectorAll('.pay-btn').forEach(b => {
        if(b.innerText.includes(method)) {
            b.classList.remove('bg-slate-800');
            b.classList.add('active', 'ring-2', 'ring-blue-500', 'bg-slate-700');
        }
    });
}

// --- DATA ---
async function loadData() {
    try {
        const res = await fetch('/api/init');
        const data = await res.json();
        products = Array.isArray(data.products) ? data.products : [];
        history = Array.isArray(data.history) ? data.history : [];
        renderProducts();
        if(!document.getElementById('statsModal').classList.contains('hidden')) calcStats();
    } catch(e) { console.error(e); products=[]; history=[]; }
}

// --- RENDER PRODUK ---
function renderProducts() {
    const grid = document.getElementById('grid');
    const s = document.getElementById('search').value.toLowerCase();
    
    if(!products || products.length === 0) {
        grid.innerHTML = '<div class="col-span-full text-center text-slate-500 mt-10">Data Kosong...</div>';
        return;
    }

    grid.innerHTML = products.map(p => {
        if(p.name && !p.name.toLowerCase().includes(s)) return '';
        const activeCat = document.querySelector('.cat-pill.active')?.innerText.toLowerCase();
        
        if(activeCat === 'makanan' && p.category !== 'food') return '';
        if(activeCat === 'minuman' && p.category !== 'drink') return '';
        if(activeCat === 'cemilan' && p.category !== 'snack') return '';

        return `
        <div onclick="addToCart(${p.id})" class="bg-slate-800 p-3 md:p-4 rounded-2xl cursor-pointer hover:bg-slate-700 transition border border-slate-700 hover:border-blue-500 group relative overflow-hidden ${p.stock<=0?'opacity-50 grayscale':''}">
            <div class="flex justify-between items-start mb-2 md:mb-3">
                <div class="w-8 h-8 md:w-10 md:h-10 rounded-full bg-slate-900 flex items-center justify-center text-blue-500 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <i class="fa-solid ${p.icon || 'fa-box'} text-xs md:text-sm"></i>
                </div>
                <span class="text-[9px] md:text-[10px] font-bold px-2 py-1 rounded bg-slate-900 ${p.stock<=5?'text-red-500':'text-emerald-500'}">
                    ${p.stock}
                </span>
            </div>
            <div class="font-bold text-white mb-0.5 truncate text-xs md:text-sm">${p.name}</div>
            <div class="text-blue-400 font-black text-[10px] md:text-xs">Rp ${p.price.toLocaleString()}</div>
        </div>`;
    }).join('');
}

// --- CART ---
function addToCart(id) {
    const p = products.find(i => i.id === id);
    if(p.stock <= 0) return Swal.fire({icon:'warning', title:'Habis', toast:true, position:'top-end', timer:1000, showConfirmButton:false});
    
    const ex = cart.find(i => i.id === id);
    if(ex) {
        if(ex.qty < p.stock) ex.qty++; else return Swal.fire({icon:'warning', title:'Max Stok', toast:true, position:'top-end', timer:1000, showConfirmButton:false});
    } else {
        cart.push({...p, qty: 1});
    }
    renderCart();
}

function renderCart() {
    // Render di 2 tempat: Desktop Sidebar & Mobile Modal
    const containers = [document.getElementById('cartList'), document.getElementById('mobileCartList')];
    let t = 0;
    
    containers.forEach(l => {
        if(!l) return;
        if(cart.length === 0) {
            l.innerHTML = '<div class="text-center text-xs text-slate-600 mt-10 italic">Keranjang Kosong</div>';
        } else {
            l.innerHTML = cart.map((item, i) => {
                // Hitung total hanya sekali (di loop pertama)
                if(l === containers[0]) t += item.price * item.qty;
                
                return `
                <div class="flex justify-between items-center bg-slate-800 p-3 rounded-xl border border-slate-700 mb-2">
                    <div>
                        <div class="font-bold text-xs text-white">${item.name}</div>
                        <div class="text-[10px] text-slate-400">${item.qty} x ${item.price.toLocaleString()}</div>
                    </div>
                    <button onclick="cart.splice(${i},1);renderCart()" class="text-red-500 w-8 h-8 rounded-lg hover:bg-red-500/20 flex items-center justify-center transition"><i class="fa-solid fa-trash-can text-xs"></i></button>
                </div>`;
            }).join('');
        }
    });

    // Update Display Harga (Desktop & Mobile)
    document.getElementById('totalDisplay').innerText = 'Rp ' + t.toLocaleString();
    document.getElementById('mobileTotalDisplay').innerText = 'Rp ' + t.toLocaleString();
    
    // Update Badge Count
    document.getElementById('cartCount').innerText = cart.length;
    document.getElementById('mobileCartCount').innerText = cart.length;

    return t;
}

// --- CHECKOUT ---
async function checkout() {
    const t = renderCart(); // Hitung ulang total
    if(t === 0) return Swal.fire('Info', 'Pilih barang dulu', 'info');
    
    // Tutup modal mobile jika terbuka
    document.getElementById('mobile-cart-modal').classList.add('hidden');

    Swal.fire({
        title: 'Total: Rp ' + t.toLocaleString(),
        text: 'Metode: ' + payMethod,
        input: 'number',
        inputPlaceholder: 'Nominal Bayar',
        background: '#1e293b', color: '#fff',
        confirmButtonText: 'BAYAR & CETAK',
        showCancelButton: true,
        confirmButtonColor: '#2563eb'
    }).then(async r => {
        if(r.isConfirmed) {
            const bayar = parseInt(r.value);
            if(!bayar || bayar < t) return Swal.fire('Error', 'Uang Kurang!', 'error');

            const kembali = bayar - t;
            const trx = {
                id: 'INV-' + Date.now().toString().slice(-6),
                date: new Date().toISOString(),
                cashier: sessionStorage.getItem('username') || 'Admin',
                total: t, method: payMethod, items: cart
            };

            Swal.fire({title: 'Memproses...', didOpen: () => Swal.showLoading()});

            try {
                const res = await fetch('/api/checkout', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(trx)
                });
                
                if(res.ok) {
                    // ISI DATA STRUK
                    document.getElementById('p-no').innerText = trx.id;
                    document.getElementById('p-date').innerText = new Date().toLocaleString('id-ID');
                    document.getElementById('p-items-table').innerHTML = cart.map(i => `
                        <tr><td style="padding:2px 0; font-weight:bold">${i.name}</td></tr>
                        <tr>
                            <td style="padding:2px 0; border-bottom:1px dashed #ccc; display:flex; justify-content:space-between">
                                <span>${i.qty} x ${i.price.toLocaleString()}</span>
                                <span>${(i.qty * i.price).toLocaleString()}</span>
                            </td>
                        </tr>
                    `).join('');

                    document.getElementById('print-footer').innerHTML = `
                        <div class="flex justify-between font-bold text-xs"><span>TOTAL</span><span>Rp ${t.toLocaleString()}</span></div>
                        <div class="flex justify-between text-[10px]"><span>TUNAI (${payMethod})</span><span>Rp ${bayar.toLocaleString()}</span></div>
                        <div class="flex justify-between text-[10px]"><span>KEMBALI</span><span>Rp ${kembali.toLocaleString()}</span></div>
                    `;
                    
                    cart = []; renderCart(); await loadData();
                    Swal.close();
                    setTimeout(() => window.print(), 500);
                } else { throw new Error('Server error'); }
            } catch(e) { Swal.fire('Error', 'Gagal Transaksi', 'error'); }
        }
    });
}

// --- STOK & EDIT ---
async function addNewProduct() {
    const n = document.getElementById('newName').value;
    const p = document.getElementById('newPrice').value;
    const s = document.getElementById('newStock').value;
    const c = document.getElementById('newCategory').value;
    if(n && p) {
        try {
            await fetch('/api/products', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({name:n, price:p, stock:s, category:c, icon:'fa-box'})
            });
            document.getElementById('newName').value = '';
            document.getElementById('newPrice').value = '';
            document.getElementById('newStock').value = '';
            loadData(); renderStockTable();
            Swal.fire({icon: 'success', title: 'Produk Ditambah', toast: true, position: 'top-end', timer: 1500, showConfirmButton: false});
        } catch(e) { Swal.fire('Error', 'Gagal', 'error'); }
    }
}

function openStockModal() {
    document.getElementById('stockModal').classList.remove('hidden');
    renderStockTable();
}

function renderStockTable() {
    const tbody = document.getElementById('stockTableBody');
    if(!products.length) return tbody.innerHTML = '<tr><td colspan="4" class="text-center p-4">Kosong</td></tr>';
    
    tbody.innerHTML = products.map(p => `
        <tr class="border-b border-slate-800 hover:bg-slate-800">
            <td class="p-3 text-white">
                <div class="font-bold">${p.name}</div>
                <div class="text-[10px] text-slate-500 uppercase">${p.category}</div>
            </td>
            <td class="p-3 text-slate-400">Rp ${p.price.toLocaleString()}</td>
            <td class="p-3 font-bold ${p.stock<=5?'text-red-500':'text-emerald-500'}">${p.stock}</td>
            <td class="p-3 text-center flex justify-center gap-2">
                <button onclick="editProduct(${p.id})" class="text-blue-400 w-8 h-8 rounded hover:bg-slate-700 flex items-center justify-center"><i class="fa-solid fa-pen-to-square"></i></button>
                <button onclick="delProd(${p.id})" class="text-red-500 w-8 h-8 rounded hover:bg-slate-700 flex items-center justify-center"><i class="fa-solid fa-trash-can"></i></button>
            </td>
        </tr>
    `).join('');
}

async function editProduct(id) {
    const p = products.find(i => i.id === id);
    if(!p) return;
    const { value: f } = await Swal.fire({
        title: 'Edit Produk',
        html: `
            <input id="sw-n" class="swal2-input" value="${p.name}" placeholder="Nama">
            <input id="sw-p" type="number" class="swal2-input" value="${p.price}" placeholder="Harga">
            <input id="sw-s" type="number" class="swal2-input" value="${p.stock}" placeholder="Stok">
            <select id="sw-c" class="swal2-input">
                <option value="food" ${p.category==='food'?'selected':''}>Makanan</option>
                <option value="drink" ${p.category==='drink'?'selected':''}>Minuman</option>
                <option value="snack" ${p.category==='snack'?'selected':''}>Cemilan</option>
            </select>
        `,
        focusConfirm: false, showCancelButton: true, confirmButtonText: 'Simpan',
        preConfirm: () => ({
            name: document.getElementById('sw-n').value,
            price: document.getElementById('sw-p').value,
            stock: document.getElementById('sw-s').value,
            category: document.getElementById('sw-c').value
        })
    });
    if(f) {
        try {
            await fetch(`/api/products/${id}`, {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(f)});
            loadData(); renderStockTable();
            Swal.fire({icon:'success', title:'Update Berhasil', toast:true, position:'top-end', timer:1500, showConfirmButton:false});
        } catch(e) { Swal.fire('Error', 'Gagal update', 'error'); }
    }
}

async function delProd(id) {
    if(confirm('Hapus produk?')) {
        await fetch(`/api/products/${id}`, {method:'DELETE'});
        loadData(); renderStockTable();
    }
}

function setCategory(cat) {
    document.querySelectorAll('.cat-pill').forEach(b => {
        b.classList.remove('active', 'bg-blue-600', 'text-white', 'border-blue-600');
        b.classList.add('bg-slate-800', 'border-slate-700', 'text-slate-400');
    });
    
    // Highlight logic
    if(cat === 'all') document.querySelectorAll('.cat-pill')[0].classList.add('active', 'bg-blue-600', 'text-white');
    if(cat === 'food') document.getElementById('cat-food').classList.add('active', 'bg-blue-600', 'text-white');
    if(cat === 'drink') document.getElementById('cat-drink').classList.add('active', 'bg-blue-600', 'text-white');
    if(cat === 'snack') document.getElementById('cat-snack').classList.add('active', 'bg-blue-600', 'text-white');
    
    renderProducts(); 
}

// --- LAPORAN ---
function showStatsModal() {
    document.getElementById('statsModal').classList.remove('hidden');
    setTimeout(calcStats, 200);
}

function calcStats() {
    if (!history || !Array.isArray(history)) return;
    let today = 0, week = 0, month = 0;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const labels = [];
    const dataSet = [0,0,0,0,0,0,0];
    
    for(let i=6; i>=0; i--) {
        const d = new Date(); d.setDate(now.getDate()-i);
        labels.push(d.toLocaleDateString('id-ID',{weekday:'short'}));
    }

    history.forEach(t => {
        try {
            if(!t.date) return;
            const d = new Date(t.date);
            const dZero = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            if(dZero.getTime() === startOfToday.getTime()) today += t.total;
            if(d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) month += t.total;
            const diffDays = Math.floor((startOfToday - dZero) / (1000 * 60 * 60 * 24));
            if(diffDays >= 0 && diffDays <= 6) {
                dataSet[6-diffDays] += t.total;
                week += t.total;
            }
        } catch(e) {}
    });

    document.getElementById('stat-today').innerText = 'Rp ' + today.toLocaleString();
    document.getElementById('stat-week').innerText = 'Rp ' + week.toLocaleString();
    document.getElementById('stat-month').innerText = 'Rp ' + month.toLocaleString();

    const tb = document.getElementById('historyTableBody');
    if(history.length === 0) {
        tb.innerHTML = '<tr><td colspan="5" class="text-center p-6 text-slate-600 italic">Belum ada transaksi</td></tr>';
    } else {
        tb.innerHTML = history.slice(0, 50).map(t => {
            let itemsText = '-';
            try {
                const items = typeof t.items === 'string' ? JSON.parse(t.items) : t.items;
                itemsText = items.map(i => `<span class="text-slate-300 font-bold">${i.name}</span> <span class="text-[10px] text-slate-500">x${i.qty}</span>`).join('<br>');
            } catch(e) {}
            return `
            <tr class="border-b border-slate-800 hover:bg-slate-800/50 transition">
                <td class="p-3 align-top">
                    <div class="text-slate-300 font-bold text-xs">${new Date(t.date).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}</div>
                    <div class="text-[10px] text-blue-500 uppercase tracking-wider">${new Date(t.date).toLocaleDateString('id-ID', {day:'numeric', month:'short'})}</div>
                    <div class="text-[9px] text-slate-600 mt-1">${t.id}</div>
                </td>
                <td class="p-3 align-top leading-tight text-xs">${itemsText}</td>
                <td class="p-3 align-top">
                    <span class="px-2 py-1 rounded text-[9px] font-bold border ${t.method==='QRIS'?'bg-purple-500/10 text-purple-400 border-purple-500/20':'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}">${t.method||'TUNAI'}</span>
                </td>
                <td class="p-3 align-top text-right font-mono font-bold text-slate-200">Rp ${t.total.toLocaleString()}</td>
                <td class="p-3 align-top text-center">
                    <button onclick="delHistory('${t.id}')" class="text-slate-600 hover:text-red-500 transition"><i class="fa-solid fa-trash-can"></i></button>
                </td>
            </tr>`;
        }).join('');
    }

    const ctx = document.getElementById('salesChart');
    if(ctx) {
        if(salesChart) salesChart.destroy();
        salesChart = new Chart(ctx.getContext('2d'), {
            type: 'bar',
            data: { labels: labels, datasets: [{ label: 'Omzet', data: dataSet, backgroundColor: '#3b82f6', borderRadius: 4, barThickness: 20 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { grid: { color: '#1e293b' }, ticks: { color: '#64748b' } }, x: { grid: { display: false }, ticks: { color: '#64748b' } } } }
        });
    }
}

async function delHistory(id) {
    const res = await Swal.fire({title:'Hapus Laporan?', text:'Data tidak bisa kembali', icon:'warning', showCancelButton:true, confirmButtonColor:'#d33', confirmButtonText:'Hapus'});
    if(res.isConfirmed) {
        await fetch(`/api/history/${id}`, {method:'DELETE'});
        loadData(); calcStats();
        Swal.fire({title:'Terhapus', icon:'success', toast:true, position:'top-end', timer:1000, showConfirmButton:false});
    }
}
