const USERS = { "admin": "123", "fatiha": "111", "kasir": "1", "mala": "02"};
let products = [], history = [], cart = [], payMethod = 'TUNAI';
let salesChart = null;

// --- INIT (Jalankan saat web dibuka) ---
window.onload = () => {
    if(sessionStorage.getItem('isLoggedIn')) {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        loadData();
    }
};

// --- LOGIN SYSTEM ---
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
    btn.classList.remove('bg-slate-800');
    btn.classList.add('active', 'ring-2', 'ring-blue-500', 'bg-slate-700');
}

// --- DATA SYNC (Sinkronisasi dengan Server) ---
async function loadData() {
    try {
        const res = await fetch('/api/init');
        const data = await res.json();
        // Pastikan data selalu array agar tidak error
        products = Array.isArray(data.products) ? data.products : [];
        history = Array.isArray(data.history) ? data.history : [];
        
        renderProducts();
        
        // Jika sedang buka laporan, refresh juga angkanya
        if(!document.getElementById('statsModal').classList.contains('hidden')) {
            calcStats();
        }
    } catch(e) { 
        console.error("Gagal load data:", e);
        products = []; history = [];
    }
}

// --- RENDER PRODUK (Tampilan Grid) ---
function renderProducts() {
    const grid = document.getElementById('grid');
    const s = document.getElementById('search').value.toLowerCase();
    
    if(!products || products.length === 0) {
        grid.innerHTML = '<div class="col-span-full text-center text-slate-500 mt-10">Data Kosong / Loading...</div>';
        return;
    }

    grid.innerHTML = products.map(p => {
        if(p.name && !p.name.toLowerCase().includes(s)) return '';
        
        // FILTER KATEGORI (TERMASUK CEMILAN)
        const activeCat = document.querySelector('.cat-pill.active')?.innerText.toLowerCase();
        
        if(activeCat === 'makanan' && p.category !== 'food') return '';
        if(activeCat === 'minuman' && p.category !== 'drink') return '';
        if(activeCat === 'cemilan' && p.category !== 'snack') return ''; // FIX CEMILAN

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

// --- KERANJANG BELANJA ---
function addToCart(id) {
    const p = products.find(i => i.id === id);
    if(p.stock <= 0) return Swal.fire({icon:'warning', title:'Stok Habis', toast:true, position:'top-end', timer:1000, showConfirmButton:false});
    
    const ex = cart.find(i => i.id === id);
    if(ex) {
        if(ex.qty < p.stock) ex.qty++; else return Swal.fire({icon:'warning', title:'Stok Maksimal', toast:true, position:'top-end', timer:1000, showConfirmButton:false});
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
        <div class="flex justify-between items-center bg-slate-800 p-3 rounded-xl border border-slate-700 mb-2">
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

// --- CHECKOUT & PRINT STRUK ---
async function checkout() {
    const t = renderCart();
    if(t === 0) return Swal.fire('Info', 'Pilih barang dulu', 'info');
    
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

            const trx = {
                id: 'INV-' + Date.now().toString().slice(-6),
                date: new Date().toISOString(),
                cashier: sessionStorage.getItem('username') || 'Admin',
                total: t, method: payMethod, items: cart
            };

            Swal.fire({title: 'Memproses...', didOpen: () => Swal.showLoading()});

            try {
                // 1. Kirim Transaksi ke Server
                const res = await fetch('/api/checkout', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(trx)
                });
                
                if(res.ok) {
                    // 2. ISI DATA STRUK (PENTING AGAR TIDAK KOSONG)
                    document.getElementById('p-no').innerText = trx.id;
                    document.getElementById('p-date').innerText = new Date().toLocaleString('id-ID');
                    
                    document.getElementById('p-items-table').innerHTML = cart.map(i => `
                        <tr><td style="padding:2px 0; font-weight:bold">${i.name}</td></tr>
                        <tr>
                            <td style="padding:2px 0; border-bottom:1px dashed #000; display:flex; justify-content:space-between">
                                <span>${i.qty} x ${i.price.toLocaleString()}</span>
                                <span>${(i.qty * i.price).toLocaleString()}</span>
                            </td>
                        </tr>
                    `).join('');

                    document.getElementById('p-total').innerText = 'Rp ' + t.toLocaleString();
                    
                    // 3. Reset Cart & Refresh Data
                    cart = []; 
                    renderCart(); 
                    await loadData(); // Ambil stok terbaru
                    
                    Swal.close();
                    
                    // 4. Print
                    setTimeout(() => window.print(), 500);
                    
                } else { throw new Error('Server error'); }
            } catch(e) {
                Swal.fire('Error', 'Gagal Transaksi (Cek Koneksi)', 'error');
            }
        }
    });
}

// --- MANAJEMEN STOK (TAMBAH, EDIT, HAPUS) ---
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
            // Reset Form
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
                <button onclick="editProduct(${p.id})" class="text-blue-400 hover:bg-blue-500/20 w-8 h-8 rounded flex items-center justify-center"><i class="fa-solid fa-pen-to-square"></i></button>
                <button onclick="delProd(${p.id})" class="text-red-500 hover:bg-red-500/20 w-8 h-8 rounded flex items-center justify-center"><i class="fa-solid fa-trash-can"></i></button>
            </td>
        </tr>
    `).join('');
}

// FUNGSI EDIT PRODUK (POPUP & PILIHAN CEMILAN)
async function editProduct(id) {
    const p = products.find(i => i.id === id);
    if(!p) return;

    const { value: formValues } = await Swal.fire({
        title: 'Edit Produk',
        html: `
            <input id="swal-name" class="swal2-input" placeholder="Nama" value="${p.name}">
            <input id="swal-price" type="number" class="swal2-input" placeholder="Harga" value="${p.price}">
            <input id="swal-stock" type="number" class="swal2-input" placeholder="Stok" value="${p.stock}">
            <select id="swal-cat" class="swal2-input">
                <option value="food" ${p.category==='food'?'selected':''}>Makanan</option>
                <option value="drink" ${p.category==='drink'?'selected':''}>Minuman</option>
                <option value="snack" ${p.category==='snack'?'selected':''}>Cemilan</option>
            </select>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Simpan',
        preConfirm: () => {
            return {
                name: document.getElementById('swal-name').value,
                price: document.getElementById('swal-price').value,
                stock: document.getElementById('swal-stock').value,
                category: document.getElementById('swal-cat').value
            }
        }
    });

    if (formValues) {
        try {
            await fetch(`/api/products/${id}`, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(formValues)
            });
            loadData(); renderStockTable();
            Swal.fire({icon:'success', title:'Data Terupdate', toast:true, position:'top-end', timer:1500, showConfirmButton:false});
        } catch (e) { Swal.fire('Error', 'Gagal update', 'error'); }
    }
}

