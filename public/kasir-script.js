const USERS = { "roy": "123", "fatiha": "111", "mala": "1234" };
let products = [], history = [], cart = [];
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
        sessionStorage.setItem('username', u); // Simpan nama user
        location.reload();
    } else {
        Swal.fire('Gagal', 'Cek username/password', 'error');
    }
}

function handleLogout() {
    sessionStorage.clear();
    location.reload();
}

// --- DATA & SYNC ---
async function loadData() {
    try {
        const res = await fetch('/api/init');
        const data = await res.json();
        // Pastikan data selalu berupa Array agar tidak error
        products = Array.isArray(data.products) ? data.products : [];
        history = Array.isArray(data.history) ? data.history : [];
        renderProducts();
    } catch(e) { 
        console.error("Gagal load data:", e);
        // Jika gagal, set array kosong agar web tidak blank
        products = [];
        history = [];
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
        return `
        <div onclick="addToCart(${p.id})" class="bg-slate-800 p-4 rounded-xl cursor-pointer hover:bg-slate-700 transition border border-slate-700 hover:border-blue-500 ${p.stock<=0?'opacity-50 grayscale':''}">
            <div class="flex justify-between items-start mb-2">
                <div class="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-blue-500"><i class="fa-solid fa-box"></i></div>
                <span class="text-[10px] font-bold ${p.stock<=5?'text-red-500':'text-emerald-500'}">${p.stock} Stok</span>
            </div>
            <div class="font-bold text-white mb-1 truncate text-sm">${p.name}</div>
            <div class="text-blue-400 font-bold text-xs">Rp ${p.price.toLocaleString()}</div>
        </div>`;
    }).join('');
}

// --- CART & TRANSAKSI ---
function addToCart(id) {
    const p = products.find(i => i.id === id);
    if(p.stock <= 0) return Swal.fire({icon: 'warning', title: 'Stok Habis', toast: true, position: 'top-end', showConfirmButton: false, timer: 1500});
    
    const ex = cart.find(i => i.id === id);
    if(ex) {
        if(ex.qty < p.stock) ex.qty++; 
        else return Swal.fire({icon: 'warning', title: 'Stok Maksimal', toast: true, position: 'top-end', showConfirmButton: false, timer: 1500});
    } else {
        cart.push({...p, qty: 1});
    }
    renderCart();
}

function renderCart() {
    const l = document.getElementById('cartList');
    let t = 0;
    
    if(cart.length === 0) {
        l.innerHTML = '<div class="text-center text-xs text-slate-500 mt-4">Keranjang Kosong</div>';
        document.getElementById('totalDisplay').innerText = '0';
        return 0;
    }

    l.innerHTML = cart.map((item, i) => {
        t += item.price * item.qty;
        return `
        <div class="flex justify-between items-center bg-slate-800 p-3 rounded-lg border border-slate-700 mb-2">
            <div>
                <div class="font-bold text-xs text-white">${item.name}</div>
                <div class="text-[10px] text-slate-400">${item.qty} x ${item.price.toLocaleString()}</div>
            </div>
            <button onclick="cart.splice(${i},1);renderCart()" class="text-red-500 hover:text-red-300"><i class="fa-solid fa-trash"></i></button>
        </div>`;
    }).join('');
    
    document.getElementById('totalDisplay').innerText = 'Rp ' + t.toLocaleString();
    return t;
}

async function checkout() {
    const t = renderCart();
    if(t === 0) return Swal.fire('Info', 'Pilih barang dulu', 'info');
    
    Swal.fire({
        title: 'Total: Rp ' + t.toLocaleString(),
        text: 'Masukkan Pembayaran:',
        input: 'number',
        background: '#1e293b', color: '#fff',
        confirmButtonText: 'BAYAR',
        showCancelButton: true
    }).then(async r => {
        if(r.isConfirmed) {
            const bayar = parseInt(r.value);
            if(bayar < t) return Swal.fire('Kurang', 'Uang pembayaran kurang!', 'error');

            const trx = {
                id: 'INV-' + Date.now().toString().slice(-6),
                date: new Date().toISOString(),
                cashier: sessionStorage.getItem('username') || 'Admin',
                total: t, method: 'TUNAI', items: cart
            };

            // Loading state
            Swal.fire({title: 'Memproses...', didOpen: () => Swal.showLoading()});

            try {
                await fetch('/api/checkout', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(trx)
                });

                // Cetak Struk
                document.getElementById('p-no').innerText = trx.id;
                document.getElementById('p-date').innerText = new Date().toLocaleString();
                document.getElementById('p-total').innerText = t.toLocaleString();
                document.getElementById('p-items-table').innerHTML = cart.map(i => 
                    `<tr><td>${i.name}</td><td class="text-right">${(i.qty*i.price).toLocaleString()}</td></tr>`
                ).join('');
                
                cart = []; renderCart(); loadData();
                Swal.close();
                window.print();

            } catch(e) {
                Swal.fire('Error', 'Gagal menyimpan transaksi. Cek internet.', 'error');
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
            
            // Reset form
            document.getElementById('newName').value = '';
            document.getElementById('newPrice').value = '';
            document.getElementById('newStock').value = '';
            
            loadData(); renderStockTable();
            Swal.fire({icon: 'success', title: 'Produk Ditambah', toast: true, position: 'top-end', timer: 1500, showConfirmButton: false});
        } catch(e) {
            Swal.fire('Error', 'Gagal tambah produk', 'error');
        }
    }
}

function openStockModal() {
    document.getElementById('stockModal').classList.remove('hidden');
    renderStockTable();
}

function renderStockTable() {
    const tbody = document.getElementById('stockTableBody');
    if(!products.length) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center p-4">Belum ada data</td></tr>';
        return;
    }
    tbody.innerHTML = products.map(p => `
        <tr class="border-b border-slate-800">
            <td class="py-2 text-white">${p.name}</td>
            <td>${p.stock}</td>
            <td><button onclick="delProd(${p.id})" class="text-red-500"><i class="fa-solid fa-trash"></i></button></td>
        </tr>
    `).join('');
}

