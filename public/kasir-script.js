const USERS = { "admin": "123", "manager": "09876543211234567890" };
const MANAGER_PIN = "9999";
let products = [], history = [], cart = [], payMethod = 'TUNAI';
let salesChart = null;

window.onload = () => {
    const t = localStorage.getItem('theme') || 'dark';
    setTheme(t);
    document.getElementById('themeSelect').value = t;

    if(sessionStorage.getItem('isLoggedIn')) {
        document.getElementById('login-screen').classList.add('hidden');
        loadData().then(() => nav('dashboard'));
    }
};

function toggleSidebar() {
    const sb = document.getElementById('sidebar');
    sb.classList.toggle('-translate-x-full');
}

function nav(pageId) {
    document.querySelectorAll('.page-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById('page-' + pageId).classList.remove('hidden');
    document.getElementById('nav-' + pageId)?.classList.add('active');
    
    if(window.innerWidth < 768) document.getElementById('sidebar').classList.add('-translate-x-full');

    if(pageId === 'dashboard') calcDashboard();
    if(pageId === 'stock') renderStockTable();
    if(pageId === 'history') renderHistoryTable();
}

function setTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
}

function handleLogin(e) {
    e.preventDefault();
    const u = document.getElementById('username').value.trim();
    const p = document.getElementById('password').value.trim();
    if(USERS[u] && USERS[u] === p) {
        sessionStorage.setItem('isLoggedIn', 'true');
        location.reload();
    } else Swal.fire('Error', 'Login Gagal', 'error');
}
function handleLogout() { sessionStorage.clear(); location.reload(); }

async function loadData() {
    try {
        const res = await fetch('/api/init');
        if(!res.ok) throw new Error("Gagal");
        const d = await res.json();
        products = d.products || [];
        history = d.history || [];
        renderProducts();
    } catch(e) { console.error(e); }
}

// --- POS SYSTEM ---
function renderProducts() {
    const s = document.getElementById('search').value.toLowerCase();
    const cat = document.querySelector('.cat-pill.active')?.innerText.toLowerCase() || 'semua';
    const grid = document.getElementById('grid');
    
    const filtered = products.filter(p => {
        if(p.name && !p.name.toLowerCase().includes(s)) return false;
        if(cat!=='semua' && ((cat.includes('makanan')&&p.category!=='food')||(cat.includes('minuman')&&p.category!=='drink')||(cat.includes('cemilan')&&p.category!=='snack'))) return false;
        return true;
    });

    if(filtered.length === 0) {
        grid.innerHTML = '<div class="col-span-full text-center text-[var(--text-muted)] mt-10">Produk tidak ditemukan</div>';
        return;
    }

    grid.innerHTML = filtered.map(p => `
        <div onclick="addToCart(${p.id})" class="card p-0 cursor-pointer hover:border-[var(--accent)] transition group relative overflow-hidden flex flex-col h-[200px] shadow-sm ${p.stock<=0?'opacity-50 grayscale':''}">
            <div class="p-3 flex justify-between items-start">
                <div class="w-8 h-8 rounded-lg bg-[var(--bg-input)] flex items-center justify-center text-[var(--accent)] group-hover:bg-[var(--accent)] group-hover:text-white transition"><i class="fa-solid fa-utensils"></i></div>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-[var(--bg-input)] text-[var(--text-muted)]">Stok: ${p.stock}</span>
            </div>
            <div class="px-4 flex-1">
                <div class="font-bold text-sm text-[var(--text-main)] leading-tight line-clamp-2 h-[2.5em] flex items-center">${p.name}</div>
                <div class="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mt-1">${p.category}</div>
            </div>
            <div class="p-3 mt-auto bg-[var(--bg-input)]/50 border-t border-[var(--border)] flex justify-between items-center">
                <div class="text-[var(--accent)] font-bold text-sm">Rp ${p.price.toLocaleString()}</div>
                <i class="fa-solid fa-plus-circle text-[var(--text-muted)] group-hover:text-[var(--accent)] transition"></i>
            </div>
        </div>
    `).join('');
}

function setCategory(cat) {
    document.querySelectorAll('.cat-pill').forEach(b => { b.classList.remove('active','border-[var(--accent)]'); b.classList.add('border-[var(--border)]'); });
    event.currentTarget.classList.add('active','border-[var(--accent)]'); event.currentTarget.classList.remove('border-[var(--border)]');
    renderProducts();
}

