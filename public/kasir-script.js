// --- CONFIG (MODE OFFLINE / LOCALSTORAGE) ---
const USERS = { "fatih": "111006", "mala": "030107", "roy": "1234", "kasir1": "1", "kasir2": "2" };
let CURRENT_USER = sessionStorage.getItem('username') || "";
let products = [], history = [], cart = [], payMethod = 'TUNAI', currentCategory = 'all';
let salesChart = null;

// INIT
window.onload = () => {
    loadData();
    if(sessionStorage.getItem('isLoggedIn') === 'true' && CURRENT_USER) showApp();
};

// DATA LOAD
// BAGIAN PENTING: Mengambil data dari server, bukan LocalStorage
async function loadData() {
    try {
        const response = await fetch('/api/init'); // Memanggil route di server.js
        const data = await response.json();
        products = data.products;
        history = data.history;
        renderProducts();
        if(!document.getElementById('statsModal').classList.contains('hidden')) calcStats();
    } catch(e) { 
        console.error("Gagal sinkron database:", e);
    }
}

// Saat checkout, kirim ke server
async function processTrx(total, bayar, kembali) {
    const trxData = {
        id: 'INV-' + Date.now().toString().slice(-6),
        date: new Date().toISOString(),
        items: cart,
        total, method: payMethod, cashier: CURRENT_USER
    };

    const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trxData)
    });

    if(res.ok) {
        Swal.fire('Berhasil!', 'Data tersimpan di Cloud', 'success');
        cart = [];
        renderCart();
        loadData(); // Refresh data dari server agar stok sinkron
    }
}

function saveData() {
    localStorage.setItem('pos_products', JSON.stringify(products));
    localStorage.setItem('pos_history', JSON.stringify(history));
}

// LOGIN
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
        Swal.fire({icon: 'error', title: 'Login Gagal', text: 'Periksa username & password'});
    }
}

function showApp() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
    document.getElementById('displayUsername').innerText = CURRENT_USER;
    renderProducts();
    renderCart();
}

function handleLogout() {
    sessionStorage.clear();
    location.reload();
}

// PRODUCT GRID
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
            const isCrit = p.stock <= 5;
            grid.innerHTML += `
            <div onclick="addToCart(${p.id})" class="product-card ${p.stock<=0?'opacity-50 grayscale':''}">
                <div class="p-icon"><i class="fa-solid ${p.icon || 'fa-box'}"></i></div>
                <div class="text-sm font-bold text-white mb-1 truncate">${p.name}</div>
                <div class="text-blue-400 font-extrabold text-xs mb-3">Rp ${p.price.toLocaleString()}</div>
                <div class="flex justify-between text-[9px] font-black uppercase ${isCrit?'text-red-500':'text-slate-500'}">
                    <span>${p.category}</span><span>${p.stock} pcs</span>
                </div>
            </div>`;
        }
    });
}