async function delProd(id) {
    if(confirm('Hapus produk ini?')) {
        await fetch(`/api/products/${id}`, {method:'DELETE'});
        loadData(); renderStockTable();
    }
}

function setCategory(cat) {
    document.querySelectorAll('.cat-pill').forEach(b => b.classList.remove('bg-blue-600', 'text-white'));
    if(cat !== 'all') document.getElementById('cat-'+cat).classList.add('bg-blue-600', 'text-white');
    // Implementasi filter kategori di renderProducts jika diperlukan
    renderProducts();
}

// --- LAPORAN (PERBAIKAN ANTI-ERROR) ---
function showStatsModal() {
    document.getElementById('statsModal').classList.remove('hidden');
    // Beri sedikit delay agar modal muncul dulu baru render chart
    setTimeout(calcStats, 100);
}

function calcStats() {
    // 1. Cek Keamanan Data
    if (!history || !Array.isArray(history)) {
        console.warn("Data history belum siap");
        return;
    }

    let today = 0, week = 0, month = 0;
    const now = new Date();
    // Reset jam hari ini ke 00:00 agar akurat
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const labels = [];
    const dataSet = [0,0,0,0,0,0,0];

    // Buat label H-6 s/d Hari ini
    for(let i=6; i>=0; i--) {
        const d = new Date(); 
        d.setDate(now.getDate()-i);
        labels.push(d.toLocaleDateString('id-ID',{weekday:'short'}));
    }

    // Loop semua transaksi dengan Aman (Try-Catch)
    history.forEach(t => {
        try {
            if(!t.date) return; // Skip jika tanggal kosong

            const d = new Date(t.date); // Convert tanggal database
            const dZero = new Date(d.getFullYear(), d.getMonth(), d.getDate()); // Tanggal saja tanpa jam

            // Hitung Hari Ini
            if(dZero.getTime() === startOfToday.getTime()) today += t.total;
            
            // Hitung Bulan Ini
            if(d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) month += t.total;
            
            // Hitung Grafik (7 Hari Terakhir)
            const diffTime = startOfToday - dZero;
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            
            if(diffDays >= 0 && diffDays <= 6) {
                dataSet[6-diffDays] += t.total; // Masukkan ke grafik
                week += t.total; // Tambah ke omzet mingguan
            }
        } catch (err) {
            console.error("Error menghitung transaksi:", err);
        }
    });

    // Tampilkan Angka
    document.getElementById('stat-today').innerText = 'Rp ' + today.toLocaleString();
    document.getElementById('stat-week').innerText = 'Rp ' + week.toLocaleString();
    document.getElementById('stat-month').innerText = 'Rp ' + month.toLocaleString();

    // Render Tabel (Maksimal 20 data terakhir)
    const tableBody = document.getElementById('historyTableBody');
    if (history.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="3" class="text-center p-4">Belum ada transaksi</td></tr>';
    } else {
        tableBody.innerHTML = history.slice(0, 20).map(t => `
            <tr class="border-b border-slate-800 text-[11px] hover:bg-slate-800">
                <td class="py-3">${new Date(t.date).toLocaleString('id-ID')}</td>
                <td class="uppercase text-blue-400 font-bold">${t.cashier || '-'}</td>
                <td class="text-right text-emerald-400 font-bold">Rp ${t.total.toLocaleString()}</td>
            </tr>
        `).join('');
    }

    // Render Chart (Dengan pengecekan Canvas)
    const ctx = document.getElementById('salesChart');
    if (ctx) {
        if(salesChart) salesChart.destroy(); // Hapus chart lama agar tidak error
        
        salesChart = new Chart(ctx.getContext('2d'), {
            type: 'bar', // Ganti jadi Bar Chart agar lebih jelas
            data: {
                labels: labels,
                datasets: [{
                    label: 'Omzet',
                    data: dataSet,
                    backgroundColor: '#3b82f6',
                    borderRadius: 4
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { grid: { color: '#1e293b' }, ticks: { color: '#94a3b8' } },
                    x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
                }
            }
        });
    }
}