function addToCart(id) {
    const p = products.find(i=>i.id===id);
    if(p.stock<=0) return Swal.fire({toast:true,position:'top-end',icon:'warning',title:'Stok Habis',showConfirmButton:false,timer:1000});
    const ex=cart.find(i=>i.id===id); if(ex){if(ex.qty<p.stock)ex.qty++;}else{cart.push({...p,qty:1});} renderCart();
}

function renderCart() {
    const list = document.getElementById('cartList');
    let sub = 0;
    if(!cart.length) list.innerHTML = '<div class="text-center text-xs opacity-50 mt-10">Keranjang Kosong</div>';
    else {
        list.innerHTML = cart.map((i,idx) => {
            sub += i.price * i.qty;
            return `<div class="flex justify-between items-center bg-[var(--bg-input)] p-2 rounded-lg mb-2 border border-[var(--border)]"><div class="text-xs"><div class="font-bold">${i.name}</div><div class="text-[var(--text-muted)]">${i.qty} x ${i.price.toLocaleString()}</div></div><button onclick="cart.splice(${idx},1);renderCart()" class="text-red-500 w-6 h-6 hover:bg-red-500/10 rounded"><i class="fa-solid fa-trash text-xs"></i></button></div>`;
        }).join('');
    }
    const disc = parseInt(document.getElementById('inputDiscount').value)||0;
    const tot = Math.max(0, sub-disc);
    document.getElementById('subtotalDisplay').innerText = 'Rp '+sub.toLocaleString();
    document.getElementById('totalDisplay').innerText = 'Rp '+tot.toLocaleString();
    document.getElementById('cartCount').innerText = cart.length;
    return tot;
}

function setPayment(m) { payMethod=m; document.querySelectorAll('.pay-btn').forEach(b=>{b.classList.remove('active','bg-[var(--accent)]','text-white','border-transparent'); if(b.innerText.includes(m)) b.classList.add('active','bg-[var(--accent)]','text-white','border-transparent');});}

