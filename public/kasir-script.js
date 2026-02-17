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
        Swal.fire({icon:'error', title:'Gagal', text:'Cek username/password', timer:1500, showConfirmButton:false});
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
    btn.classList.remove('bg-slate-800');
    btn.classList.add('active', 'ring-2', 'ring-blue-500', 'bg-slate-700');
}

// --- DATA SYNC (BACKEND) ---
async function loadData() {
    try {
        const res = await fetch('/api/init');
        const data = await res.json();
        products = Array.isArray(data.products) ? data.products : [];
        history = Array.isArray(data.history) ? data.history : [];
        renderProducts();
    } catch(e) { 
        console.error("Gagal load data:", e);
        products = []; history = [];
    }
}

// --- RENDER PRODUK ---
function renderProducts() {
    const grid = document.getElementById('grid');
    const s = document.getElementById('search').value.toLowerCase();
    
    if(!products || products.length === 0) {
        grid.innerHTML = '<div class="col-span-full text-center text-slate-500 mt-10">Belum ada produk. Tambahkan di menu Stok.</div>';
        return;
    }

    grid.innerHTML = products.map(p => {
        if(p.name && !p.name.toLowerCase().includes(s)) return '';
        // Filter Kategori (Logic sederhana: cek class button aktif)
        const activeCat = document.querySelector('.cat-pill.bg-blue-600')?.id;
        if(activeCat === 'cat-food' && p.category !== 'food') return '';
        if(activeCat === 'cat-drink' && p.category !== 'drink') return '';

        return `
        <div onclick="addToCart(${p.id})" class="bg-slate-800 p-4 rounded-2xl cursor-pointer hover:bg-slate-700 transition border border-slate-700 hover:border-blue-500 group relative overflow-hidden ${p.stock<=0?'opacity-50 grayscale':''}">
            <div class="flex justify-between items-start mb-3">
                <div class="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center text-blue-500 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <i class="fa-solid ${p.icon || 'fa-box'}"></i>
                </div>
                <span class="text-[10px] font-bold px-2 py-1 rounded bg-slate-900 ${p.stock<=5?'text-red-500':'text-emerald-500'}">
                    ${p.stock}
                </span>
            </div>
            <div class="font-bold text-white mb-1 truncate text-sm">${p.name}</div>
            <div class="text-blue-400 font-black text-xs">Rp ${p.price.toLocaleString()}</div>
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
    const l = document.getElementById('cartList');
    let t = 0;
    
    if(cart.length === 0) {
        l.innerHTML = '<div class="text-center text-xs text-slate-600 mt-10 italic">Keranjang Kosong</div>';
        document.getElementById('totalDisplay').innerText = 'Rp 0';
        document.getElementById('cartCount').innerText = '0';
        return 0;
    }

    l.innerHTML = cart.map((item, i) => {
        t += item.price * item.qty;
        return `
        <div class="flex justify-between items-center bg-slate-800 p-3 rounded-xl border border-slate-700 mb-2 group">
            <div>
                <div class="font-bold text-xs text-white">${item.name}</div>
                <div class="text-[10px] text-slate-400">${item.qty} x ${item.price.toLocaleString()}</div>
            </div>
            <button onclick="cart.splice(${i},1);renderCart()" class="text-red-500 w-8 h-8 rounded-lg hover:bg-red-500/20 flex items-center justify-center transition"><i class="fa-solid fa-trash-can text-xs"></i></button>
        </div>`;
    }).join('');
    
    document.getElementById('totalDisplay').innerText = 'Rp ' + t.toLocaleString();
    document.getElementById('cartCount').innerText = cart.length;
    return t;
}

// --- CHECKOUT ---
async function checkout() {
    const t = renderCart();
    if(t === 0) return Swal.fire('Info', 'Pilih barang dulu', 'info');
    
    Swal.fire({
        title: 'Total: Rp ' + t.toLocaleString(),
        text: 'Metode: ' + payMethod,
        input: 'number',
        inputPlaceholder: 'Masukkan Nominal Bayar',
        background: '#1e293b', color: '#fff',
        confirmButtonText: 'BAYAR & CETAK',
        showCancelButton: true,
        confirmButtonColor: '#2563eb'
    }).then(async r => {
        if(r.isConfirmed) {
            const bayar = parseInt(r.value);
            if(bayar < t) return Swal.fire('Error', 'Uang Kurang!', 'error');

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
                    // Print Struk
                    document.getElementById('p-no').innerText = trx.id;
                    document.getElementById('p-date').innerText = new Date().toLocaleString();
                    document.getElementById('p-total').innerText = t.toLocaleString();
                    document.getElementById('p-items-table').innerHTML = cart.map(i => 
                        `<tr><td>${i.name}</td><td class="text-right">${(i.qty*i.price).toLocaleString()}</td></tr>`
                    ).join('');
                    
                    cart = []; renderCart(); loadData();
                    Swal.close();
                    window.print();
                } else { throw new Error('Server error'); }
            } catch(e) {
                Swal.fire('Error', 'Gagal Transaksi (Cek Koneksi)', 'error');
            }
        }
    });
}

// --- MANAJEMEN STOK ---
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
            <td class="p-3 text-white font-bold">${p.name}</td>
            <td class="p-3 text-slate-400">Rp ${p.price.toLocaleString()}</td>
            <td class="p-3 ${p.stock<=5?'text-red-500':'text-emerald-500'} font-bold">${p.stock}</td>
            <td class="p-3 text-center"><button onclick="delProd(${p.id})" class="text-red-500 hover:text-red-300"><i class="fa-solid fa-trash-can"></i></button></td>
        </tr>
    `).join('');
}

async function delProd(id) {
    if(confirm('Hapus produk?')) {
        await fetch(`/api/products/${id}`, {method:'DELETE'});
        loadData(); renderStockTable();
    }
}

// --- KATEGORI ---
function setCategory(cat) {
    document.querySelectorAll('.cat-pill').forEach(b => {
        b.classList.remove('active', 'bg-blue-600', 'text-white', 'border-blue-600');
        b.classList.add('bg-slate-800', 'border-slate-700', 'text-slate-400');
    });
    
    const btn = cat === 'all' ? document.querySelector('.cat-pill') : document.getElementById('cat-'+cat);
    if(btn) {
        btn.classList.remove('bg-slate-800', 'border-slate-700', 'text-slate-400');
        btn.classList.add('active', 'bg-blue-600', 'text-white', 'border-blue-600');
    }
    
    // Force re-render dengan filter baru
    const searchInput = document.getElementById('search'); 
    renderProducts(); 
}


// --- LAPORAN (ANTI-ERROR & 5 KOLOM) ---
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
        } catch (e) {}
    });

    document.getElementById('stat-today').innerText = 'Rp ' + today.toLocaleString();
    document.getElementById('stat-week').innerText = 'Rp ' + week.toLocaleString();
    document.getElementById('stat-month').innerText = 'Rp ' + month.toLocaleString();

    // RENDER TABEL LENGKAP
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

    // CHART
    const ctx = document.getElementById('salesChart');
    if(ctx) {
        if(salesChart) salesChart.destroy();
        salesChart = new Chart(ctx.getContext('2d'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Omzet', data: dataSet, backgroundColor: '#3b82f6', borderRadius: 4, barThickness: 20
                }]
            },
            options: { 
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { grid: { color: '#1e293b' }, ticks: { color: '#64748b' } }, x: { grid: { display: false }, ticks: { color: '#64748b' } } }
            }
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