async function delProd(id) {
    if(confirm('Hapus produk ini?')) {
        await fetch(`/api/products/${id}`, {method:'DELETE'});
        loadData(); renderStockTable();
    }
}

function setCategory(cat) {
    document.querySelectorAll('.cat-pill').forEach(b => {
        b.classList.remove('active', 'bg-blue-600', 'text-white', 'border-blue-600');
        b.classList.add('bg-slate-800', 'border-slate-700', 'text-slate-400');
    });
    
    // Logic highlight tombol (termasuk cemilan)
    if(cat === 'all') document.querySelectorAll('.cat-pill')[0].classList.add('active', 'bg-blue-600', 'text-white');
    if(cat === 'food') document.getElementById('cat-food').classList.add('active', 'bg-blue-600', 'text-white');
    if(cat === 'drink') document.getElementById('cat-drink').classList.add('active', 'bg-blue-600', 'text-white');
    if(cat === 'snack') document.getElementById('cat-snack').classList.add('active', 'bg-blue-600', 'text-white');
    
    renderProducts(); 
}

// --- LAPORAN & GRAFIK (Anti-Error) ---
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

    // RENDER TABEL (5 Kolom: Waktu, Item, Metode, Total, Aksi)
    const tb = document.getElementById('historyTableBody');
    if(history.length === 0) {
        tb.innerHTML = '<tr><td colspan="5" class="text-center p-6 text-slate-600 italic">Belum ada transaksi</td></tr>';
    } else {
        tb.innerHTML = history.slice(0, 50).map(t => {
            let itemsText = '-';
            try {
                // Parse Items JSON agar tampil nama produk
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
        loadData(); 
        calcStats(); // Refresh tabel laporan
        Swal.fire({title:'Terhapus', icon:'success', toast:true, position:'top-end', timer:1000, showConfirmButton:false});
    }
}