async function checkout() {
    const tot = renderCart(); 
    if(tot === 0 && cart.length === 0) return Swal.fire('Ops', 'Keranjang kosong', 'info');

    let bayar = tot;
    if(payMethod === 'TUNAI') {
        const {value:u} = await Swal.fire({
            title: `Total: Rp ${tot.toLocaleString()}`, 
            input: 'number', 
            confirmButtonText: 'BAYAR & CETAK', 
            confirmButtonColor: '#3b82f6',
            inputValidator: (value) => {
                if (!value || parseInt(value) < tot) {
                    return 'Uang pembayaran kurang!'
                }
            }
        });
        
        if(!u) return; // Jika dibatalkan
        bayar = parseInt(u);
    }

    const disc = parseInt(document.getElementById('inputDiscount').value) || 0;
    const trxId = 'TRX-' + Date.now().toString().slice(-6);
    const dateNow = new Date().toLocaleString('id-ID');

    // 1. SIAPKAN DATA STRUK (PENTING: Lakukan ini SEBELUM request ke server)
    const printArea = document.getElementById('print-area');
    document.getElementById('p-no').innerText = trxId;
    document.getElementById('p-date').innerText = dateNow;
    
    // Render Item Struk
    document.getElementById('p-items').innerHTML = cart.map(i => `
        <tr>
            <td style="padding-bottom: 4px;">${i.name}</td>
            <td align="right" style="padding-bottom: 4px;">${i.qty} x ${i.price.toLocaleString()}</td>
        </tr>
    `).join('');

    // Render Footer Struk
    document.getElementById('p-footer').innerHTML = `
        <div style="display:flex;justify-content:space-between"><span>TOTAL</span><span>Rp ${(tot + disc).toLocaleString()}</span></div>
        ${disc > 0 ? `<div style="display:flex;justify-content:space-between"><span>DISKON</span><span>-Rp ${disc.toLocaleString()}</span></div>` : ''}
        <div style="display:flex;justify-content:space-between; border-top: 1px dashed black; margin-top: 4px; padding-top: 4px; font-weight: bold;">
            <span>TAGIHAN</span><span>Rp ${tot.toLocaleString()}</span>
        </div>
        <div style="display:flex;justify-content:space-between"><span>BAYAR</span><span>Rp ${bayar.toLocaleString()}</span></div>
        <div style="display:flex;justify-content:space-between"><span>KEMBALI</span><span>Rp ${(bayar - tot).toLocaleString()}</span></div>
    `;

    // 2. SIMPAN KE DATABASE (Background Process)
    const trx = {
        id: trxId, 
        date: new Date().toISOString(), 
        cashier: sessionStorage.getItem('username') || 'Admin', 
        total: tot, 
        method: payMethod, 
        items: cart, 
        discount: disc
    };

    // Tampilkan Loading
    Swal.fire({title: 'Memproses...', didOpen: () => Swal.showLoading()});

    try {
        await fetch('/api/checkout', {
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify(trx)
        });

        // 3. CETAK STRUK
        Swal.close();
        
        // Reset Keranjang DULUAN agar UI Kasir bersih
        cart = []; 
        document.getElementById('inputDiscount').value = ''; 
        renderCart(); 
        loadData();

        // Tampilkan Print Area & Cetak
        printArea.classList.remove('hidden');
        
        // Timeout penting! Memberi waktu browser me-render HTML struk sebelum dialog print muncul
        setTimeout(() => {
            window.print();
            printArea.classList.add('hidden'); // Sembunyikan lagi setelah print dialog tertutup
        }, 500);

    } catch(e) { 
        console.error(e);
        Swal.fire('Error', 'Gagal menyimpan transaksi, tapi struk akan dicoba cetak.', 'warning')
        .then(() => {
             // Tetap coba print walau DB error (opsional)
             setTimeout(() => window.print(), 500);
        });
    }
}
function calcDashboard() {
    const today = new Date().toDateString();
    let income = 0, sold = 0, count = 0;
    const dailyData = [0,0,0,0,0,0,0];
    const days = [];
    
    // Siapkan label hari untuk grafik (7 hari terakhir)
    for(let i=6; i>=0; i--) { 
        const d = new Date(); 
        d.setDate(d.getDate()-i); 
        days.push(d.toLocaleDateString('id',{weekday:'short'})); 
    }

    history.forEach(t => {
        const d = new Date(t.date);
        
        // 1. Hitung Pemasukan & Transaksi Hari Ini
        if(d.toDateString() === today) { 
            income += parseInt(t.total); 
            count++; 
            
            // --- PERBAIKAN LOGIKA ITEM TERJUAL ---
            let itemList = t.items;
            
            // Cek: Jika masih string JSON, kita parse. Jika sudah objek, biarkan.
            if (typeof itemList === 'string') {
                try { itemList = JSON.parse(itemList); } catch(e) { itemList = []; }
            }
            
            // Hitung total qty
            if (Array.isArray(itemList)) {
                itemList.forEach(i => sold += parseInt(i.qty));
            }
            // -------------------------------------
        }

        // 2. Hitung Grafik Mingguan
        const diff = Math.floor((new Date() - d) / (1000 * 60 * 60 * 24));
        if(diff >= 0 && diff <= 6) {
            dailyData[6-diff] += parseInt(t.total);
        }
    });

    // Update Tampilan Angka
    document.getElementById('dash-income').innerText = 'Rp ' + income.toLocaleString();
    document.getElementById('dash-sold').innerText = sold;
    document.getElementById('dash-trx').innerText = count;
    
    // Update List Transaksi Terakhir
    document.getElementById('dash-recent-list').innerHTML = history.slice(0, 5).map(t => `
        <div class="flex justify-between items-center p-3 bg-[var(--bg-input)] rounded-lg mb-2 border border-[var(--border)]">
            <div>
                <div class="font-bold text-xs">${t.id}</div>
                <div class="text-[10px] text-[var(--text-muted)]">${new Date(t.date).toLocaleTimeString()}</div>
            </div>
            <div class="font-bold text-[var(--accent)] text-sm">Rp ${parseInt(t.total).toLocaleString()}</div>
        </div>`).join('');

    // Update Grafik
    const ctx = document.getElementById('salesChart');
    if(salesChart) salesChart.destroy();
    
    salesChart = new Chart(ctx, {
        type: 'bar',
        data: { 
            labels: days, 
            datasets: [{ 
                label: 'Omzet', 
                data: dailyData, 
                backgroundColor: '#3b82f6', 
                borderRadius: 4 
            }] 
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { legend: { display: false } },
            scales: { 
                x: { grid: { display: false }, ticks: { color: '#64748b', font: {size: 10} } }, 
                y: { grid: { color: '#334155' }, ticks: { color: '#64748b', font: {size: 10} } } 
            } 
        }
    });
}

