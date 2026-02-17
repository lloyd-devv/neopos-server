// --- KONFIGURASI ---
const USERS = { "admin": "123", "fatiha": "111006", "kasir1": "1" };
let CURRENT_USER = sessionStorage.getItem('username') || "";
let products = [], history = [], cart = [], payMethod = 'TUNAI', currentCategory = 'all';

// --- INIT (Saat Web Dibuka) ---
window.onload = () => {
    if(sessionStorage.getItem('isLoggedIn') === 'true' && CURRENT_USER) {
        showApp();
    }
};

// --- FUNGSI DATA (Koneksi ke Server) ---
async function loadData() {
    try {
        const response = await fetch('/api/init');
        const data = await response.json();
        products = data.products; // Data dari Neon DB
        history = data.history;   // Data dari Neon DB
        
        renderProducts();
        if(!document.getElementById('statsModal').classList.contains('hidden')) calcStats();
    } catch(e) {
        console.error("Gagal koneksi server:", e);
        Swal.fire('Error', 'Gagal memuat data dari server', 'error');
    }
}

// --- FUNGSI LOGIN ---
function handleLogin(e) {
    e.preventDefault();
    const u = document.getElementById('username').value;
    const p = document.getElementById('password').value;
    if (USERS[u] === p) {
        sessionStorage.setItem('isLoggedIn', 'true');
        sessionStorage.setItem('username', u);
        CURRENT_USER = u;
        showApp();
    } else {
        Swal.fire('Gagal', 'Username/Password Salah', 'error');
    }
}

function showApp() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
    document.getElementById('displayUsername').innerText = CURRENT_USER;
    loadData(); // Ambil data terbaru dari Cloud saat login
}

function handleLogout() {
    sessionStorage.clear();
    location.reload();
}

// --- FUNGSI PRODUK & CART ---
function setCategory(cat) {
    currentCategory = cat;
    document.querySelectorAll('.cat-pill').forEach(b => b.classList.remove('active'));
    document.getElementById(`cat-${cat}`).classList.add('active');
    renderProducts();
}

function renderProducts() {
    const grid = document.getElementById('grid');
    const s = document.getElementById('search').value.toLowerCase();
    grid.innerHTML = '';
    
    products.forEach(p => {
        if(p.name.toLowerCase().includes(s) && (currentCategory === 'all' || p.category === currentCategory)) {
            grid.innerHTML += `
            <div onclick="addToCart(${p.id})" class="product-card ${p.stock<=0?'opacity-50 grayscale':''}">
                <div class="p-icon"><i class="fa-solid ${p.icon || 'fa-box'}"></i></div>
                <div class="text-sm font-bold text-white mb-1 truncate">${p.name}</div>
                <div class="text-blue-400 font-extrabold text-xs mb-3">Rp ${p.price.toLocaleString()}</div>
                <div class="text-[10px] uppercase ${p.stock<=5?'text-red-500':'text-slate-500'}">Stok: ${p.stock}</div>
            </div>`;
        }
    });
}

function addToCart(id) {
    const p = products.find(i => i.id === id);
    if(p.stock <= 0) return Swal.fire({icon:'error', title:'Stok Habis', toast:true, position:'top-end', timer:1000, showConfirmButton:false});
    
    const ex = cart.find(i => i.id === id);
    if(ex) {
        if(ex.qty < p.stock) ex.qty++; 
        else return Swal.fire({icon:'warning', title:'Mencapai Batas Stok', toast:true, position:'top-end'});
    } else {
        cart.push({...p, qty: 1});
    }
    renderCart();
}

function renderCart() {
    const l = document.getElementById('cartList');
    l.innerHTML = '';
    let t = 0;
    cart.forEach((item, i) => {
        t += item.price * item.qty;
        l.innerHTML += `
        <div class="cart-item">
            <div><h4 class="text-xs font-bold text-white">${item.name}</h4><p class="text-[10px] text-slate-500">${item.qty} x ${item.price.toLocaleString()}</p></div>
            <button onclick="cart.splice(${i},1);renderCart()" class="text-red-500 w-8 h-8 rounded-full hover:bg-red-500/10"><i class="fa-solid fa-trash-can text-xs"></i></button>
        </div>`;
    });
    document.getElementById('totalDisplay').innerText = `Rp ${t.toLocaleString()}`;
    document.getElementById('cartCount').innerText = `${cart.length} Item`;
    return t;
}