// CART
function addToCart(id) {
    const p = products.find(i => i.id === id);
    if(p.stock <= 0) return Swal.fire({icon: 'error', title: 'Stok Habis', toast: true, position: 'top-end', timer: 1000, showConfirmButton: false});
    const ex = cart.find(i => i.id === id);
    if(ex) {
        if(ex.qty < p.stock) ex.qty++; else return Swal.fire({icon: 'warning', title: 'Stok Max', toast: true, position: 'top-end', timer: 1000, showConfirmButton: false});
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
            <button onclick="cart.splice(${i},1);renderCart()" class="text-red-500 w-8 h-8 rounded-full hover:bg-red-500/10 flex items-center justify-center"><i class="fa-solid fa-trash-can text-xs"></i></button>
        </div>`;
    });
    document.getElementById('totalDisplay').innerText = `Rp ${t.toLocaleString()}`;
    document.getElementById('cartCount').innerText = `${cart.length} Item`;
    return t;
}

function setPay(m) {
    payMethod = m;
    document.querySelectorAll('.pay-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`btn-${m.toLowerCase()}`).classList.add('active');
}

// CHECKOUT
function checkout() {
    const t = renderCart();
    if(t === 0) return Swal.fire('Info', 'Keranjang Kosong', 'info');
    
    if(payMethod === 'TUNAI') {
        Swal.fire({
            title: 'Pembayaran Tunai',
            text: `Total: Rp ${t.toLocaleString()}`,
            input: 'number',
            background: '#1e293b', color: '#fff',
            confirmButtonText: 'BAYAR & CETAK',
            showCancelButton: true
        }).then(r => {
            if(r.isConfirmed) {
                const b = parseInt(r.value);
                if(b < t) return Swal.fire('Error', 'Uang Kurang!', 'error');
                processTrx(t, b, b-t);
            }
        });
    } else {
        processTrx(t, t, 0);
    }
}

function processTrx(total, bayar, kembali) {
    cart.forEach(c => {
        const p = products.find(i => i.id === c.id);
        if(p) p.stock -= c.qty;
    });

    const trx = {
        id: 'INV-' + Date.now().toString().slice(-6),
        date: new Date().toISOString(),
        items: [...cart],
        total, method: payMethod, cashier: CURRENT_USER
    };
    history.push(trx);
    saveData();

    // RENDER STRUK
    document.getElementById('p-kasir').innerText = CURRENT_USER.toUpperCase();
    document.getElementById('p-date').innerText = new Date().toLocaleString();
    document.getElementById('p-no').innerText = trx.id;
    
    let itemsHtml = '';
    trx.items.forEach(i => {
        itemsHtml += `
            <tr><td colspan="2" style="font-weight:bold; padding-top:4px;">${i.name}</td></tr>
            <tr>
                <td style="font-size:8pt">${i.qty} x ${i.price.toLocaleString()}</td>
                <td class="text-right">${(i.price*i.qty).toLocaleString()}</td>
            </tr>
        `;
    });
    document.getElementById('p-items-table').innerHTML = itemsHtml;
    document.getElementById('p-total').innerText = total.toLocaleString();
    document.getElementById('p-pay').innerText = bayar.toLocaleString();
    document.getElementById('p-kembali').innerText = kembali.toLocaleString();

    Swal.fire({icon: 'success', title: 'Berhasil!', timer: 800, showConfirmButton: false}).then(() => {
        window.print();
        cart = [];
        renderCart();
        renderProducts();
    });
}

// MODALS
function openStockModal() { document.getElementById('stockModal').classList.remove('hidden'); renderStockTable(); }
function renderStockTable() {
    const tb = document.getElementById('stockTableBody'); tb.innerHTML = '';
    products.forEach((p, i) => {
        tb.innerHTML += `<tr class="border-b border-slate-800"><td class="p-3 text-white">${p.name}</td><td class="p-3">Rp ${p.price.toLocaleString()}</td><td class="p-3"><input type="number" value="${p.stock}" onchange="products[${i}].stock=parseInt(this.value);saveData()" class="w-14 bg-slate-900 border border-slate-700 rounded px-2 text-white"></td><td class="p-3 text-center"><button onclick="products.splice(${i},1);saveData();renderStockTable()" class="text-red-400"><i class="fa-solid fa-trash-can"></i></button></td></tr>`;
    });
}
function addNewProduct() {
    const n = document.getElementById('newName').value, pr = document.getElementById('newPrice').value, st = document.getElementById('newStock').value, c = document.getElementById('newCategory').value;
    if(!n || !pr) return;
    products.push({id: Date.now(), name: n, price: parseInt(pr), stock: parseInt(st)||0, category: c, icon: 'fa-box'});
    saveData(); renderStockTable(); document.getElementById('newName').value='';
}

function showStatsModal() { document.getElementById('statsModal').classList.remove('hidden'); calcStats(); }
function calcStats() {
    const now=new Date(); now.setHours(0,0,0,0);
    let tD=0,tW=0,tM=0; const lb=[],dt=[]; 
    
    for(let i=6;i>=0;i--){
        let d = new Date(now); d.setDate(now.getDate()-i);
        lb.push(d.toLocaleDateString('id-ID',{weekday:'short'}));
        dt.push(0);
    }
    
    history.forEach(t=>{
        const d=new Date(t.date); const dZero = new Date(d); dZero.setHours(0,0,0,0);
        if(dZero.getTime()===now.getTime()) tD+=t.total; 
        if(d.getMonth()===now.getMonth()) tM+=t.total;
        
        const diff=Math.floor((now-dZero)/86400000); 
        if(diff<=6 && diff>=0) dt[6-diff]+=t.total;
        if(diff<=6) tW+=t.total;
    });

    document.getElementById('stat-today').innerText='Rp '+tD.toLocaleString();
    document.getElementById('stat-week').innerText='Rp '+tW.toLocaleString();
    document.getElementById('stat-month').innerText='Rp '+tM.toLocaleString();

    document.getElementById('historyTableBody').innerHTML = history.slice().reverse().map((t, idx) => `
        <tr class="border-b border-slate-800 text-[11px]">
            <td class="p-3">${new Date(t.date).toLocaleString()}</td>
            <td class="p-3 uppercase text-blue-400 font-bold">${t.cashier}</td>
            <td class="p-3 truncate max-w-[100px]">${t.items.map(i=>i.name).join(', ')}</td>
            <td class="p-3">${t.method}</td>
            <td class="p-3 text-right text-emerald-400">Rp ${t.total.toLocaleString()}</td>
            <td class="p-3 text-center"><button onclick="history.splice(${history.length-1-idx},1);saveData();calcStats()" class="text-red-400"><i class="fa-solid fa-trash-can"></i></button></td>
        </tr>
    `).join('');

    const ctx = document.getElementById('salesChart').getContext('2d'); if(salesChart) salesChart.destroy();
    salesChart = new Chart(ctx, {type:'bar',data:{labels:lb,datasets:[{label:'Omzet',data:dt,backgroundColor:'#3b82f6',borderRadius:5}]},options:{responsive:true, maintainAspectRatio: false, plugins:{legend:{display:false}}, scales:{y:{grid:{color:'#1e293b'}},x:{grid:{display:false}}}}});
}