// --- EDIT & DELETE STOK ---
async function editProduct(id) {
    const p = products.find(i => i.id === id);
    const { value: f } = await Swal.fire({
        title: 'Edit Produk',
        html: `
            <input id="sw-n" class="swal2-input" value="${p.name}" placeholder="Nama">
            <input id="sw-p" type="number" class="swal2-input" value="${p.price}" placeholder="Harga">
            <input id="sw-s" type="number" class="swal2-input" value="${p.stock}" placeholder="Stok">
            <select id="sw-c" class="swal2-input"><option value="food">Makanan</option><option value="drink">Minuman</option><option value="snack">Cemilan</option></select>
        `,
        focusConfirm: false, showCancelButton: true, confirmButtonText: 'Simpan',
        preConfirm: () => ({ name: document.getElementById('sw-n').value, price: document.getElementById('sw-p').value, stock: document.getElementById('sw-s').value, category: document.getElementById('sw-c').value })
    });

    if (f) {
        await fetch(`/api/products/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(f) });
        loadData().then(renderStockTable);
        Swal.fire('Berhasil', 'Data diupdate', 'success');
    }
}

async function delHistory(id) { const {value:p}=await Swal.fire({title:'PIN',input:'password'}); if(p===MANAGER_PIN){await fetch(`/api/history/${id}`,{method:'DELETE'}); loadData().then(renderHistoryTable); Swal.fire('Terhapus','','success');} else Swal.fire('Salah','','error'); }
function renderHistoryTable() { document.getElementById('historyTableBody').innerHTML=history.map(t=>`<tr class="border-b border-[var(--border)] hover:bg-[var(--bg-input)] transition"><td class="p-4 text-[var(--text-muted)]">${new Date(t.date).toLocaleString()}</td><td class="p-4 font-mono text-xs">${t.id}</td><td class="p-4"><span class="px-2 py-1 rounded text-[10px] border border-[var(--border)] font-bold">${t.method}</span></td><td class="p-4 text-right font-bold">Rp ${t.total.toLocaleString()}</td><td class="p-4 text-center"><button onclick="delHistory('${t.id}')" class="text-red-500 hover:bg-red-500/10 p-2 rounded transition"><i class="fa-solid fa-trash"></i></button></td></tr>`).join(''); }

async function addNewProduct() { const n=document.getElementById('newName').value, p=document.getElementById('newPrice').value, s=document.getElementById('newStock').value, c=document.getElementById('newCategory').value; if(n&&p) { await fetch('/api/products',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:n,price:p,stock:s,category:c})}); loadData().then(renderStockTable); Swal.fire({toast:true,icon:'success',title:'Ditambah',position:'top-end',showConfirmButton:false,timer:1000}); } }
async function delProd(id) { if(confirm('Hapus?')) { await fetch(`/api/products/${id}`,{method:'DELETE'}); loadData().then(renderStockTable); } }

function renderStockTable() { 
    document.getElementById('stockTableBody').innerHTML=products.map(p=>`
        <tr class="border-b border-[var(--border)] hover:bg-[var(--bg-input)] transition">
            <td class="p-4 font-bold text-sm">${p.name}</td>
            <td class="p-4 text-xs uppercase text-[var(--text-muted)]">${p.category}</td>
            <td class="p-4 font-mono text-xs">Rp ${p.price.toLocaleString()}</td>
            <td class="p-4 text-center font-bold">${p.stock}</td>
            <td class="p-4 text-center flex justify-center gap-2">
                <button onclick="editProduct(${p.id})" class="text-blue-500 hover:bg-blue-500/10 p-2 rounded transition"><i class="fa-solid fa-pen"></i></button>
                <button onclick="delProd(${p.id})" class="text-red-500 hover:bg-red-500/10 p-2 rounded transition"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>`).join(''); 
}