// --- FUNGSI CHECKOUT (TRANSAKSI) ---
function checkout() {
    const t = renderCart();
    if(t === 0) return Swal.fire('Info', 'Keranjang Kosong', 'info');
    
    // Konfirmasi Pembayaran
    Swal.fire({
        title: 'Total: Rp ' + t.toLocaleString(),
        text: 'Masukkan nominal pembayaran',
        input: 'number',
        background: '#1e293b', color: '#fff',
        confirmButtonText: 'BAYAR',
        showCancelButton: true
    }).then(r => {
        if(r.isConfirmed) {
            const bayar = parseInt(r.value);
            if(bayar < t) return Swal.fire('Error', 'Uang Kurang!', 'error');
            processTrx(t, bayar, bayar - t);
        }
    });
}

async function processTrx(total, bayar, kembali) {
    // Siapkan Data untuk dikirim ke Server
    const trxData = {
        id: 'INV-' + Date.now().toString().slice(-6),
        date: new Date().toISOString(),
        items: cart,
        total, method: payMethod, cashier: CURRENT_USER
    };

    // KIRIM KE SERVER (Fetch API)
    try {
        const res = await fetch('/api/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(trxData)
        });

        if(res.ok) {
            // Jika sukses, cetak struk & refresh data
            printStruk(trxData, total, bayar, kembali);
            cart = [];
            renderCart();
            loadData(); // REFRESH STOK DARI SERVER
        } else {
            Swal.fire('Gagal', 'Transaksi gagal disimpan', 'error');
        }
    } catch(e) {
        Swal.fire('Offline', 'Koneksi terputus', 'error');
    }
}

function printStruk(trx, total, bayar, kembali) {
    document.getElementById('p-kasir').innerText = CURRENT_USER.toUpperCase();
    document.getElementById('p-date').innerText = new Date().toLocaleString();
    document.getElementById('p-no').innerText = trx.id;
    let html = '';
    trx.items.forEach(i => {
        html += `<tr><td colspan="2" style="font-weight:bold">${i.name}</td></tr>
                 <tr><td>${i.qty} x ${i.price}</td><td class="text-right">${i.qty*i.price}</td></tr>`;
    });
    document.getElementById('p-items-table').innerHTML = html;
    document.getElementById('p-total').innerText = total.toLocaleString();
    document.getElementById('p-pay').innerText = bayar.toLocaleString();
    document.getElementById('p-kembali').innerText = kembali.toLocaleString();
    
    Swal.fire({icon:'success', title:'Berhasil', timer:1000, showConfirmButton:false}).then(() => {
        window.print();
    });
}

// --- MANAJEMEN STOK (MODAL) ---
function openStockModal() { 
    document.getElementById('stockModal').classList.remove('hidden'); 
    renderStockTable(); 
}

function renderStockTable() {
    const tb = document.getElementById('stockTableBody'); 
    tb.innerHTML = products.map(p => `
        <tr class="border-b border-slate-800">
            <td class="p-3 text-white">${p.name}</td>
            <td class="p-3">Rp ${p.price}</td>
            <td class="p-3">${p.stock}</td>
            <td class="p-3 text-center">
                <button onclick="deleteProduct(${p.id})" class="text-red-400"><i class="fa-solid fa-trash-can"></i></button>
            </td>
        </tr>
    `).join('');
}

async function addNewProduct() {
    const n = document.getElementById('newName').value;
    const pr = document.getElementById('newPrice').value;
    const st = document.getElementById('newStock').value;
    const c = document.getElementById('newCategory').value;
    
    if(!n || !pr) return;

    // Kirim data produk baru ke Server
    try {
        await fetch('/api/products', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                name: n, price: parseInt(pr), stock: parseInt(st)||0, category: c, icon: 'fa-box'
            })
        });
        document.getElementById('newName').value = '';
        loadData(); // Refresh list produk
        renderStockTable();
    } catch(e) {
        alert('Gagal tambah produk');
    }
}

async function deleteProduct(id) {
    if(!confirm('Hapus produk ini?')) return;
    try {
        await fetch(`/api/products/${id}`, { method: 'DELETE' });
        loadData();
        renderStockTable();
    } catch(e) { alert('Gagal hapus'); }
}